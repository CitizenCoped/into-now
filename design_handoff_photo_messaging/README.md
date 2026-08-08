# Handoff: DM Photo Messaging (v3) — into.now

## Overview
Photo sharing for DMs (plus post photos, same release) on the into.now Next.js app. Users keep a reusable library of up to 10 photos (camera captures get a LIVE badge), attach up to 5 per message, and every photo is blurred for the recipient until they tap to reveal. Senders can hide any sent photo at any time with a closed-eye toggle. Uploads pass a silent moderation scan before becoming usable.

**Locked product decisions:** reveal model = **tap-to-reveal** · ephemerality = **persist** (revealed stays revealed) · moderation = **Sightengine** (sync at upload) + CSAM hash-matching before public launch.

## About the Design Files
`Photo Messaging v3.dc.html` (+ `support.js`) is a **design reference built in HTML** — an interactive prototype showing intended look and behavior, NOT production code. The task is to **recreate this design in the existing into.now codebase** (Next.js / React / Drizzle / Pusher on the `v3` branch) using its established patterns — especially the existing `BlurredPhoto.tsx`, conversation thread, and composer components. Open the prototype in a browser to see both sides of a live conversation and every interaction.

## Fidelity
**High-fidelity.** Colors, spacing, radii, animation timings, and copy are final — recreate pixel-perfectly with the codebase's components.

## Primary implementation spec
**`photo-feature-handoff-v3.md` in this folder is the authoritative engineering doc.** It contains, in build order:
1. DigitalOcean Spaces storage setup (existing `thebestdrug` Space, `intonow-photos/` prefix, private ACL for photos, 60s presigned GET URLs, env vars) — **CORS is already configured by the owner**
2. Schema migration SQL (`drizzle/0005_photo_messaging.sql`): `user_photos`, `message_photos`, `photo_reveals`
3. Full API contract (upload, scan, library, send, reveal, hide endpoints + Pusher payloads)
4. Component specs matching the prototype
5. Sightengine moderation integration (env: `SIGHTENGINE_USER`/`SIGHTENGINE_SECRET`, reject threshold 0.6)
6. Post photos reuse
7. Rollout checklist

## Screens / Views (see prototype for exact rendering)
- **Composer + PhotoSheet**: photo icon in composer opens sheet; "My photos" 5-col grid, `n/10` count, `n/5` selected; dashed add-tile (file picker) and dashed orange camera-tile (`getUserMedia`, marks LIVE). Selection = 2px `#FF8A1E` border + ordered number badge.
- **Scanning tile**: photo dimmed `rgba(6,4,12,.55)` + orange sweep bar (`scanSweep` .45s loop). **No text ever.** Duration = real moderation latency.
- **Message photo grid**: 1 photo full-width; 2+ photos 2-col grid, 6px gap, 10px radius, square tiles.
- **Blurred (recipient default)**: render only the ~300B `blurDataUrl` upscaled with `blur(16px) saturate(.85)`, lock icon + orange "Tap to reveal" pill. Reveal = 500ms crossfade (existing `BlurredPhoto.tsx` behavior).
- **Hidden by sender**: 26px circular closed-eye button top-right of sender's photos; hidden state on both sides = blur + dark overlay + eye-off + "Hidden by sender"/"Hidden". Reversible, server-authoritative.
- **LIVE badge**: existing BlurredPhoto badge, camera captures only.

## Interactions & Behavior
- Tap blurred photo → self-grant reveal (API call) → 500ms crossfade to presigned image. Grant persists.
- Sender taps eye → optimistic toggle + `photo-updated` Pusher event; server stops issuing presigned URLs while hidden.
- Rejected photo: tile shows danger state briefly then is removed from library; object deleted from Spaces; `photo.rejected` logged.
- Push notifications: body masked as "Sent a photo".

## State Management
Per-photo client state: `scanning | ready | rejected` (library), `blurred | revealed | hidden` (message view, per viewer). Server is the source of truth for reveal grants and hidden flags; Pusher keeps both clients live.

## Design Tokens
- Backgrounds `#06040c` / `#0f0d18` · accent `#FF8A1E` · gradient `#FFB03A → #F56A00` · glow `#FF9E2C` · danger `#FF4D6D` · borders `rgba(255,255,255,.05–.12)`
- Photo tiles: radius 10px, aspect 1, grid gap 6px; reveal crossfade 500ms; scan sweep loop 450ms

## Assets
No new assets — prototype uses gradient placeholders. LIVE badge, lock, and eye icons follow the existing icon set in the codebase.

## Files
- `Photo Messaging v3.dc.html` + `support.js` — interactive prototype (open in browser)
- `photo-feature-handoff-v3.md` — authoritative engineering spec (schema, APIs, rollout)
