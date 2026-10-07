# Feature handoff — Post media (2-step create) + latest-post reference in threads

Branch: `v6` (on top of the rebrand). Visual reference: `The Best Drug Posts Flow.dc.html` (3 frames).
Brand tokens as in README.md: pink `#FF2D8A`, cyan `#00F0FF`, panel bg `#120A14`, ink `#07060B`, display font Anton italic uppercase.

## 1. PostCreateForm → two steps

File: `src/components/PostCreateForm.tsx`

- Add `step: 1 | 2` state. Step indicator top-right of the body: `STEP 1 OF 2` (number in cyan).
- **Step 1** (existing form). Footer primary button text `Post Now` → `Next →`. It only validates (headline + description required) and sets `step = 2`. Cancel unchanged.
- **Step 2 — "Add photos"**. Back link `← Back` returns to step 1 with fields intact.
  - Title (Anton italic caps 22px): `ADD PHOTOS`
  - Copy: *Posts with photos get answered. Up to **4 photos**, or **2 photos + 2 videos**. Videos max **10 seconds**.*
  - 2×2 grid of square tiles (radius 14). Filled tile: `PHOTO` / `VIDEO` pill top-left (video pill cyan), `×` remove top-right, video shows play glyph + `m:ss` badge bottom-right and a cyan border. Empty tile: dashed `+` circle + "Photo or video".
  - Counter line under grid: `2 photos · 1 video · 1 slot left` and right-aligned `Screened before they show`.
  - Two source buttons: `Camera` / `Library` (reuse `usePhotoLibrary` + `PhotoSheet` for library; camera capture path from `PhotoSheet`'s live flow).
  - Footer: `Post Now` (pink) + `Cancel`; secondary text link below: `Post without photos`.
- Media limits (new constants in `src/lib/photoTypes.ts`):
  ```ts
  export const MAX_POST_MEDIA = 4;
  export const MAX_POST_VIDEOS = 2;          // videos count against MAX_POST_MEDIA
  export const MAX_POST_VIDEO_SECONDS = 10;
  ```
  Enforce client-side on add (disable the empty tile when full; reject >10s videos with inline error "Videos must be 10 seconds or less") and server-side in the create-post route.
- `onSubmit` gains `mediaIds: string[]` (ordered). Write rows to `postPhotos` (`src/lib/schema.ts` already has `post_photos` with `position`). Videos: extend `user_photos` with `kind: 'photo' | 'video'` and `durationMs` (new migration `0007_post_media.sql`); or add a sibling `user_videos` table if moderation pipeline differs — pick whichever keeps `postPhotos.photoId` FK valid.
- Post read APIs (`/api/posts*`) return `media: { id, kind, blurDataUrl, url, aspectRatio, durationMs? }[]` ordered by position. Posts render thumbnails in `PostPanel.tsx` list + map popup (not in scope to redesign; append a strip).

## 2. ConversationThread → latest-post reference row + popup

File: `src/components/ConversationThread.tsx`

- Between the name row (`Anonymous · Online · Block`) and the message list, when the **other user** has an active post (not expired per `POST_TTL_MS`), render a tappable row:
  - Container: full width, radius 12, border `rgba(255,45,138,.35)`, bg `linear-gradient(90deg,rgba(255,45,138,.14),rgba(255,45,138,.04))`, padding 10/12.
  - Left: code (`MW4ANY`) 10px/800/`.14em` in `CODE_COLORS[posterIs]`.
  - Middle: eyebrow `THEIR LATEST POST · 26 MIN AGO` (9.5px, white 40%), headline in Anton italic caps 15px white, single line ellipsis.
  - Right: up to two overlapping 26px media thumbs (if media) + `›` chevron.
  - Hairline divider below, then messages.
- Data: extend `ConversationSummary.otherUser` (`src/hooks/useMessages.ts`, built in `src/lib/conversations.ts`) with `latestPost: { id, title, description, category, posterIs, createdAt, media[] } | null` = that user's most recent non-expired post.
- Tap → **post popup** inside the Messages panel (above composer, z above thread; scrim `rgba(7,6,11,.7)` + blur 6px; tap scrim closes):
  - Sheet anchored to bottom, radius 20, bg `#160C19`, border white 12%, max-height 720.
  - Header row: code (left) + `×` close (right).
  - Headline Anton italic caps 26px; meta line `Anonymous · 0.5 mi · 26 min ago · expires in 23h`; body 14.5px/1.5 white 80%, `whitespace-pre-wrap`.
  - Media grid 2 cols, square tiles radius 12; videos show play glyph + duration badge; use existing `BlurredPhoto`/reveal rules (post media is public to viewers, no reveal gate).
  - Footer button `Close` (cyan outline style from "Message author" button) → dismisses the popup only; the user lands back in the same DM thread with that post's author (no panel switch, no navigation to Posts).
- Hide the row when `latestPost` is null, the user is blocked, or the session is expired.

## 3. Not in scope
No changes to landing, map chrome, filters, or profile. Keep existing message photo flow (`MAX_PHOTOS_PER_MESSAGE = 5`) untouched.
