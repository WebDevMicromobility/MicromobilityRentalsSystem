import sqlite3
import json
import os
from flask import Flask, jsonify, request, send_from_directory

app = Flask(__name__)
DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'micromobility.db')

SCHEMA = """
CREATE TABLE IF NOT EXISTS customers (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT,
    phone         TEXT,
    password_hash TEXT NOT NULL,
    created_at    INTEGER NOT NULL,
    height        INTEGER
);

CREATE TABLE IF NOT EXISTS bikes (
    id     TEXT PRIMARY KEY,
    name   TEXT NOT NULL,
    size   TEXT NOT NULL,
    type   TEXT NOT NULL,
    colors TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available'
);

CREATE TABLE IF NOT EXISTS sessions (
    id           TEXT PRIMARY KEY,
    day          TEXT NOT NULL,
    session_date TEXT NOT NULL,
    capacity     INTEGER NOT NULL DEFAULT 12,
    status       TEXT NOT NULL DEFAULT 'closed',
    created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS queue_entries (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    email            TEXT,
    phone            TEXT,
    size             TEXT NOT NULL,
    type_preference  TEXT NOT NULL,
    paid             INTEGER NOT NULL DEFAULT 0,
    price            REAL NOT NULL DEFAULT 30,
    assigned_bike_id TEXT,
    session_id       TEXT NOT NULL,
    session_day      TEXT NOT NULL,
    session_date     TEXT NOT NULL,
    queue_num        INTEGER NOT NULL,
    status           TEXT NOT NULL DEFAULT 'waiting',
    registered_at    INTEGER NOT NULL,
    walk_in          INTEGER NOT NULL DEFAULT 0,
    customer_id      TEXT,
    FOREIGN KEY (assigned_bike_id) REFERENCES bikes(id),
    FOREIGN KEY (customer_id)      REFERENCES customers(id)
);
"""


def get_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with get_db() as conn:
        conn.executescript(SCHEMA)


def entry_to_dict(row):
    e = dict(row)
    e['paid'] = bool(e['paid'])
    e['walkIn'] = bool(e.pop('walk_in'))
    e['typePreference'] = e.pop('type_preference')
    e['assignedBikeId'] = e.pop('assigned_bike_id')
    e['sessionId'] = e.pop('session_id')
    e['sessionDay'] = e.pop('session_day')
    e['sessionDate'] = e.pop('session_date')
    e['queueNum'] = e.pop('queue_num')
    e['registeredAt'] = e.pop('registered_at')
    e['customerId'] = e.pop('customer_id')
    return e


def bike_to_dict(row):
    b = dict(row)
    b['colors'] = json.loads(b['colors'])
    return b


init_db()


# ── STATIC FILES ──────────────────────────────────────────────────────────────

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')


@app.route('/micromobilitylogo.jpeg')
def serve_logo():
    return send_from_directory('.', 'micromobilitylogo.jpeg')


# ── SESSIONS ─────────────────────────────────────────────────────────────────

@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM sessions ORDER BY session_date"
        ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route('/api/sessions', methods=['POST'])
def add_session():
    s = request.get_json()
    with get_db() as conn:
        exists = conn.execute(
            "SELECT id FROM sessions WHERE id = ?", (s['id'],)
        ).fetchone()
        if exists:
            return jsonify({'ok': False, 'error': 'session_exists'}), 409
        conn.execute(
            "INSERT INTO sessions (id, day, session_date, capacity, status, created_at) VALUES (?,?,?,?,?,?)",
            (s['id'], s['day'], s['session_date'], s.get('capacity', 12), 'closed', s['created_at'])
        )
    return jsonify({'ok': True})


@app.route('/api/sessions/<session_id>', methods=['PATCH'])
def patch_session(session_id):
    data = request.get_json()
    allowed = {'status', 'capacity'}
    sets, vals = [], []
    for key in allowed:
        if key in data:
            sets.append(f"{key} = ?")
            vals.append(data[key])
    if not sets:
        return jsonify({'ok': False}), 400
    vals.append(session_id)
    with get_db() as conn:
        conn.execute(f"UPDATE sessions SET {', '.join(sets)} WHERE id = ?", vals)
    return jsonify({'ok': True})


