# Phase 2 Build Recap — Identity & "For Me" Matching

**Built:** July 31, 2026 · **Branch:** `v2` · **Verified:** TypeScript clean, ESLint clean (only pre-existing `<img>` warnings), production `next build` passes.

Phase 2 delivers the matching magic from the pivot plan: every user can now declare *who they are* once, and the app uses that one fact in two places — filtering the feed down to posts that are looking for them, and pre-filling the "You are" picker every time they post.

## What was built

### 1. The identity model (database + API)

- **`users.identity`** — new nullable text column holding one identity token (`M`, `W`, `T`, `MW`, `MM`, `WW`). Nullable by design: nobody is forced to declare; features that need it ask lazily.
- **Migration `drizzle/0003_user_identity.sql`** — a single `ALTER TABLE users ADD COLUMN identity text;`, registered in the drizzle journal as entry idx 3. Backward-compatible: old code ignores the column, so deploy order doesn't matter for this one (no truncate, no NOT NULL).
- **`/api/profile` (PATCH)** — accepts `identity`, validated server-side with `z.enum(IDENTITY_TOKENS)`; invalid tokens are rejected with a 400.
- **`/api/auth/me` + `/api/profile` (GET)** — now return `identity` on the serialized user.
- **`src/lib/auth.ts`** — `AuthUser` type, `userToAuthUser`, and `serializeAuthUser` all carry `identity` end-to-end.
- **`src/hooks/useAuth.ts`** — client `AuthUser` type includes `identity`; `updateProfile()` accepts it.

### 2. Profile — the "I am" picker (`ProfileEditor.tsx`)

- New chip row above the display-name field: the six identity tokens in their code colors (amber M, coral W, violet T, orange MW, ember MM, magenta WW).
- Optional — tapping the active chip deselects it; the profile saves with or without one. Helper text explains what it powers.
- `ProfilePanel.tsx` prop types widened to pass identity through the save flow.

### 3. Filters — the "For me" toggle (`FilterPanel.tsx`)

- **New "For me" switch** at the top of the filter panel. On: the feed shows only posts whose *Looking for* matches your identity — or `ANY` ("Anyone" posts always qualify).
- **Lazy identity capture:** flipping the switch without a saved identity opens an inline "First — you are:" chip picker right there in the panel. Picking one saves to the profile via `/api/profile` and turns the toggle on in the same gesture. No settings detour, asked exactly once.
- **Manual "Posted by" chips remain** as the fallback mode (filter by who's posting: M4…, W4…, etc.). While "For me" is on, the manual section dims and disables — for-me wins, exactly as the plan specified.
- Age-range and distance filters unchanged.

### 4. Feed matching (`HomePage.tsx`)

- New state: `forMe` boolean; `categoryFilters` renamed to `posterFilters` (the Phase-1 interim name is gone).
- Matching logic, in priority order: **for-me** (`post.lookingFor === myIdentity || post.lookingFor === "ANY"`) → **manual poster filters** → unfiltered.
- `myIdentity` is derived defensively with the `isIdentityToken` guard, so a bad DB value can never crash filtering.
- Registered-users-only gating on filters is unchanged (anonymous users see the full feed, same as before).

### 5. Posting pre-fill (`PostPanel.tsx` → `PostCreateForm.tsx`)

- `defaultPosterIs` now flows from `user.identity` through `PostPanel` into the create form: if you've declared you're `MW`, every new post opens with **MW** already selected and the code preview showing `MW4ANY`. One less tap between the urge and the post.

## Files touched

| File | Change |
|------|--------|
| `src/lib/schema.ts` | `users.identity` column |
| `drizzle/0003_user_identity.sql` + `drizzle/meta/_journal.json` | Migration + journal entry |
| `src/lib/auth.ts` | identity through AuthUser/serialization |
| `src/hooks/useAuth.ts` | identity on client type + updateProfile |
| `src/app/api/profile/route.ts` | zod-validated identity PATCH |
| `src/components/ProfileEditor.tsx` | "I am" chip picker |
| `src/components/ProfilePanel.tsx` | prop type pass-through |
| `src/components/FilterPanel.tsx` | For-me toggle + inline identity picker + dimming |
| `src/components/HomePage.tsx` | matching logic, state rename, wiring |
| `src/components/PostPanel.tsx` | `defaultPosterIs` pass-through |

## Rollout steps (same two-database drill as Phase 1)

```bash
# 1. dev database
env $(grep '^DATABASE_URL=' .env.local | tr -d '"') npm run db:migrate

# 2. prod database
DATABASE_URL="<production DATABASE_URL from Vercel>" npm run db:migrate

# 3. ship
git push        # then Promote to Production in the Vercel dashboard
```

Note: unlike Phase 1, this migration is non-destructive (adds one nullable column, wipes nothing) and old code runs fine against the new schema — so migration timing is forgiving. Both DBs still need it before the new code serves traffic, or `/api/auth/me` will 500 on the missing column.

## What Phase 2 deliberately did NOT include

- 24h post expiry, report/block, keyword screen, DM phone-number warning → **Phase 3** (next).
- Photos, blur activation, upload pipeline → **Phase 4**, blocked on attorney review (blur module remains built and flag-off).
- "…and I'm into them" second-direction matching (filter by which posters *I* seek while for-me is on) → noted in the plan as a possible Phase 2.5; skipped to keep this release tight.

## Verification performed

- `tsc --noEmit` — zero errors
- `eslint src/` — zero errors (4 pre-existing `<img>` warnings, untouched files)
- `next build` — production build compiles, all 23 routes generate
