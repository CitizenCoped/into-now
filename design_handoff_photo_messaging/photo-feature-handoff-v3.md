# into.now — Photo Messaging: v3 Developer Handoff

Target branch: `v3` (cut from `v2`). Apply in order; each section is independent enough to review as its own commit.

**Locked decisions (2026-08-06):** reveal model = **tap-to-reveal**, ephemerality = **persist**, moderation vendor = **Sightengine**.

## 1. Storage: DigitalOcean Spaces (replaces @vercel/blob for photos)

Spaces is S3-compatible — use `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`.

We reuse the existing `thebestdrug` Space (sfo3) that already hosts the landing video — `intonow-photos/` is a key prefix (folder) inside it, not its own bucket. Spaces keys are **account-scoped**, so the existing DO_SPACES_KEY/SECRET pair works as-is.

Env vars (Vercel project settings + `.env.local`):
```
DO_SPACES_REGION=sfo3
DO_SPACES_ENDPOINT=https://sfo3.digitaloceanspaces.com   # regional endpoint — no bucket name; the SDK prepends it
DO_SPACES_BUCKET=thebestdrug
DO_SPACES_PREFIX=intonow-photos
DO_SPACES_KEY=...      # same pair already used for video uploads
DO_SPACES_SECRET=...
NEXT_PUBLIC_FEATURE_PHOTO_BLUR=true   # activates existing BlurredPhoto surfaces
```

The bucket stays as-is (video objects are public-read). Photo objects are uploaded with the **private** ACL (the S3 default — presigned PUT must NOT set `x-amz-acl: public-read`), so the CDN endpoint (`thebestdrug.sfo3.cdn.digitaloceanspaces.com`) returns 403 for them. Serve photos only via short-lived presigned GET URLs (60s TTL) on the origin endpoint, minted per authorized viewer — this is what enforces the blur privacy model server-side. Never store a public URL in the DB; store the object key.

New `src/lib/spaces.ts`:
- `presignUpload(key, contentType, maxBytes)` → presigned PUT
- `presignView(key)` → presigned GET, 60s
- key scheme: `intonow-photos/photos/{userId}/{photoId}.{ext}` (prefix from `DO_SPACES_PREFIX`)

## 2. Schema migration — `drizzle/0005_photo_messaging.sql`

```sql
-- Reusable per-user photo library (max 10, enforced in API)
CREATE TABLE user_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_key text NOT NULL,
  blur_data_url text NOT NULL,          -- ~300B placeholder from src/lib/blur.ts
  aspect_ratio double precision NOT NULL DEFAULT 1,
  is_live boolean NOT NULL DEFAULT false, -- camera-only capture
  status text NOT NULL DEFAULT 'scanning', -- scanning | ready | rejected
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_photos_user_idx ON user_photos(user_id);

-- Photos attached to a message (max 5, ordered)
CREATE TABLE message_photos (
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  photo_id uuid NOT NULL REFERENCES user_photos(id) ON DELETE CASCADE,
  position smallint NOT NULL DEFAULT 0,
  hidden_by_sender boolean NOT NULL DEFAULT false, -- closed-eye toggle
  PRIMARY KEY (message_id, photo_id)
);

-- Reveal grants (supports tap-to-reveal AND sender-grant models)
CREATE TABLE photo_reveals (
  message_id uuid NOT NULL,
  photo_id uuid NOT NULL,
  viewer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_at timestamptz,
  granted_at timestamptz,
  viewed_at timestamptz,                 -- unused in persist model; kept for future view-once
  PRIMARY KEY (message_id, photo_id, viewer_id),
  FOREIGN KEY (message_id, photo_id) REFERENCES message_photos(message_id, photo_id) ON DELETE CASCADE
);
```

`messages.body` stays; a photo message may have empty body. Add zod: body `min(0)` when photos present.

## 3. API contract

