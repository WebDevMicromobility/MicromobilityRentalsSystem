# SCREENS.md — MicroMobility Rentals

Every screen and modal in the customer app and the staff panel: purpose, how it is reached,
every element on it, and what each control does.

**Copy**: the exact user-facing strings for every screen are in **§13, the copy appendix**,
generated from the `LANG` object — 1,734 keys × 3 languages (EN / AR / ES), full parity
enforced by CI. Inline below, strings are referenced by key (e.g. `regStep1Title`) and quoted in
English; look the key up in §13 for the Arabic and Spanish.

**Architecture**: one single-page app. There is no routing library — a `showView()` call swaps
which of `#view-landing`, `#view-customer`, `#view-staff` is visible, and `body` carries
`view-landing` / `view-picker` / `view-customer` / `view-staff` which the CSS keys off. Every
modal is a **pre-declared empty `<div>`** at the end of `<body>` ([app.src.html:304](../app.src.html#L304)–[332](../app.src.html#L332))
that its render function fills with `innerHTML` and shows with `style.display='flex'`.

---

## 0. Persistent chrome (present on every screen)

### 0.1 Top bar — `#topbar`

| Element | Behaviour |
|---|---|
| Logo button (`.topbar-logo`, `#topbar-logo-img`) | `goLanding()`. `aria-label="MicroMobility home"`. Image swaps `logo.png` ⇄ `logo-dark.png` by theme |
| Language button `#lang-btn` | `showLangMenu(event)` → a floating `role="listbox"` with **🇺🇸 ENG / 🇸🇦 عربي / 🇪🇸 ESP**. Label shows the current flag + short code + ▾ |
| Theme toggle `#theme-toggle-btn` | `toggleTheme()`, `aria-label`/`title` = "Sunlight mode" |
| `#topbar-right` | Rendered by `renderTopbarRight()` — signed-out: a **Sign in** affordance; signed-in customer: name + email (`.cust-topbar-name`, `.cust-topbar-email`, forced LTR); staff: operator name, role segmented control, staff theme toggle, **Lock** |

### 0.2 Customer navigation

- **Desktop**: `#customer-tab-nav` — three `.tab-btn`s: `tabReserve`, `tabMyRides`, `tabAccount`.
- **Mobile**: `#cust-bottom-nav`, a fixed bottom bar with three icon buttons (bicycle, calendar,
  person) and labels `#bnav-reserve-lbl` / `-myrides-lbl` / `-account-lbl`.
- **Back**: `#cust-back-btn` (`custBack()`) — visible on all customer tabs, label
  `‹ regBackBtn`. The chevron carries `.mirror-rtl` so it flips in Arabic. It walks the wizard
  back a step, else returns to the event picker.

### 0.3 Staff navigation — `#staff-tab-nav`

A left rail, grouped by `.snav-group` headers: **Rides** (`snavRides`) · **Commerce**
(`snavCommerce`) · **People** (`snavPeople`) · **Insights** (`snavInsights`) · **System**
(`snavSystem`), over seven tabs:

| Tab | `data-stab` | Copy key | Front-desk sees it? |
|---|---|---|---|
| Bookings | `queue` | `tabQueue` | ✅ |
| Sales | `cashier` | `tabCashier` | ✅ |
| Inventory | `inventory` | `tabInventory` | ❌ |
| Community | `community` | `tabCommunity` | ❌ |
| Analytics | `analytics` | `tabAnalytics` | ❌ |
| History | `history` | `tabHistory` | ❌ |
| Notes | `notes` | `tabNotes` | ❌ |

`#rail-pin` toggles pinned vs hover-expand (`aria-pressed`, `localStorage.cq_rail`).
The **Inventory** tab carries a `.tab-badge` with the count of items at or below their low
threshold, `title`/`aria-label` = `invLowAlert` ("{0} low stock").

### 0.4 Footer — `#app-footer`

Four `.footer-social-link` icons: **Instagram** (`instagram.com/MicroMobilitySA`), **WhatsApp**
(`wa.me/966566668818`), **Email** (`info@micromobility.sa`), **Phone** (`tel:+966566668818`).
Each has a `title` and an `aria-label` ending "(opens in a new tab)".
`#footer-copy` = `footerCopy` → "© 2026 MicroMobility. All Rights Reserved".

### 0.5 Global overlays

| Element | Purpose |
|---|---|
| `#loading-screen` | `brand.png` + `#ld-txt` ("Loading..." / "جارٍ التحميل..." / "Cargando..."), set **before the app script parses**. Auto-hides after **5 s** even if boot stalls |
| `#toast-container` | `role="status" aria-live="polite"`. `toast(msg, kind)` — kinds: default (green edge), `error` (red), `warning` (grey) |
| Undo bar (`#undo-bar-btn`) | `showUndoBar()` — appears after every destructive staff action with a countdown; copy `undoBtn`, `undoneMsg`, `undoFailed` |
| `#confirm-modal` | Generic confirm dialog (`confirmDialog({title, body, confirmLabel, confirmClass, onConfirm})`). **`z-index:300`** so it outranks whatever raised it |
| `#booth-popup` | Kiosk/booth announcement — title, message, an extra info panel, and a × close |
| Error bar | `errorBar(msg, retry, detail)` — a persistent bar for write failures, unlike a toast |

---

## 1. Landing / event picker — `#view-landing`

**Purpose**: the front door, and the signed-in event chooser.
**Reached**: app entry; the logo; `goLanding()`; browser Back from a customer tab.

### 1.1 Hero

| Element | Content |
|---|---|
| `.landing-ghost` | Huge outlined watermark "MICROMOBILITY", `aria-hidden` |
| `#land-eyebrow` | `landEyebrow` — "Rides & Events" |
| `#land-main-title` | "Reserve Your **Bicycle Now!**" — hard-coded per language: AR "احجز **دراجتك الآن!**", ES "¡Reserva tu **bicicleta ahora!**" |
| `#land-sub` | `landingSub` |
| `#land-auth-cta` | Sign-in / sign-up call to action (signed-out only) |
| `.landing-hero-card` | `hero.webp`, `landHeroClick()`, `aria-label="Jeddah Corniche Circuit"`, with a circular arrow `#land-cta-arrow` (`→`, flipped to `←` in Arabic) |
| `.sector-stripes` | Three decorative angled bars, `aria-hidden` |

### 1.2 Event cards — `#land-events`

**Exactly two cards, always both shown**, whatever the session list holds:

1. **Evening Circuit Session** — `landJccCardTitle` / `landJccTitle`, meta `landJccMeta`
   ("Sun & Tue · 9-11pm · Road, Hybrid & Mountain"), JCC logo (`jcc.png`, `jcc-white.png` on dark).
2. **Micromobility Rides** — `landCommTitle`. **Logo only, no description** (this was changed
   deliberately). Umbrella over *every* non-JCC ride.

Clicking sets `S.selEvent` and enters the Reserve wizard. The community card runs the **members
gate** first (§1.4).

### 1.3 Availability strip — `#land-avail-strip`

`renderLandingAvail()` ([app.src.html:3807](../app.src.html#L3807)). One `.landing-avail-row`
per upcoming open session: a status dot, `.landing-avail-date`, `.landing-avail-time`, and
`.landing-avail-spots`.

- **Empty state**: `noSessions`.
- **All full**: `sessAllFull`.
- **A full session**: `statusFull`; otherwise `availLabel`.
- **`landChooseEvent`** prompts the choice.

> **Community sessions never show a computed spot count here** — only the staff-set full flag.

### 1.4 Members-only dialog — `showCommMembersModal()`

**Reached**: a non-member taps a community ride (event card, session card, or submit).

| Element | Key |
|---|---|
| Title | `commMembersTitle` — "Community members only" |
| Body | `commMembersMsg` |
| WhatsApp button | `wa.me/966534423513` — **+966 53 442 3513** (note: a *different* number from the footer's) |
| Instagram button | `commMembersIg` → `instagram.com/MicroMobilitySA` |
| Dismiss | `commMembersOk` ("Got it"), `closeBtn` |

Links carry `opensNewTab` for screen readers.

### 1.5 Staff access — `.landing-footer`

`#land-staff-btn` (`staffAccessClick()`), label `staffAccess`. Deliberately subtle. Also
reachable at `/staff` or `?staff`.

---

## 2. Authentication — `#auth-modal`

`renderAuthModal()` ([app.src.html:2889](../app.src.html#L2889)) — **42 copy keys**, five modes
in one modal, switched by `S.authMode` / `S.forgotStep`.

### 2.1 Sign in (`authMode='login'`)

`.auth-tabs` with `authLogin` / `authSignup`; `.auth-logo`; title `authWelcome`; sub `authSub`.

| Field | Key | Notes |
|---|---|---|
| Identifier | `authIdentifier` | **email or phone**; placeholder `enterEmailOrPhone` |
| Password | `authPassword` | |
| Remember me | `rememberMe` | **defaults ON** — session-only storage evaporates on iOS, logging customers out on every app switch |
| Submit | `authLoginBtn` | |
| Forgot | `forgotPwLink` | |
| OAuth | `continueGoogle`, `continueApple`, separator `authOr` | |

### 2.2 Sign up (`authMode='signup'`)

`firstName` + `lastName` (placeholders `phFirstName`, `phLastName`), `authEmail`, `authPhone`
with a **country-code picker** (`.auth-cc-row`, default `+966`, ~200 countries), `authPassword` +
`authConfirmPassword` with `authPasswordHint`, `heightLabel` (`heightPlaceholder`), `genderLabel`
(`genderMale` / `genderFemale`), submit `authSignupBtn`.

### 2.3 Forgot password (two steps)

- Step 1 — `forgotStep1Title`, `forgotStep1Sub`: email (`enterEmail`) **and** phone
  (`enterPhone`), verified together via `customer_reset`. Button `forgotVerifyBtn`.
- Step 2 — `forgotStep2Title`, confirmation `forgotVerifiedMsg`, new password, `resetBtn`.
- `backToLogin` returns.

### 2.4 Google completion (`openGoogleComplete`)

Shown when a Google account has no profile yet: `gCompleteTitle`, `gCompleteSub`, then phone,
height, gender; `finishBtn`.

### 2.5 Error states

`authErr()` renders into `.auth-err`. Notable: **`iabGoogleBlocked`** — Google sign-in is
blocked inside in-app browsers (Instagram, Facebook), which the app detects and explains.
`errNoInternet` vs `errConnection` are distinguished ([app.src.html:3188](../app.src.html#L3188)).

### 2.6 Staff sign-in — `#pin-modal`

`renderPinModal()` ([app.src.html:5132](../app.src.html#L5132)) — the numeric PIN pad
(`.pin-numpad`, `.pin-key`, `.pin-dots`) plus the Supabase Auth email/password path.
`openStaffPwdModal()` forces a password change when `must_change_pwd` is set.
Lockout escalates **1, 2, 5, 10, 15, 30, 45, 60, 120 minutes** and shows a live countdown
(`_fmtLock()` → "45s", "2m 10s", "1h 30m").

---

## 3. Reserve — `#tab-register`

`renderRegister()` ([app.src.html:5289](../app.src.html#L5289)) — **436 lines, 69 copy keys**.
A **three-step wizard** with a `.reg-stepper` (`regProg1` Session · `regProg2` Riders ·
`regProg3` Confirm; `role="group"`, `aria-label="<n> / 3"`), passed steps ticked. A fourth
implicit state shows tickets.

### 3.1 Step 1 — Session

Header `regStep1Title` / `regStep1Msg`.

**Session list** — only sessions matching the chosen event (`_evMatch`), status `open` or
`full`, sorted by date. Each `.sess-card` carries `_evClass(s)` (blue/green/red) and shows:

- a `.sess-card-dot` (filled when selected),
- `.sess-card-date` — `dayLabel(day) · shortDate(date)`,
- `.sess-comm-chip` with `_evName(s)` (community only),
- `.sess-card-time` — `sessionTime(s)`; an **approval ride shows "gathering · start"**, everything
  else a plain range,
- `.sess-card-spots` — `waitlistLabel` when the session is `full`, else `availLabel`, coloured
  `spots-red` / `spots-low` (≤3 left) / `spots-green`.

> **An approval ride never shows the low-spots hint** — customers only ever see "waitlist" once
> staff explicitly mark the session full.

**Empty state**: `noSessionsAvail` + `noSessionsSocial` + an Instagram button (`@MicroMobilitySA`).

**Full-session notice**: `commFullWaitlistMsg`.

**"Book my usual"** — `bookUsualBtn`, shown only to a returning customer when an open session
exists. One tap re-books with remembered height/type/time-of-day. **Never picks a community
session.**

**Footer**: `regContinueBtn`, disabled (opacity .4, `cursor:not-allowed`) until a session is chosen.

### 3.2 Step 2 — Riders

Header `regStep2Title` / `regStep2Msg`.

| Control | Behaviour |
|---|---|
| Quantity stepper | `numBikes`, `.qty-stepper` with `qtyDecLabel` / `qtyIncLabel`. Range **1–10** (JCC), **1–4** on the Petromin ride (hint `groupCapHint` = "Up to {0} riders"), **locked to 1** on the Saturday ride |
| Per rider: name | `riderName` / `riderNamePlaceholder`. Rider 1 defaults to the account holder |
| Per rider: height | `heightLabel` + `heightHint`, `heightPlaceholder`, min 100 max 250 cm → **auto-size** XS/S/M/L |
| Per rider: bike type | `bikeTypePref` — `bikeTypeOpts()`: JCC gets Any/Road/Hybrid/Mountain/Road Carbon; community gets Any/Road/Hybrid/Mountain/**Own** |
| Add-ons | `addonsLabel` — inventory items with photos and quantity steppers, stock-capped; sold-out becomes a backorder up to 10 |
| Promo code | `.reg-promo` + `applyPromoCode()`. **JCC only.** Messages: `promoInvalidMsg`, `promoExpiredMsg`, `promoUsedUpMsg`, `promoNotYoursMsg` |
| Price preview | Per bike: `pricePerBike`, or per-rider `priceDisplay(ty)`; **`onTheHouseLabel`** when the house perk applies; `freeLabel` on a free ride |
| Account block | Name / email / phone read-only, with `needToUpdate` → link to `tabAccount` |
| Footer | `regBackBtn` · `regReviewBtn` |

**Modify mode**: if the customer already has a `waiting`/`waitlist` booking on the selected
session, the wizard switches to editing it — a green banner (`modifyBookingBtn`,
`queueNumLabel`, per-bike chips, `modifyBanner`) and the confirm button becomes
`modifyBookingBtn`. **Community approval rides are never editable this way** — a Saturday
booking is managed only from My Rides, cancel-only.

### 3.3 Step 3 — Review & confirm

Header `regStep3Title` / `regStep3Msg`. `.reg-summary-panel` with `reviewSessionLabel`,
`bookedByLabel`, `reviewRidersLabel (n)`, a per-rider row (name, `typeBadge`, height in
`cmUnit`, price), add-ons, and `.reg-summary-total` = `reviewTotalLabel`.

Footer: `regBackBtn` · `regConfirmBtn` (or `modifyBookingBtn`). While submitting the button is
disabled and shows an ellipsis.

**Already-booked banner** (`#already-booked-banner`): `errAlreadyBooked` + `errAlreadyBookedSub`
and a `modifyExistingBtn` button; scrolled into view on trigger.

### 3.4 Step 4 — Ticket(s)

`renderBookingTicket()` ([app.src.html:6268](../app.src.html#L6268)) — **31 copy keys**. One
`.ticket-card` per rider; multi-rider bookings label each "Bike i / n".

| Ride | Ticket shows |
|---|---|
| **Circuit** | `.ticket-num` — the big **queue number**, label `queueNumLabel`; QR of `MMC-<num>-<id6>` |
| **Circuit, waitlisted** | `.ticket-num-label.wl-loud` — `waitlistLabel` + `· W<n>` |
| **Community** | The **ride title** instead of a number (`landCommTitle` fallback), plus an orange cue: `commCuePending` or `commCueWaitlist`. **No number, no QR** |

Detail columns: `colSession`, `timeLabel`, `nameLabel`.

Actions:
- `ticketAddCal` → `downloadBookingICS()`;
- `ticketDirections` → the circuit pin, **or** `meetPointLbl` → the ride's meeting point on a
  community ticket;
- `addToWallet` (`.btn-wallet`) — **circuit bookings only**, and only when `_hasWallet()`;
- `ticketNotice` — the pay-at-the-booth note.

---

## 4. My Rides — `#tab-myrides`

`renderMyRides()` ([app.src.html:6813](../app.src.html#L6813)).

Bookings are grouped by customer+session, soonest first, split into upcoming and past.

**Circuit card**: queue number(s) large, status badge, live cue (`youreNextMsg` / position),
per-rider rows (#num, name, type, assigned bike once known, price, paid/pending), add-ons with
an edit affordance, and actions **Edit** (jumps to wizard step 2), **Reschedule**, **Cancel**.
QR with the numbered reference.

**Community card**: the ride **title** instead of numbers, an approval cue —
pending (orange) / confirmed (green) / waitlist — meeting point and breakfast links, and
**Cancel only** (no edit, no reschedule, no add-ons). QR uses the **number-free** ref.

**Past rides**: `bookAgainBtn` (prefills the wizard) and ratings.

**Empty state**: `.rides-empty` / `.rides-zero`.

### 4.1 Rating modal — `#rate-modal`

`renderRateModal()` ([app.src.html:6618](../app.src.html#L6618)). Two 1–10 scales — bike and
experience — plus free-text feedback. A pending post-ride rating is **prompted on any customer
tab** and is mandatory (`tests/forced-rating.spec.ts`).

### 4.2 Cancel — `#cancel-reason-modal`

`showCancelReasonModal()` ([app.src.html:10427](../app.src.html#L10427)) — reason picker before
confirming. Cancels the **whole party**.

### 4.3 Reschedule — `#reschedule-modal`

`showRescheduleModal()` ([app.src.html:10480](../app.src.html#L10480)) — move to another open
session, renumbering safely. Not offered for community bookings.

---

## 5. My Account — `#tab-account`

`renderAccount()` ([app.src.html:6863](../app.src.html#L6863)) — **37 copy keys**.

Profile: first / middle / last name, email, phone with country picker, height, gender, birth
date, country, city, favourite bike type, **profile photo** (Supabase Storage upload with a
data-URL fallback), and a **profile-completeness percentage**. Plus change password, and log out.

Height and bike type **prefill the booking wizard every time**.

---

## 6. Staff — Bookings (`#tab-queue`)

The densest screen. `renderStaffQueue()` ([app.src.html:9448](../app.src.html#L9448)) dispatches
to **three views** via `S.queueView`, chosen by `.filter-pill`s:

| View | Value | Renderer |
|---|---|---|
| Sessions | `sessions` | `renderSessions()` |
| Bookings | `bookings` | the roster (table on desktop, `.q-card`s on mobile) |
| **Waitlist** | `managed` | `renderManagedWl()` |

> A device still pointing at the removed `'waitlist'` view is **redirected to `managed`**, not
> left on a blank tab.

### 6.1 Bookings view

**Session summary chips** — one `.sess-summary-chip` per open session with waiting / on-bike /
done counts and a fill bar. Community chips carry the ride colour (customer side) or plain
green/ink (staff layer).

**Filter bar**:

| Control | Options |
|---|---|
| Session | `allSessions` + every session |
| Status | `filterStatus`: all / Expected / On Bike / Completed / No-show / Cancelled; on a community session: Approved / Pending / Waitlist / Rejected |
| Payment | `filterPay`: all / paid / pending |
| Bike | `bikeTypeLabel`: All / **Bike owner** / **Rental bike** / Road / Mountain / Hybrid |
| Size | `filterSize`: all / XS / S / M / L |
| Search | `#sf-search-input`, placeholder **`searchPlaceholder`** = "Booking number, name or phone…" |
| Scan | `scanBtn` → `openScanModal()` |
| Density | `.density-btn` — compact / comfortable |
| Result count | `#q-result-count` — "N `resultOf` M `resultRiders`", shown only when filtered |

Search behaviour is specified in BUSINESS-RULES.md §19 — number from the first digit, `W`
prefix for waitlist position, and **party widening**.

**Rows** — `renderQRow()` ([app.src.html:9639](../app.src.html#L9639)), **480 lines, 78 copy
keys**. Per row: queue number, name, contact (call + WhatsApp circles), type badge, size,
payment cell (`.pay-toggle`), status badge, and an actions cell that varies by status:

| Status | Actions |
|---|---|
| `waiting` | **Check in** (opens the quick modal), No-show, Edit booking, Note, Cancel |
| `waitlist` | same, plus an editable **W** position box |
| `active` | Change bike, **Return bike**, add POS sale, Undo check-in, Cancel |
| `done` | Reopen, Remove |
| `noshow` | "Customer showed", Remove |
| `cancelled` | Restore (with an over-capacity confirm), Remove |
| community `pending` | **Approve** / **Reject** / move to Waitlist |
| community `approved` | chip + Undo approval |

**Bulk bar**: select-all checkbox, mark paid, bulk check-in.
**Keyboard**: `N` checks in the next waiting rider.
**Roster limit**: 150 rows with "Show N more" **only on All Sessions**; a chosen session lists
in full (BUSINESS-RULES.md §20).

### 6.2 Waitlist view — `renderManagedWl()`

Title `wlTitle`, sub `mwSub`.

| Control | Purpose |
|---|---|
| `#mw-sess` | Session filter (`allSessions` + sessions) |
| `#mw-name` | Search — placeholder `mwSearchPh` "Booking number, name or phone…" |
| `#mw-phone` | Phone for a new walk-up |
| `#mw-browse` | `mwBrowseBtn` / `mwHideBtn` — browse all addable bookings (`aria-expanded`) |
| `+ mwAddBtn` | Add the typed person to the list |
| `wlAddBtn` | Open the multi-rider walk-up modal |
| `#mw-suggest` | Picker: `mwFromBookings` / `mwFromCustomers` headers, `.mw-sug` rows showing `#num` or `W<n>`, name (with `+N` for a party), and meta; empty → `mwNoMatches` |

**Rows** are one `.q-card` per party. Each carries a position box, the rider's name, an orange
`#num · W<n>` chip, an editable **W** box, `_mwTypeCell` (bike type), the pay cell, contact
buttons, `beAddRiderBtn` (+ add rider), the booking's own actions, and `wlRemoveBtn`.
Party cards add a header with the group name, a `.mw-party-chip` ("N riders"), `bulkPaidBtn`
and `bulkCheckinBtn`.

**The list is a union** of `desk_waitlist` rows and *every waitlisted booking* not already on it
(DATA-MODEL.md §1.4). Folded-in rows **hide** the position box, the list Remove and dragging,
because they have no `desk_waitlist` row to write to.

Empty states: `wlEmpty`, or `mwEmptyForSess` when a session filter hides everything.

### 6.3 Sessions view — `renderSessions()`

**486 lines, 80 copy keys.** A two-pane browser (list + detail with riders).

Create / edit / clone / open / close / mark-full / delete (**blocked while booked**; deleted are
restorable). Fields differ by event:

- **JCC**: date, repeat 1–12 weeks, time range, capacity by per-type/size counts (`.type-count-box`)
  or explicit bike assignment.
- **Saturday**: title, **spots (1–500)**, gathering + start times, meeting-point URL, breakfast
  spot picker, `needs_approval` and `hide_queue` true.
- **Petromin**: title, **bike composition** (like JCC), plain start–end times, **no meeting point
  or breakfast fields**, `needs_approval` false, `paid_ride` true.

Waitlist cap control (`wlCapLabel`, `wlCapCount` / `wlCapPct`) writes `_wl` into `bike_slots`.

### 6.4 Booking modals

| Modal | Function | Purpose |
|---|---|---|
| `#checkin-modal` | `renderCheckinModal()` | **Quick check-in** — payment row (`pendingLabel`, paid·cash, paid·card, `splitWord`…, `onTheHouseLabel`), bike type row, a link to the full bike picker, `confirmCheckin`. The payment row is hidden on a free ride |
| `#bike-modal` | `renderModal()` (273 lines, 50 keys) | **Bike picker** — search, size/brand/model filters, sort, preferred-type group then others, availability, add-a-bike inline |
| `#walkin-modal` | `showWalkinModal()` | Walk-in booking with no account: name (datalist of customers), phone, height, type, session, multi-rider rows. **Bails with a toast if no session is loaded** |
| `#jcc-group-modal` | `showJccGroupModal()` | Group booking at the desk: group name, contact, phone, per-rider rows |
| `#comm-add-modal` | `renderCommAddModal()` | Add a rider to a community ride — customer search with a members chip, destination (final list / waitlist), **"rider brings their own bike"** checkbox |
| `#group-edit-modal` | `showGroupEditModal()` | Edit a whole party: group name/contact/phone, move the party to another session, per-member fields |
| `#booking-edit-modal` | `showBookingEditModal()` | Edit one booking |
| `#booking-note-modal` | `showBookingNoteModal()` | Staff note against a booking |
| `#edit-price-modal` | `showEditPriceModal()` | Override the price |
| `#qnum-edit-modal` | `showEditQNumModal()` | Change a queue number |
| `#return-pay-modal` | `showReturnPayModal()` | Payment prompt on bike return |
| `#scan-modal` | `openScanModal()` | QR scanner — `scanTitle`, `scanHint`, live video, `#scan-msg`, **continuous mode** (`scanContBtn`) and a tally (`scanTally`) |
| `#op-gate-modal` | `showOpGate()` | Asks the operator's name for the audit trail |

---

## 7. Staff — Sales / POS (`#tab-cashier`)

`renderCashier()` ([app.src.html:15098](../app.src.html#L15098)) — **57 copy keys** — plus
`renderCashierModal()` (20 keys), `showReceipt()` (16), `renderReceiptEdit()` (10),
`renderTeamManager()` (7).

Cart of inventory items plus custom lines; quantities; **discounts** (% or SAR → a negative
`__discount__` line); payment **cash / card / split** (split writes a `__cardmeta__` meta line);
**MM Team** (`pay='team'` with an editable roster); **on the house**. Multi-item branded
receipts, shareable; edit receipt; **refunds** (`pay='refunded'`, restocks); mark-paid; link a
sale to a booking or customer. Offline outbox plus the voided-ids guard.

---

## 8. Staff — Inventory (`#tab-inventory`)

`renderInventory()` ([app.src.html:15362](../app.src.html#L15362)) — **65 copy keys** — and
`renderBikes()` ([app.src.html:12945](../app.src.html#L12945)) — **71 copy keys** — share the
tab via `S.invSection`.

- **Inventory**: equipment and supplements, brands / categories / flavours / subcategories,
  photos, cost and price, **low-stock badges**, reorder suggestions, a nutrition panel
  (`showNutrition()`), grid ⇄ table view.
- **Bikes**: fleet CRUD — name, size, type, brand, model, groupset, speeds, colours (a colour
  builder with named slots), location, frame type, bike number, in-service / retired dates,
  photo, status. Filters by type / status / size, search, sort, show-retired toggle.
  `openBikeProfile()` (23 keys) shows one bike's history.

---

## 9. Staff — Community (`#tab-community`)

`renderCommunity()` ([app.src.html:15951](../app.src.html#L15951)) — **39 copy keys**.

- **Leaderboard**: rider ranking with scope (owner / all), window, branch, metric; a KPI strip;
  a #1 spotlight with tier progress; milestone watch; a shareable image; upcoming rides.
- **Accounts & tags**: customer list with search and tag filter; per-customer tag chips showing
  validity ("until 12 Aug 2026" / "from 10 Aug 2026" / dimmed "expired"); tag editor.
  - **`renderTagGrantModal()`** — grant a tag as **Permanent**, or **Temporary** with either a
    duration preset (1d / 3d / 1w / 2w / 1m / 3m / 6m / 1y) or explicit start and end dates, with
    a **"Today"** checkbox under the start date (pre-checked, locks start to today). **End date
    is inclusive.**
  - Tag CRUD (name / colour / description), system tags locked, member counts show **active**
    holders only.
- **Customer admin**: `renderCustFormModal()` (34 keys) — create an account, edit the full
  profile, set a password, and **Delete account** (Admin only — see BUSINESS-RULES.md §18);
  `openCustomerProfile()` (10 keys); per-customer notes.

---

## 10. Staff — Analytics (`#tab-analytics`)

`renderAnalytics()` ([app.src.html:16356](../app.src.html#L16356)) — **1,131 lines, 254 copy
keys**, the largest single screen. Sub-views via `S.anView` (`.an-subnav`): overview, growth,
and more.

Revenue with a **VAT inclusive/exclusive toggle**, ratings, retention, top sellers (excluding
meta and refunded lines), demand fill-rates, growth (funnel, demand heatmap, retail attach,
run-rate forecast, RFM, market basket, LTV by cohort, gross margin, Pearson correlation,
sparklines), height distribution, weather correlation, a date-range bar and CSV export.

**Unique-approved-riders card**: counts *distinct people* approved for the Saturday ride — a
rider approved on six Saturdays is one customer. Only appears when a social ride exists.

---

## 11. Staff — History (`#tab-history`) and Notes (`#tab-notes`)

- `renderHistory()` ([app.src.html:13873](../app.src.html#L13873)) — **66 copy keys**. All past
  bookings with status / payment / session / range / type / size filters, search, sort, a 60-row
  page size, bulk selection, CSV-safe export (injection-hardened) and bilingual print reports
  (`showPrintReportOptions()`, 22 keys). Includes the **audit log** view (`renderLogs()`, 14 keys)
  over `staff_actions`.
- `renderNotes()` ([app.src.html:4154](../app.src.html#L4154)) — **14 copy keys**. Staff notes:
  search (`noteSearchPh`), customer (`noteCustomerPh`), phone (`notePhonePh`), note type, text
  (`noteTextPh`), add and delete; a booking chip links a note to a booking. Empty: `notesEmpty`.

---

## 12. Edge-case screens

Screens a rebuild will miss because they only appear in unusual states:

| Situation | What appears |
|---|---|
| **Session full** | Session card shows `waitlistLabel` instead of `availLabel`; `commFullWaitlistMsg` notice; the ticket shows `waitlistLabel · W<n>` |
| **Waitlist full** (cap reached) | `waitlistRoom()` hits 0 — the join path is refused (client-side only) |
| **Session closed while booking** | `customer_create_booking` returns no rows → "booking refused" |
| **Already booked** | The already-booked banner with `modifyExistingBtn` |
| **Unpaid at check-in** | Payment row defaults to `pendingLabel`; a rider can still be checked in — payment is a separate concern |
| **Walk-in** | `#walkin-modal`; if no session is loaded it toasts `noSessionsAvail` and never opens |
| **No sessions at all** | `noSessionsAvail` + `noSessionsSocial` + the Instagram button |
| **Non-member on a community ride** | The members-only dialog (§1.4) |
| **Community results not yet published** (`hide_queue`) | "Under review" only — never a verdict or a number |
| **Offline** | Connection UI (`_updateConnUI`), `syncOfflineToast`, optimistic tickets, outbox badges |
| **Write failure** | `errorBar()` with a retry, distinguishing an expired staff session from a dropped connection |
| **Stale data** | `toastConnStale` |
| **Staff session expired** | The PIN gate returns **only** on a positive "not staff" verdict — never on a network blip |
| **Low stock** | `.tab-badge` on Inventory, `invLowAlert` |
| **Bike taken by another device** | `errBikeUnavailable` warning; the claim is released |
| **Force-rating** | A mandatory rating modal on any customer tab after an unrated ride |
| **Factory reset** | `showFactoryReset()` (17 keys) — a destructive admin tool |

---

## 13. Copy appendix — every user-facing string, EN / AR / ES

Generated from the `LANG` object in [app.src.html:352](../app.src.html#L352) (English) and the
extracted packs [lang/ar.json](../lang/ar.json) / [lang/es.json](../lang/es.json).

**1,734 keys, full parity across all three languages** (enforced by
[scripts/check-i18n.mjs](../scripts/check-i18n.mjs)).

`{0}`, `{1}` … are runtime placeholders substituted with `.replace('{0}', value)`.


**1734 keys.** Grouped by key prefix for navigation.


### `add*` — 14 keys

| key | English | العربية | Español |
|---|---|---|---|
| `addBike` | + Add Bike | + إضافة دراجة | + Añadir bici |
| `addBikeBtn` | Add Bike | إضافة دراجة | Añadir bici |
| `addBikeTitle` | Add New Bike | إضافة دراجة جديدة | Añadir bici nueva |
| `addBikeToFleetBtn` | Add New Bike to Fleet | إضافة دراجة جديدة للأسطول | Añadir bici nueva a la flota |
| `addCustomBrandLabel` | Add brand... | إضافة علامة... | Añadir marca... |
| `addCustomCatLabel` | Add custom category... | إضافة فئة مخصصة... | Añadir categoría personalizada... |
| `addCustomFlavLabel` | Add flavour... | إضافة نكهة... | Añadir sabor... |
| `addCustomTypeLabel` | Add type... | إضافة نوع... | Añadir tipo... |
| `addLocationLabel` | Add new location... | إضافة موقع جديد... | Añadir ubicación nueva... |
| `addNewOption` | Add new... | إضافة جديد... | Añadir nuevo... |
| `addToCalendarBtn` | Add to Calendar | أضف إلى التقويم | Añadir al calendario |
| `addToWallet` | Add to Apple Wallet | أضف إلى Apple Wallet | Añadir a Apple Wallet |
| `addWalkin` | + Walk-in | + زيارة مباشرة | + Sin reserva |
| `addWalkinBtn` | Add Walk-in | إضافة زيارة | Añadir cliente sin reserva |

### `am*` — 20 keys

| key | English | العربية | Español |
|---|---|---|---|
| `amAutoTag` | Auto-granted | تُمنح تلقائيًا | Automática |
| `amCustomersTitle` | Customers | العملاء | Clientes |
| `amEditTag` | Edit tag | تعديل الوسم | Editar etiqueta |
| `amEditTags` | Tags | الوسوم | Etiquetas |
| `amFilterAll` | All | الكل | Todos |
| `amHolders` | {0} holders | {0} حاملًا | {0} con la etiqueta |
| `amNewTag` | New tag | وسم جديد | Nueva etiqueta |
| `amNoCustomers` | No customer accounts yet. | لا توجد حسابات عملاء بعد. | Aún no hay cuentas de clientes. |
| `amNoTags` | No tags | لا وسوم | Sin etiquetas |
| `amSearchPh` | Search name, email or phone | ابحث بالاسم أو البريد أو الهاتف | Busca nombre, correo o teléfono |
| `amTagColor` | Colour | اللون | Color |
| `amTagDeleted` | Tag deleted | تم حذف الوسم | Etiqueta eliminada |
| `amTagDesc` | Description | الوصف | Descripción |
| `amTagDescPh` | Who is this tag for? | لمن هذا الوسم؟ | ¿Para quién es esta etiqueta? |
| `amTagName` | Tag name | اسم الوسم | Nombre de la etiqueta |
| `amTagNamePh` | e.g. Saturday Social Ride | مثال: جولة السبت الاجتماعية | p. ej. Paseo social del sábado |
| `amTagNameReq` | Enter a tag name. | أدخل اسم الوسم. | Escribe un nombre de etiqueta. |
| `amTagSaved` | Tag saved | تم حفظ الوسم | Etiqueta guardada |
| `amTagsSub` | Tags gate access to private events. Customers never see tags or that they exist. | تتحكم الوسوم في الوصول إلى الفعاليات الخاصة. لا يرى العملاء الوسوم ولا يعلمون بوجودها. | Las etiquetas controlan el acceso a eventos privados. Los clientes nunca ven las etiquetas ni saben que existen. |
| `amTagsTitle` | Tags | الوسوم | Etiquetas |

### `an*` — 286 keys

| key | English | العربية | Español |
|---|---|---|---|
| `anAddCapacityHint` | Consider adding capacity |  فكّر في زيادة السعة | Considera ampliar la capacidad |
| `anAddonRevRide` | Add-on SAR / ride | ريال إضافات / رحلة | SAR de extras / paseo |
| `anAddonsSub` | Most-selected booking extras (this range) | أكثر الإضافات اختياراً (هذا النطاق) | Extras más elegidos en las reservas (este rango) |
| `anAddonsTitle` | Add-on sales | مبيعات الإضافات | Ventas de extras |
| `anAllRatings` | All ratings | كل التقييمات | Todas las valoraciones |
| `anAllRatingsSub` | {0} rated rides, most recent first | {0} رحلة مقيّمة، الأحدث أولاً | {0} paseos valorados, los más recientes primero |
| `anAllTime` | All Time | كل الوقت | Todo el tiempo |
| `anAnomalyDown` | Latest session down {0}% vs your usual {1} riders — check timing, weather or run a promo. | آخر جلسة أقل بـ {0}% من معدّلك المعتاد {1} راكب — راجع التوقيت أو الطقس أو أطلق عرضاً. | Última sesión un {0}% por debajo de tus {1} ciclistas habituales — revisa el horario, el clima o lanza una promoción. |
| `anAnomalyTitle` | Trend alert | تنبيه اتجاه | Alerta de tendencia |
| `anAnomalyUp` | Latest session up {0}% vs your usual {1} riders — ride the momentum. | آخر جلسة أعلى بـ {0}% من معدّلك المعتاد {1} راكب — استثمر هذا الزخم. | Última sesión un {0}% por encima de tus {1} ciclistas habituales — aprovecha el impulso. |
| `anApprovedAvg` | Rides per rider | جولات لكل راكب | Salidas por ciclista |
| `anApprovedTotal` | Approvals given | عدد الموافقات | Aprobaciones dadas |
| `anApprovedUnique` | Riders approved (unique) | الراكبون المعتمدون (فريدون) | Ciclistas aprobados (únicos) |
| `anAttachRate` | Attach rate | نسبة الإرفاق | Tasa de venta adjunta |
| `anAttachRateSub` | rides that added a product | رحلات أضافت منتجاً | paseos que añadieron un producto |
| `anAttachTitle` | Retail attach | المبيعات المرافقة | Ventas de tienda adjuntas |
| `anAttempts` | attempts | محاولة | intentos |
| `anAttnHeavyUse` | Heavy use | استخدام كثيف | Uso intensivo |
| `anAttnLowRated` | Low rating | تقييم منخفض | Valoración baja |
| `anAvgBikeRating` | Avg bike rating | متوسط تقييم الدراجة | Valoración media de bicis |
| `anAvgDuration` | Avg Duration | متوسط المدة | Duración media |
| `anAvgExpRating` | Avg experience | متوسط التجربة | Experiencia media |
| `anAvgFill` | Avg fill rate | متوسط نسبة الإشغال | Tasa media de ocupación |
| `anAvgOccupancy` | Avg Occupancy | متوسط الإشغال | Ocupación media |
| `anAvgPerPiece` | Avg Rides per Piece | متوسط الرحلات لكل قطعة | Media de paseos por unidad |
| `anAvgPerPieceSub` | Total model rides divided by number of bikes of that model | إجمالي رحلات الموديل ÷ عدد دراجات هذا الموديل | Paseos totales del modelo divididos entre el número de bicis de ese modelo |
| `anAvgPerSession` | Avg / Session | متوسط الجلسة | Media / Sesión |
| `anAvgSpend` | avg spend | متوسط الإنفاق | gasto medio |
| `anBasketNone` | Not enough multi-item receipts yet. | لا توجد فواتير متعددة العناصر بعد. | Aún no hay suficientes recibos de varios artículos. |
| `anBasketSub` | Products that share a receipt — good bundle candidates | منتجات تشترك في نفس الفاتورة — مرشّحة للعروض المجمّعة | Productos que comparten recibo — buenos candidatos para packs |
| `anBasketTitle` | Bought together | تُشترى معاً | Comprados juntos |
| `anBestSession` | Best Session by Revenue | أفضل جلسة من حيث الإيرادات | Mejor sesión por ingresos |
| `anBikeUtilSub` | Completed rides per bike, and bikes sitting idle | عدد الرحلات المكتملة لكل دراجة والدراجات غير المستخدمة | Paseos completados por bici, y bicis sin uso |
| `anBikeUtilTitle` | Bike Utilization | استخدام الدراجات | Uso de las bicis |
| `anBusiestDayLabel` | Busiest Day of Week | أكثر يوم في الأسبوع نشاطاً | Día más concurrido |
| `anByBrand` | Rentals by Brand | الإيجارات حسب الماركة | Alquileres por marca |
| `anByBrandSub` | Total completed rides per brand | إجمالي الرحلات المكتملة لكل ماركة | Paseos completados totales por marca |
| `anByDay` | Rides by Day of Week | الرحلات حسب يوم الأسبوع | Paseos por día de la semana |
| `anByModel` | Rentals by Model | الإيجارات حسب الموديل | Alquileres por modelo |
| `anByModelSub` | Total completed rides per model | إجمالي الرحلات المكتملة لكل موديل | Paseos completados totales por modelo |
| `anByRevType` | Revenue by Bike Type | الإيرادات حسب نوع الدراجة | Ingresos por tipo de bici |
| `anBySize` | Rides by Frame Size | الرحلات حسب مقاس الإطار | Paseos por talla |
| `anByType` | Rides by Bike Type | الرحلات حسب نوع الدراجة | Paseos por tipo de bici |
| `anCancellationRate` | Cancellation Rate | معدل الإلغاء | Tasa de cancelación |
| `anCancellations` | cancellations | إلغاء | cancelaciones |
| `anCapacity` | Capacity | الطاقة | Capacidad |
| `anCardCollected` | Card collected | المحصّل بالبطاقة | Cobrado con tarjeta |
| `anCardShare` | card share | نسبة البطاقة | proporción con tarjeta |
| `anCashCollected` | Cash collected | المحصّل نقداً | Cobrado en efectivo |
| `anChartCumRev` | Cumulative Revenue | الإيرادات التراكمية | Ingresos acumulados |
| `anChartCumSub` | Running total of collected revenue over time | المجموع التراكمي للإيرادات المحصّلة مع الوقت | Total acumulado de ingresos cobrados a lo largo del tiempo |
| `anChartDaySub` | Busiest days drive scheduling decisions | أكثر الأيام ازدحاماً يوجّه قرارات الجدولة | Los días más concurridos guían la programación |
| `anChartFrameSub` | Distribution across XS · S · M · L | التوزيع عبر XS · S · M · L | Distribución entre XS · S · M · L |
| `anChartOccSub` | % of capacity filled per session | نسبة الطاقة المستخدمة لكل جلسة | % de capacidad ocupada por sesión |
| `anChartOccupancy` | Session Occupancy | إشغال الجلسة | Ocupación por sesión |
| `anChartPaySplit` | Payment Split | توزيع المدفوعات | Desglose de pagos |
| `anChartPaySub` | Collected vs pending across all rides | المحصّل مقابل المعلق عبر كل الرحلات | Cobrado vs pendiente en todos los paseos |
| `anChartRevPerSession` | Revenue per Session | الإيرادات لكل جلسة | Ingresos por sesión |
| `anChartRevSub` | Green = collected · dashed = total billed | أخضر = محصّل · منقط = إجمالي الفاتورة | Verde = cobrado · discontinua = total facturado |
| `anChartRidersPerSession` | Riders per Session | الراكبون لكل جلسة | Ciclistas por sesión |
| `anChartRidersSub` | Blue = riders · dashed = capacity | أخضر = راكبون · منقط = الطاقة | Azul = ciclistas · discontinua = capacidad |
| `anChartTypeDistrib` | Bike Type Distribution | توزيع أنواع الدراجات | Distribución por tipo de bici |
| `anChartTypeSubtext` | Share of rides by type preference | حصة كل نوع من إجمالي الرحلات | Proporción de paseos por tipo preferido |
| `anCntRiders` | Number of Riders | عدد الراكبين | Número de ciclistas |
| `anCntRidersSub` | unique riders across counted rides | راكبون فريدون ضمن الرحلات المحتسبة | ciclistas únicos en los paseos contados |
| `anCntRides` | Number of Rides | عدد الرحلات | Número de paseos |
| `anCogs` | Cost of goods | تكلفة البضاعة | Coste de los productos |
| `anCohortColMonth` | Month | الشهر | Mes |
| `anCohortColNew` | New | جدد | Nuevos |
| `anCohortColRepeat` | Repeat | متكرر | Repiten |
| `anCohortColRode` | Rode | ركبوا | Montaron |
| `anCohortSub` | new signups who became riders | المسجلون الجدد الذين أصبحوا ركاباً | nuevos registros que llegaron a montar |
| `anCohortTitle` | Signup cohorts | مجموعات التسجيل | Cohortes de registro |
| `anColDate` | Date | التاريخ | Fecha |
| `anColDay2` | Day | اليوم | Día |
| `anColNoShows` | No-Shows | الغياب | Ausencias |
| `anColOccupancy` | Occupancy | الإشغال | Ocupación |
| `anColPending` | Pending | المعلق | Pendiente |
| `anColRevenue` | Revenue | الإيرادات | Ingresos |
| `anColRiders` | Riders | الراكبون | Ciclistas |
| `anColTopType` | Top Type | النوع الأكثر | Tipo más pedido |
| `anColTopType2` | Top Type | النوع الأكثر | Tipo más pedido |
| `anCollRateLabel` | collection rate | معدل التحصيل | tasa de cobro |
| `anCollected` | Collected | المحصّل | Cobrado |
| `anCollectedOnly` | Collected only | المحصّل فقط | Solo cobrado |
| `anCollectionRate` | Collection Rate | معدل التحصيل | Tasa de cobro |
| `anCompletionRate` | Completion Rate | معدل الإتمام | Tasa de finalización |
| `anCompletionSub` | Riders who completed the session | الراكبون الذين أكملوا الجلسة | Ciclistas que completaron la sesión |
| `anCsvEmpty` | Nothing to export in this range. | لا يوجد ما يُصدَّر في هذا النطاق. | Nada que exportar en este rango. |
| `anCustRetention` | Customer Retention | نسبة عودة العملاء | Retención de clientes |
| `anCustom` | Custom | مخصص | Personalizado |
| `anDateRange` | Date Range | نطاق تاريخ | Rango de fechas |
| `anDaysInServiceShort` | {0}d in service | {0} يوم بالخدمة | {0}d en servicio |
| `anDemandTitle` | Demand | الطلب | Demanda |
| `anDigestShare` | Share digest | مشاركة الملخص | Compartir resumen |
| `anDiscountsGiven` | Discounts given | الخصومات الممنوحة | Descuentos aplicados |
| `anDurByModel` | Avg Duration by Model | متوسط المدة حسب الموديل | Duración media por modelo |
| `anDurByModelSub` | Which bikes see the longest rides | الدراجات ذات الرحلات الأطول | Qué bicis tienen los paseos más largos |
| `anDurBySession` | Avg Duration by Session | متوسط المدة حسب الجلسة | Duración media por sesión |
| `anDurBySessionSub` | How ride times vary across sessions | تفاوت الرحلات عبر الجلسات | Cómo varían los tiempos entre sesiones |
| `anDurByType` | Avg Duration by Type | متوسط المدة حسب النوع | Duración media por tipo |
| `anDurByTypeSub` | Average minutes per ride by bike type | متوسط الدقائق لكل رحلة حسب نوع الدراجة | Minutos medios por paseo según tipo de bici |
| `anDurDistrib` | Ride Length Distribution | توزيع مدة الركوب | Distribución de duración |
| `anDurDistribSub` | How long riders typically stay on the bike | كم من الوقت يمضي الراكبون على الدراجة | Cuánto suelen durar los paseos |
| `anDurRidesTracked` | rides tracked | رحلات مرصودة | paseos registrados |
| `anDurationSection` | Ride Duration | مدة الركوب | Duración de los paseos |
| `anExportCsv` | Export CSV | تصدير CSV | Exportar CSV |
| `anFillBySession` | Fill rate by session | نسبة الإشغال لكل جلسة | Ocupación por sesión |
| `anFillBySessionSub` | Booked vs capacity (busiest first) | المحجوز مقابل السعة (الأكثر ازدحاماً أولاً) | Reservado vs capacidad (las más llenas primero) |
| `anFleetSection` | Fleet Analytics | تحليلات الأسطول | Analítica de flota |
| `anForecastSoFar` | so far | حتى الآن | hasta ahora |
| `anForecastSub` | Projected from the pace so far ({0} of {1} days) | متوقّع من الوتيرة حتى الآن ({0} من {1} يوم) | Proyección según el ritmo actual ({0} de {1} días) |
| `anForecastTitle` | This-month forecast | توقّع هذا الشهر | Previsión del mes |
| `anFromDate` | From | من | Desde |
| `anFunnelBooked` | Booked | محجوز | Reservaron |
| `anFunnelCheckedIn` | Checked in | تم الحضور | Llegaron |
| `anFunnelCompleted` | Completed | مكتمل | Completaron |
| `anFunnelSub` | Where riders drop off between booking and finishing | أين يتسرّب الركاب بين الحجز وإنهاء الرحلة | Dónde se pierden ciclistas entre reservar y terminar |
| `anFunnelTitle` | Booking funnel | مسار الحجز | Embudo de reservas |
| `anGrossProfit` | Gross profit | إجمالي الربح | Beneficio bruto |
| `anHeatSub` | Rides by day & time of day — schedule sessions around the hot spots | الرحلات حسب اليوم ووقت اليوم — جدول الجلسات حول أوقات الذروة | Paseos por día y franja horaria — programa sesiones en los puntos calientes |
| `anHeatTitle` | Demand heatmap | خريطة الطلب الحرارية | Mapa de calor de demanda |
| `anHeightAvg` | avg | المتوسط | media |
| `anHeightReport` | Height & Bike report | تقرير الأطوال والدراجات | Informe de alturas y bicis |
| `anHeightReportSub` | Per session: rider heights + bikes rented by type | لكل جلسة: أطوال الركّاب + الدراجات المؤجّرة حسب النوع | Por sesión: alturas de ciclistas + bicis alquiladas por tipo |
| `anHeightSub` | Height distribution of riders in range | توزيع أطوال الركّاب في النطاق | Distribución de alturas de los ciclistas en el rango |
| `anHeightTitle` | Rider Heights | أطوال الركّاب | Alturas de ciclistas |
| `anHighlights` | Highlights | أبرز المؤشرات | Destacados |
| `anIdleBikesTitle` | Idle bikes | دراجات غير مستخدمة | Bicis sin uso |
| `anInsightGoodCollection` | Collection rate is strong - revenue is being captured effectively. | معدل التحصيل ممتاز - الإيرادات تُحصَّل بكفاءة. | La tasa de cobro es sólida: los ingresos se están capturando bien. |
| `anInsightHighOcc` | Sessions are filling well. Consider adding more sessions to meet demand. | الجلسات تمتلئ بشكل جيد. فكر في إضافة جلسات لتلبية الطلب. | Las sesiones se llenan bien. Considera añadir más sesiones para cubrir la demanda. |
| `anInsightLowCollection` | Collection rate is below 70%. Follow up on SAR {0} in pending payments. | معدل التحصيل أقل من 70%. تابع {0} ريال مستحقة الدفع. | La tasa de cobro está por debajo del 70%. Haz seguimiento de SAR {0} en pagos pendientes. |
| `anInsightLowOcc` | Average occupancy is low. Try marketing or reducing session frequency. | متوسط الإشغال منخفض. حاول تسويق الخدمة أو تقليل تكرار الجلسات. | La ocupación media es baja. Prueba con marketing o reduce la frecuencia de sesiones. |
| `anInsightPeakTime` | Busiest slot: {0} ({1} rides). Add capacity or open more sessions at this time. | أكثر الأوقات ازدحاماً: {0} ({1} رحلة). فكّر في زيادة السعة أو فتح جلسات إضافية في هذا الوقت. | Franja más concurrida: {0} ({1} paseos). Amplía capacidad o abre más sesiones a esa hora. |
| `anInsightPendingHigh` | SAR {0} is outstanding ({1}% of billed). Prompt collection recommended. | {0} ريال مستحقة ({1}% من المفوتر). يُنصح بالمتابعة الفورية. | Hay SAR {0} pendientes ({1}% de lo facturado). Se recomienda gestionar el cobro. |
| `anInsightRetention` | Strong repeat rider rate ({0}%). Loyalty program could further boost returns. | معدل عودة العملاء مرتفع ({0}%). برنامج ولاء يمكن أن يعزز العودة أكثر. | Buena tasa de ciclistas que repiten ({0}%). Un programa de fidelidad podría aumentarla. |
| `anInsightTopDay` | Busiest day: {0}. Prioritize sessions on this day to maximize revenue. | أكثر الأيام نشاطاً: {0}. أولوية إضافة الجلسات هذا اليوم. | Día más concurrido: {0}. Prioriza sesiones ese día para maximizar ingresos. |
| `anInsightTopType` | Most-requested type: {0}. Ensure fleet stock matches demand. | الأكثر طلباً: {0}. تأكد من توافر الأسطول بما يتناسب مع الطلب. | Tipo más solicitado: {0}. Asegúrate de que la flota cubre la demanda. |
| `anInsights` | Business Insights | رؤى تجارية | Conclusiones del negocio |
| `anLapsedColLast` | Last ride | آخر رحلة | Último paseo |
| `anLapsedColRider` | Rider | الراكب | Ciclista |
| `anLapsedColRides` | Rides | الرحلات | Paseos |
| `anLapsedSub` | no ride in 30+ days | لم يركبوا منذ أكثر من 30 يوماً | sin paseos en 30+ días |
| `anLapsedTitle` | Lapsed riders | عملاء متوقفون | Ciclistas inactivos |
| `anLast10` | Last 10 Sessions | آخر 10 جلسات | Últimas 10 sesiones |
| `anLast5` | Last 5 Sessions | آخر 5 جلسات | Últimas 5 sesiones |
| `anLiveActive` | On bikes now | على الدراجات الآن | En bici ahora |
| `anLiveFill` | Booked / capacity | المحجوز / السعة | Reservado / capacidad |
| `anLiveRev` | Revenue today | إيراد اليوم | Ingresos de hoy |
| `anLiveRides` | Rides today | رحلات اليوم | Paseos de hoy |
| `anLiveSub` | Live — today's sessions | مباشر — جلسات اليوم | En vivo — sesiones de hoy |
| `anLiveTitle` | Today | اليوم | Hoy |
| `anLongestRide` | Longest Ride | أطول رحلة | Paseo más largo |
| `anLtvAvg` | Avg LTV | متوسط القيمة | LTV medio |
| `anLtvCohort` | Cohort | المجموعة | Cohorte |
| `anLtvRiders` | Riders | الركاب | Ciclistas |
| `anLtvSub` | Average total spend per rider, grouped by their first-ride month | متوسط إجمالي الإنفاق لكل راكب، مجمّعاً حسب شهر أول رحلة | Gasto total medio por ciclista, agrupado por el mes de su primer paseo |
| `anLtvTitle` | Lifetime value by cohort | القيمة الدائمة حسب المجموعة | Valor de vida por cohorte |
| `anMargin` | Margin | الهامش | Margen |
| `anMarginSub` | Product revenue minus cost of goods, for items that have a cost set | إيراد المنتجات ناقص تكلفة البضاعة، للعناصر التي لها تكلفة محددة | Ingresos de productos menos coste, para artículos con coste definido |
| `anMarginTitle` | Gross margin | هامش الربح | Margen bruto |
| `anMeasuredRides` | rides with measured time | رحلة بوقت مُقاس | paseos con tiempo medido |
| `anMostPopFrame` | Most Common Frame Size | المقاس الأكثر شيوعاً | Talla más común |
| `anMostPopType` | Most Popular Bike Type | النوع الأكثر طلباً | Tipo de bici más popular |
| `anNavCustomers` | Customers | العملاء | Clientes |
| `anNavGrowth` | Growth | النمو | Crecimiento |
| `anNavOverview` | Overview | نظرة عامة | Resumen |
| `anNeedsAttention` | Bikes needing attention | دراجات تحتاج انتباهاً | Bicis que requieren atención |
| `anNeverUsed` | Never used | لم تُستخدم | Nunca usada |
| `anNoAddons` | No add-ons sold in this range. | لا توجد إضافات مباعة في هذا النطاق. | No se vendieron extras en este rango. |
| `anNoAttention` | All bikes look healthy. | كل الدراجات بحالة جيدة. | Todas las bicis están en buen estado. |
| `anNoBikesData` | No bike data yet. | لا توجد بيانات للدراجات بعد. | Aún no hay datos de bicis. |
| `anNoData` | No completed rides yet. Data will appear here once sessions are done. | لا توجد رحلات مكتملة بعد. ستظهر البيانات هنا عند اكتمال الجلسات. | Aún no hay paseos completados. Los datos aparecerán cuando terminen las sesiones. |
| `anNoData2` | No data | لا بيانات | Sin datos |
| `anNoDataTrend` | No sessions with completed rides yet. | لا توجد جلسات مكتملة بعد. | Aún no hay sesiones con paseos completados. |
| `anNoPrev` | no prior period | لا توجد فترة سابقة | sin periodo anterior |
| `anNoPromo` | No promo codes used in this range. | لم تُستخدم أي رموز خصم في هذا النطاق. | No se usaron códigos promocionales en este rango. |
| `anNoShowByDay` | No-shows by day | حالات الغياب حسب اليوم | Ausencias por día |
| `anNoShowByDaySub` | Which days lose the most riders | الأيام التي تفقد أكبر عدد من الركّاب | Qué días pierden más ciclistas |
| `anNoShowLost` | est. revenue lost | إيراد مفقود تقريباً | ingresos perdidos est. |
| `anNoShowRate` | No-Show Rate | معدل الغياب | Tasa de ausencias |
| `anOf` | of | من | de |
| `anOperations` | Operations | العمليات | Operaciones |
| `anOutOf10` | /10 | /10 | /10 |
| `anPageSub` | Business performance · live data from all completed sessions. | لوحة أداء الأعمال · بيانات مباشرة من جميع الجلسات المكتملة. | Rendimiento del negocio · datos en vivo de todas las sesiones completadas. |
| `anPayTitle` | Payments | المدفوعات | Pagos |
| `anPeakTimeLabel` | Peak Time of Day | وقت الذروة | Hora punta |
| `anPerRide` | per ride | لكل رحلة | por paseo |
| `anProjRev` | Projected revenue | الإيراد المتوقع | Ingresos proyectados |
| `anProjRides` | Projected rides | الرحلات المتوقعة | Paseos proyectados |
| `anPromoCol` | Code | الرمز | Código |
| `anPromoSub` | Bookings that used a promo code (this range) | الحجوزات التي استخدمت رمز خصم (هذا النطاق) | Reservas que usaron un código promocional (este rango) |
| `anPromoTitle` | Promo redemptions | استخدام رموز الخصم | Canjes de promociones |
| `anPromoUses` | Bookings | الحجوزات | Reservas |
| `anRatedRidesUnit` | rated rides | رحلات مقيّمة | paseos valorados |
| `anRatingByModel` | Bike Rating by Model | تقييم الدراجة حسب الموديل | Valoración de bicis por modelo |
| `anRatingByModelSub` | Average bike rating per model — guides purchasing & retirement | متوسط تقييم الدراجة لكل موديل — يوجّه قرارات الشراء والتقاعد | Valoración media por modelo — guía compras y retiradas |
| `anRatingsSection` | Ratings & Bike Health | التقييمات وصحة الدراجات | Valoraciones y estado de las bicis |
| `anRepeatRate` | Repeat rate (all-time) | نسبة العملاء المتكررين (الإجمالي) | Tasa de repetición (histórica) |
| `anRepeatRateSub` | riders with 2+ rides | راكب لديه رحلتان فأكثر | ciclistas con 2+ paseos |
| `anRepeatRiders` | Repeat Riders | الراكبون المتكررون | Ciclistas que repiten |
| `anRetCurveSub` | Share of first-time riders who came back within… | نسبة الركاب الجدد الذين عادوا خلال… | Proporción de ciclistas nuevos que volvieron en… |
| `anRetCurveTitle` | Retention curve | منحنى الاحتفاظ | Curva de retención |
| `anRetElig` | {0} of {1} riders | {0} من {1} راكب | {0} de {1} ciclistas |
| `anRetWindow` | {0} days | {0} يوم | {0} días |
| `anRetentionTitle` | Retention | الاحتفاظ بالعملاء | Retención |
| `anReturned` | returned | عاد | volvieron |
| `anRevByDay` | Revenue by Day of Week | الإيرادات حسب اليوم | Ingresos por día de la semana |
| `anRevByDaySub` | Average collected SAR per day - guides scheduling | متوسط الإيرادات المحصّلة يومياً - يُفيد في جدولة الجلسات | SAR medio cobrado por día - guía la programación |
| `anRevByModel` | Revenue by Model | الإيرادات حسب الموديل | Ingresos por modelo |
| `anRevByModelSub` | Collected revenue per bike model | الإيرادات المحصّلة لكل موديل | Ingresos cobrados por modelo de bici |
| `anRevCollected` | Revenue Collected | الإيرادات المحصلة | Ingresos cobrados |
| `anRevPAS` | Revenue Per Seat | الإيراد لكل مقعد | Ingresos por plaza |
| `anRevPASSub` | Collected ÷ total seats offered | المحصّل ÷ إجمالي المقاعد المتاحة | Cobrado ÷ plazas totales ofrecidas |
| `anRevPending` | Revenue Pending | الإيرادات المعلقة | Ingresos pendientes |
| `anRevPerCust` | Revenue per Unique Customer | الإيراد لكل عميل | Ingresos por cliente único |
| `anRevPerRide` | Revenue per Ride | الإيراد لكل رحلة | Ingresos por paseo |
| `anRevTotal` | Total Revenue | إجمالي الإيرادات | Ingresos totales |
| `anRevenue` | Revenue | الإيرادات | Ingresos |
| `anRfmAtRisk` | At risk | معرّضون للفقد | En riesgo |
| `anRfmAtRiskD` | slipping away — win them back | يبتعدون — استعِدهم | se están alejando — recupéralos |
| `anRfmChampions` | Champions | الأبطال | Campeones |
| `anRfmChampionsD` | frequent & recent | متكررون وحديثون | frecuentes y recientes |
| `anRfmLost` | Lost | مفقودون | Perdidos |
| `anRfmLostD` | no ride in 60+ days | لا رحلة منذ 60+ يوماً | sin paseos en 60+ días |
| `anRfmLoyal` | Loyal | الأوفياء | Fieles |
| `anRfmLoyalD` | 2+ rides, still active | رحلتان أو أكثر، نشطون | 2+ paseos, aún activos |
| `anRfmMore` | +{0} more | +{0} آخرون | +{0} más |
| `anRfmMsg` | Hi {0}! It's MicroMobility 🚲 — hope to see you on a ride soon! | مرحباً {0}! نحن مايكروموبيليتي 🚲 — نتطلع لرؤيتك في رحلة قريباً! | ¡Hola {0}! Somos MicroMobility 🚲 — ¡esperamos verte pronto en un paseo! |
| `anRfmNew` | New | جدد | Nuevos |
| `anRfmNewD` | first ride, recent | أول رحلة، حديثاً | primer paseo, reciente |
| `anRfmNone` | No riders here yet. | لا يوجد ركاب هنا بعد. | Aún no hay ciclistas aquí. |
| `anRfmSub` | Recency · Frequency · Money — tap a rider to message them | الحداثة · التكرار · الإنفاق — اضغط على راكب لمراسلته | Recencia · Frecuencia · Gasto — toca un ciclista para escribirle |
| `anRfmTitle` | Rider segments (RFM) | شرائح الركاب (RFM) | Segmentos de ciclistas (RFM) |
| `anRideDefSub` | paid = ride before 12 Aug 2026 · checked-in only from then on | قبل 12 أغسطس 2026: المدفوع يُحتسب رحلة · بعده: تسجيل الدخول فقط | pagado = paseo antes del 12 ago 2026 · después solo con check-in |
| `anRideMinutes` | Actual Riding Minutes | دقائق الركوب الفعلية | Minutos reales de uso |
| `anRiders` | Riders | الراكبون | Ciclistas |
| `anRidersCapacity` | Riders ÷ capacity | الراكبون ÷ الطاقة | Ciclistas ÷ capacidad |
| `anRidership` | Ridership | الراكبون | Afluencia |
| `anRidesFromReturning` | rides from returning customers | رحلة من عملاء عائدين | paseos de clientes que vuelven |
| `anRidesLabel` | rides | رحلة | paseos |
| `anRidesShortN` | {0} rides | {0} رحلة | {0} paseos |
| `anRidesUnit` | rides | رحلات | paseos |
| `anSeatsFilled` | seats sold | مقعد محجوز | plazas vendidas |
| `anSessPerformTable` | Session Performance Table | جدول أداء الجلسات | Tabla de rendimiento por sesión |
| `anSessionAll` | All sessions | كل الجلسات | Todas las sesiones |
| `anSessionLabel` | Session | الجلسة | Sesión |
| `anSessionTrend` | Session-by-Session Performance | أداء الجلسات | Rendimiento sesión a sesión |
| `anSessionsHeld` | Sessions Held | الجلسات المنعقدة | Sesiones celebradas |
| `anShortestRide` | Shortest Ride | أقصر رحلة | Paseo más corto |
| `anShowing` | Showing: | عرض: | Mostrando: |
| `anSoldOut` | Sold-out sessions | جلسات ممتلئة | Sesiones agotadas |
| `anSoldOutNone` | No sessions sold out | لا توجد جلسات ممتلئة | Ninguna sesión agotada |
| `anSpentCol` | Spent | الإنفاق | Gastado |
| `anTargetBehind` | Behind pace | دون الوتيرة | Por debajo del ritmo |
| `anTargetNone` | Set a monthly revenue target to track your pace. | عيّن هدف إيراد شهري لتتبّع وتيرتك. | Define un objetivo mensual de ingresos para seguir tu ritmo. |
| `anTargetOnPace` | On pace ✓ | ضمن الوتيرة ✓ | En ritmo ✓ |
| `anTargetProjEnd` | Projected month-end: SAR {0} | المتوقع نهاية الشهر: SAR {0} | Proyección a fin de mes: SAR {0} |
| `anTargetPrompt` | Monthly revenue target (SAR)? | هدف الإيراد الشهري (ريال)؟ | ¿Objetivo mensual de ingresos (SAR)? |
| `anTargetSet` | Set target | تعيين الهدف | Definir objetivo |
| `anTargetTitle` | Monthly revenue target | هدف الإيراد الشهري | Objetivo mensual de ingresos |
| `anTeamConsumption` | Team account by member | حساب الفريق حسب العضو | Cuenta del equipo por miembro |
| `anTeamConsumptionSub` | Products taken on the MM Team account (this range) | منتجات مأخوذة على حساب فريق MM (هذا النطاق) | Productos tomados en la cuenta MM Team (este rango) |
| `anThisMonth` | This Month | هذا الشهر | Este mes |
| `anThisYear` | This Year | هذه السنة | Este año |
| `anToDate` | To | إلى | Hasta |
| `anTopCustomers` | Top customers | أفضل العملاء | Mejores clientes |
| `anTopCustomersSub` | By spend in this range | حسب الإنفاق في هذا النطاق | Por gasto en este rango |
| `anTopSellers` | Top sellers | الأكثر مبيعاً | Más vendidos |
| `anTopSellersSub` | Most-sold products (this range) | المنتجات الأكثر مبيعاً (هذا النطاق) | Productos más vendidos (este rango) |
| `anTotal` | Total | الإجمالي | Total |
| `anTotalCreated` | total created | منشأة إجمالاً | total creadas |
| `anTotalRides` | Completed Rides | الرحلات المكتملة | Paseos completados |
| `anTotalSeats` | Total Seats Offered | إجمالي المقاعد المتاحة | Plazas totales ofrecidas |
| `anTrendsSub` | Recent sessions, oldest → newest | الجلسات الأخيرة، من الأقدم إلى الأحدث | Sesiones recientes, de más antigua a más reciente |
| `anTrendsTitle` | Trends | الاتجاهات | Tendencias |
| `anTypeRevPerRide` | Avg Revenue per Ride by Type | متوسط الإيراد لكل رحلة حسب النوع | Ingreso medio por paseo según tipo |
| `anTypeRevPerRideSub` | How much each bike type earns per completed ride | كم تحقق كل فئة دراجات لكل رحلة مكتملة | Cuánto genera cada tipo de bici por paseo completado |
| `anUniqueCustomers` | Unique Customers | العملاء الفريدون | Clientes únicos |
| `anUnpaidRides` | unpaid rides | رحلة غير مدفوعة | paseos sin pagar |
| `anVsPrev` | vs prev period | مقارنة بالفترة السابقة | vs periodo anterior |
| `anWeatherFlat` | Weather has little effect on rides. | للطقس تأثير ضئيل على الرحلات. | El clima apenas afecta a los paseos. |
| `anWeatherSub` | Rides vs daily-high temperature (Jeddah, Open-Meteo) | الرحلات مقابل درجة الحرارة العظمى (جدة، Open-Meteo) | Paseos vs temperatura máxima diaria (Yeda, Open-Meteo) |
| `anWeatherTitle` | Weather & demand | الطقس والطلب | Clima y demanda |
| `anWeatherWarmLess` | Cooler days bring more rides. | الأيام الأبرد تجلب رحلات أكثر. | Los días más frescos traen más paseos. |
| `anWeatherWarmMore` | Warmer days bring more rides. | الأيام الأدفأ تجلب رحلات أكثر. | Los días más cálidos traen más paseos. |

### `appr*` — 8 keys

| key | English | العربية | Español |
|---|---|---|---|
| `apprApproveBtn` | Approve | موافقة | Aprobar |
| `apprApprovedChip` | Approved | مقبول | Aprobado |
| `apprApprovedToast` | {0} approved | تمت الموافقة على {0} | {0} aprobado |
| `apprPendingChip` | Pending approval | بانتظار الموافقة | Pendiente de aprobación |
| `apprRejectBtn` | Reject | رفض | Rechazar |
| `apprRejectedToast` | {0} rejected | تم رفض {0} | {0} rechazado |
| `apprSelectBtn` | Select | اختيار | Seleccionar |
| `apprUndoBtn` | Undo approval | تراجع عن الموافقة | Deshacer aprobación |

### `auth*` — 17 keys

| key | English | العربية | Español |
|---|---|---|---|
| `authCancel` | Cancel - Go Home | إلغاء - الرئيسية | Cancelar |
| `authConfirmPassword` | Confirm Password | تأكيد كلمة المرور | Confirmar contraseña |
| `authEmail` | Email Address | البريد الإلكتروني | Correo electrónico |
| `authEmailOpt` | (optional if using phone) | (اختياري إذا استخدمت الهاتف) | (opcional si usas teléfono) |
| `authFullName` | Full Name | الاسم الكامل | Nombre completo |
| `authIdentifier` | Email or Phone | البريد الإلكتروني أو الهاتف | Correo o teléfono |
| `authLogin` | Log In | تسجيل الدخول | Iniciar sesión |
| `authLoginBtn` | Log In | تسجيل الدخول | Iniciar sesión |
| `authOr` | or | أو | o |
| `authPassword` | Password | كلمة المرور | Contraseña |
| `authPasswordHint` | Min 8 chars, 1 uppercase, 1 number | 8 أحرف كحد أدنى، حرف كبير ورقم | Mínimo 8 caracteres |
| `authPhone` | Phone Number | رقم الهاتف | Número de teléfono |
| `authPhoneOpt` | (optional if using email) | (اختياري إذا استخدمت البريد) | (opcional si usas correo) |
| `authSignup` | Sign Up | إنشاء حساب | Registrarse |
| `authSignupBtn` | Create Account | إنشاء الحساب | Crear cuenta |
| `authSub` | Sign in or create an account to track your rides. | سجل دخولك أو أنشئ حساباً لتتبع رحلاتك. | Inicia sesión o crea una cuenta para seguir tus paseos. |
| `authWelcome` | Welcome to MicroMobility | مرحباً بك في مايكرو موبيليتي | Bienvenido a MicroMobility |

### `bd*` — 20 keys

| key | English | العربية | Español |
|---|---|---|---|
| `bd25` | Corniche 25 | كورنيش ٢٥ | Corniche 25 |
| `bd25D` | 25 rides on the corniche | ٢٥ رحلة على الكورنيش | 25 paseos en la corniche |
| `bdCarbon` | Carbon Club | نادي الكربون | Club Carbono |
| `bdCarbonD` | Rode the Road Carbon | ركبت درّاجة الرود كاربون | Montaste la Road Carbon |
| `bdEarned` | Earned | حصلت عليه | Conseguida |
| `bdFirstLap` | First Lap | اللفة الأولى | Primera vuelta |
| `bdFirstLapD` | Completed your first circuit ride | أكملت أول رحلة لك في الحلبة | Completaste tu primer paseo en el circuito |
| `bdFrontRow` | Front Row | الصف الأول | Primera fila |
| `bdFrontRowD` | Held booking #1 in a session | حصلت على الحجز رقم ١ في جلسة | Tuviste la reserva n.º 1 en una sesión |
| `bdFuel` | Fuel Stop | محطة تزوّد | Parada de repostaje |
| `bdFuelD` | Added extras to a booking | أضفت إضافات إلى حجزك | Añadiste extras a una reserva |
| `bdHowTo` | How to earn | كيف تحصل عليه | Cómo conseguirla |
| `bdPodium` | Podium Pace | إيقاع المنصة | Ritmo de podio |
| `bdPodiumD` | 10 rides strong | ١٠ رحلات | 10 paseos |
| `bdRegular` | Grid Regular | منتظم الحلبة | Habitual |
| `bdRegularD` | 5 rides on the grid | ٥ رحلات في الحلبة | 5 paseos en la parrilla |
| `bdSquad` | Squad Captain | قائد المجموعة | Capitán de grupo |
| `bdSquadD` | Booked for 3+ riders at once | حجزت لـ٣ رُكّاب أو أكثر دفعة واحدة | Reservaste para 3+ ciclistas a la vez |
| `bdStreak` | Hot Streak | حماس متواصل | Racha caliente |
| `bdStreakD` | Rode 3 weeks in a row | ركبت ٣ أسابيع متتالية | Montaste 3 semanas seguidas |

### `bike*` — 22 keys

| key | English | العربية | Español |
|---|---|---|---|
| `bike` | Bike | دراجة | Bici |
| `bikeAutoName` | Auto Name | الاسم التلقائي | Nombre automático |
| `bikeBrand` | Brand | الماركة | Marca |
| `bikeColorsLabel` | Bike Color(s) | لون الدراجة | Color(es) de la bici |
| `bikeCustomPrice` | Custom Rental Price | سعر إيجار مخصص | Precio de alquiler personalizado |
| `bikeEndDate` | Retired Date | تاريخ التقاعد | Fecha de retirada |
| `bikeFleetComp` | Bike Fleet Composition | تركيبة أسطول الدراجات | Composición de la flota |
| `bikeFrameTypeLabel` | Frame Type | نوع الإطار | Tipo de cuadro |
| `bikeGroupset` | Groupset | منظومة التروس | Grupo |
| `bikeLocationLabel` | Location | الموقع | Ubicación |
| `bikeModel` | Model | الموديل | Modelo |
| `bikeNameAuto` | Auto | تلقائي | Auto |
| `bikeNameHint` | (edit to rename) | (عدّل لإعادة التسمية) | (edita para renombrar) |
| `bikeNameLabel` | Bike Name | اسم الدراجة | Nombre de la bici |
| `bikeNumberLabel` | Bike Number | رقم الدراجة | Número de bici |
| `bikeRentalPrice` | Rental Price | سعر الإيجار | Precio de alquiler |
| `bikeReserveCleared` | Reservation cleared | تم إلغاء الحجز | Reserva cancelada |
| `bikeReservedToast` | {0} reserved | تم حجز {0} | {0} reservada |
| `bikeSpeeds` | Speeds | عدد السرعات | Velocidades |
| `bikeStartDate` | In-Service Date | تاريخ بدء الاستخدام | Fecha de alta |
| `bikeTypeLabel` | Bike Type | نوع الدراجة | Tipo de bici |
| `bikeTypePref` | Bike Type Preference | تفضيل نوع الدراجة | Tipo de bici preferido |

### `bk*` — 15 keys

| key | English | العربية | Español |
|---|---|---|---|
| `bkBulkExport` | Export CSV | تصدير CSV | Exportar CSV |
| `bkBulkLocPh` | Location… | الموقع… | Ubicación… |
| `bkBulkMaint` | Maintenance | صيانة | Mantenimiento |
| `bkBulkMaintConfirm` | Move {0} selected bike(s) to maintenance? In-use bikes are skipped. | نقل {0} دراجة محددة إلى الصيانة؟ يتم تخطّي الدراجات قيد الاستخدام. | ¿Pasar {0} bici(s) seleccionada(s) a mantenimiento? Las bicis en uso se omiten. |
| `bkBulkMove` | Move | نقل | Mover |
| `bkBulkNoneEligible` | No eligible bikes in selection. | لا توجد دراجات مؤهلة ضمن التحديد. | No hay bicis elegibles en la selección. |
| `bkBulkPickLoc` | Choose a location first. | اختر موقعاً أولاً. | Elige primero una ubicación. |
| `bkBulkPickPrice` | Enter a valid price. | أدخل سعراً صحيحاً. | Introduce un precio válido. |
| `bkBulkPricePh` | SAR | ريال | SAR |
| `bkBulkRetire` | Retire | تقاعد | Retirar |
| `bkBulkRetireConfirm` | Retire {0} selected bike(s)? In-use bikes are skipped. | تقاعد {0} دراجة محددة؟ يتم تخطّي الدراجات قيد الاستخدام. | ¿Retirar {0} bici(s) seleccionada(s)? Las bicis en uso se omiten. |
| `bkBulkSetPrice` | Set price | تحديد السعر | Fijar precio |
| `bkBulkUpdated` | {0} bike(s) updated | تم تحديث {0} دراجة | {0} bici(s) actualizada(s) |
| `bkSelectAll` | Select all | تحديد الكل | Seleccionar todo |
| `bkSelectedN` | {0} selected | {0} محدد | {0} seleccionadas |

### `bp*` — 12 keys

| key | English | العربية | Español |
|---|---|---|---|
| `bpAvgRating` | Avg rating | متوسط التقييم | Valoración media |
| `bpColorsLabel` | Colors | الألوان | Colores |
| `bpFeedbackTitle` | Rider feedback | ملاحظات الركّاب | Opiniones de ciclistas |
| `bpHistoryTitle` | Recent rides | أحدث الرحلات | Paseos recientes |
| `bpInServiceLabel` | In service | في الخدمة | En servicio |
| `bpLastUsed` | Last used | آخر استخدام | Último uso |
| `bpNever` | Never | لم تُستخدم | Nunca |
| `bpNoRides` | No completed rides yet. | لا توجد رحلات مكتملة بعد. | Aún no hay paseos completados. |
| `bpRevenue` | Revenue | الإيرادات | Ingresos |
| `bpRides` | Rides | الرحلات | Paseos |
| `bpSpecsTitle` | Specifications | المواصفات | Especificaciones |
| `bpUtilLabel` | Utilization | الاستخدام | Utilización |

### `cancel*` — 10 keys

| key | English | العربية | Español |
|---|---|---|---|
| `cancelBooking` | Cancel | إلغاء | Cancelar |
| `cancelBookingLabel` | Cancel booking | إلغاء الحجز | Cancelar reserva |
| `cancelBtn` | Cancel | إلغاء | Cancelar |
| `cancelConfirmBtn` | Confirm Cancellation | تأكيد الإلغاء | Confirmar cancelación |
| `cancelEntryBody` | This will release any assigned bike and mark the entry as cancelled. | سيؤدي هذا إلى تحرير أي دراجة معيّنة ووضع الحجز كملغى. | Esto liberará cualquier bici asignada y marcará la reserva como cancelada. |
| `cancelOtherPlaceholder` | Please describe your reason... | يرجى وصف سببك... | Describe tu motivo... |
| `cancelReason1` | Change of plans | تغيير في الخطط | Cambio de planes |
| `cancelReason2` | Found a better price elsewhere | وجدت سعراً أفضل في مكان آخر | Encontré mejor precio en otro sitio |
| `cancelReason3` | Other | سبب آخر | Otro |
| `cancelReasonTitle` | Why are you cancelling? | ما سبب الإلغاء؟ | ¿Por qué cancelas? |

### `cash*` — 49 keys

| key | English | العربية | Español |
|---|---|---|---|
| `cashAcctLinked` | Linked to account | مرتبط بالحساب | Vinculado a la cuenta |
| `cashAddItemBtn` | Add item | إضافة عنصر | Añadir artículo |
| `cashAddedToast` | Sale recorded | تم تسجيل البيع | Venta registrada |
| `cashAllItems` | All items | كل العناصر | Todos los artículos |
| `cashAmtLabel` | Unit price (SAR) | سعر الوحدة (ريال) | Precio unitario (SAR) |
| `cashAmtRequired` | Enter a valid amount | أدخل مبلغاً صحيحاً | Introduce un importe válido |
| `cashCard` | Card | بطاقة | Tarjeta |
| `cashCartEmpty` | Add at least one item | أضف عنصراً واحداً على الأقل | Añade al menos un artículo |
| `cashCartTitle` | Receipt items | عناصر الفاتورة | Artículos del recibo |
| `cashCash` | Cash | نقدًا | Efectivo |
| `cashCustomOpt` | Custom item… | عنصر مخصص… | Artículo personalizado… |
| `cashCustomerLabel` | Customer (optional) | العميل (اختياري) | Cliente (opcional) |
| `cashCustomerPh` | Search name, phone, email - or type a name | ابحث بالاسم أو الجوال أو البريد - أو اكتب اسماً | Busca por nombre, teléfono o correo - o escribe un nombre |
| `cashDiscount` | Discount | خصم | Descuento |
| `cashDone` | Done | تم | Hecho |
| `cashEditBtn` | Edit | تعديل | Editar |
| `cashItemsWord` | items | عناصر | artículos |
| `cashLedgerTitle` | Sales | المبيعات | Ventas |
| `cashMarkPaid` | Mark paid | تحديد مدفوع | Marcar pagado |
| `cashNameLabel` | Item name | اسم العنصر | Nombre del artículo |
| `cashNewSale` | New sale | عملية بيع جديدة | Nueva venta |
| `cashNoSales` | No purchases yet. | لا توجد مشتريات بعد. | Aún no hay compras. |
| `cashNoSalesSession` | No sales recorded for this session yet. | لا توجد مبيعات مسجلة لهذه الجلسة بعد. | No hay ventas registradas en esta sesión. |
| `cashNoSessions` | No sessions yet. Create a session first. | لا توجد جلسات بعد. أنشئ جلسة أولاً. | Aún no hay sesiones. Crea una primero. |
| `cashPayLabel` | Payment | الدفع | Pago |
| `cashPendingSync` | {0} pending sync | {0} بانتظار المزامنة | {0} pendiente(s) de sincronizar |
| `cashQtyCol` | Qty sold | الكمية المباعة | Cant. vendida |
| `cashQtyLabel` | Qty | الكمية | Cant. |
| `cashReceiptRecorded` | Receipt recorded | تم تسجيل الفاتورة | Recibo registrado |
| `cashReceiptWord` | Receipt | فاتورة | Recibo |
| `cashRecordBtn` | Record sale | تسجيل البيع | Registrar venta |
| `cashRecordReceiptBtn` | Record receipt | تسجيل الفاتورة | Registrar recibo |
| `cashRefund` | Refund | استرداد | Reembolsar |
| `cashRefundConfirm` | Refund this receipt? The items go back to stock and the sale is reversed (kept as a record). | استرداد هذه الفاتورة؟ تعود العناصر إلى المخزون ويُعكس البيع (يبقى كسجل). | ¿Reembolsar este recibo? Los artículos vuelven al stock y la venta se revierte (queda como registro). |
| `cashRefunded` | Refunded | مُسترد | Reembolsado |
| `cashRefundedToast` | Receipt refunded | تم استرداد الفاتورة | Recibo reembolsado |
| `cashRefunds` | Refunds | المستردات | Reembolsos |
| `cashRentalTag` | rental | إيجار | alquiler |
| `cashRingUp` | Add to sale | إضافة للبيع | Añadir a la venta |
| `cashSalesTitle` | Sales | المبيعات | Ventas |
| `cashSavedToast` | Receipt updated | تم تحديث الفاتورة | Recibo actualizado |
| `cashSelectItem` | Choose an item | اختر عنصراً | Elige un artículo |
| `cashShare` | Share | مشاركة | Compartir |
| `cashSplitLabel` | Card payment | الدفع بالبطاقة | Pago con tarjeta |
| `cashTabSub` | Sell items and track sales for a session | بيع العناصر وتتبع المبيعات لكل جلسة | Vende artículos y controla las ventas por sesión |
| `cashValue` | Sales value | قيمة المبيعات | Valor de ventas |
| `cashVoid` | Void | إلغاء | Anular |
| `cashVoidedToast` | Purchase voided | تم إلغاء العملية | Compra anulada |
| `cashWalkup` | Walk-up | زبون عابر | Cliente de paso |

### `cat*` — 12 keys

| key | English | العربية | Español |
|---|---|---|---|
| `catAccessory` | Accessory | إكسسوار | Accesorio |
| `catApparel` | Apparel | ملابس | Ropa |
| `catElectrolyteSachets` | Electrolytes | إلكتروليت | Electrolitos |
| `catEnergyGels` | Energy Gels | جل طاقة | Geles energéticos |
| `catHelmet` | Helmet | خوذة | Casco |
| `catOther` | Other | أخرى | Otro |
| `catProteinBars` | Protein Bars | ألواح بروتين | Barritas de proteína |
| `catProteinCookies` | Protein Cookies | كوكيز بروتين | Galletas de proteína |
| `catProteinGummies` | Protein Gummies | علكة بروتين | Gominolas de proteína |
| `catProteinMuffins` | Protein Muffins | مافن بروتين | Muffins de proteína |
| `catProteinSnacks` | Protein Snacks | سناك بروتين | Snacks de proteína |
| `catSparePart` | Spare part | قطعة غيار | Repuesto |

### `col*` — 26 keys

| key | English | العربية | Español |
|---|---|---|---|
| `colActions` | Actions | الإجراءات | Acciones |
| `colBike` | Bike | الدراجة | Bici |
| `colBookingNum` | Booking # | رقم الحجز | Reserva n.º |
| `colBookings` | Bookings | الحجوزات | Reservas |
| `colCapacity` | Capacity | الطاقة | Capacidad |
| `colColor` | Bike Color | لون الدراجة | Color de bici |
| `colContact` | Contact | تواصل | Contacto |
| `colDate` | Date | التاريخ | Fecha |
| `colDay` | Day | اليوم | Día |
| `colDuration` | Duration | المدة | Duración |
| `colHeight` | Height | الطول | Altura |
| `colManageBike` | Manage Bike | إدارة الدراجة | Gestionar bici |
| `colManageBooking` | Manage Booking | إدارة الحجز | Gestionar reserva |
| `colManageRecord` | Manage Record | إدارة السجل | Gestionar registro |
| `colManageSession` | Manage Session | إدارة الجلسة | Gestionar sesión |
| `colMember` | Membership | العضوية | Membresía |
| `colPayment` | Payment | الدفع | Pago |
| `colPosition` | Position | الموضع | Posición |
| `colPrice` | Price | السعر | Precio |
| `colQueueNum` | # | # | # |
| `colRevenue` | Revenue | الإيرادات | Ingresos |
| `colRider` | Rider | الراكب | Ciclista |
| `colSession` | Session | الجلسة | Sesión |
| `colSizeType` | Size / Type | المقاس / النوع | Talla / Tipo |
| `colStatus` | Status | الحالة | Estado |
| `colWants` | Wants | الطلب | Quiere |

### `comm*` — 56 keys

| key | English | العربية | Español |
|---|---|---|---|
| `commAddBtn` | Add rider | إضافة مشارك | Añadir ciclista |
| `commAddDestLbl` | Add to | إضافة إلى | Añadir a |
| `commAddDestList` | Final list | القائمة النهائية | Lista final |
| `commAddDup` | Already booked in this session. | محجوز في هذه الجلسة بالفعل. | Ya tiene reserva en esta sesión. |
| `commAddGroupBtn` | Add group | إضافة مجموعة | Añadir grupo |
| `commAddGroupHint` | Pick two or more riders — they stay grouped together on the roster. | اختر مشاركَين أو أكثر — سيظهرون كمجموعة واحدة في القائمة. | Elige dos o más ciclistas: quedarán agrupados en la lista. |
| `commAddGroupMin` | Select at least 2 riders. | اختر مشاركَين على الأقل. | Selecciona al menos 2 ciclistas. |
| `commAddGroupTitle` | Add group to a JCC session | إضافة مجموعة إلى جلسة JCC | Añadir grupo a una sesión del JCC |
| `commAddNoMatch` | No matching customers. | لا يوجد عملاء مطابقون. | No hay clientes coincidentes. |
| `commAddOwnBike` | Rider brings their own bike (does not use a spot) | الراكب لديه دراجته الخاصة (لا يشغل مقعداً) | El ciclista trae su propia bici (no ocupa plaza) |
| `commAddRiderBtn` | Add rider | إضافة مشارك | Añadir ciclista |
| `commAddSearchLbl` | Customer | العميل | Cliente |
| `commAddSearchPh` | Search name, email or phone… | ابحث بالاسم أو البريد أو الجوال… | Busca por nombre, correo o teléfono… |
| `commAddTitle` | Add rider to the social ride | إضافة مشارك إلى الجولة الاجتماعية | Añadir ciclista al paseo social |
| `commAddedToast` | {0} added | تمت إضافة {0} | {0} añadido |
| `commCopied` | Leaderboard copied | تم نسخ لوحة المتصدرين | Clasificación copiada |
| `commCueConfirmed` | Your spot is confirmed! | تم تأكيد مقعدك! | ¡Tu plaza está confirmada! |
| `commCuePending` | Reserved - awaiting confirmation | تم الحجز - بانتظار التأكيد | Reservado: esperando confirmación |
| `commCueUnderReview` | Reserved - the rider list is being finalised | تم الحجز - يجري إعداد قائمة المشاركين | Reservado: se está finalizando la lista de ciclistas |
| `commCueWaitlist` | On the waitlist - we will notify you if a spot opens | في قائمة الانتظار - سنعلمك إذا توفر مقعد | En lista de espera: te avisaremos si se libera una plaza |
| `commEvents` | Upcoming rides | الرحلات القادمة | Próximos paseos |
| `commFullWaitlistMsg` | This ride is full. You can still reserve - you will join the waitlist, and if a spot opens the staff may select you. | هذه الجولة مكتملة. لا يزال بإمكانك الحجز - ستنضم إلى قائمة الانتظار، وإذا توفر مقعد فقد يختارك الموظفون. | Este paseo está completo. Aún puedes reservar: entrarás en la lista de espera y, si se libera una plaza, el personal podrá seleccionarte. |
| `commGatherShort` | Gathering | التجمع | Encuentro |
| `commGroupAddedToast` | {0} added as a group | تمت إضافة {0} كمجموعة | {0} añadidos como grupo |
| `commLeaderboard` | Leaderboard | المتصدرون | Clasificación |
| `commMaxTier` | Top tier reached | بلغ أعلى فئة | Nivel máximo alcanzado |
| `commMembersIg` | Message us on Instagram | راسلنا على إنستغرام | Escríbenos por Instagram |
| `commMembersMsg` | Our community rides are invite-only, for our community members. Keep riding with us at the Corniche Circuit, and if you would like to join the community, ask our team at the booth or message us on WhatsApp or Instagram. | جولات مجتمعنا بدعوة خاصة لأعضاء المجتمع. واصل الركوب معنا في حلبة الكورنيش، وإذا رغبت في الانضمام إلى المجتمع فاسأل فريقنا في الكشك أو راسلنا عبر واتساب أو إنستغرام. | Nuestras rutas de la comunidad son solo por invitación, para los miembros de nuestra comunidad. Sigue pedaleando con nosotros en el Circuito de la Corniche y, si quieres unirte a la comunidad, pregunta a nuestro equipo en la caseta o escríbenos por WhatsApp o Instagram. |
| `commMembersOk` | Got it | حسناً | Entendido |
| `commMembersTitle` | Community members only | لأعضاء المجتمع فقط | Solo para miembros de la comunidad |
| `commMileAway` | {0} away | تبقّى {0} | A {0} |
| `commMilestones` | Milestone watch | على وشك الإنجاز | Cerca de un hito |
| `commMilestonesSub` | Riders close to their next milestone | ركّاب قريبون من إنجازهم القادم | Ciclistas cerca de su próximo hito |
| `commNoEvents` | No upcoming sessions scheduled. | لا توجد جلسات قادمة. | No hay sesiones próximas programadas. |
| `commNoLeaders` | No completed rides yet. | لا توجد رحلات مكتملة بعد. | Aún no hay paseos completados. |
| `commNoMatch` | No rider matches. | لا يوجد راكب مطابق. | Ningún ciclista coincide. |
| `commRank` | Rank | الترتيب | Puesto |
| `commRider` | Rider | الراكب | Ciclista |
| `commRides` | rides | رحلات | paseos |
| `commSearchPh` | Search rider… | ابحث عن راكب… | Buscar ciclista… |
| `commShareBtn` | Share | مشاركة | Compartir |
| `commSoloOnly` | Saturday ride bookings are one rider per customer — extra riders cannot be added. | حجز جولة السبت لراكب واحد فقط لكل عميل — لا يمكن إضافة ركاب آخرين. | La Saturday Social Ride es de un solo ciclista por cliente: no se pueden añadir más. |
| `commSpotlight` | Top rider | الراكب الأبرز | Ciclista destacado |
| `commSpotsLeft` | {0} spots left | {0} مقاعد متبقية | {0} plazas libres |
| `commStartShort` | Start | الانطلاق | Salida |
| `commStatAvg` | Avg / rider | متوسط/راكب | Media / ciclista |
| `commStatMinutes` | Minutes ridden | دقائق الركوب | Minutos montados |
| `commStatRiders` | Active riders | الركّاب النشطون | Ciclistas activos |
| `commStatRides` | Rides | الرحلات | Paseos |
| `commSub` | Rider leaderboard and upcoming rides. | لوحة متصدّري الركّاب والرحلات القادمة. | Clasificación de ciclistas y próximos paseos. |
| `commTabAccounts` | Accounts | الحسابات | Cuentas |
| `commTabLeaderboard` | Leaderboard | المتصدرون | Clasificación |
| `commTabStats` | Statistics | الإحصائيات | Estadísticas |
| `commTitle` | Community | المجتمع | Comunidad |
| `commToNext` | {0} rides to {1} | {0} رحلات حتى {1} | {0} paseos para {1} |
| `commTopRiders` | Top riders by completed rides | أفضل الركّاب حسب الرحلات المكتملة | Mejores ciclistas por paseos completados |

### `confirm*` — 8 keys

| key | English | العربية | Español |
|---|---|---|---|
| `confirmBikeChange` | Confirm Change | تأكيد التغيير | Confirmar cambio |
| `confirmBtn` | Confirm | تأكيد | Confirmar |
| `confirmCheckin` | Confirm & Check In | تأكيد وتسجيل الدخول | Confirmar y registrar |
| `confirmDeleteBikeTitle` | Delete Bike? | حذف الدراجة؟ | ¿Eliminar bici? |
| `confirmNoShowTitle` | Mark as No-Show? | تسجيل كغائب؟ | ¿Marcar como ausencia? |
| `confirmRemoveTitle` | Remove Rider? | حذف الراكب؟ | ¿Quitar ciclista? |
| `confirmUndoTitle` | Undo action? | التراجع عن الإجراء؟ | ¿Deshacer acción? |
| `confirmUndoYes` | Yes, undo it | نعم، تراجع | Sí, deshacer |

### `cust*` — 11 keys

| key | English | العربية | Español |
|---|---|---|---|
| `custAvgRating` | Avg rating | متوسط التقييم | Valoración media |
| `custBookingsLabel` | Booking history | سجل الحجوزات | Historial de reservas |
| `custBtn` | Customer | العميل | Cliente |
| `custFavType` | Favorite type | النوع المفضل | Tipo favorito |
| `custMemberSince` | First seen | أول ظهور | Visto por primera vez |
| `custNoBookings` | No bookings. | لا حجوزات. | Sin reservas. |
| `custProfileTitle` | Customer profile | ملف العميل | Perfil del cliente |
| `custPurchTitle` | Purchases | المشتريات | Compras |
| `custTotalRides` | Completed rides | الرحلات المكتملة | Paseos completados |
| `custTotalSpent` | Total spent | إجمالي الإنفاق | Gasto total |
| `custWalkIn` | Walk-in (no account) | زائر (بدون حساب) | Sin reserva (sin cuenta) |

### `dash*` — 12 keys

| key | English | العربية | Español |
|---|---|---|---|
| `dashAddonsToday` | Add-ons today | إضافات اليوم | Extras de hoy |
| `dashAlerts` | Alerts | التنبيهات | Alertas |
| `dashAllClear` | All clear - nothing needs attention. | كل شيء على ما يرام - لا شيء يحتاج انتباهاً. | Todo en orden - nada requiere atención. |
| `dashAvailBikes` | Available bikes | الدراجات المتاحة | Bicis disponibles |
| `dashLowBikes` | Only {0} bikes available | تبقّى {0} دراجات متاحة فقط | Solo {0} bicis disponibles |
| `dashMaintAlert` | {0} bike(s) in maintenance | {0} دراجة في الصيانة | {0} bici(s) en mantenimiento |
| `dashOnBikes` | On bikes now | على الدراجات الآن | En bici ahora |
| `dashOpenSessions` | Open sessions | الجلسات المفتوحة | Sesiones abiertas |
| `dashOverdueSub` | Ride running long | الرحلة تطول | Paseo alargándose |
| `dashSub` | Live overview of the booth right now. | نظرة حية على الكشك الآن. | Vista en vivo de la caseta ahora mismo. |
| `dashTitle` | Dashboard | لوحة القيادة | Panel |
| `dashWaiting` | Waiting | في الانتظار | En espera |

### `edit*` — 12 keys

| key | English | العربية | Español |
|---|---|---|---|
| `editBikeTitle` | Edit Bike | تعديل الدراجة | Editar bici |
| `editBookingBtn` | Edit | تعديل | Editar |
| `editBookingSub` | Change the rider details or move the booking, the same fields the customer can edit. | عدّل بيانات الراكب أو انقل الحجز، نفس الحقول التي يمكن للعميل تعديلها. | Cambia los datos del ciclista o mueve la reserva, los mismos campos que puede editar el cliente. |
| `editBookingTitle` | Edit Booking | تعديل الحجز | Editar reserva |
| `editBtn` | Edit | تعديل | Editar |
| `editBtn2` | Edit | تعديل | Editar |
| `editPriceBtn` | Edit Price | تعديل السعر | Editar precio |
| `editPriceCustom` | Custom Amount | مبلغ مخصص | Importe personalizado |
| `editPriceTip` | Edit price | تعديل السعر | Editar precio |
| `editPriceTitle` | Edit Payment Amount | تعديل مبلغ الدفع | Editar importe del pago |
| `editQNumTip` | Edit booking number | تعديل رقم الحجز | Editar número de reserva |
| `editSessionTitle` | Edit Session | تعديل الجلسة | Editar sesión |

### `err*` — 74 keys

| key | English | العربية | Español |
|---|---|---|---|
| `errAccountName` | Please enter your name. | الرجاء إدخال اسمك. | Introduce tu nombre. |
| `errAccountNotFound` | No account found with that email. | لا يوجد حساب بهذا البريد الإلكتروني. | No hay ninguna cuenta con ese correo. |
| `errAddBikeToSession` | Please add at least one bike to the session. | الرجاء إضافة دراجة واحدة على الأقل للجلسة. | Añade al menos una bici a la sesión. |
| `errAdminOnly` | Admin accounts only. | للمسؤولين فقط. | Solo cuentas de administrador. |
| `errAlreadyBooked` | You already have a booking for this session. | لديك حجز مسبق في هذه الجلسة. | Ya tienes una reserva para esta sesión. |
| `errAlreadyBookedSub` | Would you like to modify your existing booking instead? | هل تريد تعديل حجزك الحالي؟ | ¿Prefieres modificar tu reserva existente? |
| `errBikeFrameReq` | Please select a frame type. | الرجاء اختيار نوع الإطار. | Selecciona un tipo de cuadro. |
| `errBikeInUse` | Cannot change status while in use. | لا يمكن التغيير والدراجة قيد الاستخدام. | No se puede cambiar el estado mientras está en uso. |
| `errBikeLocationReq` | Please select a location. | الرجاء اختيار الموقع. | Selecciona una ubicación. |
| `errBikeName` | Please enter a bike name. | الرجاء إدخال اسم الدراجة. | Introduce un nombre para la bici. |
| `errBikeNumberDup` | That bike number is already in use. | رقم الدراجة مستخدم بالفعل. | Ese número de bici ya está en uso. |
| `errBikeNumberReq` | Please enter a bike number. | الرجاء إدخال رقم الدراجة. | Introduce un número de bici. |
| `errBikeTypeReq` | Please select a bike type. | الرجاء اختيار نوع الدراجة. | Selecciona un tipo de bici. |
| `errBikeUnavailable` | Bike no longer available. | الدراجة غير متاحة حالياً. | La bici ya no está disponible. |
| `errCancelWaiting` | Only waiting bookings can be cancelled. | يمكن إلغاء حجوزات الانتظار فقط. | Solo se pueden cancelar reservas en espera. |
| `errCheckinRejected` | Check-in could not be saved. The server rejected the change, sign out and sign back in as staff, then try again. | تعذّر حفظ تسجيل الدخول. رفض الخادم التغيير، سجّل الخروج ثم الدخول كموظف وحاول مجدداً. | No se pudo guardar el registro. El servidor rechazó el cambio; cierra sesión y vuelve a entrar como personal, luego inténtalo de nuevo. |
| `errCommSessGate` | Could not create the community event - run tags-events-migration.sql first. | تعذّر إنشاء الفعالية المجتمعية - شغّل ملف tags-events-migration.sql أولًا. | No se pudo crear el evento comunitario: ejecuta antes tags-events-migration.sql. |
| `errConnection` | Connection error. Check your network. | خطأ في الاتصال. تحقق من شبكتك. | Error de conexión. Comprueba tu red. |
| `errCreateSession` | Error creating session. | حدث خطأ في إنشاء الجلسة. | Error al crear la sesión. |
| `errDateExists` | A session for that date already exists. | توجد جلسة بهذا التاريخ مسبقاً. | Ya existe una sesión para esa fecha. |
| `errDeleteSession` | Error deleting session. | حدث خطأ في حذف الجلسة. | Error al eliminar la sesión. |
| `errEmailExists` | An account with this email already exists. | يوجد حساب بهذا البريد الإلكتروني مسبقاً. | Ya existe una cuenta con este correo. |
| `errEmailOrPhone` | Please enter at least an email or phone number. | الرجاء إدخال بريد إلكتروني أو رقم هاتف على الأقل. | Introduce al menos un correo o un teléfono. |
| `errEmailRequired` | Please enter your email address. | الرجاء إدخال بريدك الإلكتروني. | Introduce tu correo electrónico. |
| `errEnterName` | Please enter your full name (first and last name). | الرجاء إدخال اسمك الكامل (الاسم الأول والأخير). | Introduce tu nombre completo (nombre y apellido). |
| `errFieldRequired` | This field is required. | هذا الحقل مطلوب. | Este campo es obligatorio. |
| `errGoogleNoPw` | This account uses Google or Apple sign-in. Use that button to log in. | هذا الحساب يستخدم تسجيل الدخول عبر Google أو Apple. استخدم ذلك الزر للدخول. | Esta cuenta usa el acceso de Google o Apple. Usa ese botón para entrar. |
| `errGroupCap` | Up to {0} riders per booking on this ride. | حتى {0} راكبين لكل حجز في هذه الجولة. | Hasta {0} ciclistas por reserva en esta ruta. |
| `errHasBookings` | Cannot delete a session with existing bookings. | لا يمكن حذف جلسة تحتوي على حجوزات. | No se puede eliminar una sesión con reservas. |
| `errHasSales` | Cannot delete a session that has recorded sales. Refund or move them first. | لا يمكن حذف جلسة تحتوي على مبيعات مسجلة. استردها أو انقلها أولاً. | No se puede eliminar una sesión con ventas registradas. Reembólsalas o muévelas primero. |
| `errHeightReq` | Please enter your height in cm. | الرجاء إدخال طولك بالسنتيمتر. | Introduce tu altura en cm. |
| `errInvalidCredentials` | Incorrect credentials. Please try again. | بيانات الدخول غير صحيحة. حاول مجدداً. | Correo/teléfono o contraseña incorrectos. |
| `errLoginFirst` | Please log in first. | الرجاء تسجيل الدخول أولاً. | Inicia sesión primero. |
| `errLoginLocked` | Too many failed attempts. Please wait about 15 minutes and try again, or reset your password. | محاولات كثيرة فاشلة. انتظر حوالي ١٥ دقيقة ثم حاول مجدداً، أو أعد تعيين كلمة المرور. | Demasiados intentos fallidos. Espera unos 15 minutos e inténtalo de nuevo, o restablece tu contraseña. |
| `errMaxOneBike` | A rider can only have one bike. | لا يمكن تخصيص أكثر من دراجة واحدة للراكب. | Un ciclista solo puede tener una bici. |
| `errNoInternet` | You appear to be offline — check your connection and try again. | يبدو أنك غير متصل بالإنترنت — تحقق من الاتصال وحاول مجدداً. | Parece que no tienes conexión — revísala e inténtalo de nuevo. |
| `errNotEnoughSpots` | Not enough spots available. | لا توجد مقاعد كافية. | No hay plazas suficientes. |
| `errNoteCustomer` | Who is this note about? | عن مَن هذه الملاحظة؟ | ¿Sobre quién es esta nota? |
| `errNoteRequired` | Write a note first. | اكتب الملاحظة أولاً. | Escribe la nota primero. |
| `errPasswordLen` | Password must be at least 8 characters and include an uppercase letter and a number. | يجب أن تكون كلمة المرور 8 أحرف على الأقل وتحتوي على حرف كبير ورقم. | La contraseña debe tener al menos 8 caracteres e incluir una mayúscula y un número. |
| `errPasswordMatch` | Passwords do not match. | كلمتا المرور غير متطابقتين. | Las contraseñas no coinciden. |
| `errPasswordRequired` | Please enter your password. | الرجاء إدخال كلمة المرور. | Introduce tu contraseña. |
| `errPhoneExists` | An account with this phone number already exists. | يوجد حساب بهذا الرقم مسبقاً. | Ya existe una cuenta con este teléfono. |
| `errPhoneInSession` | This phone number is already registered for that session. | رقم الهاتف مسجّل في هذه الجلسة مسبقاً. | Este teléfono ya está registrado en esa sesión. |
| `errPhoneRegistered` | Phone already registered. | رقم الهاتف مسجّل مسبقاً. | Teléfono ya registrado. |
| `errPhoneRequired` | Please enter your phone number. | الرجاء إدخال رقم هاتفك. | Introduce tu número de teléfono. |
| `errPickDate` | Please pick a date. | الرجاء اختيار تاريخ. | Elige una fecha. |
| `errPinWrong` | Incorrect PIN. Try again. | رمز PIN غير صحيح. حاول مجدداً. | PIN incorrecto. Inténtalo de nuevo. |
| `errQNumTaken` | That number is already taken by another booking. | هذا الرقم مستخدم بالفعل لحجز آخر. | Ese número ya lo tiene otra reserva. |
| `errResetNoMatch` | That email and phone number do not match an account. | البريد الإلكتروني ورقم الهاتف لا يطابقان أي حساب. | Ese correo y teléfono no coinciden con ninguna cuenta. |
| `errRiderName` | Please enter rider name. | الرجاء إدخال اسم الراكب. | Introduce el nombre del ciclista. |
| `errRiderPhone` | Please enter phone number. | الرجاء إدخال رقم الهاتف. | Introduce el número de teléfono. |
| `errSaveAccount` | Error saving changes. Please try again. | حدث خطأ في الحفظ. حاول مجدداً. | Error al guardar. Inténtalo de nuevo. |
| `errSelectBike` | Please select a bike. | الرجاء اختيار دراجة. | Selecciona una bici. |
| `errSelectGender` | Please select your gender. | الرجاء اختيار جنسك. | Selecciona tu género. |
| `errSelectSession` | Please select a session above. | الرجاء اختيار جلسة من الأعلى. | Elige una sesión primero. |
| `errSelectSizeGeneric` | Please select a frame size. | الرجاء اختيار مقاس الإطار. | Selecciona una talla. |
| `errSelectTypeGeneric` | Please select a bike type. | الرجاء اختيار نوع الدراجة. | Elige un tipo de bici. |
| `errServerError` | Server error. | خطأ في الخادم. | Error del servidor. |
| `errSessionClosed` | That session is no longer open. | هذه الجلسة لم تعد مفتوحة. | Esa sesión ya no está abierta. |
| `errSessionFull` | Session is full. | الجلسة ممتلئة. | La sesión está completa. |
| `errSessionStale` | Your session has expired — please sign in again. | انتهت صلاحية جلستك — يرجى تسجيل الدخول من جديد. | Tu sesión ha caducado. Inicia sesión de nuevo. |
| `errSomethingWrong` | Something went wrong - it was logged. | حدث خطأ ما - تم تسجيله. | Algo salió mal - quedó registrado. |
| `errStaffAuthExpired` | Your staff sign-in has expired. Sign in again, then retry. | انتهت صلاحية تسجيل دخول الموظف. سجّل الدخول مجددًا ثم أعد المحاولة. | Tu sesión de personal ha caducado. Inicia sesión de nuevo e inténtalo otra vez. |
| `errStaffNotAuthorized` | This account is not on the staff list. | هذا الحساب ليس ضمن قائمة الموظفين. | Esta cuenta no está en la lista del personal. |
| `errStockWrite` | Stock for {0} was not saved — the count on screen has been put back. | لم يتم حفظ مخزون {0} — تمت إعادة العدد الظاهر على الشاشة. | No se guardó el stock de {0} — se ha restaurado el recuento en pantalla. |
| `errStorageFull` | Device storage is full — free some space; unsynced sales/bookings may not be saved. | ذاكرة الجهاز ممتلئة — أفرغ بعض المساحة؛ قد لا تُحفظ المبيعات/الحجوزات غير المتزامنة. | El almacenamiento del dispositivo está lleno — libera espacio; las ventas/reservas sin sincronizar podrían no guardarse. |
| `errValidEmail` | Please enter a valid email address. | الرجاء إدخال بريد إلكتروني صحيح. | Introduce un correo electrónico válido. |
| `errValidHeightCm` | Enter a height between 100 and 250 cm. | أدخل طولاً بين 100 و250 سم. | Introduce una altura válida en cm (100-250). |
| `errValidPhone` | Please enter a valid phone number (at least 8 digits). | الرجاء إدخال رقم هاتف صحيح (٨ أرقام على الأقل). | Introduce un número de teléfono válido (mínimo 8 dígitos). |
| `errValidPrice` | Please enter a valid price (0 or above). | الرجاء إدخال سعر صحيح (صفر أو أكثر). | Introduce un precio válido (0 o más). |
| `errWaitlistFull` | The waitlist for this session is full. | قائمة الانتظار لهذه الجلسة ممتلئة. | La lista de espera de esta sesión está llena. |
| `errWriteDup` | That booking number was just taken by another device. Reload and try again. | تم أخذ رقم الحجز للتو من جهاز آخر. أعد التحميل وحاول مجددًا. | Otro dispositivo acaba de tomar ese número de reserva. Recarga e inténtalo de nuevo. |
| `errWritePerm` | That did not save - your staff session may have expired. Unlock again and retry. | لم يتم الحفظ - ربما انتهت جلسة الموظف. أعد فتح القفل ثم حاول مجددًا. | No se guardó - puede que tu sesión de personal haya caducado. Vuelve a desbloquear e inténtalo. |

### `filter*` — 14 keys

| key | English | العربية | Español |
|---|---|---|---|
| `filterAll` | All | الكل | Todos |
| `filterCancelled` | Cancelled | ملغي | Cancelados |
| `filterDone` | Done | منتهي | Terminados |
| `filterNoshow` | No-Show | لم يحضر | Ausencias |
| `filterOnBike` | On Bike | على الدراجة | En bici |
| `filterPaid` | Paid | مدفوع | Pagados |
| `filterPay` | Pay | الدفع | Pago |
| `filterRejected` | Rejected | مرفوض | Rechazados |
| `filterRentalBike` | Rental bike | دراجة مستأجرة | Bici de alquiler |
| `filterSize` | Size | المقاس | Talla |
| `filterStatus` | Status | الحالة | Estado |
| `filterType` | Type | النوع | Tipo |
| `filterUnpaid` | Unpaid | غير مدفوع | Sin pagar |
| `filterWaiting` | Waiting | بانتظار | En espera |

### `fr*` — 16 keys

| key | English | العربية | Español |
|---|---|---|---|
| `frBikes` | Fleet (Bikes) | الأسطول (الدراجات) | Flota (bicis) |
| `frBikesSub` | All bikes in the fleet | جميع الدراجات في الأسطول | Todas las bicis de la flota |
| `frBookings` | Bookings & Queue | الحجوزات والطابور | Reservas y cola |
| `frBookingsSub` | All queue entries and ride history | جميع إدخالات الطابور وسجل الرحلات | Todas las entradas de la cola y el historial de paseos |
| `frChoose` | Choose what to reset: | اختر ما تريد إعادة ضبطه: | Elige qué restablecer: |
| `frCustomers` | Customers | العملاء | Clientes |
| `frCustomersSub` | All customer accounts and login data | جميع حسابات العملاء وبيانات الدخول | Todas las cuentas de clientes y datos de acceso |
| `frDeleteBtn` | Delete Selected Data | حذف البيانات المحددة | Eliminar datos seleccionados |
| `frSessions` | Sessions | الجلسات | Sesiones |
| `frSessionsSub` | All created sessions | جميع الجلسات المُنشأة | Todas las sesiones creadas |
| `frTitle` | Factory Reset | إعادة ضبط المصنع | Restablecimiento de fábrica |
| `frTypeAfter` | to confirm: | للتأكيد: | para confirmar: |
| `frTypeBefore` | Type | اكتب | Escribe |
| `frWarn1` | This will permanently delete | سيؤدي هذا إلى حذف | Esto eliminará permanentemente |
| `frWarn2` | data — bookings, sessions, bikes, and customers. | البيانات نهائياً — الحجوزات والجلسات والدراجات والعملاء. | los datos — reservas, sesiones, bicis y clientes. |
| `frWarnAll` | ALL | كل | TODOS |

### `hist*` — 12 keys

| key | English | العربية | Español |
|---|---|---|---|
| `histInLabel` | Check-in | الدخول | Entrada |
| `histLogBtn` | Log | السجل | Registro |
| `histMarkSelPaid` | Mark {0} paid | تحديد {0} كمدفوع | Marcar {0} pagados |
| `histOutLabel` | Check-out | الخروج | Salida |
| `histRange30` | Last 30 days | آخر 30 يومًا | Últimos 30 días |
| `histRange7` | Last 7 days | آخر 7 أيام | Últimos 7 días |
| `histRangeLabel` | Range | المدة | Rango |
| `histRangeToday` | Today | اليوم | Hoy |
| `histRemoved` | Removed | محذوف | Eliminado |
| `histRestored` | Restored | مستعاد | Restaurado |
| `histTabRides` | Rides | الرحلات | Paseos |
| `histWindowNote` | Showing the last 12 months | يعرض آخر 12 شهرًا | Mostrando los últimos 12 meses |

### `inv*` — 33 keys

| key | English | العربية | Español |
|---|---|---|---|
| `invAddBtn` | + Add item | + إضافة عنصر | + Añadir artículo |
| `invBikesTotal` | Fleet | الأسطول | Flota |
| `invBrand` | Brand | العلامة التجارية | Marca |
| `invCategory` | Category | الفئة | Categoría |
| `invCost` | Cost (SAR) | التكلفة (ريال) | Coste (SAR) |
| `invCostHint` | (what you pay — powers margin) | (ما تدفعه — يُحسب منه الربح) | (lo que pagas — alimenta el margen) |
| `invFlavour` | Flavour | النكهة | Sabor |
| `invFree` | Free | مجاني | Gratis |
| `invInStock` | In stock | متوفر | En stock |
| `invItemName` | Item | العنصر | Artículo |
| `invLowAlert` | {0} item(s) need restocking | {0} عنصر بحاجة لإعادة تخزين | {0} artículo(s) necesitan reposición |
| `invLowAt` | Low-stock at | تنبيه عند | Aviso de stock bajo en |
| `invLowStock` | Low stock | مخزون منخفض | Stock bajo |
| `invManageBikes` | Manage in Bikes tab | الإدارة في تبويب الدراجات | Gestionar en la pestaña Bicis |
| `invNoBrand` | No brand | بدون علامة | Sin marca |
| `invNoFlavour` | No flavour | بدون نكهة | Sin sabor |
| `invNoItems` | No inventory items yet. Add helmets, locks, accessories or spare parts. | لا توجد عناصر بعد. أضف الخوذ والأقفال والإكسسوارات أو قطع الغيار. | Aún no hay artículos. Añade cascos, candados, accesorios o repuestos. |
| `invOutStock` | Out of stock | نفد المخزون | Agotado |
| `invPrice` | Price (SAR) | السعر (ريال) | Precio (SAR) |
| `invProteinType` | Type | النوع | Tipo |
| `invQty` | In stock | المتوفر | En stock |
| `invSaved` | Inventory updated | تم تحديث المخزون | Inventario actualizado |
| `invSearchPh` | Search items… | ابحث عن العناصر… | Buscar artículos… |
| `invSecBikes` | Bikes | الدراجات | Bicis |
| `invSecEquipment` | Equipment | المعدات | Equipamiento |
| `invSecSupplements` | Supplements & Beverages | المكمّلات والمشروبات | Suplementos y bebidas |
| `invSortCat` | By category | حسب الفئة | Por categoría |
| `invSortSales` | Best sellers | الأكثر مبيعاً | Más vendidos |
| `invSortStock` | Lowest stock | الأقل مخزوناً | Menos stock |
| `invSub` | Helmets, accessories and spare-part stock. | الخوذ والإكسسوارات وقطع الغيار. | Cascos, accesorios y repuestos. |
| `invTitle` | Inventory | المخزون | Inventario |
| `invVolumeMl` | Volume (ml) | الحجم (مل) | Volumen (ml) |
| `invVolumeMlPh` | e.g. 500 | مثال: 500 | p. ej. 500 |

### `kb*` — 8 keys

| key | English | العربية | Español |
|---|---|---|---|
| `kbCheckin` | Check in next rider | تسجيل دخول الراكب التالي | Registrar al siguiente ciclista |
| `kbCommunity` | Community | المجتمع | Comunidad |
| `kbInventory` | Inventory | المخزون | Inventario |
| `kbNoWaiting` | No riders waiting | لا يوجد ركاب في الانتظار | No hay ciclistas en espera |
| `kbRefresh` | Refresh now | تحديث الآن | Actualizar ahora |
| `kbSearch` | Search / find a booking | بحث / إيجاد حجز | Buscar una reserva |
| `kbTitle` | Keyboard shortcuts | اختصارات لوحة المفاتيح | Atajos de teclado |
| `kbToggle` | Toggle this help | إظهار/إخفاء المساعدة | Mostrar/ocultar esta ayuda |

### `land*` — 10 keys

| key | English | العربية | Español |
|---|---|---|---|
| `landChooseEvent` | Pick your event | اختر فعاليتك | Elige tu evento |
| `landCommSoon` | Details coming soon | التفاصيل قريبًا | Detalles próximamente |
| `landCommTitle` | Micromobility Rides | جولات مايكروموبيليتي | Rutas MicroMobility |
| `landEventCommunity` | Community event | فعالية مجتمعية | Evento comunitario |
| `landEventRide` | Circuit ride | جولة الحلبة | Paseo en el circuito |
| `landEyebrow` | Rides & Events | جولات وفعاليات | Paseos y eventos |
| `landJccCardTitle` | Evening Circuit Session | جلسة الحلبة المسائية | Sesión Nocturna del Circuito |
| `landJccMeta` | Sun & Tue · 9-11pm · Road, Hybrid & Mountain | الأحد والثلاثاء · 9-11 مساءً · طريق، هجين وجبلي | Dom y mar · 9-11pm · Carretera, híbrida y montaña |
| `landJccTitle` | Jeddah Corniche Circuit | حلبة كورنيش جدة | Circuito Corniche de Yeda |
| `landSessionsOpen` | {0} sessions open | {0} جلسات متاحة | {0} sesiones abiertas |

### `lb*` — 13 keys

| key | English | العربية | Español |
|---|---|---|---|
| `lbMinutes` | Minutes | الدقائق | Minutos |
| `lbNewLabel` | new | جديد | nuevo |
| `lbRankByLabel` | Rank by | الترتيب حسب | Ordenar por |
| `lbRidersBooked` | Riders booked | الركّاب المحجوزون | Ciclistas reservados |
| `lbScopeOwner` | Booking owners | أصحاب الحجوزات | Titulares de reserva |
| `lbScopeOwnerSub` | Credited for every rider in their bookings | يُحتسب لكل راكب في حجوزاتهم | Se les acredita cada ciclista de sus reservas |
| `lbScopeRider` | Riders | الركّاب | Ciclistas |
| `lbScopeRiderSub` | Each individual rider | كل راكب على حدة | Cada ciclista individual |
| `lbSpent` | Spent | الإنفاق | Gastado |
| `lbStreakTip` | {0}-week streak | {0} أسابيع متتالية | Racha de {0} semanas |
| `lbWindowAll` | All-time | كل الأوقات | Histórico |
| `lbWindowMonth` | This month | هذا الشهر | Este mes |
| `lbWindowWeek` | This week | هذا الأسبوع | Esta semana |

### `log*` — 29 keys

| key | English | العربية | Español |
|---|---|---|---|
| `logAcctCreated` | Account created:  | تم إنشاء حساب:  | Cuenta creada:  |
| `logAcctCreatedGoogle` | Account created (Google):  | تم إنشاء حساب (جوجل):  | Cuenta creada (Google):  |
| `logBookedWord` | Booked | تم الحجز | Reservado |
| `logBulkCheckin` | Bulk checked in {0} | تسجيل دخول {0} (جماعي) | Registro masivo de {0} |
| `logBulkPaid` | Bulk marked {0} paid | تعليم {0} كمدفوع (جماعي) | Marcados {0} como pagados |
| `logCatAuth` | Access | الوصول | Acceso |
| `logCatBike` | Bikes | الدراجات | Bicis |
| `logCatBook` | Bookings | الحجوزات | Reservas |
| `logCatInv` | Inventory | المخزون | Inventario |
| `logCatOther` | Other | أخرى | Otro |
| `logCatPay` | Payment | الدفع | Pago |
| `logExportedBackup` | Exported data backup | تصدير نسخة احتياطية | Copia de seguridad exportada |
| `logLoggedIn` | Logged in:  | تسجيل الدخول:  | Sesión iniciada:  |
| `logLoggedOut` | Logged out:  | تسجيل الخروج:  | Sesión cerrada:  |
| `logOperatorSet` | Operator changed: {0} | تغيير المشغّل: {0} | Cambio de operador: {0} |
| `logOut` | Log Out | تسجيل الخروج | Cerrar sesión |
| `logPrintedReport` | Printed session report | طُبع تقرير الجلسة | Informe de sesión impreso |
| `logPromotedFromWaitlist` | Promoted #{0} {1} from waitlist | ترقية #{0} {1} من قائمة الانتظار | Promovido #{0} {1} desde la lista de espera |
| `logPwdResetSelf` | Password reset (self-service):  | إعادة تعيين كلمة المرور (ذاتي):  | Contraseña restablecida (autoservicio):  |
| `logRestoredBooking` | Restored booking | استعادة الحجز | Reserva restaurada |
| `logStaffResetPwd` | Staff reset password for  | الموظف أعاد تعيين كلمة المرور لـ  | El personal restableció la contraseña de  |
| `logStaffUnlocked` | Staff panel unlocked | تم فتح لوحة الموظفين | Panel del personal desbloqueado |
| `logStockAdj` | Stock {0}: {1} | المخزون {0}: {1} | Stock {0}: {1} |
| `logStockTake` | Stock-take {0}: {1} → {2} | جرد {0}: {1} → {2} | Inventario {0}: {1} → {2} |
| `logSwitchedAdmin` | Switched to Admin role | التحويل إلى دور المدير | Cambio al rol de administrador |
| `logToday` | Today | اليوم | Hoy |
| `logUpdatedBooking` | Updated booking | تحديث الحجز | Reserva actualizada |
| `logWaitlistedWord` | Waitlisted | قائمة الانتظار | En lista de espera |
| `logYesterday` | Yesterday | أمس | Ayer |

### `logs*` — 11 keys

| key | English | العربية | Español |
|---|---|---|---|
| `logsActivity` | Activity Log | سجل النشاط | Registro de actividad |
| `logsColAction` | Action | الإجراء | Acción |
| `logsColBy` | By | بواسطة | Por |
| `logsColTime` | Time | الوقت | Hora |
| `logsEmpty` | No actions logged yet. | لم يتم تسجيل أي إجراءات بعد. | Aún no hay acciones registradas. |
| `logsExportBtn` | Export CSV | تصدير CSV | Exportar CSV |
| `logsOperator` | Operator | الموظف | Operador |
| `logsOperatorPh` | Your name (tags the audit log) | اسمك (يوسم سجل التدقيق) | Tu nombre (marca el registro de auditoría) |
| `logsPermanentNote` | Shared audit trail - actions from every staff device, synced to the database. | سجل تدقيق مشترك - إجراءات كل أجهزة الموظفين، متزامنة مع قاعدة البيانات. | Registro de auditoría compartido - acciones de todos los dispositivos del personal, sincronizadas con la base de datos. |
| `logsSearchPh` | Search actions… | ابحث في الإجراءات… | Buscar acciones… |
| `logsTitle` | Action Log | سجل الإجراءات | Registro de acciones |

### `mw*` — 17 keys

| key | English | العربية | Español |
|---|---|---|---|
| `mwAddBtn` | Add | إضافة | Añadir |
| `mwBrowseBtn` | From bookings | من الحجوزات | Desde reservas |
| `mwCustTag` | Customer | عميل | Cliente |
| `mwEmptyForSess` | Nobody on the list for this session — pick All Sessions to see the rest. | لا أحد في القائمة لهذه الجلسة — اختر كل الجلسات لعرض البقية. | Nadie en la lista para esta sesión — elige Todas las sesiones para ver el resto. |
| `mwFromBookings` | Bookings & waitlist | الحجوزات وقائمة الانتظار | Reservas y lista de espera |
| `mwFromCustomers` | Saved customers | العملاء المحفوظون | Clientes guardados |
| `mwHideBtn` | Hide list | إخفاء القائمة | Ocultar lista |
| `mwMoveBtn` | To staff list | إلى قائمة الموظفين | A lista del personal |
| `mwMovedToast` | {0} moved to the staff list | تم نقل {0} إلى قائمة الموظفين | {0} movido a la lista del personal |
| `mwNoMatches` | Nobody left to add matches that. | لا يوجد من يمكن إضافته يطابق ذلك. | Nadie por añadir coincide con eso. |
| `mwOnlyOpenMsg` | Only a booking that has not ridden yet can go on the staff list. | يمكن إضافة الحجوزات التي لم تبدأ ركوبها فقط إلى قائمة الموظفين. | Solo una reserva que aún no ha salido a rodar puede ir a la lista del personal. |
| `mwPartyMovedToast` | {0} riders moved to the staff list | تم نقل {0} راكبين إلى قائمة الموظفين | {0} ciclistas movidos a la lista del personal |
| `mwRemovePartyBody` | This takes all {0} riders off the staff list. Their bookings are not touched. | سيؤدي هذا إلى إزالة {0} راكبين من قائمة الموظفين. لن تتأثر حجوزاتهم. | Esto quita a los {0} ciclistas de la lista del personal. Sus reservas no se tocan. |
| `mwRidersN` | {0} riders | {0} راكبين | {0} ciclistas |
| `mwSearchPh` | Booking number, name or phone… | رقم الحجز أو الاسم أو الهاتف… | Número de reserva, nombre o teléfono… |
| `mwSub` | Hand-picked and hand-ordered by staff — drag or use the arrows. | يضيفها ويرتبها الموظفون يدوياً — بالسحب أو بالأسهم. | Añadida y ordenada a mano por el personal: arrastra o usa las flechas. |
| `mwTitle` | Staff Managed Waitlist | قائمة انتظار يديرها الموظفون | Lista gestionada por el personal |

### `na*` — 11 keys

| key | English | العربية | Español |
|---|---|---|---|
| `naBtn` | New account | حساب جديد | Cuenta nueva |
| `naCreateBtn` | Create account | إنشاء الحساب | Crear cuenta |
| `naDelBody` | The login, tags, notes and any push subscriptions are removed. {0} past booking(s) stay on record with the rider’s name, so rosters and reports are unchanged. This can be undone from the bar at the top. | سيُحذف تسجيل الدخول والوسوم والملاحظات واشتراكات الإشعارات. تبقى {0} حجوزات سابقة باسم الراكب، فلا تتأثر الكشوف والتقارير. ويمكن التراجع من الشريط في الأعلى. | Se eliminan el acceso, las etiquetas, las notas y las suscripciones push. Las {0} reservas anteriores se conservan con el nombre del ciclista, así que los listados y los informes no cambian. Puedes deshacerlo desde la barra superior. |
| `naDelBtn` | Delete account | حذف الحساب | Eliminar cuenta |
| `naDelDone` | {0}’s account deleted | تم حذف حساب {0} | Cuenta de {0} eliminada |
| `naDelLiveMsg` | This rider has {0} live booking(s). Finish or cancel those first — deleting the account under them leaves a booking nobody can look up. | لدى هذا الراكب {0} حجز/حجوزات قائمة. أنهِها أو ألغِها أولاً — حذف الحساب يترك حجزاً لا يمكن لأحد الوصول إليه. | Este ciclista tiene {0} reserva(s) activa(s). Termínalas o cancélalas primero: borrar la cuenta deja una reserva que nadie puede consultar. |
| `naDelTitle` | Delete this account | حذف هذا الحساب | Eliminar esta cuenta |
| `naEditTitle` | Edit customer | تعديل العميل | Editar cliente |
| `naPwdKeepHint` | leave blank to keep | اتركه فارغًا للإبقاء عليها | déjalo en blanco para conservar |
| `naSaveBtn` | Save changes | حفظ التغييرات | Guardar cambios |
| `naTitle` | Create customer account | إنشاء حساب عميل | Crear cuenta de cliente |

### `no*` — 19 keys

| key | English | العربية | Español |
|---|---|---|---|
| `noBikes` | No bikes found. Add your first bike above. | لا توجد دراجات. أضف أول دراجة أعلاه. | No hay bicis. Añade la primera arriba. |
| `noBikesForType` | No {0} bikes in the fleet. | لا توجد دراجات من نوع {0} في الأسطول. | No hay bicis {0} en la flota. |
| `noBikesMatchFleet` | No bikes match this session's fleet. | لا توجد دراجات مطابقة لأسطول هذه الجلسة. | Ninguna bici coincide con la flota de esta sesión. |
| `noCurrentRides` | No upcoming bookings. Reserve a ride to get started. | لا حجوزات قادمة. احجز رحلة للبدء. | No tienes reservas próximas. Reserva un paseo para empezar. |
| `noEmailLabel` | no email | لا بريد إلكتروني | sin correo |
| `noHistory` | No riders match the current filters. | لا يوجد راكبون يطابقون الفلتر الحالي. | Ningún ciclista coincide con los filtros actuales. |
| `noOtherTypes` | No other types available either. | لا توجد أنواع أخرى متاحة. | Tampoco hay otros tipos disponibles. |
| `noPastRides` | No completed rides yet. | لا توجد رحلات مكتملة بعد. | Aún no hay paseos anteriores. |
| `noRatingsYet` | No ratings collected yet. | لا توجد تقييمات بعد. | Aún no hay valoraciones. |
| `noResultsLabel` | No bikes match your search. | لا توجد دراجات تطابق بحثك. | Ninguna bici coincide con tu búsqueda. |
| `noRiderAssigned` | No rider assigned | لا يوجد راكب | Sin ciclista asignado |
| `noRides` | No bookings yet. | لا توجد حجوزات بعد. | Aún no hay reservas. |
| `noSessions` | No sessions are currently open for reservation. Check back soon or contact the team. | لا توجد جلسات مفتوحة للحجز حالياً. تحقق لاحقاً أو تواصل مع الفريق. | No hay sesiones abiertas para reservar ahora mismo. Vuelve pronto o contacta con el equipo. |
| `noSessionsAvail` | No sessions are available right now. | لا توجد جلسات متاحة الآن. | No hay sesiones disponibles ahora mismo. |
| `noSessionsSocial` | Follow us on social media for updates on upcoming sessions! | تابعنا على وسائل التواصل الاجتماعي للاطلاع على الجلسات القادمة! | ¡Síguenos en redes sociales para enterarte de las próximas sesiones! |
| `noSessionsYet` | No sessions yet. Create one above. | لا توجد جلسات بعد. أنشئ واحدة أعلاه. | Aún no hay sesiones. Crea una arriba. |
| `noShowBtn` | No-Show | لم يحضر | Ausencia |
| `noShowCustomerMsg` | The staff marked you as a No-Show for this session. | تم تسجيلك كغائب في هذه الجلسة من قِبَل الموظفين. | El personal te marcó como ausente en esta sesión. |
| `noShowFlagTip` | {0} past no-shows | {0} حالات عدم حضور سابقة | {0} ausencias anteriores |

### `note*` — 19 keys

| key | English | العربية | Español |
|---|---|---|---|
| `noteAddBtn` | Add note | إضافة ملاحظة | Añadir nota |
| `noteBookingChip` | Booking #{0} | حجز #{0} | Reserva #{0} |
| `noteBtn` | Note | ملاحظة | Nota |
| `noteCustomerLabel` | Customer | العميل | Cliente |
| `noteCustomerPh` | Type or pick a name… | اكتب أو اختر اسماً… | Escribe o elige un nombre… |
| `noteDeleteBtn` | Delete | حذف | Eliminar |
| `noteDeletedToast` | Note deleted | تم حذف الملاحظة | Nota eliminada |
| `noteForBooking` | Note · #{0} {1} | ملاحظة · #{0} {1} | Nota · #{0} {1} |
| `notePhonePh` | Phone (optional) | الجوال (اختياري) | Teléfono (opcional) |
| `noteRecentTitle` | Previous notes for this customer | ملاحظات سابقة لهذا العميل | Notas anteriores de este cliente |
| `noteSavedToast` | Note saved | تم حفظ الملاحظة | Nota guardada |
| `noteSearchPh` | Search notes by name, phone or text… | ابحث بالاسم أو الجوال أو النص… | Buscar notas por nombre, teléfono o texto… |
| `noteTextLabel` | Note | الملاحظة | Nota |
| `noteTextPh` | e.g. Prefers a low saddle, paid deposit in cash… | مثال: يفضّل مقعداً منخفضاً، دفع العربون نقداً… | p. ej. Prefiere el sillín bajo, pagó el depósito en efectivo… |
| `noteTypeComment` | Comment | تعليق | Comentario |
| `noteTypeCustComplaint` | Customer complaint | شكوى من عميل | Queja de cliente |
| `noteTypeFeedback` | Feedback | ملاحظات وتقييم | Comentarios |
| `noteTypeLabel` | Note type | نوع الملاحظة | Tipo de nota |
| `noteTypeStaffComplaint` | Staff complaint | شكوى من الموظفين | Queja del personal |

### `nu*` — 20 keys

| key | English | العربية | Español |
|---|---|---|---|
| `nuAddMicro` | Add vitamin / mineral | إضافة فيتامين / معدن | Añadir vitamina / mineral |
| `nuButton` | Nutrition | القيمة الغذائية | Información nutricional |
| `nuCaffeine` | Caffeine | الكافيين | Cafeína |
| `nuCalories` | Calories | السعرات | Calorías |
| `nuCarbs` | Carbs | الكربوهيدرات | Hidratos |
| `nuFat` | Fat | الدهون | Grasas |
| `nuFibre` | Fibre | الألياف | Fibra |
| `nuIngredients` | Ingredients | المكونات | Ingredientes |
| `nuMicroName` | Vitamin / mineral | فيتامين / معدن | Vitamina / mineral |
| `nuMicros` | Vitamins & minerals | الفيتامينات والمعادن | Vitaminas y minerales |
| `nuNrv` | NRV% | NRV% | %VRN |
| `nuOptional` | optional | اختياري | opcional |
| `nuPrefill` | Prefill | تعبئة مسبقة | Pre-rellenar |
| `nuProtein` | Protein | البروتين | Proteínas |
| `nuSalt` | Salt | الملح | Sal |
| `nuSatFat` | Saturated fat | الدهون المشبعة | Grasas saturadas |
| `nuServingPh` | e.g. 1 bottle | مثال: زجاجة واحدة | p. ej. 1 botella |
| `nuSodium` | Sodium | الصوديوم | Sodio |
| `nuSugar` | Sugars | السكريات | Azúcares |
| `nuTitle` | Nutrition Facts | القيمة الغذائية | Información nutricional |

### `ph*` — 8 keys

| key | English | العربية | Español |
|---|---|---|---|
| `phBikeSearch` | Name, brand, model… | الاسم، العلامة، الطراز… | Nombre, marca, modelo… |
| `phCustEmail` | customer@email.com | customer@email.com | cliente@correo.com |
| `phFirstName` | Your first name | اسمك الأول | Tu nombre |
| `phFullName` | Your full name | اسمك الكامل | Tu nombre completo |
| `phHeightEg` | e.g. 120 | مثال: 120 | p. ej. 120 |
| `phInvName` | e.g. Medium helmet | مثال: خوذة متوسطة | p. ej. Casco mediano |
| `phLastName` | Your last name | اسم عائلتك | Tu apellido |
| `phMiddleName` | Your middle name | اسمك الأوسط | Tu segundo nombre |

### `promo*` — 38 keys

| key | English | العربية | Español |
|---|---|---|---|
| `promoActiveLabel` | Active | مفعّل | Activo |
| `promoAddBtn` | + Add code | + إضافة رمز | + Añadir código |
| `promoAddedOnly` | Applies to the riders you add in this edit | يُطبَّق على الراكبين الذين تضيفهم في هذا التعديل | Se aplica a los ciclistas que añadas en esta edición |
| `promoAllTypes` | All bike types | جميع أنواع الدراجات | Todos los tipos de bici |
| `promoAnyone` | Anyone | أي شخص | Cualquiera |
| `promoAppliedMsg` | {0} applied | تم تطبيق {0} | {0} aplicado |
| `promoAppliesLabel` | Applies to | يسري على | Se aplica a |
| `promoApplyBtn` | Apply | تطبيق | Aplicar |
| `promoCodeLabel` | Code | الرمز | Código |
| `promoCustomerLabel` | One customer only | لعميل واحد فقط | Solo un cliente |
| `promoDiscountLabel` | Discount | الخصم | Descuento |
| `promoExpiredLabel` | Expired | منتهٍ | Caducado |
| `promoExpiredMsg` | That code has expired. | انتهت صلاحية هذا الرمز. | Ese código ha caducado. |
| `promoExpiresLabel` | Expires | ينتهي في | Caduca |
| `promoFlatOpt` | Flat (SAR) | مبلغ ثابت (ريال) | Fijo (SAR) |
| `promoInactiveLabel` | Inactive | غير مفعّل | Inactivo |
| `promoInvalidMsg` | Invalid or inactive code | رمز غير صالح أو غير مفعّل | Código no válido o inactivo |
| `promoKindLabel` | Type | النوع | Tipo |
| `promoLabel` | Promo code | رمز الخصم | Código promocional |
| `promoLimitsLabel` | Limits | الحدود | Límites |
| `promoLimitsMissing` | Limit columns missing - run 20260816120000_promo_limits.sql; the code was saved without limits. | أعمدة الحدود غير موجودة - شغّل 20260816120000_promo_limits.sql؛ تم حفظ الرمز بدون حدود. | Faltan las columnas de límites - ejecuta 20260816120000_promo_limits.sql; el código se guardó sin límites. |
| `promoMaxUsesLabel` | Max uses | أقصى عدد استخدامات | Usos máximos |
| `promoMgrTitle` | Promo Codes | رموز الخصم | Códigos promocionales |
| `promoNoCodes` | No promo codes yet. | لا توجد رموز خصم بعد. | Aún no hay códigos promocionales. |
| `promoNoSuchCustomer` | No customer with that name. | لا يوجد عميل بهذا الاسم. | No hay ningún cliente con ese nombre. |
| `promoNotYoursMsg` | That code belongs to another account. | هذا الرمز يخص حسابًا آخر. | Ese código pertenece a otra cuenta. |
| `promoNudgeMsg` | {0} is next — send them a WhatsApp | {0} هو التالي — أرسل له رسالة واتساب | {0} es el siguiente — envíale un WhatsApp |
| `promoOneCustomer` | One customer | عميل واحد | Un cliente |
| `promoPercentOpt` | Percent (%) | نسبة (%) | Porcentaje (%) |
| `promoRemoveBtn` | Remove | إزالة | Quitar |
| `promoSavedToast` | Promo code saved | تم حفظ رمز الخصم | Código promocional guardado |
| `promoSyncedToast` | {0} live bookings repriced | تم تحديث أسعار {0} من الحجوزات النشطة | {0} reservas activas actualizadas |
| `promoTypeOnlyMsg` | This code applies only to {0} bookings. | هذا الرمز يسري فقط على حجوزات {0}. | Este código solo se aplica a reservas de {0}. |
| `promoUnlimited` | Unlimited | غير محدود | Ilimitado |
| `promoUntil` | until {0} | حتى {0} | hasta {0} |
| `promoUsedUpLabel` | Used up | استُنفد | Agotado |
| `promoUsedUpMsg` | That code has been fully used. | تم استخدام هذا الرمز بالكامل. | Ese código ya se ha usado por completo. |
| `promoValueLabel` | Value | القيمة | Valor |

### `push*` — 10 keys

| key | English | العربية | Español |
|---|---|---|---|
| `pushBlockedMsg` | Notifications are blocked for this site in your browser settings. | الإشعارات محظورة لهذا الموقع في إعدادات متصفحك. | Las notificaciones están bloqueadas para este sitio en tu navegador. |
| `pushDisableBtn` | Turn off notifications | إيقاف الإشعارات | Desactivar notificaciones |
| `pushEnableBtn` | Turn on notifications | تفعيل الإشعارات | Activar notificaciones |
| `pushFailedMsg` | Could not turn notifications on. | تعذّر تفعيل الإشعارات. | No se pudieron activar las notificaciones. |
| `pushOffToast` | Notifications are off. | تم إيقاف الإشعارات. | Notificaciones desactivadas. |
| `pushOnToast` | Notifications are on. | تم تفعيل الإشعارات. | Notificaciones activadas. |
| `pushPromotedBody` | You are off the waitlist - booking #{0} is confirmed. See you at the booth. | خرجت من قائمة الانتظار - تم تأكيد الحجز رقم {0}. نراك في الكشك. | Ya no estás en lista de espera: la reserva n.º {0} está confirmada. Te esperamos en la caseta. |
| `pushPromotedTitle` | A spot opened up | توفّر مكان | Se ha liberado una plaza |
| `pushSub` | Get told the moment a spot opens up for you, even when this page is closed. | نُعلمك فور توفّر مكان لك، حتى لو كانت الصفحة مغلقة. | Te avisamos en cuanto se libere una plaza, aunque esta página esté cerrada. |
| `pushTitle` | Notifications | الإشعارات | Notificaciones |

### `rate*` — 13 keys

| key | English | العربية | Español |
|---|---|---|---|
| `rateBikeLabel` | Bike | الدراجة | Bici |
| `rateExpLabel` | Experience | التجربة | Experiencia |
| `rateForcedHint` | Please rate your ride to help us improve. | يرجى تقييم رحلتك لمساعدتنا على التحسين. | Valora tu paseo para ayudarnos a mejorar. |
| `rateLaterBtn` | Later | لاحقاً | Más tarde |
| `rateNoteLabel` | Comments (optional) | ملاحظات (اختياري) | Comentarios (opcional) |
| `rateReasonHint` | You rated below 10 - please tell us why. | قيّمت أقل من 10 - يرجى إخبارنا بالسبب. | Diste menos de 10 - cuéntanos por qué. |
| `rateReasonLabel` | What could be better? | ما الذي يمكن تحسينه؟ | ¿Qué podría mejorar? |
| `rateReasonRequired` | Please tell us what could be better before submitting. | يرجى إخبارنا بما يمكن تحسينه قبل الإرسال. | Cuéntanos qué podría mejorar antes de enviar. |
| `rateRequiredScore` | Please give a rating before submitting. | يرجى إعطاء تقييم قبل الإرسال. | Da una valoración antes de enviar. |
| `rateRideBtn` | Rate your ride | قيّم رحلتك | Valora tu paseo |
| `rateSubmitBtn` | Submit rating | إرسال التقييم | Enviar valoración |
| `rateThanks` | Thanks for the feedback! | شكراً لتقييمك! | ¡Gracias por tu opinión! |
| `rateTitle` | How was your ride? | كيف كانت رحلتك؟ | ¿Qué tal tu paseo? |

### `receipt*` — 10 keys

| key | English | العربية | Español |
|---|---|---|---|
| `receiptBtn` | Receipt | الإيصال | Recibo |
| `receiptDateLabel` | Issued | تاريخ الإصدار | Emitido |
| `receiptDear` | Dear | عزيزي | Estimado/a |
| `receiptEditTitle` | Edit receipt | تعديل الفاتورة | Editar recibo |
| `receiptPaidLabel` | Payment | الدفع | Pago |
| `receiptPrintBtn` | Print / Save as PDF | طباعة / حفظ PDF | Imprimir / Guardar PDF |
| `receiptRefLabel` | Booking ref | رقم الحجز | Ref. de reserva |
| `receiptSeeYou` | We hope to see you at the Corniche Circuit again soon! | نأمل رؤيتك في حلبة الكورنيش مجدداً! | ¡Esperamos verte pronto de nuevo en el Circuito de la Corniche! |
| `receiptThankYou` | Thank you for riding with us at the Jeddah Corniche Circuit! | شكراً لركوبك معنا في حلبة كورنيش جدة! | ¡Gracias por montar con nosotros en el Circuito de la Corniche de Yeda! |
| `receiptTitle` | Ride Receipt | إيصال الرحلة | Recibo del paseo |

### `reg*` — 16 keys

| key | English | العربية | Español |
|---|---|---|---|
| `regBackBtn` | Back | رجوع | Atrás |
| `regBookAnotherBtn` | Book another ride | حجز رحلة أخرى | Reservar otro paseo |
| `regConfirmBtn` | Confirm booking | تأكيد الحجز | Confirmar reserva |
| `regContinueBtn` | Continue | متابعة | Continuar |
| `regProg1` | Session | الجلسة | Sesión |
| `regProg2` | Riders | الركّاب | Ciclistas |
| `regProg3` | Confirm | التأكيد | Confirmar |
| `regReviewBtn` | Review booking | مراجعة الحجز | Revisar reserva |
| `regStep1Msg` | Pick the day you would like to ride. | اختر اليوم الذي ترغب بالركوب فيه. | Elige el día que quieres montar. |
| `regStep1Title` | Choose your session | اختر جلستك | Elige tu sesión |
| `regStep2Msg` | Tell us who is riding and their bike preference. | أخبرنا من سيركب وتفضيل الدراجة. | Dinos quién monta y su bici preferida. |
| `regStep2Title` | Rider details | بيانات الراكب | Datos del ciclista |
| `regStep3Msg` | Check everything below, then confirm your booking. | تحقق من التفاصيل أدناه ثم أكّد حجزك. | Revisa todo y confirma tu reserva. |
| `regStep3Title` | Review & confirm | المراجعة والتأكيد | Revisar y confirmar |
| `regSub` | Pick an available session, fill in your details, and join the queue. | اختر جلسة متاحة، أدخل بياناتك، وانضم إلى الطابور. | Elige una sesión disponible, rellena tus datos y únete a la cola. |
| `regTitle` | Reserve Your Spot | احجز دراجتك | Reserva tu plaza |

### `rep*` — 34 keys

| key | English | العربية | Español |
|---|---|---|---|
| `repAddon` | Add-on | الإضافة | Extra |
| `repAddonValue` | Add-on value | قيمة الإضافات | Valor de extras |
| `repAddonsSold` | Add-ons sold | الإضافات المُباعة | Extras vendidos |
| `repBikesRented` | Bikes rented by type | الدراجات المؤجّرة حسب النوع | Bicis alquiladas por tipo |
| `repBookings` | Bookings | الحجوزات | Reservas |
| `repBrand` | Brand | العلامة التجارية | Marca |
| `repColEmail` | Email | البريد الإلكتروني | Correo |
| `repColPhone` | Phone | الهاتف | Teléfono |
| `repColType` | Type | النوع | Tipo |
| `repGeneratedAt` | Generated | أُنشئ | Generado |
| `repHeightCol` | Height (cm) | الطول (سم) | Altura (cm) |
| `repHeightIndividual` | Individually | فرديًّا | Individualmente |
| `repHeightRanges` | Ranges | النطاقات | Rangos |
| `repHeightSummary` | Summary | ملخّص | Resumen |
| `repMax` | Tallest | الأطول | Más alto |
| `repMin` | Shortest | الأقصر | Más bajo |
| `repNo` | No | لا | No |
| `repNoHeight` | No heights recorded | لا توجد أطوال مسجّلة | Sin alturas registradas |
| `repOptCols` | Columns | الأعمدة | Columnas |
| `repOptFilters` | Filters | عوامل التصفية | Filtros |
| `repOptNone` | Pick at least one column. | اختر عموداً واحداً على الأقل. | Elige al menos una columna. |
| `repOptReset` | Reset | إعادة تعيين | Restablecer |
| `repOptSections` | Sections | الأقسام | Secciones |
| `repOptSummary` | Summary tiles | بطاقات الملخص | Tarjetas de resumen |
| `repPayPartial` | Partial | مدفوع جزئياً | Parcial |
| `repPreparedBy` | Prepared by | أعدّه | Preparado por |
| `repPriceSar` | Price (SAR) | السعر (SAR) | Precio (SAR) |
| `repPrintNow` | Print | طباعة | Imprimir |
| `repReviewedBy` | Reviewed by | راجعه | Revisado por |
| `repRiderHeights` | Rider heights | أطوال الركّاب | Alturas de los ciclistas |
| `repTotal` | Total | الإجمالي | Total |
| `repValueSar` | Value (SAR) | القيمة (SAR) | Valor (SAR) |
| `repVatIncl` | VAT (15%) incl. | شامل ضريبة القيمة المضافة (15%) | IVA (15%) incl. |
| `repYes` | Yes | نعم | Sí |

### `scan*` — 13 keys

| key | English | العربية | Español |
|---|---|---|---|
| `scanAlreadyActive` | #{0} {1} is already on a bike. | #{0} {1} على الدراجة بالفعل. | #{0} {1} ya está en una bici. |
| `scanBtn` | Scan ticket | مسح التذكرة | Escanear ticket |
| `scanCamDenied` | Camera access was denied. Allow camera permission and try again. | تم رفض الوصول إلى الكاميرا. اسمح باستخدام الكاميرا وحاول مجدداً. | Se denegó el acceso a la cámara. Concede el permiso e inténtalo de nuevo. |
| `scanCamError` | Could not start the camera on this device. | تعذر تشغيل الكاميرا على هذا الجهاز. | No se pudo iniciar la cámara en este dispositivo. |
| `scanCancelled` | This booking was cancelled. | تم إلغاء هذا الحجز. | Esta reserva fue cancelada. |
| `scanContBtn` | Keep scanning | متابعة المسح | Seguir escaneando |
| `scanDone` | #{0} {1} already completed this ride. | #{0} {1} أنهى الرحلة بالفعل. | #{0} {1} ya completó este paseo. |
| `scanFound` | Found #{0} {1} - opening check-in. | تم العثور على #{0} {1} - جارٍ فتح تسجيل الدخول. | Encontrado #{0} {1} - abriendo registro. |
| `scanHint` | Point the camera at the QR code on the customer's ticket. | وجّه الكاميرا نحو رمز QR في تذكرة العميل. | Apunta la cámara al código QR del ticket del cliente. |
| `scanNoshow` | This booking was marked as a no-show. | هذا الحجز مسجل كغياب. | Esta reserva se marcó como ausencia. |
| `scanNotFound` | No booking matches this code. | لا يوجد حجز مطابق لهذا الرمز. | Ninguna reserva coincide con este código. |
| `scanTally` | {0} checked in | تم تسجيل {0} | {0} registrados |
| `scanTitle` | Scan booking QR | مسح رمز الحجز | Escanear QR de reserva |

### `sess*` — 28 keys

| key | English | العربية | Español |
|---|---|---|---|
| `sessAllFull` | All sessions are fully booked right now. Check back soon or follow us for new dates. | جميع الجلسات محجوزة بالكامل حالياً. تحقق لاحقاً أو تابعنا لمعرفة المواعيد الجديدة. | Todas las sesiones están completas ahora mismo. Vuelve pronto o síguenos para nuevas fechas. |
| `sessBackList` | All sessions | كل الجلسات | Todas las sesiones |
| `sessBfMapLabel` | Breakfast location (Google Maps link) | موقع الفطور (رابط خرائط جوجل) | Ubicación del desayuno (enlace de Google Maps) |
| `sessBfNameLabel` | Breakfast spot | مكان الفطور | Lugar de desayuno |
| `sessBfNamePh` | e.g. Brew92 | مثال: Brew92 | p. ej. Brew92 |
| `sessClosed` | Session closed. | تم إغلاق الجلسة. | Sesión cerrada. |
| `sessDeleted` | Session deleted. | تم حذف الجلسة. | Sesión eliminada. |
| `sessDeletedGroup` | Deleted Sessions | الجلسات المحذوفة | Sesiones eliminadas |
| `sessEventCommHint` | Private event: only tagged riders can see or book it. Reservations need staff approval, and queue order stays staff-only. | فعالية خاصة: يراها ويحجزها الحاصلون على الوسم فقط. تحتاج الحجوزات موافقة الموظفين، ويبقى ترتيب الطابور للموظفين فقط. | Evento privado: solo los ciclistas etiquetados pueden verlo o reservarlo. Las reservas requieren aprobación del personal y el orden queda solo para el personal. |
| `sessEventLabel` | Event | الفعالية | Evento |
| `sessEventPaidHint` | Bike rental for community members only. A circuit session in every other way: same bike composition, same prices, same waitlist once the bikes run out — and no approval step. | تأجير دراجات لأعضاء المجتمع فقط. وهي في كل ما عداه جلسة حلبة: نفس تشكيلة الدراجات ونفس الأسعار ونفس قائمة الانتظار عند نفادها، وبلا موافقة مسبقة. | Alquiler de bicis solo para miembros de la comunidad. En todo lo demás es una sesión del circuito: misma composición de bicis, mismos precios y misma lista de espera cuando se agotan, y sin aprobación. |
| `sessGatherTime` | Gathering time | وقت التجمع | Hora de encuentro |
| `sessMapLabel` | Meeting point (Google Maps link) | نقطة التجمع (رابط خرائط جوجل) | Punto de encuentro (enlace de Google Maps) |
| `sessMapPh` | Paste a Google Maps link | الصق رابط خرائط جوجل | Pega un enlace de Google Maps |
| `sessModeCounts` | Bike Counts | أعداد الدراجات | Por cantidades |
| `sessModeFleet` | From Fleet | من الأسطول | Desde la flota |
| `sessModeTotal` | Total Bikes | إجمالي الدراجات | Total de bicis |
| `sessNoRiders` | No bookings in this session yet. | لا توجد حجوزات في هذه الجلسة بعد. | Aún no hay reservas en esta sesión. |
| `sessOpened` | Session opened. | تم فتح الجلسة. | Sesión abierta. |
| `sessRestored` | Session restored. | تم استعادة الجلسة. | Sesión restaurada. |
| `sessRideNameHint` | riders see this on the session card | يظهر للراكبين على بطاقة الجلسة | los ciclistas lo ven en la tarjeta de la sesión |
| `sessRideNameLabel` | Ride name | اسم الجولة | Nombre de la ruta |
| `sessRidersTitle` | Bookings | الحجوزات | Reservas |
| `sessSelectMsg` | Select a session to see its details and bookings. | اختر جلسة لعرض تفاصيلها وحجوزاتها. | Selecciona una sesión para ver sus detalles y reservas. |
| `sessShowLess` | Show less | عرض أقل | Mostrar menos |
| `sessShowMore` | Show {0} more | عرض {0} أخرى | Mostrar {0} más |
| `sessSpotsLabel` | Spots | المقاعد | Plazas |
| `sessStartTime` | Start time | وقت الانطلاق | Hora de salida |

### `sort*` — 11 keys

| key | English | العربية | Español |
|---|---|---|---|
| `sortBy` | Sort by | ترتيب حسب | Ordenar por |
| `sortDateAsc` | Date ↑ | التاريخ ↑ | Fecha ↑ |
| `sortDateDesc` | Date ↓ | التاريخ ↓ | Fecha ↓ |
| `sortName` | Name | الاسم | Nombre |
| `sortNewest` | Newest | الأحدث | Más recientes |
| `sortOldest` | Oldest | الأقدم | Más antiguos |
| `sortSARHi` | SAR High | الأعلى سعراً | SAR alto |
| `sortSARLo` | SAR Low | الأقل سعراً | SAR bajo |
| `sortSize` | Size | المقاس | Talla |
| `sortStatus` | Status | الحالة | Estado |
| `sortType` | Type | النوع | Tipo |

### `staff*` — 20 keys

| key | English | العربية | Español |
|---|---|---|---|
| `staffAccess` | Staff Access | دخول الموظفين | Personal |
| `staffAuthBtn` | Sign in | تسجيل الدخول | Iniciar sesión |
| `staffAuthEmailPh` | Email or phone number | البريد الإلكتروني أو رقم الهاتف | Correo o número de teléfono |
| `staffAuthHint` | Sign in with your staff account to unlock the panel | سجّل الدخول بحساب الموظف لفتح اللوحة | Inicia sesión con tu cuenta de personal para desbloquear el panel |
| `staffAuthPwdPh` | Password | كلمة المرور | Contraseña |
| `staffAuthTitle` | Staff sign-in | تسجيل دخول الموظفين | Acceso del personal |
| `staffBadge` | Staff Panel | لوحة الموظفين | Panel del personal |
| `staffPwdDone` | Password updated ✓ | تم تحديث كلمة المرور ✓ | Contraseña actualizada ✓ |
| `staffPwdHint` | Set a new password for your staff account. | عيّن كلمة مرور جديدة لحساب الموظف. | Establece una contraseña nueva para tu cuenta de personal. |
| `staffPwdLog` | Changed own staff password | غيّر كلمة مرور حسابه | Cambió su propia contraseña de personal |
| `staffPwdMustHint` | Welcome! For security, set your own password before using the panel. | مرحباً! للأمان، عيّن كلمة المرور الخاصة بك قبل استخدام اللوحة. | ¡Bienvenido! Por seguridad, establece tu propia contraseña antes de usar el panel. |
| `staffPwdTitle` | Change my password | تغيير كلمة المرور | Cambiar mi contraseña |
| `staffQueueTitle` | Staff Panel | لوحة الموظفين | Panel del personal |
| `staffResetDesc` | Set a new password for a customer who is locked out. | عيّن كلمة مرور جديدة لعميل لا يستطيع الدخول. | Establece una contraseña nueva para un cliente que no puede entrar. |
| `staffResetDone` | Password reset for {0}. | تمت إعادة تعيين كلمة المرور لـ {0}. | Contraseña restablecida para {0}. |
| `staffResetEmailLabel` | Customer Email | بريد العميل الإلكتروني | Correo del cliente |
| `staffResetGiveMsg` | Give them this temporary password: | أعطه كلمة المرور المؤقتة هذه: | Dale esta contraseña temporal: |
| `staffResetNewPw` | New Password | كلمة المرور الجديدة | Contraseña nueva |
| `staffResetSet` | Set Password | تعيين كلمة المرور | Establecer contraseña |
| `staffResetTool` | Reset Customer Password | إعادة تعيين كلمة مرور العميل | Restablecer contraseña de cliente |

### `stat*` — 9 keys

| key | English | العربية | Español |
|---|---|---|---|
| `statCompleted` | Completed | مكتمل | Completados |
| `statExpected` | Expected | متوقّع | Esperados |
| `statFavType` | Favourite Type | النوع المفضل | Tipo favorito |
| `statMemberSince` | Member Since | عضو منذ | Miembro desde |
| `statNextRide` | Next Ride | الرحلة القادمة | Próximo paseo |
| `statNumRiders` | # of Riders | عدد الركّاب | N.º de ciclistas |
| `statStreak` | Week Streak | أسابيع متتالية | Racha semanal |
| `statTotalRides` | Total Rides | مجموع الرحلات | Paseos totales |
| `statTotalSpent` | Total Spent | إجمالي الإنفاق | Gasto total |

### `status*` — 9 keys

| key | English | العربية | Español |
|---|---|---|---|
| `statusActive` | On Bike | على الدراجة | En bici |
| `statusCancelled` | Cancelled by Customer | ملغي من قِبَل العميل | Cancelado por el cliente |
| `statusClosed` | Closed | مغلق | Cerrada |
| `statusDone` | Complete | مكتمل | Completado |
| `statusFull` | Fully Booked | محجوز بالكامل | Completo |
| `statusNoshow` | No-Show | لم يحضر | Ausencia |
| `statusOpen` | Open | مفتوح | Abierta |
| `statusWaiting` | Waiting | بانتظار | En espera |
| `statusWaitlist` | Waitlist | قائمة الانتظار | Lista de espera |

### `tab*` — 14 keys

| key | English | العربية | Español |
|---|---|---|---|
| `tabAccount` | My Account | حسابي | Mi cuenta |
| `tabAnalytics` | Analytics | التحليلات | Analítica |
| `tabBikes` | Bikes | الدراجات | Bicis |
| `tabCashier` | Sales | المبيعات | Ventas |
| `tabCommunity` | Community | المجتمع | Comunidad |
| `tabDashboard` | Dashboard | لوحة القيادة | Panel |
| `tabHistory` | History | السجل | Historial |
| `tabInventory` | Inventory | المخزون | Inventario |
| `tabLogs` | Logs | السجلات | Registros |
| `tabMyRides` | My Rides | رحلاتي | Mis paseos |
| `tabNotes` | Notes | ملاحظات | Notas |
| `tabQueue` | Queue | الطابور | Reservas |
| `tabReserve` | Reserve | حجز | Reservar |
| `tabSessions` | Sessions | الجلسات | Sesiones |

### `tag*` — 21 keys

| key | English | العربية | Español |
|---|---|---|---|
| `tagAddTitle` | Add tag | إضافة وسم | Añadir etiqueta |
| `tagDatesLabel` | Start & end date | تاريخ البداية والنهاية | Fecha de inicio y fin |
| `tagDur1d` | 1 day | يوم واحد | 1 día |
| `tagDur1m` | 1 month | شهر | 1 mes |
| `tagDur1w` | 1 week | أسبوع | 1 semana |
| `tagDur1y` | 1 year | سنة | 1 año |
| `tagDur2w` | 2 weeks | أسبوعان | 2 semanas |
| `tagDur3d` | 3 days | 3 أيام | 3 días |
| `tagDur3m` | 3 months | 3 أشهر | 3 meses |
| `tagDur6m` | 6 months | 6 أشهر | 6 meses |
| `tagDurationLabel` | Duration | المدة | Duración |
| `tagEndAfterStart` | The end date must be after the start date. | يجب أن يكون تاريخ النهاية بعد تاريخ البداية. | La fecha de fin debe ser posterior a la de inicio. |
| `tagEndDate` | End date | تاريخ النهاية | Fecha de fin |
| `tagEndRequired` | Choose an end date. | اختر تاريخ النهاية. | Elige una fecha de fin. |
| `tagExpired` | expired | منتهٍ | caducada |
| `tagFrom` | from {0} | من {0} | desde {0} |
| `tagPermLabel` | Permanent | دائم | Permanente |
| `tagStartDate` | Start date | تاريخ البداية | Fecha de inicio |
| `tagTempLabel` | Temporary | مؤقت | Temporal |
| `tagTodayLabel` | Today | اليوم | Hoy |
| `tagUntil` | until {0} | حتى {0} | hasta {0} |

### `toast*` — 40 keys

| key | English | العربية | Español |
|---|---|---|---|
| `toastAccountCreated` | Account created. | تم إنشاء الحساب. | ¡Cuenta creada! |
| `toastActionUndone` | Action undone:  | تم التراجع عن الإجراء:  | Acción deshecha:  |
| `toastAddedToFleet` | added to fleet. | أُضيفت للأسطول. | añadida a la flota. |
| `toastAssignedChecked` | assigned. Rider checked in! | تم تخصيصها. دخول الراكب مسجَّل! | asignada. ¡Ciclista registrado! |
| `toastBikeChanged` | Bike changed successfully. | تم تغيير الدراجة بنجاح. | Bici cambiada correctamente. |
| `toastBikeRemoved` | removed. | تم إزالتها. | eliminada. |
| `toastBikeReturned` | Bike returned. Ride complete. | الدراجة مُعادة. اكتملت الرحلة. | Bici devuelta. Paseo completado. |
| `toastBikeReturnedPaid` | Bike returned and marked as paid. | الدراجة مُعادة وتم تسجيل الدفع. | Bici devuelta y marcada como pagada. |
| `toastBikeUpdated` | Bike updated. | تم تحديث الدراجة. | Bici actualizada. |
| `toastBookingCancelled` | Booking cancelled. Your spot has been freed. | تم إلغاء الحجز. أُفرج عن دراجتك. | Reserva cancelada. Tu plaza queda libre. |
| `toastBookingCancelledSpot` | Booking cancelled. Your spot has been freed. | تم إلغاء الحجز. أُفرج عن دراجتك. | Reserva cancelada. Tu plaza queda libre. |
| `toastBookingRestored` | Booking restored | تمت استعادة الحجز | Reserva restaurada |
| `toastBookingUpdated` | Your booking has been updated. | تم تحديث حجزك بنجاح. | Tu reserva se ha actualizado. |
| `toastCannotCancel` | Cannot cancel this entry. | لا يمكن إلغاء هذا الحجز. | No se puede cancelar esta entrada. |
| `toastConnStale` | Connection error — data may be stale | خطأ في الاتصال — قد تكون البيانات قديمة | Error de conexión — los datos pueden estar desactualizados |
| `toastLoggedOut` | Logged out successfully. | تم تسجيل الخروج بنجاح. | Sesión cerrada correctamente. |
| `toastNoExport` | No bookings to export | لا توجد حجوزات للتصدير | No hay reservas que exportar |
| `toastNoShow` | Marked as No-Show. | تم تسجيله كغائب. | Marcado como ausencia. |
| `toastNothingUndo` | Nothing to undo | لا شيء للتراجع عنه | Nada que deshacer |
| `toastPriceSet` | Price set to SAR {0} | تم تعيين السعر على {0} ريال | Precio fijado en SAR {0} |
| `toastPromoted` | Promoted from waitlist | تمت الترقية من قائمة الانتظار | Promovido desde la lista de espera |
| `toastPwReset` | Password reset successfully! | تم إعادة تعيين كلمة المرور بنجاح! | ¡Contraseña restablecida correctamente! |
| `toastRecurringCreated` | {0} sessions created | تم إنشاء {0} جلسات | {0} sesiones creadas |
| `toastRegistered` | Registered! Queue number | مُسجَّل! رقم الطابور | ¡Registrado! Número de turno |
| `toastRegisteredRange` | Registered! Queue numbers | مُسجَّل! أرقام الطابور | ¡Registrado! Números de turno |
| `toastReopened` | Booking re-opened - rider moved back to active. | تم إعادة فتح الحجز - الراكب عاد إلى الحالة النشطة. | Reserva reabierta - el ciclista vuelve a activo. |
| `toastRescheduled` | Booking moved to the new session ✓ | تم نقل الحجز إلى الجلسة الجديدة ✓ | Reserva movida a la nueva sesión ✓ |
| `toastResetComplete` | Reset complete. | اكتملت إعادة الضبط. | Restablecimiento completado. |
| `toastResetFailed` | Reset failed:  | فشلت إعادة الضبط:  | Falló el restablecimiento:  |
| `toastRiderRemoved` | Rider removed. | تم حذف الراكب. | Ciclista eliminado. |
| `toastSessionReady` | Open it when ready. | افتحها عند الاستعداد. | Ábrela cuando estés listo. |
| `toastSessionUpdated` | Session {0} updated. | تم تحديث جلسة {0}. | Sesión {0} actualizada. |
| `toastStaffPanel` | Welcome to the Staff Panel. | مرحباً بك في لوحة الموظفين. | Bienvenido al panel del personal. |
| `toastStatusChanged` | Status updated: | تم تحديث الحالة: | Estado actualizado: |
| `toastUndoCheckin` | Check-in reversed - rider moved back to waiting. | تم التراجع عن تسجيل الدخول - الراكب عاد إلى قائمة الانتظار. | Registro revertido - el ciclista vuelve a la espera. |
| `toastUndoFailedData` | Undo failed. Data may have changed. | فشل التراجع. ربما تغيّرت البيانات. | No se pudo deshacer. Los datos pueden haber cambiado. |
| `toastUndoNoShow` | Restored to waiting queue. | تمت إعادته لقائمة الانتظار. | Restaurado a la cola de espera. |
| `toastWaitlisted` | Added to the waitlist | تمت إضافتك إلى قائمة الانتظار | ¡En lista de espera! Número |
| `toastWalkInAdded` | Walk-in added | تمت إضافة زيارة مباشرة | Cliente sin reserva añadido |
| `toastWelcomeBack` | Welcome back | مرحباً بعودتك | Bienvenido de nuevo |

### `type*` — 11 keys

| key | English | العربية | Español |
|---|---|---|---|
| `typeAny` | Any | أي نوع | Cualquiera |
| `typeGravel` | Gravel | حصى | Gravel |
| `typeHybrid` | Hybrid | هجين | Híbrida |
| `typeMountain` | Mountain | جبلي | Montaña |
| `typeNewLabel` | Type new value... | اكتب قيمة جديدة... | Escribe un valor nuevo... |
| `typeOwn` | Bike owner | صاحب دراجة | Bike owner |
| `typeOwnPref` | I have my own bike | لدي دراجتي الخاصة | I have my own bike |
| `typePrefHint` | We'll pre-select this each time you book. | سيتم اختياره تلقائياً عند كل حجز. | Lo preseleccionaremos cada vez que reserves. |
| `typePrefSaved` | Type preference saved. | تم حفظ تفضيل النوع. | Preferencia de tipo guardada. |
| `typeRoad` | Road | طريق | Carretera |
| `typeRoadCarbon` | Road Carbon | طريق كربون | Road Carbon |

### `undo*` — 30 keys

| key | English | العربية | Español |
|---|---|---|---|
| `undoAddBike` | Add bike | إضافة دراجة | Añadir bici |
| `undoBarMsg` | Action undone in | تم التراجع خلال | Acción deshecha en |
| `undoBtn` | Undo | تراجع | Deshacer |
| `undoCancelBooking` | Cancel booking | إلغاء الحجز | Cancelar reserva |
| `undoChangeBike` | Change bike | تغيير الدراجة | Cambiar bici |
| `undoCheckin` | Check-in | تسجيل دخول | Registro |
| `undoCheckinBtn` | Undo Check-in | تراجع عن تسجيل الدخول | Deshacer registro |
| `undoDeleteBike` | Delete bike | حذف دراجة | Eliminar bici |
| `undoDeleteNote` | Delete note | حذف ملاحظة | Eliminar nota |
| `undoEditBike` | Edit bike | تعديل دراجة | Editar bici |
| `undoEditBooking` | Edit booking | تعديل الحجز | Editar reserva |
| `undoEditPrice` | Edit price | تعديل السعر | Editar precio |
| `undoEditSession` | Edit session | تعديل الجلسة | Editar sesión |
| `undoFailed` | Undo failed. | فشل التراجع. | No se pudo deshacer. |
| `undoNoShow` | No-show | عدم حضور | Ausencia |
| `undoPayment` | Payment | الدفع | Pago |
| `undoPromote` | Promote | الترقية | Promover |
| `undoRelease` | Release | تحرير | Liberar |
| `undoRenumber` | Renumber | إعادة ترقيم | Renumerar |
| `undoReopen` | Re-open | إعادة فتح | Reabrir |
| `undoRestoreBike` | Restore | استعادة | Restaurar |
| `undoRetire` | Retire | سحب | Retirar |
| `undoReturn` | Return | إرجاع | Devolver |
| `undoRevBody` | This will reverse the action. Some operations may not be fully reversible if data has changed since. | سيؤدي هذا إلى عكس الإجراء. قد لا تكون بعض العمليات قابلة للعكس بالكامل إذا تغيّرت البيانات. | Esto revertirá la acción. Algunas operaciones pueden no ser totalmente reversibles. |
| `undoSeconds` | s | ث | s |
| `undoSessionStatus` | Session | الجلسة | Sesión |
| `undoStaffCancel` | Staff cancel | إلغاء بواسطة الموظف | Cancelación del personal |
| `undoUndoCheckin` | Undo check-in | تراجع عن تسجيل الدخول | Deshacer registro |
| `undoUndoNoShow` | Undo no-show | تراجع عن عدم الحضور | Deshacer ausencia |
| `undoWl` | Back on the waitlist | إعادة إلى قائمة الانتظار | De vuelta en la lista de espera |

### `wl*` — 18 keys

| key | English | العربية | Español |
|---|---|---|---|
| `wlAddBtn` | Add to waitlist | إضافة إلى القائمة | Añadir a la lista |
| `wlAddedToast` | {0} added to the waitlist | تمت إضافة {0} إلى قائمة الانتظار | {0} añadido a la lista de espera |
| `wlAvailNow` | {0} available now | {0} متاحة الآن | {0} disponibles ahora |
| `wlCapCount` | Number | عدد | Número |
| `wlCapHint` | How many riders may wait for a spot once the session is full. Leave blank or 0 for no limit; a percentage is taken from the session capacity. | عدد المشاركين المسموح لهم بالانتظار بعد اكتمال الجلسة. اتركه فارغاً أو 0 لعدم وضع حد؛ تُحتسب النسبة من سعة الجلسة. | Cuántos ciclistas pueden esperar un lugar cuando la sesión esté llena. Déjalo vacío o en 0 para no poner límite; el porcentaje se calcula sobre la capacidad de la sesión. |
| `wlCapLabel` | Waitlist limit | حد قائمة الانتظار | Límite de lista de espera |
| `wlCapNone` | Unlimited | بلا حد | Sin límite |
| `wlCapPct` | Percent | نسبة | Porcentaje |
| `wlEmpty` | Nobody is waiting. | لا يوجد أحد في الانتظار. | Nadie está esperando. |
| `wlGivenBtn` | Bike given | تم تسليم الدراجة | Bici entregada |
| `wlGivenToast` | Bike given to {0} | تم تسليم الدراجة إلى {0} | Bici entregada a {0} |
| `wlHistTitle` | Waitlist history | سجل قائمة الانتظار | Historial de la lista de espera |
| `wlPosMsg` | You are W{0} in line for a spot. We will let you know if one frees up — you can still come and ask at the booth. | أنت رقم W{0} في انتظار مقعد. سنخبرك إذا توفّر مقعد، ويمكنك أيضاً السؤال في الكشك. | Eres el W{0} en la fila para una plaza. Te avisaremos si se libera alguna; también puedes preguntar en la caseta. |
| `wlPosNoNumMsg` | You are in line for a spot. We will let you know if one frees up — you can still come and ask at the booth. | أنت في انتظار مقعد. سنخبرك إذا توفّر مقعد، ويمكنك أيضاً السؤال في الكشك. | Estás en la fila para una plaza. Te avisaremos si se libera alguna; también puedes preguntar en la caseta. |
| `wlRemoveBtn` | Remove | إزالة | Quitar |
| `wlRemovedToast` | Removed from the waitlist | تمت الإزالة من قائمة الانتظار | Quitado de la lista de espera |
| `wlTitle` | Waitlist | قائمة الانتظار | Lista de espera |
| `wlWaitingFor` | waiting {0} | في الانتظار منذ {0} | esperando {0} |

### Other — 465 keys

| key | English | العربية | Español |
|---|---|---|---|
| `accountSaved` | Profile updated successfully. | تم تحديث الملف الشخصي. | Perfil actualizado correctamente. |
| `accountSub` | Update your profile information and preferences. | تحديث معلومات ملفك الشخصي. | Actualiza tu información y preferencias. |
| `accountTitle` | Account Settings | إعدادات الحساب | Ajustes de la cuenta |
| `activeSessChip` | on bike | على الدراجة | en bici |
| `addonAddBtn` | Add-ons | الإضافات | Extras |
| `addonEditTitle` | Edit add-ons | تعديل الإضافات | Editar extras |
| `addonNone` | No add-ons available for this session. | لا توجد إضافات متاحة لهذه الجلسة. | No hay extras disponibles para esta sesión. |
| `addonStepSub` | Optional extras available for this session | إضافات اختيارية متاحة لهذه الجلسة | Extras opcionales para esta sesión |
| `addonStepTitle` | Add on your booking | أضف إلى حجزك | Añade a tu reserva |
| `addonsLabel` | Add-ons | الإضافات | Extras |
| `addonsSelectedToast` | Add-ons saved with your booking | تم حفظ الإضافات مع حجزك | Extras guardados con tu reserva |
| `adminOnlyMsg` | Admin only. | للمدير فقط. | Solo administradores. |
| `aheadOfYou` | {0} ahead of you | {0} أمامك | {0} por delante de ti |
| `allBranchesLabel` | All branches | كل الفروع | Todas las sucursales |
| `allSessions` | All Sessions | جميع الجلسات | Todas las sesiones |
| `allSizes` | All sizes | كل المقاسات | Todas las tallas |
| `altBadge` | Alt | بديل | Alt |
| `appSub` | Rental and Inventory System | نظام التأجير والمخزون | Sistema de alquiler e inventario |
| `assignBikeCheckin` | Assign Bike & Check In | تخصيص دراجة وتسجيل الدخول | Asignar bici y registrar |
| `assignBikeTitle` | Assign Bike | تخصيص دراجة | Asignar bici |
| `assignedBikeLabel` | Assigned Bike | الدراجة المخصصة | Bici asignada |
| `autoLabel` | auto | تلقائي | auto |
| `availLabel` | Available | متاح | Disponible |
| `availSessions` | Available Sessions | الجلسات المتاحة | Sesiones disponibles |
| `available2` | available | متاح | disponible |
| `backToLogin` | Back to login | العودة لتسجيل الدخول | Volver a iniciar sesión |
| `beAddRiderBtn` | Add rider | إضافة راكب | Añadir ciclista |
| `beAddRidersLabel` | Add riders | إضافة رُكّاب | Añadir ciclistas |
| `beRemoveRider` | Remove rider | إزالة الراكب | Quitar ciclista |
| `beRiderPh` | Rider name | اسم الراكب | Nombre del ciclista |
| `beRidersAdded` | rider(s) added | رُكّاب أُضيفوا | ciclista(s) añadido(s) |
| `bfNewOpt` | + New breakfast spot… | + موقع فطور جديد… | + Nuevo lugar de desayuno… |
| `bfNoneOpt` | - none - | - بدون - | - ninguno - |
| `bikesTitle` | Fleet | الأسطول | Flota |
| `bikesWord` | bikes | دراجات | bicis |
| `birthDateLabel` | Birth date | تاريخ الميلاد | Fecha de nacimiento |
| `bookAgainBtn` | Book again | احجز مجدداً | Reservar de nuevo |
| `bookUsualBtn` | Book my usual | احجز المعتاد | Reservar lo de siempre |
| `bookUsualToast` | Pre-filled your usual booking - just confirm. | تم تجهيز حجزك المعتاد - أكّد فقط. | Tu reserva habitual está pre-rellenada - solo confirma. |
| `bookedByLabel` | Booked by | حجز بواسطة | Reservado por |
| `branchLabel` | Branch | الفرع | Sucursal |
| `breakfastLbl` | Breakfast | الفطور | Desayuno |
| `breakfastSpotLbl` | Breakfast spot | موقع الفطور | Lugar del desayuno |
| `bulkCheckinBtn` | Check in | تسجيل الدخول | Registrar llegada |
| `bulkClearSel` | Clear | مسح | Limpiar |
| `bulkPaidBtn` | Mark paid | تحديد كمدفوع | Marcar pagado |
| `bulkSelectedLabel` | selected | محدد | seleccionados |
| `byGuest` | Guest | زائر | Invitado |
| `byStaff` | Staff | موظف | Personal |
| `callLabel` | Call | اتصال | Llamar |
| `cancelledAdminNote` | Cancelled by customer | ملغى من قِبَل العميل | Cancelado por el cliente |
| `capacityLabel` | Capacity (spots) | الطاقة الاستيعابية | Capacidad (plazas) |
| `cashierAddBtn` | Add purchase | إضافة عملية بيع | Añadir compra |
| `cashierSub` | Items sold with this rental | العناصر المباعة مع هذا الإيجار | Artículos vendidos con este alquiler |
| `cashierTitle` | Sales | المبيعات | Ventas |
| `changeBikeBtn` | Change Bike | تغيير الدراجة | Cambiar bici |
| `changeBikeTitle` | Change Assigned Bike | تغيير الدراجة المخصصة | Cambiar bici asignada |
| `changeInAccount` | Change in Account | تغيير في الحساب | Cambiar en Mi cuenta |
| `checkInBtn` | Check In | تسجيل الدخول | Registrar llegada |
| `cityLabel` | City | المدينة | Ciudad |
| `clearWord` | Clear | مسح | Limpiar |
| `cloneSessBtn` | Clone | نسخ | Clonar |
| `closeBtn` | Close | إغلاق | Cerrar |
| `closeWord` | Close | إغلاق | Cerrar |
| `closeoutBtn` | Close-out | إغلاق اليوم | Cierre del día |
| `closeoutTitle` | Day close-out | تقرير إغلاق اليوم | Cierre del día |
| `cmUnit` | cm | سم | cm |
| `coGrand` | Grand total | الإجمالي الكلي | Total general |
| `coReconOff` | Unaccounted | غير محتسب | Sin cuadrar |
| `coReconOk` | Card + cash balances | البطاقة + النقد متوازنان | Tarjeta + efectivo cuadran |
| `coRentals` | Bike rentals | تأجير الدراجات | Alquileres de bicis |
| `coSales` | Product sales | مبيعات المنتجات | Ventas de productos |
| `colorNameLabel` | Color Name | اسم اللون | Nombre del color |
| `colorWord` | Color | اللون | Color |
| `colorsHint` | 1 required - up to 4 | مطلوب 1 - حتى 4 | 1 obligatorio - hasta 4 |
| `comfortableTip` | Comfortable | مريح | Cómodo |
| `compactTip` | Compact | مدمج | Compacto |
| `completedLabel` | Completed | مكتملة | Completado |
| `contactNameLabel` | Contact name | اسم جهة الاتصال | Nombre del contacto |
| `continueApple` | Continue with Apple | المتابعة عبر Apple | Continuar con Apple |
| `continueGoogle` | Continue with Google | المتابعة عبر جوجل | Continuar con Google |
| `countryLabel` | Country | الدولة | País |
| `createSession` | Create Session | إنشاء جلسة | Crear sesión |
| `customWord` | Custom | مخصص | Personalizado |
| `customerBadge` | Customer | عميل | Cliente |
| `customerShowedBtn` | Customer Showed | العميل حضر | El cliente llegó |
| `dateLabel` | Date | التاريخ | Fecha |
| `dateWarning` | Changing the date will update all existing bookings for this session. | تغيير التاريخ سيحدّث جميع الحجوزات الموجودة لهذه الجلسة. | Cambiar la fecha actualizará todas las reservas existentes de esta sesión. |
| `daysLabel` | days | يوم | días |
| `defPayNormal` | Normal | عادي | Normal |
| `defaultPayLabel` | Default payment | الدفع الافتراضي | Pago predeterminado |
| `deleteBtn` | Delete | حذف | Eliminar |
| `doneBtn` | Done | تم | Listo |
| `doneSessChip` | done | منتهٍ | terminados |
| `doneStat` | Done | منتهٍ | Terminados |
| `dueWord` | due | مستحق | debe |
| `emailAddr` | Email Address | البريد الإلكتروني | Correo electrónico |
| `enterEmail` | Enter your email address | أدخل بريدك الإلكتروني | Introduce tu correo |
| `enterEmailOrPhone` | Enter your email or phone number | أدخل بريدك الإلكتروني أو رقم هاتفك | Introduce tu correo o número de teléfono |
| `enterHeightAbove` | Enter height above | أدخل الطول أعلاه | Introduce la altura arriba |
| `enterPhone` | Enter your phone number | أدخل رقم هاتفك | Introduce tu número |
| `eqnGroup` | Group of {0} bikes | مجموعة من {0} دراجات | Grupo de {0} bicis |
| `eqnNewNum` | New Booking Number | رقم الحجز الجديد | Nuevo número de reserva |
| `eqnTitle` | Edit Booking Number | تعديل رقم الحجز | Editar número de reserva |
| `evJccName` | Jeddah Corniche Circuit | حلبة كورنيش جدة | Circuito Corniche de Yeda |
| `evPetroName` | Petromin Wednesday Ride | جولة بترومين الأربعاء | Petromin Wednesday Ride |
| `evSatName` | Saturday Social Ride | جولة السبت الاجتماعية | Paseo social del sábado |
| `expChoose` | Choose a format | اختر الصيغة | Elige un formato |
| `expExcel` | Excel (CSV) | إكسل (CSV) | Excel (CSV) |
| `expPdf` | PDF / Print | PDF / طباعة | PDF / Imprimir |
| `expTitle` | Export Report | تصدير التقرير | Exportar informe |
| `exportBackupBtn` | Export backup | تصدير نسخة احتياطية | Exportar copia |
| `exportBtn` | Export CSV | تصدير CSV | Exportar CSV |
| `exportedToast` | Backup downloaded | تم تنزيل النسخة الاحتياطية | Copia de seguridad descargada |
| `finishBtn` | Finish | إنهاء | Terminar |
| `firstName` | First Name | الاسم الأول | Nombre |
| `fixDupBody` | Found {0} duplicate booking number(s). Each duplicate will get a fresh unique number (the earliest booking keeps its number). Continue? | تم العثور على {0} رقم حجز مكرر. سيحصل كل مكرر على رقم فريد جديد (يحتفظ الحجز الأقدم برقمه). متابعة؟ | Se encontraron {0} número(s) de reserva duplicado(s). Cada duplicado recibirá un número único nuevo (la reserva más antigua conserva el suyo). ¿Continuar? |
| `fixDupBtn` | Fix duplicate numbers | إصلاح الأرقام المكررة | Corregir números duplicados |
| `fixDupConfirm` | Renumber duplicates | إعادة ترقيم المكررات | Renumerar duplicados |
| `fixDupDone` | Renumbered {0} booking(s). | تمت إعادة ترقيم {0} حجز. | {0} reserva(s) renumerada(s). |
| `fixDupLog` | Fixed {0} duplicate booking number(s) | إصلاح {0} رقم حجز مكرر | Corregidos {0} número(s) de reserva duplicado(s) |
| `fixDupNone` | No duplicate booking numbers found. | لا توجد أرقام حجوزات مكررة. | No se encontraron números de reserva duplicados. |
| `fixDupTitle` | Fix duplicate booking numbers | إصلاح أرقام الحجوزات المكررة | Corregir números de reserva duplicados |
| `fleetBadge` | Fleet | الأسطول | Flota |
| `footerCopy` | © 2026 MicroMobility. All Rights Reserved | © 2026 مايكروموبيليتي. جميع الحقوق محفوظة | © 2026 MicroMobility. Todos los derechos reservados |
| `forgotContactStaffMsg` | To reset your password, please visit a staff member at the Corniche Circuit booth. They will reset it for you. | لإعادة تعيين كلمة المرور، يرجى زيارة أحد الموظفين في كشك حلبة الكورنيش. سيقوم بإعادة تعيينها لك. | Para restablecer tu contraseña, acude a un miembro del personal en la caseta del Circuito de la Corniche. Ellos la restablecerán por ti. |
| `forgotPwLink` | Forgot password? | نسيت كلمة المرور؟ | ¿Olvidaste tu contraseña? |
| `forgotStep1Sub` | Verify your identity with your registered email and phone number, then set a new password. | تحقق من هويتك ببريدك الإلكتروني ورقم هاتفك المسجّلين، ثم عيّن كلمة مرور جديدة. | Verifica tu identidad con tu correo y teléfono registrados y luego crea una contraseña nueva. |
| `forgotStep1Title` | Reset Your Password | إعادة تعيين كلمة المرور | Restablece tu contraseña |
| `forgotStep2Title` | Set a New Password | تعيين كلمة مرور جديدة | Crea una contraseña nueva |
| `forgotVerifiedMsg` | Identity verified for | تم التحقق من الهوية لـ | Identidad verificada para |
| `forgotVerifyBtn` | Verify Identity | تحقق من الهوية | Verificar identidad |
| `frameAluminum` | Aluminum | ألمنيوم | Aluminio |
| `frameCarbon` | Carbon | كربون | Carbono |
| `frameSizeLabel` | Frame Size | مقاس الإطار | Talla |
| `frameSteel` | Steel | فولاذ | Acero |
| `frameTitanium` | Titanium | تيتانيوم | Titanio |
| `freeLabel` | Complimentary | ضيافة | Cortesía |
| `fullName` | Full Name | الاسم الكامل | Nombre completo |
| `gCompleteSub` | Just a couple more details to finish signing up. | تفاصيل قليلة لإتمام إنشاء الحساب. | Solo un par de datos más para terminar el registro. |
| `gCompleteTitle` | Complete your profile | أكمل ملفك الشخصي | Completa tu perfil |
| `genderFemale` | Female | أنثى | Mujer |
| `genderLabel` | Gender | الجنس | Género |
| `genderMale` | Male | ذكر | Hombre |
| `gridViewBtn` | Grid | شبكة | Cuadrícula |
| `groupCapHint` | up to {0} riders | حتى {0} راكبين | hasta {0} ciclistas |
| `groupEditTitle` | Edit group booking | تعديل حجز المجموعة | Editar reserva de grupo |
| `groupNameLabel` | Group name | اسم المجموعة | Nombre del grupo |
| `groupNamePh` | e.g. Tamer Group | مثال: مجموعة تامر | p. ej., Grupo Tamer |
| `hasBookingsTitle` | Has bookings | لديه حجوزات | Tiene reservas |
| `heightHint` | - frame size auto-selected | - يتم اختيار المقاس تلقائياً | - la talla se elige automáticamente |
| `heightLabel` | Height | الطول | Altura |
| `heightOptional` | (optional - auto-selects your bike size) | (اختياري - يحدد مقاس الدراجة تلقائياً) | (opcional - selecciona tu talla automáticamente) |
| `heightPlaceholder` | Enter your height (cm) | أدخل طولك (سم) | Introduce tu altura (cm) |
| `helpBody` | Open a session so customers can book it (Sessions tab).<br>When a rider arrives, check them in from the Bookings tab and assign a bike.<br>Mark payment with the Paid toggle; use On the House for free rides.<br>In Sessions you can open, close, mark full, clone, or delete sessions.<br>Print or export a session report from the Bookings tab toolbar.<br>A  on a rider means they have repeat no-shows.<br>Use Lock (top bar) when you step away. | افتح جلسة ليتمكن العملاء من الحجز (تبويب الجلسات).<br>عند وصول الراكب، سجّل دخوله من تبويب الحجوزات وخصّص دراجة.<br>حدّد الدفع بزر مدفوع؛ استخدم "على الحساب" للرحلات المجانية.<br>في الجلسات يمكنك الفتح والإغلاق والتعليم كممتلئة والنسخ والحذف.<br>اطبع أو صدّر تقرير الجلسة من شريط أدوات الحجوزات.<br>علامة  على الراكب تعني تكرار عدم الحضور.<br>استخدم القفل (الشريط العلوي) عند الابتعاد. | Abre una sesión para que los clientes puedan reservar (pestaña Sesiones).<br>Cuando llegue un ciclista, regístralo desde la pestaña Reservas y asígnale una bici.<br>Marca el pago con el conmutador Pagado; usa Invitación para paseos gratis.<br>En Sesiones puedes abrir, cerrar, marcar como completa, clonar o eliminar sesiones.<br>Imprime o exporta un informe de sesión desde la barra de la pestaña Reservas.<br>Un  en un ciclista significa ausencias repetidas.<br>Usa Bloquear (barra superior) cuando te ausentes. |
| `helpBtn` | Help | مساعدة | Ayuda |
| `helpTitle` | Staff quick guide | دليل سريع للموظفين | Guía rápida del personal |
| `hiddenTypesLabel` | Hidden bike types | أنواع الدراجات المخفية | Tipos de bici ocultos |
| `hideOtherTypes` | ↑ Hide other types | ↑ إخفاء الأنواع الأخرى | ↑ Ocultar otros tipos |
| `historySub` | Log of all completed and no-show rides. Send receipts directly to customers. | سجل جميع الرحلات المكتملة والغيابات. | Registro de todos los paseos completados y ausencias. Envía recibos directamente a los clientes. |
| `historyTitle` | Ride History | سجل الرحلات | Historial de paseos |
| `homeBtn` | Home | الرئيسية | Inicio |
| `housePayTypesLabel` | On the house for these bike types | على حساب المحل لهذه الأنواع | Invitación para estos tipos de bici |
| `iabGoogleBlocked` | Google sign-in is blocked inside this app's browser (Instagram/WhatsApp). Tap ⋯ and choose "Open in browser", or sign up with email below. | تسجيل الدخول عبر Google محظور داخل متصفح هذا التطبيق (إنستغرام/واتساب). اضغط ⋯ واختر "الفتح في المتصفح"، أو أنشئ حساباً بالبريد أدناه. | El acceso con Google está bloqueado en el navegador de esta app (Instagram/WhatsApp). Toca ⋯ y elige "Abrir en el navegador", o regístrate con tu correo abajo. |
| `inLine` | in line | في الطابور | en la cola |
| `inQueueMsg` | You're in the queue | أنت في قائمة الانتظار | Estás en la cola |
| `inUseElse` | In use elsewhere | قيد الاستخدام في مكان آخر | En uso en otra reserva |
| `inUseLabel` | In Use | قيد الاستخدام | En uso |
| `joinQueue` | Join Queue | انضم للطابور | Unirse a la cola |
| `joinWaitlistBtn` | Join waitlist | انضم لقائمة الانتظار | Lista de espera |
| `justNow` | just now | الآن | ahora mismo |
| `keepNumberMsg` | Keep this number - you will need it to check your status. | احتفظ بهذا الرقم - ستحتاجه للتحقق من حالتك. | Guarda este número - lo necesitarás para consultar tu estado. |
| `landingSub` | Bicycle rentals & community rides in Jeddah | تأجير الدراجات وجولات مجتمعية في جدة | Alquiler de bicicletas y paseos comunitarios en Yeda |
| `landingTitle` | MicroMobility Rentals | مايكرو موبيليتي للتأجير | MicroMobility Rentals |
| `lastName` | Last Name | اسم العائلة | Apellido |
| `lecKickerComm` | Micromobility | مايكرو موبيليتي | Micromobility |
| `lifespanLabel` | Lifespan | مدة الخدمة | Vida útil |
| `liveLabel` | Live | مباشر | En vivo |
| `lockBtn` | Lock | قفل | Bloquear |
| `maintBtn` | Maintenance | صيانة | Mantenimiento |
| `maintLabel` | Maintenance | صيانة | Mantenimiento |
| `markFullBtn` | Mark Full | تعيين كمكتمل | Marcar completa |
| `meetPointLbl` | Meeting point | نقطة التجمع | Punto de encuentro |
| `memberCardTitle` | Member card | بطاقة العضوية | Tarjeta de socio |
| `memberNo` | Non-member | غير عضو | No miembro |
| `memberYes` | Member | عضو | Miembro |
| `mfBrand` | Brand: | العلامة: | Marca: |
| `mfModel` | Model: | الطراز: | Modelo: |
| `mfSize` | Size: | المقاس: | Talla: |
| `middleName` | Middle Name | الاسم الأوسط | Segundo nombre |
| `minutesAgo` | m ago | د مضت | min atrás |
| `modifyBanner` | You already have a booking in this session. Update your size or bike type preference below. | لديك حجز قائم في هذه الجلسة. يمكنك تعديل المقاس أو نوع الدراجة أدناه. | Ya tienes una reserva en esta sesión. Actualiza abajo tu talla o tipo de bici. |
| `modifyBookingBtn` | Update Booking | تعديل الحجز | Actualizar reserva |
| `modifyExistingBtn` | Modify My Booking | تعديل حجزي | Modificar mi reserva |
| `moveDownLabel` | Move down | تحريك لأسفل | Bajar |
| `moveDownLbl` | Move down | تحريك لأسفل | Bajar |
| `moveUpLabel` | Move up | تحريك لأعلى | Subir |
| `moveUpLbl` | Move up | تحريك لأعلى | Subir |
| `mrBadgesTitle` | Badges | الأوسمة | Insignias |
| `mrBookNext` | Book your next ride | احجز رحلتك القادمة | Reserva tu próximo paseo |
| `mrInDays` | in {0} days | بعد {0} أيام | en {0} días |
| `mrShareBtn` | Share my season | شارك موسمي | Compartir mi temporada |
| `mrShareText` | My season at the Jeddah Corniche Circuit 🚴 | موسمي في حلبة كورنيش جدة 🚴 | Mi temporada en el Circuito Corniche de Yeda 🚴 |
| `mrToday` | Today! | اليوم! | ¡Hoy! |
| `mrTomorrow` | Tomorrow | غداً | Mañana |
| `myCurrentRides` | Current & upcoming | الحالية والقادمة | Actuales y próximos |
| `myPastRides` | Past rides | الرحلات السابقة | Paseos anteriores |
| `myRidesSub` | Your complete rental history. | سجلك الكامل للإيجار. | Tu historial completo de alquileres. |
| `myRidesTitle` | My Rides | رحلاتي | Mis paseos |
| `nameLabel` | Name | الاسم | Nombre |
| `navReserve` | Reserve | احجز | Reservar |
| `needToUpdate` | Need to update? | تريد التحديث؟ | ¿Necesitas actualizarlo? |
| `newSession` | + New Session | + جلسة جديدة | + Nueva sesión |
| `newSessionTitle` | New Session | جلسة جديدة | Nueva sesión |
| `nextUpLabel` | Next Up | التالي | Siguiente |
| `notSetOpt` | Not set | غير محدد | Sin definir |
| `notesEmpty` | No notes yet. Add the first one above. | لا توجد ملاحظات بعد. أضف الأولى أعلاه. | Aún no hay notas. Añade la primera arriba. |
| `notesSub` | Private staff notes - customers never see these. | ملاحظات خاصة بالموظفين - لا يراها العملاء أبداً. | Notas privadas del personal - los clientes nunca las ven. |
| `notesTitle` | Customer Notes | ملاحظات العملاء | Notas de clientes |
| `nsClear` | Clear | مسح | Limpiar |
| `nsSelectAll` | Select all | تحديد الكل | Seleccionar todo |
| `nsSelectAllBikes` | Select all bikes | تحديد كل الدراجات | Seleccionar todas las bicis |
| `numBikes` | Number of Bikes | عدد الدراجات | Número de bicicletas |
| `offlineBanner` | You are offline - changes are saved and will sync when the connection returns. | أنت غير متصل - يتم حفظ التغييرات وستتم المزامنة عند عودة الاتصال. | Estás sin conexión - los cambios se guardan y se sincronizarán cuando vuelva la conexión. |
| `offlineLabel` | Offline | غير متصل | Sin conexión |
| `onBikeNow` | On the bike now | على الدراجة الآن | En la bici ahora |
| `onBikeStat` | On Bike | على الدراجة | En bici |
| `onTheHouseLabel` | On the house | على حساب المحل | Invitación |
| `opGateBtn` | Continue | متابعة | Continuar |
| `opGateMsg` | Pick your name — every action is recorded in the log under whoever did it. | اختر اسمك — يُسجَّل كل إجراء في السجل باسم من قام به. | Elige tu nombre: cada acción queda registrada con el nombre de quien la hizo. |
| `opGateTitle` | Who is working? | من يعمل الآن؟ | ¿Quién está trabajando? |
| `openBtn` | Open | فتح | Abrir |
| `openEmailApp` | Open in Email App | فتح في تطبيق البريد | Abrir en la app de correo |
| `openMapsLbl` | Open in Maps | افتح في الخرائط | Abrir en Maps |
| `opensNewTab` |  (opens in a new tab) |  (يفتح في تبويب جديد) |  (se abre en una pestaña nueva) |
| `optionalLabel` | optional | اختياري | opcional |
| `outOfStock` | Out of stock | نفد المخزون | Agotado |
| `paidLabel` | Paid | مدفوع | Pagado |
| `payAtBooth` |  Payment is collected at the booth at the Corniche Circuit. Please have your queue number ready. |  الدفع يتم عند الكشك في دوار الكورنيش. يرجى إحضار رقم طابورك. |  El pago se realiza en la caseta del Circuito de la Corniche. Ten tu número de turno a mano. |
| `payAtBoothFCFS` | Bikes are assigned on a First Come, First Serve basis. Come early to get the bike type you chose. | يتم توزيع الدراجات على أساس الأول فالأول. تعال مبكراً للحصول على نوع الدراجة الذي اخترته. | Las bicis se asignan por orden de llegada. Llega pronto para conseguir el tipo de bici que elegiste. |
| `payAtBoothMsg` | Payment is collected at the booth at the Corniche Circuit. Please have your queue number ready when you arrive. | يتم الدفع عند الكشك في حلبة الكورنيش. يرجى إحضار رقم طابورك عند وصولك. | El pago se realiza en la caseta del Circuito de la Corniche. Ten tu número de turno listo al llegar. |
| `payAtBoothTitle` | Payment Info | معلومات الدفع | Información de pago |
| `payPendingWarning` | Unpaid | غير مدفوع | Sin pagar |
| `payTeam` | MM Team | فريق MM | Equipo MM |
| `pendingLabel` | Pending | معلق | Pendiente |
| `pendingPayment` | Pending Payment | مستحق الدفع | Pago pendiente |
| `phoneNum` | Phone Number | رقم الهاتف | Número de teléfono |
| `photoErrToast` | Could not read that image. | تعذّرت قراءة الصورة. | No se pudo leer esa imagen. |
| `photoSavedToast` | Photo updated | تم تحديث الصورة | Foto actualizada |
| `pinAttemptsWarn` | {0} attempts remaining before lockout | تبقّت {0} محاولات قبل القفل | {0} intentos antes del bloqueo |
| `pinLocked` | Too many wrong attempts. Try again in {0}. | محاولات خاطئة كثيرة. حاول مجدداً بعد {0}. | Demasiados intentos fallidos. Inténtalo de nuevo en {0}. |
| `pinSub` | Enter the 4-digit PIN to access the staff panel. | أدخل الرقم السري المكون من 4 أرقام للدخول إلى لوحة الموظفين. | Introduce el PIN de 4 dígitos para acceder al panel del personal. |
| `pinTitle` | Staff Access | دخول الموظفين | Acceso del personal |
| `posLabel` | Pos. | مركز | Pos. |
| `preferenceLabel` | Preference | التفضيل | Preferencia |
| `priceCustomOpt` | Custom... | مخصص... | Personalizado... |
| `pricePerBike` | Price per bike | السعر للدراجة | Precio por bici |
| `priceVipDiscount` | VIP & Guests Discount | خصم كبار الشخصيات والضيوف | Descuento VIP e invitados |
| `printCollected` | Collected | المبلغ المحصل | Cobrado |
| `printPending` | Pending | المبلغ المعلق | Pendiente |
| `printReportBtn` | Print Report | طباعة التقرير | Imprimir informe |
| `printReportTitle` | Session Report | تقرير الجلسة | Informe de sesión |
| `printTotalRiders` | Total Riders | إجمالي الركاب | Ciclistas totales |
| `profileCompleteLabel` | Profile {0}% complete | اكتمال الملف {0}% | Perfil {0}% completo |
| `profileInfo` | Profile Information | معلومات الملف الشخصي | Información del perfil |
| `profilePhotoLabel` | Profile Photo | صورة الملف | Foto de perfil |
| `promoteBtn` | Promote | ترقية | Promover |
| `publishBtn` | Publish | نشر | Publicar |
| `publishConfirmBody` | {0} approved rider(s) will immediately see that they are confirmed, along with their queue number. This cannot be undone from here. | سيرى {0} مشارك مقبول تأكيد مشاركته ورقمه في الطابور فوراً. لا يمكن التراجع عن ذلك من هنا. | {0} ciclista(s) aprobado(s) verán de inmediato su confirmación y su número de turno. Esto no se puede deshacer desde aquí. |
| `publishConfirmTitle` | Publish the rider list? | نشر قائمة المشاركين؟ | ¿Publicar la lista de ciclistas? |
| `publishedAlready` | Results are already published for this ride. | تم نشر نتائج هذه الجولة بالفعل. | Los resultados de este paseo ya están publicados. |
| `publishedChip` | Published | تم النشر | Publicado |
| `publishedToast` | Results published - {0} rider(s) confirmed | تم نشر النتائج - تأكيد {0} مشارك | Resultados publicados - {0} ciclista(s) confirmado(s) |
| `qtyDecLabel` | Decrease number of bikes | إنقاص عدد الدراجات | Reducir número de bicicletas |
| `qtyIncLabel` | Increase number of bikes | زيادة عدد الدراجات | Aumentar número de bicicletas |
| `queueNumLabel` | Queue Number | رقم الطابور | Número de turno |
| `quickAddBikeSubmit` | Add & Select | إضافة وتحديد | Añadir y seleccionar |
| `quickAddBikeTitle` | Quick Add Bike | إضافة دراجة سريعة | Añadir bici rápido |
| `railHoverTip` | Collapse sidebar | طيّ القائمة | Contraer barra lateral |
| `railPinTip` | Keep sidebar open | تثبيت القائمة الجانبية | Mantener la barra lateral abierta |
| `ratedLabel` | Rated | تم التقييم | Valorado |
| `registeredLabel` | Registered | مُسجَّل | Registrado |
| `releaseBikeBtn` | Release | تحرير | Liberar |
| `releaseBikeToast` | released back to available | تم تحريره وأصبح متاحاً | liberada y disponible de nuevo |
| `rememberMe` | Remember me | تذكرني | Recuérdame |
| `removeBtn` | Remove | حذف | Quitar |
| `removePhotoBtn` | Remove | إزالة | Quitar |
| `removedLabel` | Removed | محذوف | Eliminado |
| `rentDiscountLabel` | Discount % | خصم % | Descuento % |
| `reopenBookingBtn` | Re-open | إعادة فتح | Reabrir |
| `reopenBtn` | Re-open | إعادة فتح | Reabrir |
| `reorderNone` | Nothing needs reordering right now. | لا شيء يحتاج إعادة طلب الآن. | Nada necesita reposición ahora mismo. |
| `reorderShareBtn` | Share list | مشاركة القائمة | Compartir lista |
| `reorderShareTitle` | Reorder list - MicroMobility | قائمة إعادة الطلب - مايكروموبيليتي | Lista de reposición - MicroMobility |
| `reorderSold` | sold | مُباع | vendidos |
| `reorderSuggest` | reorder | أعد الطلب | reponer |
| `reorderTitle` | Reorder suggestions | اقتراحات إعادة الطلب | Sugerencias de reposición |
| `repeatOnceOpt` | Just this date | هذا التاريخ فقط | Solo esta fecha |
| `repeatWeeksHint` | creates the same session for the next weeks | ينشئ نفس الجلسة للأسابيع القادمة | crea la misma sesión para las próximas semanas |
| `repeatWeeksLabel` | Repeat weekly | تكرار أسبوعي | Repetir semanalmente |
| `repeatWeeksOpt` | {0} weeks | {0} أسابيع | {0} semanas |
| `rescheduleBtn` | Reschedule | إعادة جدولة | Reprogramar |
| `rescheduleFull` | Not enough room in that session. | لا توجد مساحة كافية في تلك الجلسة. | No hay sitio suficiente en esa sesión. |
| `rescheduleNoSessions` | No other open sessions available. | لا توجد جلسات مفتوحة أخرى متاحة. | No hay otras sesiones abiertas disponibles. |
| `rescheduleSub` | Pick another session to move all your riders to. | اختر جلسة أخرى لنقل جميع ركابك إليها. | Elige otra sesión a la que mover a todos tus ciclistas. |
| `rescheduleTitle` | Move your booking | نقل حجزك | Mover tu reserva |
| `reserveBikeBtn` | Reserve bike | حجز الدراجة | Reservar bici |
| `reserveDesc` | Register for an available session and join the queue. | سجل في جلسة متاحة وانضم إلى الطابور. | Regístrate en una sesión disponible y únete a la cola. |
| `reserveTakenConfirm` | Reserved for {0} — assign anyway? | محجوزة لـ {0} — هل تريد المتابعة؟ | Reservada para {0}. ¿Asignar igualmente? |
| `reserveTitle` | Reserve Your Spot | احجز دراجتك | Reserva tu plaza |
| `reservedAtLabel` | Reserved at | وقت الحجز | Reservado el |
| `reservedChip` | Reserved | محجوزة | Reservada |
| `resetBtn` | Set New Password | تعيين كلمة مرور جديدة | Establecer contraseña nueva |
| `resetCodeLabel` | 6-Digit Code | الرمز المكوّن من 6 أرقام | Código de 6 dígitos |
| `resetConfirmPwd` | Confirm New Password | تأكيد كلمة المرور | Confirmar contraseña nueva |
| `resetFiltersBtn` | Reset | إعادة تعيين | Restablecer |
| `resetNewPwd` | New Password | كلمة المرور الجديدة | Contraseña nueva |
| `restoreBookingBtn` | Restore | استعادة | Restaurar |
| `restoreBtn` | Restore | استعادة | Restaurar |
| `restoreEntryBtn` | Restore | استعادة | Restaurar |
| `restoreFullBody` | This session is already at capacity. Restore this booking anyway? | هذه الجلسة ممتلئة بالفعل. هل تريد استعادة هذا الحجز على أي حال؟ | Esta sesión ya está al máximo. ¿Restaurar esta reserva de todos modos? |
| `restoreFullTitle` | Session is full | الجلسة ممتلئة | La sesión está completa |
| `resultBikes` | bikes | دراجة | bicis |
| `resultOf` | of | من | de |
| `resultRecords` | records | سجل | registros |
| `resultRiders` | riders | راكباً | ciclistas |
| `resultRides` | rides | رحلات | paseos |
| `resultSessions` | sessions | جلسات | sesiones |
| `retireBtn` | Retire | تقاعد | Retirar |
| `retiredLabel` | Retired | متقاعد | Retirada |
| `retryBtn` | Try again | إعادة المحاولة | Reintentar |
| `returnBikeBtn` | Return Bike | إرجاع الدراجة | Devolver bici |
| `returnMarkPaidBtn` | Mark Paid & Return | تسجيل الدفع وإعادة الدراجة | Marcar pagado y devolver |
| `returnPayMsg` | This rider has not paid yet. The bike will be returned and payment will be marked as pending. | لم يدفع هذا الراكب بعد. سيتم إرجاع الدراجة وسيُسجَّل الدفع كمعلق. | Este ciclista aún no ha pagado. La bici se devolverá y el pago quedará pendiente. |
| `returnPayTitle` | Payment Pending | الدفع معلق | Pago pendiente |
| `returnPendingBtn` | Return - Pending Payment | إرجاع الدراجة - دفع معلق | Devolver - pago pendiente |
| `reviewRentalLabel` | Rental | الإيجار | Alquiler |
| `reviewRidersLabel` | Riders | الركّاب | Ciclistas |
| `reviewSessionLabel` | Session | الجلسة | Sesión |
| `reviewTotalLabel` | Total | الإجمالي | Total |
| `rideHistory` | Ride History | سجل الرحلات | Historial de paseos |
| `rideTierLabel` | Rider tier | مستوى الراكب | Nivel de ciclista |
| `riderDetails` | Rider Details | بيانات الراكب | Datos del ciclista |
| `riderLabel` | Rider | الراكب | Ciclista |
| `riderName` | Rider's Full Name | الاسم الكامل للراكب | Nombre completo del ciclista |
| `riderNamePlaceholder` | Enter rider's full name | أدخل الاسم الكامل | Nombre completo del ciclista |
| `ridersStat` | Riders | الراكبون | Ciclistas |
| `ridesToNext` | {0} more rides to {1} | {0} رحلات للوصول إلى {1} | {0} paseos más para {1} |
| `roleAdmin` | Admin | مدير | Admin |
| `roleFrontDesk` | Front Desk | موظف استقبال | Recepción |
| `rowLabel` | Row | الإجمالي | Fila |
| `saveAccountBtn` | Save Changes | حفظ التغييرات | Guardar cambios |
| `saveBikeBtn` | Save Changes | حفظ التغييرات | Guardar cambios |
| `saveBtn` | Save | حفظ | Guardar |
| `saveChangesBtn` | Save Changes | حفظ التغييرات | Guardar cambios |
| `saveSessionBtn` | Save Changes | حفظ التغييرات | Guardar cambios |
| `searchLabel` | Search bikes... | ابحث عن دراجة... | Buscar bicis... |
| `searchPlaceholder` | Booking number, name or phone… | رقم الحجز أو الاسم أو الهاتف… | Número de reserva, nombre o teléfono… |
| `searchWord` | Search | بحث | Buscar |
| `secondsAgo` | s ago | ث مضت | s atrás |
| `selectCityOpt` | Select city | اختر المدينة | Selecciona una ciudad |
| `selectCountryFirst` | Select a country first | اختر الدولة أولاً | Selecciona primero un país |
| `selectCountryOpt` | Select country | اختر الدولة | Selecciona un país |
| `selectRowTip` | Select | تحديد | Seleccionar |
| `selectSessionPrompt` | Select a session above | اختر جلسة من الأعلى | Selecciona una sesión arriba |
| `selectSessionSub` | Click a session chip to view and manage its queue independently. | انقر على إحدى الجلسات لعرض طابورها وإدارته بشكل مستقل. | Toca una sesión para ver y gestionar su cola por separado. |
| `sendCodeBtn` | Send Code | إرسال الرمز | Enviar código |
| `sendReceipt` | Receipt | إيصال | Recibo |
| `servingSize` | Serving size | حجم الحصة | Tamaño de ración |
| `sessionAddonsHint` | inventory items customers can add to a booking | عناصر من المخزون يمكن للعملاء إضافتها إلى الحجز | artículos del inventario que los clientes pueden añadir a una reserva |
| `sessionAddonsLabel` | Add-ons offered | الإضافات المتاحة | Extras ofrecidos |
| `sessionBranchLabel` | Location / Branch | الموقع / الفرع | Ubicación / Sucursal |
| `sessionFleetLabel` | Session fleet | أسطول الجلسة | Flota de la sesión |
| `sessionFullWaitlistMsg` | This session is full. You can join the waitlist and we will promote you if a spot opens. | هذه الجلسة ممتلئة. يمكنك الانضمام لقائمة الانتظار وسنرقّيك عند توفر مكان. | Esta sesión está completa. Puedes unirte a la lista de espera y te promoveremos si se libera una plaza. |
| `sessionsSub` | Create sessions and open them to accept reservations. Closed by default. | أنشئ الجلسات وافتحها لقبول الحجوزات. مغلقة بشكل افتراضي. | Crea sesiones y ábrelas para aceptar reservas. Cerradas por defecto. |
| `sessionsTitle` | Sessions | الجلسات | Sesiones |
| `setBtnShort` | Set | تعيين | Fijar |
| `setPriceBtn` | Set Price | تحديد السعر | Fijar precio |
| `settledLabel` | Settled | مسوّى | Saldado |
| `showOtherTypes` | ↓ Show other types | ↓ عرض أنواع أخرى | ↓ Mostrar otros tipos |
| `sizeMatchLabel` | Size match | مقاس مناسب | Talla compatible |
| `sizeWord` | Size | المقاس | Talla |
| `snavCommerce` | Commerce | التجارة | Comercio |
| `snavInsights` | Insights | الرؤى | Informes |
| `snavPeople` | People | الأشخاص | Personas |
| `snavRides` | Rides | الرحلات | Paseos |
| `snavSystem` | System | النظام | Sistema |
| `someDatesSkipped` | {0} created, {1} already existed | تم إنشاء {0}، {1} موجودة مسبقاً | {0} creadas, {1} ya existían |
| `splitCardPrompt` | Amount paid by CARD (SAR)? The rest is cash. | المبلغ المدفوع بالبطاقة (ريال)؟ والباقي نقدًا. | ¿Importe pagado con TARJETA (SAR)? El resto es efectivo. |
| `splitWord` | Split | تقسيم | Dividir |
| `spotsLeft` | left | متبقٍ | libres |
| `stApplyBtn` | Apply {0} correction(s) | تطبيق {0} تصحيح | Aplicar {0} corrección(es) |
| `stCancelBtn` | Exit stock-take | إنهاء الجرد | Salir del inventario |
| `stHint` | Type the counted quantity for each item - differences are highlighted. | اكتب الكمية المعدودة لكل عنصر - تُبرز الفروقات. | Escribe la cantidad contada de cada artículo - las diferencias se resaltan. |
| `stNoChanges` | No corrections to apply. | لا توجد تصحيحات للتطبيق. | No hay correcciones que aplicar. |
| `stStartBtn` | Stock-take | جرد المخزون | Hacer inventario |
| `stepConfirm` | Confirmation | تأكيد | Confirmación |
| `stockLeft` | left | متبقٍ | quedan |
| `switchLangTip` | Switch language | تغيير اللغة | Cambiar idioma |
| `switchToAdmin` | Admin | مدير | Admin |
| `switchToFrontDesk` | Front Desk mode | وضع الاستقبال | Modo recepción |
| `syncDiscardBtn` | Discard | تجاهل | Descartar |
| `syncDiscardedToast` | Pending sales discarded. | تم تجاهل المبيعات المعلقة. | Ventas pendientes descartadas. |
| `syncOfflineToast` | Still offline - they will sync when the connection returns. | لا يزال دون اتصال - ستتم المزامنة عند عودة الاتصال. | Aún sin conexión - se sincronizarán cuando vuelva. |
| `syncStuckBody` | {0} sale(s) could not sync. They may reference data that was changed or removed. Discard them? This cannot be undone. | {0} عملية بيع تعذّرت مزامنتها. قد تشير إلى بيانات تم تغييرها أو حذفها. تجاهلها؟ لا يمكن التراجع. | {0} venta(s) no se pudieron sincronizar. Puede que hagan referencia a datos cambiados o eliminados. ¿Descartarlas? No se puede deshacer. |
| `syncStuckTitle` | Sales stuck syncing | مبيعات عالقة في المزامنة | Ventas atascadas en la sincronización |
| `tableViewBtn` | Table | جدول | Tabla |
| `tblScrollLabel` | Table — scroll sideways | جدول — مرّر أفقياً | Tabla — desplázate en horizontal |
| `teamAddMember` | Add member | إضافة عضو | Añadir miembro |
| `teamChoose` | Choose team member | اختر عضو الفريق | Elegir miembro del equipo |
| `teamCustom` | Custom name | اسم مخصص | Nombre personalizado |
| `teamCustomPrompt` | Team member name | اسم عضو الفريق | Nombre del miembro del equipo |
| `teamEmpty` | No team members yet. | لا يوجد أعضاء فريق بعد. | Aún no hay miembros del equipo. |
| `teamManage` | Manage team | إدارة الفريق | Gestionar equipo |
| `teamMgrTitle` | MM Team members | أعضاء فريق MM | Miembros del equipo MM |
| `themeDark` | Night mode | الوضع الليلي | Modo noche |
| `themeLight` | Sunlight mode | وضع النهار | Modo día |
| `ticketAddCal` | Add to Calendar | أضف إلى التقويم | Añadir al calendario |
| `ticketDirections` | Get Directions | الاتجاهات | Cómo llegar |
| `ticketLocation` | Location | الموقع | Ubicación |
| `ticketScanGate` | Scan on arrival | امسح عند الوصول | Escanea al llegar |
| `tierElite` | Elite | نخبة | Élite |
| `tierLegend` | Legend | أسطورة | Leyenda |
| `tierNewcomer` | Newcomer | مبتدئ | Novato |
| `tierPro` | Pro | محترف | Pro |
| `tierRegular` | Regular | منتظم | Habitual |
| `timeLabel` | Time | الوقت | Hora |
| `todayBikesOut` | Bikes out | دراجات بالخارج | Bicis fuera |
| `todayLabel` | Today | اليوم | Hoy |
| `todayNoShows` | No-shows | لم يحضروا | Ausencias |
| `todayRevenue` | Revenue today | إيرادات اليوم | Ingresos de hoy |
| `todayServed` | Riders served | الركّاب المخدومون | Ciclistas atendidos |
| `totalBikesSession` | Total bikes in session | إجمالي الدراجات في الجلسة | Bicis totales en la sesión |
| `totalBookings` | Total Bookings | إجمالي الحجوزات | Reservas totales |
| `totalPaid` | Total Paid | إجمالي المدفوع | Total pagado |
| `totalStat` | Total | الكل | Total |
| `totalWord` | Total | الإجمالي | Total |
| `undoneMsg` | Undone. | تم التراجع. | Deshecho. |
| `undoneTag` | undone | تم التراجع | deshecho |
| `unitHour` | h | س | h |
| `unitMin` | min | د | min |
| `unreachableBanner` | Connected to wifi but the server is not reachable - you may need to sign in to this network. | متصل بالشبكة لكن تعذّر الوصول إلى الخادم - قد تحتاج إلى تسجيل الدخول إلى هذه الشبكة. | Conectado al wifi pero el servidor no responde - puede que debas iniciar sesión en esta red. |
| `updReloadBtn` | Refresh | تحديث | Actualizar |
| `updateReadyToast` | A new version is ready — refresh the page to update. | يتوفر إصدار جديد — حدّث الصفحة للتحديث. | Hay una versión nueva — actualiza la página para aplicarla. |
| `uploadPhotoBtn` | Upload photo | رفع صورة | Subir foto |
| `vatExcl` | excl. | غير شامل | sin IVA |
| `vatExclusive` | V.A.T. Exclusive | غير شامل الضريبة | IVA no incluido |
| `vatInclusive` | V.A.T. Inclusive | شامل الضريبة | IVA incluido |
| `verifying` | Verifying... | جارٍ التحقق... | Verificando... |
| `waMissYouMsg` | We miss you at MicroMobility! Come ride the Corniche Circuit with us again - reserve your next ride anytime.<br><br>اشتقنا لك في مايكروموبيليتي! تعال واركب في حلبة الكورنيش معنا مجدداً - احجز رحلتك القادمة في أي وقت. | We miss you at MicroMobility! Come ride the Corniche Circuit with us again - reserve your next ride anytime.<br><br>اشتقنا لك في مايكروموبيليتي! تعال واركب في حلبة الكورنيش معنا مجدداً - احجز رحلتك القادمة في أي وقت. | ¡Te echamos de menos en MicroMobility! Vuelve a montar con nosotros en el Circuito de la Corniche - reserva tu próximo paseo cuando quieras. |
| `waRateMsg` | Thanks for riding with MicroMobility! How was your ride? Rate it here:<br><br>شكراً لركوبك مع مايكروموبيليتي! كيف كانت رحلتك؟ قيّمها هنا: | Thanks for riding with MicroMobility! How was your ride? Rate it here:<br><br>شكراً لركوبك مع مايكروموبيليتي! كيف كانت رحلتك؟ قيّمها هنا: | ¡Gracias por montar con MicroMobility! ¿Qué tal tu paseo? Valóralo aquí: |
| `waYourTurnMsg` | Hello! Your turn at MicroMobility is coming up soon. Please head to the booth.<br><br>مرحباً! اقترب دورك في مايكروموبيليتي. يرجى التوجه إلى الكشك. | Hello! Your turn at MicroMobility is coming up soon. Please head to the booth.<br><br>مرحباً! اقترب دورك في مايكروموبيليتي. يرجى التوجه إلى الكشك. | ¡Hola! Tu turno en MicroMobility llega pronto. Acércate a la caseta, por favor. |
| `waitingRidersStat` | Waiting Riders | في الانتظار | Ciclistas en espera |
| `waitingStat` | Waiting | بانتظار | En espera |
| `waitlistLabel` | Waitlist | قائمة الانتظار | Lista de espera |
| `walkinName` | Full Name | الاسم الكامل | Nombre completo |
| `walkinPhone` | Phone Number | رقم الهاتف | Número de teléfono |
| `walkinSession` | Session | الجلسة | Sesión |
| `walkinSize` | Frame Size | مقاس الإطار | Talla |
| `walkinTitle` | Walk-in Registration | تسجيل زيارة مباشرة | Registro sin reserva |
| `walkinType` | Bike Type Preference | تفضيل نوع الدراجة | Tipo de bici preferido |
| `walletAdding` | Preparing pass… | جارٍ تجهيز البطاقة… | Preparando el pase… |
| `walletErr` | Could not create the Wallet pass. | تعذّر إنشاء بطاقة Wallet. | No se pudo crear el pase de Wallet. |
| `wiPickCustPh` | Type a name or pick a saved customer | اكتب اسمًا أو اختر عميلًا محفوظًا | Escribe un nombre o elige un cliente guardado |
| `youreNext` | You're next! | أنت التالي! | ¡Eres el siguiente! |
