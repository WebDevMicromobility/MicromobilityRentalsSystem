// Ambient declarations for the app globals that extracted modules reference.
// These live in the main inline script (app.src.html); modules are concatenated into
// that same scope at build time, so to `tsc` they are globals. Typed loosely for now —
// tighten as more of the app is extracted and properly typed.

/** Global app state object. */
declare const S: any;
/** Parses a session's bike_slots blob into a slots object ({ _time, ... }). */
declare function parseSlots(raw: any): any;
/** Returns all sessions (with a display field added). */
declare function allSessions(): any[];
/** Formats a "HH:MM - HH:MM" range into a localized 12-hour string. */
declare function fmt12h(timeStr: string): string;
