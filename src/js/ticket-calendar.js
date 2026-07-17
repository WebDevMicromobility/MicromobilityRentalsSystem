// @ts-check
// Ticket "extras": directions link + add-to-calendar (.ics) for a booking ticket.
// First module extracted under the build-time include mechanism (see scripts/build-html.mjs
//). It runs in the app's global scope — functions declared here are
// global exactly as if they were still inline, so onclick="_ticketCal(i)" keeps working.
// Type-checked in isolation via `npm run lint` (tsc --noEmit, checkJs); app-provided
// globals are declared in src/js/app-globals.d.ts.

// Maps a branch name to a Google Maps directions link. Exact booth pins (lat,lng from
// the staff-provided Google Maps link) win; other branches fall back to a name search.
/** @type {Record<string,string>} */
const _BOOTH_PINS = { 'JCC': '21.624565,39.106812' }; // Corniche Circuit booth
/** @param {string} loc @returns {string} */
function _mapUrl(loc) {
  const pin = _BOOTH_PINS[loc];
  const q = pin || ({ 'Sharafeyah Branch': 'Sharafeyah, Jeddah' })[loc] || ((loc || 'Jeddah Corniche Circuit') + ', Jeddah');
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
}

/** @param {any} sess @returns {string} */
function _sessRawTime(sess) { const s = parseSlots(sess && sess.bike_slots); return (s && s._time) || '09:00 - 11:00'; }

/** RFC5545 text escaping. @param {string} s @returns {string} */
function _icsEsc(s) { return String(s).replace(/([,;\\])/g, '\\$1').replace(/\r?\n/g, '\\n'); }

/** UTC timestamp for DTSTAMP. @param {Date} [d] @returns {string} */
function _icsStamp(d) { d = d || new Date(); const p = (/** @type {number} */ n) => String(n).padStart(2, '0'); return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + 'T' + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + 'Z'; }

// v2 design: Google Calendar template URL for the ticket's "Add to calendar" ghost button.
// (The .ics download in _ticketCal below stays available and is what the tests exercise.)
/** @param {number} idx @returns {string} */
function _gcalUrl(idx) {
  try {
    const tkt = (S.lastTickets || [])[idx]; if (!tkt) return '';
    const sess = allSessions().find((/** @type {any} */ s) => s.id === tkt.sessionId);
    const m = String(_sessRawTime(sess)).match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    const d = String(tkt.sessionDate || '').replace(/-/g, '');
    if (d.length !== 8) return '';
    const sh = (m ? m[1] : '9').padStart(2, '0'), sm = m ? m[2] : '00', eh = (m ? m[3] : '11').padStart(2, '0'), em = m ? m[4] : '00';
    const loc = ((sess && sess.location) === 'JCC' ? 'Jeddah Corniche Circuit' : (sess && sess.location) || 'Jeddah Corniche Circuit');
    const e = encodeURIComponent;
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE'
      + '&text=' + e('MicroMobility Rental #' + tkt.queueNum)
      + '&dates=' + e(d + 'T' + sh + sm + '00/' + d + 'T' + eh + em + '00')
      + '&location=' + e(loc)
      + '&details=' + e('Your bicycle rental at the Jeddah Corniche Circuit. Booking #' + tkt.queueNum);
  } catch (e) { return ''; }
}

// Downloads an .ics event so the rider can add the session to their calendar (one tap on iOS/Android).
/** @param {number} idx */
function _ticketCal(idx) {
  try {
    const tkt = (S.lastTickets || [])[idx]; if (!tkt) return;
    const sess = allSessions().find((/** @type {any} */ s) => s.id === tkt.sessionId);
    const m = String(_sessRawTime(sess)).match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    const d = String(tkt.sessionDate || '').replace(/-/g, '');
    if (d.length !== 8) return;
    const sh = (m ? m[1] : '9').padStart(2, '0'), sm = m ? m[2] : '00', eh = (m ? m[3] : '11').padStart(2, '0'), em = m ? m[4] : '00';
    const loc = (sess && sess.location) || '';
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MicroMobility//Booking//EN', 'BEGIN:VEVENT',
      'UID:mm-' + tkt.queueNum + '-' + d + sh + sm + '@micromobility', 'DTSTAMP:' + _icsStamp(),
      'DTSTART:' + d + 'T' + sh + sm + '00', 'DTEND:' + d + 'T' + eh + em + '00',
      'SUMMARY:' + _icsEsc('MicroMobility Rental #' + tkt.queueNum),
      'DESCRIPTION:' + _icsEsc('Your bicycle rental at the Jeddah Corniche Circuit. Booking #' + tkt.queueNum),
      loc ? 'LOCATION:' + _icsEsc(loc + ', Jeddah') : '', 'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY',
      'DESCRIPTION:' + _icsEsc('MicroMobility rental in 2 hours'), 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'micromobility-' + tkt.queueNum + '.ics';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  } catch (e) { /* calendar export is best-effort */ }
}
