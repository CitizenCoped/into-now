# CLAUDE CODE PROMPT — Post media + thread post reference on branch `v7-post-media`

The Best Drug rebrand (formerly `CLAUDE_CODE_PROMPT_REBRAND.md`) is merged to `main` and live. This prompt covers only the follow-on feature work.

---

You are working in the `CitizenCoped/into-now` Next.js 14 / Tailwind / MapLibre app. Branch `v7-post-media` is checked out off `main` — all work lands there. Commit in small, logical commits and push `v7-post-media` at the end. Do not touch `main`.

## Goal
Implement `design_handoff_the_best_drug/FEATURE_POST_MEDIA_AND_THREAD_REF.md` in full:

1. **Two-step post creation with media** — `Post Now` becomes `Next →`; step 2 "Add photos" allows 4 photos, or 2 photos + 2 videos (videos ≤ 10 s).
2. **Latest-post reference row + popup** inside `ConversationThread` — surfaces the other user's active post above the message list; tapping opens a post popup over the messenger.

Visual target: `The Best Drug Posts Flow.dc.html` (3 frames — open in a browser; needs `support.js` + `ios-frame.jsx` beside it, already included). Brand tokens are in `README.md`: pink `#FF2D8A`, cyan `#00F0FF`, panel `#120A14`, ink `#07060B`, display font Anton italic uppercase.

## Permitted changes
This work **does** include the schema/API/migration changes the feature spec calls for: `0007_post_media.sql`, `post_photos` writes, `latestPost` on `ConversationSummary.otherUser`, and the `media[]` field on post read APIs.

## Verify, commit, push
- `npm run lint && npm run build` clean.
- Phone-sized viewport: both create steps work (with and without media; limits enforced; >10 s video rejected inline); posts with media render thumbnails in the Posts list + map popup; thread shows the reference row only when the other user has a live, non-expired post and isn't blocked; popup opens/closes without leaving the thread.
- Suggested commit: `feat(v7): post media + thread post reference`.
- `git push -u origin v7-post-media`. Report the Vercel preview URL.

## Out of scope (do not do)
Landing, map chrome, filters, profile, presence logic, the existing message-photo flow (`MAX_PHOTOS_PER_MESSAGE = 5`), any schema change not listed in the feature spec.