- `POST /api/photos` — body `{contentType, sizeBytes, isLive, blurDataUrl, aspectRatio}`. Enforce ≤10 ready photos, image types, 5MB. Creates `user_photos` row (`scanning`) + returns `{photoId, uploadUrl}` (presigned PUT). Client uploads directly to Spaces.
- `POST /api/photos/[id]/scan` — called by client after upload completes (or via queue later). Runs moderation (§5); sets `ready` or `rejected`. Rejected: delete object from Spaces immediately.
- `GET /api/photos` — caller's library: `{id, blurDataUrl, aspectRatio, isLive, status}`. No URLs.
- `DELETE /api/photos/[id]` — remove from library + Spaces.
- `POST /api/conversations/[id]/messages` — extend schema: `{body?, photoIds?: string[] (max 5)}`. Validate every photoId is caller's and `ready`. Insert `message_photos`. Pusher payload includes photos as `{photoId, blurDataUrl, aspectRatio, isLive, hiddenBySender, revealed:false}` — **never object keys/URLs**.
- `GET /api/conversations/[id]/messages` — join photos; include presigned view URL ONLY where a grant exists for this viewer (`granted_at` set, and for view-once `viewed_at` null) and `hidden_by_sender=false`.
- `POST /api/messages/[id]/photos/[photoId]/reveal` — **tap-to-reveal (decided)**: viewer self-grants (participant check). Keep `PHOTO_REVEAL_MODEL=tap|grant|immediate` flag for flexibility; default + ship `tap`. Grants **persist** (decided) — once revealed, viewer keeps access; no `viewed_at` expiry logic in v3.
- `POST /api/messages/[id]/photos/[photoId]/hide` — sender only, toggles `hidden_by_sender`; fire Pusher `photo-updated` on the conversation channel so both clients update live.
- Push notifications: mask body as "Sent a photo" — never include image content.

## 4. Component specs (match prototype `Photo Messaging v3.dc.html`)

- **PhotoSheet** (in ConversationThread composer): "My photos" grid 5-col, count `n/10`, selected `n/5`; add-tile (dashed, plus) → file picker; camera-tile (dashed orange) → `getUserMedia` capture, marks `isLive`. Selection shows orange 2px border + ordered number badge.
- **Scanning tile**: photo dimmed `rgba(6,4,12,.55)` + orange sweep bar (`scanSweep` .45s loop). **No text.** Duration = real moderation time; while sync moderation is pending integration, animate 100–500ms.
- **Message photo grid**: 1 photo full-width, 2+ → 2-col grid, gap 6px, tiles `border-radius:10px`, aspect 1.
- **Blurred state**: render ONLY `blurDataUrl` upscaled, `blur(16px) saturate(.85)`, lock icon + orange pill ("Tap to reveal" / "Ask to reveal" / "Reveal requested"). Reveal = 500ms crossfade (BlurredPhoto.tsx already does this).
- **Closed-eye toggle**: 26px circular button, top-right of sender's sent photos. Hidden state (both sides): blur + dark overlay, eye-off icon, "Hidden by sender" (recipient) / "Hidden" (sender). Reversible; server-authoritative (revoke presigned issuance while hidden).
- **LIVE badge**: existing BlurredPhoto badge, camera captures only.
- Colors: bg `#06040c`/`#0f0d18`, accent `#FF8A1E`, gradient `#FFB03A→#F56A00`, glow `#FF9E2C`, danger `#FF4D6D`, borders `rgba(255,255,255,.05–.12)`.

## 5. Moderation — **Sightengine (decided)**

Sync REST call at upload (`/api/photos/[id]/scan`): nudity/minor/gore classes, ~$29/mo entry. Env vars: `SIGHTENGINE_USER`, `SIGHTENGINE_SECRET`. Reject on any class score above threshold (start conservative: 0.6).
Plus: **NCMEC/CSAM hash-matching** (PhotoDNA via Microsoft, or Cloudflare CSAM tool) layered in **before public launch** — for this app category treat it as required. Photos in `rejected` are deleted, never surfaced, and the rejection is logged to `activity_log` (`photo.rejected`).

## 6. Post photos (same release)

`BlurredPhoto.tsx` mounts on post cards + profile panel as originally planned. Add `post_photos (post_id, photo_id, position)` reusing `user_photos` rows — the library is the single source for both DMs and posts. Reveal grants for post photos use the same `photo_reveals` table with `message_id` null → split into its own `post_photo_reveals` if preferred.

## 7. v3 rollout checklist

1. `git checkout v2 && git checkout -b v3 && git push -u origin v3`
2. `npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`. ~~CORS rule~~ ✅ done 2026-08-06 — owner added PUT rule (app origin) on `thebestdrug` Space
3. Add env vars (Vercel: Preview scope → v3 branch), incl. `SIGHTENGINE_USER`/`SIGHTENGINE_SECRET`
4. `npm run db:generate && npm run db:migrate` (run against a Neon branch first, then prod per database_dev_to_prod_consistency.md)
5. Vercel: connect v3 branch → preview deployments auto-build per push
6. Set `NEXT_PUBLIC_FEATURE_PHOTO_BLUR=true` on preview only until legal review clears
