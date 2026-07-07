# RTgeoupdate — Real-Time Geolocation & Presence Plan

**Goal:** Whenever any user is online — meaning the app is open and visible on their device — their live location is continuously captured and broadcast, so every other viewer sees their green "lit" light and watches them move across the map in real time.

> **Status: IMPLEMENTED (2026-07-07).** Phases 1–4 are rolled out. Key decision change from the original draft: **presence has no age-verification gate** — it is enabled for every signed-in user (`Boolean(user)` in `HomePage.tsx`), and anonymous and verified users share location with identical verbosity. (App entry itself still requires the onboarding birthday attestation, which applies equally to both paths.) New files: `src/lib/presenceConfig.ts` (all tuning constants), `src/components/AnimatedMarker.tsx` (marker interpolation), `src/app/api/cron/reap-sessions/route.ts` (+ vercel.json cron). Rewritten: `src/hooks/useLivePresence.ts`. Verified end-to-end locally with simulated device movement: fixes → throttled POSTs → Neon rows → moving green marker. Cross-client Pusher fan-out unchanged (couldn't be exercised locally — Pusher env vars are empty in `.env.local`).

---

## 1. Where we are today (audit)

The core pipeline already exists. This plan hardens it rather than rebuilding it.

| Piece | Status | Where |
|---|---|---|
| Geolocation capture | ✅ `navigator.geolocation.watchPosition` (high accuracy) | `src/hooks/useLivePresence.ts:162-174` |
| Upload to server | ✅ POST `/api/presence` on a fixed **20s heartbeat** + visibility changes | `src/hooks/useLivePresence.ts:176-188` |
| Persistence | ✅ `live_sessions` upsert + `users.last_lat/last_lng/last_location_at` | `src/app/api/presence/route.ts`, `src/lib/schema.ts` |
| Real-time fan-out | ✅ Pusher `presence-into-now` / `presence-update` | `src/lib/pusher.ts`, `route.ts:94-109` |
| Green light | ✅ `LiveUserMarker` renders green dot + ping ring when `isLit` | `src/components/LiveUserMarker.tsx` |
| Online definition | ✅ `lastSeenAt` within `PRESENCE_TTL_MS = 45s` | `src/lib/pusher.ts:21`, `src/lib/mapUsers.ts:27` |
| Offline handling | ✅ `sendBeacon` on unload / tab hidden | `src/hooks/useLivePresence.ts:69-71, 182-190` |

### Gaps that break the goal

1. **Movement is not broadcast between heartbeats.** `watchPosition` fires on every device move, but new coords only update a local ref (`latestCoords`); the server hears about them at the next 20s tick. A user walking down the street "teleports" every 20 seconds instead of visibly moving.
2. **No recovery when geolocation fails or is denied.** The `watchPosition` error callback just sets `sharing=false` (`useLivePresence.ts:172`). There is no retry, no permission re-check, and no UI telling the user their light is off. If the user later grants permission in browser settings, the watch is never restarted — they stay invisible until a full reload.
3. **Presence never starts before age verification.** `useLivePresence` is gated on `mapReady = Boolean(user?.ageVerifiedAt)` (`src/components/HomePage.tsx:104-108`). That gate is intentional, but it means "any user online" really means "any age-verified user" — this must be confirmed as the product rule and stated in the UI, not left implicit.
4. **Markers jump instead of glide.** `<Marker>` coords are swapped on each Pusher event with no interpolation, so even with faster updates, motion looks steppy.
5. **Missed Pusher events leave stale state.** After the initial `GET /api/presence` hydration, clients rely entirely on deltas. A dropped event (reconnect, sleep/wake, flaky mobile network) can strand a lit marker at an old position until the 10s client prune catches TTL expiry — and never corrects a wrong *position*.
6. **`live_sessions` rows are never reaped server-side.** Stale rows only fall out of queries via the TTL filter; the table grows unbounded. The only cron (`vercel.json`) is `expire-anonymous`.
7. **TTL vs heartbeat margin is tight.** 45s TTL with 20s heartbeat means two missed beats = flicker to gray. On mobile radios that's common.
8. **Instant offline on tab hide.** Switching apps for 2 seconds on a phone fires `offline` and kills the session, causing green-light flicker for brief interruptions.

---

## 2. Design decisions

- **"Online" = app open, tab visible, geolocation permitted, signed in (anonymous or verified — no age-verification gate on presence).** Hidden tab still means offline (this matches "viewing the application"), but with a short grace period (below) so momentary app-switches don't flicker.
- **Keep the heartbeat, add movement-triggered updates.** The heartbeat proves liveness when stationary; movement events provide the "watch them move" experience. Both flow through the existing `/api/presence` → DB → Pusher path — no new infrastructure.
- **Throttle by distance and time, not just time.** Send when the user has moved ≥ ~15 meters AND ≥ 3s since the last send; otherwise fall back to the heartbeat. This caps Pusher message volume and DB writes for fast movers while staying visually live. (Pusher free/starter tiers meter by message count — this is the cost-control knob.)
- **Client renders smooth motion regardless of update rate.** Interpolate marker positions over ~1–2s so even 3–20s update gaps look like continuous movement.
- **Server stays the source of truth.** Clients periodically resync the full lit/unlit list; Pusher deltas are an optimization, not the record.

---

## 3. Implementation plan

### Phase 1 — Guarantee capture whenever the app is open

**Files:** `src/hooks/useLivePresence.ts`, `src/components/HomePage.tsx`, (small UI component for the permission state)

1. **Permission lifecycle.** On mount, query `navigator.permissions.query({ name: "geolocation" })`:
   - `granted` → start `watchPosition` immediately.
   - `prompt` → start `watchPosition` (which triggers the browser prompt) after a brief in-app explainer so the prompt isn't a surprise.
   - `denied` → set a `locationBlocked` state; show a persistent, dismiss-resistant banner: "Your light is off — enable location to appear on the map," with per-platform instructions.
   - Subscribe to `permissionStatus.onchange` and **restart the watch automatically** when permission flips to granted — no reload required.
2. **Watch resilience.** On `watchPosition` error (timeout, position unavailable), clear and re-establish the watch with backoff (e.g., 5s → 15s → 30s, capped). Distinguish `PERMISSION_DENIED` (show banner, stop retrying until permission changes) from transient errors (retry silently).
3. **Visibility grace period.** On `visibilitychange → hidden`, don't send `offline` immediately; start a ~15s timer. If the tab becomes visible again first, cancel it and send an `online` beat. Keep the immediate `sendBeacon("offline")` on `pagehide`/`beforeunload` (true exits).
4. **Surface sharing state to the user.** The hook already returns `sharing`; render it: green = broadcasting, gray = blocked/erroring, with a tap-through to the fix-it banner. Users should never be silently invisible.
5. **Gate removed (per product decision).** Presence enables for any signed-in user — `presenceReady = Boolean(user)` — so anonymous and verified users appear with the same level of location verbosity.

**Acceptance:** With the app open and permission granted, a presence beat reaches `/api/presence` within seconds of load and never stops while the tab is visible; denying then re-granting permission in browser settings re-lights the user without a reload.

### Phase 2 — Broadcast movement, not just liveness

**Files:** `src/hooks/useLivePresence.ts`, `src/app/api/presence/route.ts`

1. In the `watchPosition` success callback, compute haversine distance from the **last sent** coords (not last received). If moved ≥ `MOVE_THRESHOLD_M` (start at 15m) and ≥ `MIN_SEND_INTERVAL_MS` (start at 3000ms) since the last send, call `sendPresence("online")` immediately.
2. Keep the 20s heartbeat as the stationary-liveness floor; reset its timer whenever a movement-triggered send goes out (avoids redundant back-to-back sends).
3. Also filter jitter: ignore fixes with `coords.accuracy` worse than ~100m for movement-trigger purposes (still fine for the heartbeat), so GPS noise doesn't spray Pusher events from a stationary user.
4. **Server-side rate guard** in `/api/presence`: reject/coalesce more than 1 update per session per ~2s (cheap in-handler check against `live_sessions.last_seen_at`) so a buggy or hostile client can't flood Pusher.
5. Constants live in one place (`src/lib/presenceConfig.ts` or exported from `src/lib/pusher.ts`) so tuning is a one-line change: `HEARTBEAT_MS`, `MOVE_THRESHOLD_M`, `MIN_SEND_INTERVAL_MS`, `PRESENCE_TTL_MS`.

**Acceptance:** A user walking (~1.4 m/s) produces an update roughly every 10–12s; driving produces one every ~3s; a stationary user produces exactly the 20s heartbeat. Watching from a second device, the marker tracks the walk within a few seconds of reality.

### Phase 3 — Make presence state trustworthy

**Files:** `src/hooks/useLivePresence.ts`, `src/app/api/presence/route.ts`, `src/lib/mapUsers.ts`, `vercel.json` + new cron route

1. **Periodic resync.** Re-fetch `GET /api/presence` every 60s and on Pusher `connected` (after reconnects), replacing local lit/unlit state wholesale. This heals any missed delta.
2. **TTL margin.** Raise `PRESENCE_TTL_MS` from 45s to **65s** (3 heartbeats + slack) so one flaky beat doesn't gray a user out. The visibility grace period (Phase 1) covers the other flicker source.
3. **Reap stale sessions.** Add `/api/cron/reap-sessions` deleting `live_sessions` where `last_seen_at < now - 24h` (Vercel Hobby allows daily cron — matches existing `expire-anonymous` pattern). Correctness doesn't depend on this (TTL filtering handles liveness); it's hygiene so the table stays small. Opportunistic deletion of expired rows inside the presence GET handler is a cheap supplement.
4. **Broadcast offline consistently.** Verify the `offline` path always triggers a Pusher `presence-update` (it does today at `route.ts:94-109` — keep it) so other clients flip the marker gray immediately instead of waiting for TTL.

**Acceptance:** Kill a client's network for 90s and restore it — within one resync cycle every viewer's map matches the server exactly. `live_sessions` row count stays bounded over a week.

### Phase 4 — Smooth movement on the map

**Files:** `src/components/MapView.tsx`, `src/components/LiveUserMarker.tsx`

1. **Interpolate marker positions.** When a lit user's coords change, animate from old to new over ~1.5s (ease-out) instead of snapping. Simplest robust approach: a small `useAnimatedPosition(lat, lng)` hook driving `requestAnimationFrame` lerp of the `<Marker>` coordinates; alternatively a CSS-transform transition on the marker element. Keep it per-marker and cancel/restart cleanly when a new update arrives mid-animation.
2. **Key markers by `userId`, not `sessionId`.** Lit markers currently use `sessionId` as the id (`useLivePresence.ts:33`); a session change (reload) remounts the marker and defeats interpolation. Use `userId` as the React key for lit users.
3. **Green-light polish (optional):** slightly stronger ping animation while a user is actively moving (received a movement update in the last ~10s) vs. idle-online — makes "moving across the map" visually obvious.
4. Guard performance: interpolation is per-marker rAF work; with the current scale (tens of users) this is trivial, but cap concurrent animations or fall back to snapping beyond ~200 lit markers.

**Acceptance:** On a second device, a moving user's marker glides continuously; no visible teleporting; reload of the moving client doesn't flash/remount their marker for others.

### Phase 5 — Verification & rollout

1. **Two-device live test:** Device A walks outside, Device B watches. Confirm: green within seconds of A opening the app; glide-tracking during the walk; gray within ~15s of A backgrounding for >15s; instant gray on A closing the tab.
2. **Permission matrix:** iOS Safari, Android Chrome, desktop — test deny→grant recovery, prompt flow, and the blocked-state banner on each.
3. **Simulated movement in dev:** a dev-only override (query param or env flag) that feeds synthetic coordinates along a path into the hook, so movement/interp can be tested without leaving the desk.
4. **Cost check:** after a day of use, review Pusher message counts and Neon write volume; tune `MOVE_THRESHOLD_M` / `MIN_SEND_INTERVAL_MS` if either is hot.
5. **Ship order:** Phases 1–3 are independent of Phase 4 and can deploy first (correctness before polish). Each phase is a small, separately testable PR.

---

## 4. Config summary (proposed values)

| Constant | Current | Proposed | Why |
|---|---|---|---|
| `HEARTBEAT_MS` | 20s | 20s (unchanged) | Liveness floor when stationary |
| `PRESENCE_TTL_MS` | 45s | 65s | Survive one dropped heartbeat |
| `MOVE_THRESHOLD_M` | — | 15m | Visible movement, capped noise |
| `MIN_SEND_INTERVAL_MS` | — | 3s | Pusher/DB cost ceiling per user |
| Visibility grace | 0s (instant offline) | 15s | No flicker on brief app-switch |
| Resync interval | — (never) | 60s + on reconnect | Self-healing state |
| Accuracy gate | — | ignore fixes > 100m accuracy for movement triggers | GPS jitter filter |

## 5. Explicitly out of scope (for now)

- **Background location** (app closed / screen off): impossible in a web/PWA context without native wrappers; "online" deliberately means the app is actually open.
- **Location fuzzing / privacy radius:** the app currently shows exact positions to all viewers; changing that is a product decision, not part of this work — but worth a follow-up discussion since this plan makes tracking someone's movement easier.
- **Switching realtime transport** (Pusher → self-hosted WS/SSE): current Pusher setup handles this scale fine; revisit only if message costs spike.
