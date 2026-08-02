# Phase 3 Build Recap — Safety Rails

**Built:** August 1, 2026 · **Branch:** `v2` · **Verified:** TypeScript clean, ESLint clean, production `next build` passes (26 routes).

Phase 3 is the compliance floor from the pivot plan §9: the tools that make commercial solicitation structurally hard, give users power over who can reach them, and honor the "NOW" ephemerality promise. Everything below is live-ready; nothing touches photos (Phase 4, awaiting counsel).

## What was built

### 1. Block user (mutual invisibility)

- **`user_blocks` table** (migration `0004_user_blocks.sql`): blocker/blocked pair, cascade-deleted with accounts.
- **`/api/blocks`** — POST blocks, DELETE unblocks, GET lists. Idempotent, self-block rejected, every action written to the activity log.
- **Enforcement, three layers:**
  - Opening a conversation with someone in a block relationship → 403.
  - Sending a message inside an existing conversation → 403 if either side has blocked the other.
  - **Posts feed**: posts from anyone you've blocked — or who blocked you — vanish from your feed and map, both directions (`getHiddenUserIds` in `src/lib/blocks.ts`).
- **UI**: a quiet "Block" action in the conversation header with a confirm step; after blocking, the composer is replaced with a "You blocked this user" notice.

### 2. Report post

- **`/api/posts/[id]/report`** — any signed-in user (anonymous included) can report; optional reason. Writes `post.reported` to the activity log (the moderation audit trail) and fires an immediate Pushover alert to you with post title, id, author, and reporter.
- **UI**: subtle "Report post" action under each post card (never on your own posts); one-tap confirm, becomes "Reported — thank you."

### 3. Solicitation keyword screen (the FOSTA line)

- **`src/lib/contentScreens.ts` → `findSolicitationSignal()`** — runs server-side on every post's title + description. Catches rate constructions ("$200/hr", "150 an hour", "300 hh"), payment euphemisms near amounts ("roses", "donations", "tribute"), explicit commercial terms (escort, incall/outcall, gfe, pay-per-meet), and payment handles combined with amounts (CashApp/Venmo/Zelle + $).
- On a hit: post rejected with a clear, non-shaming message ("into.now is for real, non-commercial connection — reword and try again"), and the attempt is logged with the matched signal for your review. The pattern list is deliberately modest to keep false positives rare — tune as real content arrives.
- The Grok coach (Phase 1) already refuses to *write* this content; now the API refuses to *accept* it. Two independent layers.

### 4. 24-hour post expiry

- **Read-time filter**: `GET /api/posts` only returns posts younger than 24h (shared constant in `src/lib/postConfig.ts`) — expiry is honored the moment this deploys, cron or no cron.
- **`/api/cron/expire-posts`** — hourly (`:15`), physically deletes expired rows so nothing accumulates. Same `CRON_SECRET` auth pattern as your existing crons; registered in `vercel.json`.

### 5. DM contact-info warning (owner-specified)

- **`containsPhoneNumber()`** — practical client-side pattern match: E.164 (`+15558675309`), separated forms (`555-867-5309`, `(555) 867 5309`, `555.867.5309`), bare 10–11 digit runs.
- On send, a modal appears with your exact copy: *"It looks as if you're trying to send a phone number or other contact information. We strongly advise you keep communications on the platform - for your safety and to protect against fraud."*
- Two buttons, exactly as specified: **Edit** (returns to the composer, message intact) and **Send Anyway** (sends exactly as typed).
- Warn-only by design: nothing is blocked, nothing is logged, the check never leaves the browser. DMs stay open and free per your decision.

### 6. Terms page (placeholder)

- **`/terms`** — draft covering 18+, non-commercial rule, consent/harassment, 48-hour NCII removal commitment, 24h expiry, and moderation logging. Clearly marked as draft; **replace with attorney language before public launch.**

### 7. Housekeeping

- `.gitignore` now excludes `_to_delete/` and stray `.lock` files (keeps future bridge artifacts out of commits). Optional tidy-up for the files already tracked: `git rm -r --cached _to_delete && git commit -m "untrack scratch folder"`.

## Files touched (17)

| File | Change |
|------|--------|
| `src/lib/schema.ts` | `user_blocks` table |
| `drizzle/0004_user_blocks.sql` + journal | Migration |
| `src/lib/blocks.ts` (new) | Block queries: `isBlockedBetween`, `getHiddenUserIds` |
| `src/lib/contentScreens.ts` (new) | Solicitation screen + phone detection + modal copy |
| `src/lib/postConfig.ts` (new) | Shared 24h TTL constant |
| `src/app/api/blocks/route.ts` (new) | Block/unblock/list |
| `src/app/api/posts/route.ts` | Keyword screen, TTL filter, blocked-author filter |
| `src/app/api/posts/[id]/report/route.ts` (new) | Report endpoint |
| `src/app/api/conversations/route.ts` | Block check on conversation open |
| `src/app/api/conversations/[id]/messages/route.ts` | Block check on send |
| `src/app/api/cron/expire-posts/route.ts` (new) | Hourly cleanup |
| `vercel.json` | Cron registration |
| `src/components/PostPanel.tsx` | Report action |
| `src/components/ConversationThread.tsx` | Phone-warning modal, Block button |
| `src/app/terms/page.tsx` (new) | Placeholder ToS |
| `.gitignore` | Scratch artifacts |

## Rollout

```bash
rm -f .git/*.lock
env $(grep '^DATABASE_URL=' .env.local | tr -d '"') npm run db:migrate
DATABASE_URL="<production DATABASE_URL>" npm run db:migrate
git add -A
git commit -m "Phase 3: safety rails"
git push
```

Then **Promote to Production** in the Vercel dashboard. Migration 0004 only creates a new empty table — non-destructive, forgiving timing. Note: the new cron requires `CRON_SECRET` (or `ADMIN_SECRET`) to be set in Vercel env — it reuses the same secret your existing crons already use, so no action needed unless those weren't working either.

## Test checklist after promote

1. Post something with "$200/hr" in the description → rejected with the non-commercial message.
2. DM someone "call me 555-867-5309" → warning modal with Edit / Send Anyway; Send Anyway delivers it verbatim.
3. Block a user from a conversation → their posts disappear from your feed; they get a 403 trying to message you.
4. Report someone's post → Pushover alert arrives on your phone.
5. Posts older than 24h no longer appear (immediately), and get deleted at the next :15 cron run.

## What's left

**Phase 4 — Photos** (upload pipeline, blur activation, LIVE capture, reveal grants, TAKE IT DOWN flow): **blocked on your attorney meeting.** The blur module remains built and flag-off. Also pending from earlier: rotating the Neon database password, and enabling env vars on Preview deployments if you ever want testable previews.
