// Shared presence tuning. Client-safe: no server-only imports.

export const PRESENCE_CHANNEL = "presence-into-now";
export const PRESENCE_EVENT = "presence-update";

// Liveness floor while stationary.
export const HEARTBEAT_MS = 20_000;

// A user stays "lit" this long after their last beat — sized to survive
// one dropped heartbeat (3 beats + slack).
export const PRESENCE_TTL_MS = 65_000;

// Movement-triggered updates: send when moved at least this far...
export const MOVE_THRESHOLD_M = 15;
// ...but never more often than this per client.
export const MIN_SEND_INTERVAL_MS = 3_000;

// Ignore fixes with worse accuracy than this for movement triggers,
// so GPS jitter doesn't spray updates from a stationary user.
export const ACCURACY_GATE_M = 100;

// Tab hidden this long before we go offline — brief app-switches don't flicker.
export const HIDDEN_GRACE_MS = 15_000;

// Full state resync cadence (also runs on realtime reconnect).
export const RESYNC_INTERVAL_MS = 60_000;

// Server-side flood guard: coalesce online updates arriving faster than
// this per session.
export const SERVER_MIN_UPDATE_MS = 2_000;

// Cron hygiene: live_sessions rows older than this get deleted.
export const SESSION_REAP_AGE_MS = 24 * 60 * 60 * 1000;