@app.route('/api/sessions/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    with get_db() as conn:
        bookings = conn.execute(
            "SELECT COUNT(*) FROM queue_entries WHERE session_id = ?", (session_id,)
        ).fetchone()[0]
        if bookings > 0:
            return jsonify({'ok': False, 'error': 'has_bookings'}), 409
        conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    return jsonify({'ok': True})


# ── QUEUE ENTRIES ─────────────────────────────────────────────────────────────

@app.route('/api/queue', methods=['GET'])
def get_queue():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM queue_entries ORDER BY session_id, queue_num"
        ).fetchall()
    return jsonify([entry_to_dict(r) for r in rows])


@app.route('/api/queue', methods=['POST'])
def add_queue_entry():
    e = request.get_json()
    with get_db() as conn:
        conn.execute("""
            INSERT INTO queue_entries
              (id, name, email, phone, size, type_preference, paid, price,
               assigned_bike_id, session_id, session_day, session_date,
               queue_num, status, registered_at, walk_in, customer_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            e['id'], e['name'], e.get('email', ''), e.get('phone', ''),
            e['size'], e['typePreference'], int(e.get('paid', False)),
            e.get('price', 30), e.get('assignedBikeId'),
            e['sessionId'], e['sessionDay'], e['sessionDate'],
            e['queueNum'], e['status'], e['registeredAt'],
            int(e.get('walkIn', False)), e.get('customerId')
        ))
    return jsonify({'ok': True})


@app.route('/api/queue/<entry_id>', methods=['PATCH'])
def patch_queue_entry(entry_id):
    data = request.get_json()
    col_map = {
        'status': 'status',
        'paid': 'paid',
        'assignedBikeId': 'assigned_bike_id',
        'price': 'price',
    }
    sets, vals = [], []
    for key, col in col_map.items():
        if key in data:
            v = data[key]
            if isinstance(v, bool):
                v = int(v)
            sets.append(f"{col} = ?")
            vals.append(v)
    if not sets:
        return jsonify({'ok': False, 'error': 'nothing to update'}), 400
    vals.append(entry_id)
    with get_db() as conn:
        conn.execute(f"UPDATE queue_entries SET {', '.join(sets)} WHERE id = ?", vals)
    return jsonify({'ok': True})


@app.route('/api/queue/<entry_id>', methods=['DELETE'])
def delete_queue_entry(entry_id):
    with get_db() as conn:
        conn.execute("DELETE FROM queue_entries WHERE id = ?", (entry_id,))
    return jsonify({'ok': True})


# ── BIKES ─────────────────────────────────────────────────────────────────────

@app.route('/api/bikes', methods=['GET'])
def get_bikes():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM bikes").fetchall()
    return jsonify([bike_to_dict(r) for r in rows])


@app.route('/api/bikes', methods=['POST'])
def add_bike():
    b = request.get_json()
    with get_db() as conn:
        conn.execute(
            "INSERT INTO bikes (id, name, size, type, colors, status) VALUES (?,?,?,?,?,?)",
            (b['id'], b['name'], b['size'], b['type'],
             json.dumps(b['colors']), b.get('status', 'available'))
        )
    return jsonify({'ok': True})


@app.route('/api/bikes/<bike_id>', methods=['PUT'])
def replace_bike(bike_id):
    b = request.get_json()
    with get_db() as conn:
        conn.execute(
            "UPDATE bikes SET name=?, size=?, type=?, colors=?, status=? WHERE id=?",
            (b['name'], b['size'], b['type'], json.dumps(b['colors']), b['status'], bike_id)
        )
    return jsonify({'ok': True})


@app.route('/api/bikes/<bike_id>', methods=['PATCH'])
def patch_bike(bike_id):
    data = request.get_json()
    sets, vals = [], []
    for key in ('status', 'name', 'size', 'type'):
        if key in data:
            sets.append(f"{key} = ?")
            vals.append(data[key])
    if 'colors' in data:
        sets.append("colors = ?")
        vals.append(json.dumps(data['colors']))
    if not sets:
        return jsonify({'ok': False}), 400
    vals.append(bike_id)
    with get_db() as conn:
        conn.execute(f"UPDATE bikes SET {', '.join(sets)} WHERE id = ?", vals)
    return jsonify({'ok': True})


@app.route('/api/bikes/<bike_id>', methods=['DELETE'])
def delete_bike(bike_id):
    with get_db() as conn:
        conn.execute("DELETE FROM bikes WHERE id = ?", (bike_id,))
    return jsonify({'ok': True})


# ── CUSTOMERS ─────────────────────────────────────────────────────────────────

@app.route('/api/customers', methods=['GET'])
def get_customers():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, name, email, phone, created_at FROM customers ORDER BY created_at"
        ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route('/api/customers', methods=['POST'])
def add_customer():
    c = request.get_json()
    with get_db() as conn:
        if c.get('email'):
            exists = conn.execute(
                "SELECT id FROM customers WHERE email = ?", (c['email'],)
            ).fetchone()
            if exists:
                return jsonify({'ok': False, 'error': 'email_exists'}), 409
        if c.get('phone'):
            exists = conn.execute(
                "SELECT id FROM customers WHERE phone = ?", (c['phone'],)
            ).fetchone()
            if exists:
                return jsonify({'ok': False, 'error': 'phone_exists'}), 409
        conn.execute(
            "INSERT INTO customers (id, name, email, phone, password_hash, created_at, height) VALUES (?,?,?,?,?,?,?)",
            (c['id'], c['name'], c.get('email', ''), c.get('phone', ''),
             c['passwordHash'], c['createdAt'], c.get('height'))
        )
    return jsonify({'ok': True})


@app.route('/api/customers/<customer_id>', methods=['PATCH'])
def patch_customer(customer_id):
    data = request.get_json()
    col_map = {'name': 'name', 'email': 'email', 'phone': 'phone', 'height': 'height'}
    sets, vals = [], []
    for key, col in col_map.items():
        if key in data:
            sets.append(f"{col} = ?")
            vals.append(data[key])
    if not sets:
        return jsonify({'ok': False}), 400
    vals.append(customer_id)
    with get_db() as conn:
        conn.execute(f"UPDATE customers SET {', '.join(sets)} WHERE id = ?", vals)
    return jsonify({'ok': True})


# ── AUTH ──────────────────────────────────────────────────────────────────────

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    identifier = (data.get('identifier') or '').strip().lower()
    pwd_hash = data.get('passwordHash', '')
    with get_db() as conn:
        row = conn.execute(
            """SELECT id, name, email, phone, height, created_at FROM customers
               WHERE (LOWER(email) = ? OR phone = ?) AND password_hash = ?""",
            (identifier, identifier, pwd_hash)
        ).fetchone()
    if not row:
        return jsonify({'ok': False, 'error': 'invalid_credentials'}), 401
    return jsonify({'ok': True, 'customer': dict(row)})


# ── CUSTOMER STATS ────────────────────────────────────────────────────────────

@app.route('/api/customers/<customer_id>/stats', methods=['GET'])
def customer_stats(customer_id):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT status, paid, price FROM queue_entries WHERE customer_id = ?",
            (customer_id,)
        ).fetchall()
    entries = [dict(r) for r in rows]
    total = sum(1 for e in entries if e['status'] != 'noshow')
    completed = sum(1 for e in entries if e['status'] == 'done')
    total_paid = sum(e['price'] for e in entries if e['paid'])
    pending = sum(e['price'] for e in entries if not e['paid'] and e['status'] in ('done', 'waiting', 'active'))
    return jsonify({
        'totalBookings': total,
        'completed': completed,
        'totalPaid': total_paid,
        'pendingPayment': pending,
    })


if __name__ == '__main__':
    print("Starting MicroMobility server at http://localhost:5000")
    app.run(debug=True, port=5000)
