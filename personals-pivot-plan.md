# into.now — Personals Pivot Plan (v3)

**Baseline:** `v2` branch at commit `33bc369` (*Sunset Pop* recolor — verified clean, zero leftover old-palette hex). All colors below are Sunset Pop.

**Goal:** Refocus the entire app on classic personals codes (the old Craigslist casual-encounters taxonomy). Every post is "I am X, looking for Y, here, right now." The map, live presence, and messaging already built are the delivery mechanism — this pivot replaces the *content model*, not the infrastructure.

## Decisions — all locked ✅

| # | Decision | Answer |
|---|----------|--------|
| 1 | Posting UX | Two pickers ("You are" / "Looking for"), app composes the code |
| 2 | Post structure | Title + description kept |
| 3 | Browsing | Smart "for me" matching + manual code filters |
| 4 | Code combos | **All 36** from free composition (no allowlist) |
| 5 | "Anyone" option | **Yes** — `ANY` token in Looking-for |
| 6 | Post expiry | **24 hours**, via existing cron pattern |
| 7 | Dev data | **Wipe** old test posts in the migration |
| 8 | Photo content rule | Genitalia classifier **warn/reject on profile photos and post photos only** |
| 9 | DM images | **Open — no classifier action, nothing blocked** (CSAM scanning still runs everywhere; see §9) |
| 10 | DM contact-info warning | **Yes** — phone-number detection with Edit / Send Anyway modal (§8.4) |
| 11 | Photo blur | **Code built now, feature-flagged OFF** pending counsel (§8.1) |

Status: app is pre-public (invite/dev only). Photo blur and the photo pipeline stay dark until the attorney review; everything else is cleared to build on your go.

---

## 1. The code system (data model)

Store the two halves; derive the code. No hand-maintained combinatorial list.

**Identity tokens** (both pickers): `M` Man · `W` Woman · `T` Trans person · `MW` Man/woman couple · `MM` Two men · `WW` Two women. **Looking-for additionally offers `ANY` (Anyone).**

**Derived code:** `{posterIs}4{lookingFor}` → M4W, MW4MW, T4T, M4ANY … all 36 pair combos + 6 ANY codes, automatically. No allowlist.

### New `src/lib/codes.ts` (replaces `src/lib/categories.ts`)

- `IDENTITY_TOKENS`, `LOOKING_FOR_TOKENS` (= identity + `ANY`), labels
- `composeCode(posterIs, lookingFor)` / `parseCode(code)`
- `CODE_COLORS` keyed by **posterIs** (6 colors, map stays readable):

| Token | Color | Note |
|-------|-------|------|
| `M`  | `#FFB03A` amber | CTA-gradient start |
| `W`  | `#FF4D6D` coral | surviving brand coral |
| `T`  | `#A78BFA` violet | cool accent |
| `MW` | `#FF8A1E` orange | new primary accent |
| `MM` | `#F56A00` ember | CTA-gradient end |
| `WW` | `#EC4899` magenta | existing palette |

- `getCodeColor(code)` — fallback `#FF8A1E`.

### Quality pass riding with Phase 1

- New `src/lib/theme.ts`: named constants (`ACCENT` #FF8A1E, `CORAL` #FF4D6D, `CTA_GRADIENT` #FFB03A→#F56A00, `LIVE_GLOW` #FF9E2C, `VOID` #06040c, `PANEL` #0f0d18). Migrate the ~90 scattered hex strings file-by-file as Phase 1 touches them.
- Rename `--intonow-cyan` → `--intonow-ember` in `globals.css` (variable currently holds orange under a cyan name).
- ✅ Already delivered ahead of schedule: `src/lib/flags.ts` (central feature flags).

---

## 2. Database changes

### Migration `0002_personals_codes.sql`

- `TRUNCATE posts;` (decision #7 — clean slate).
- Add `poster_is text NOT NULL`, `looking_for text NOT NULL`.
- Keep `category`, repurposed to store the derived code — admin notify, activity log, and existing queries keep working. (Rename to `code` in a later cleanup.)

### `users`

- Add `identity text` (nullable) — powers "for me" matching, pre-fills the You-are picker.
- `birth_date` / `age_verified_at` 18+ gate unchanged, mandatory for all modes.

### Migration `0003_post_photos.sql` (Phase 4, blocked on counsel)

- `post_photos`: `id`, `post_id` (cascade), `url`, `blur_data_url`, `tier` (`sfw`|`suggestive`), `is_live_capture`, `status` (`pending`|`approved`|`rejected`), `created_at`.
- `photo_reveals`: `photo_id`, `viewer_id`, `granted_at`.

---

## 3. Posting flow — `PostCreateForm.tsx`

1. **"You are"** — segmented control, 6 tokens, pre-filled from `user.identity`.
2. **"Looking for"** — 7 options (6 tokens + Anyone).
3. **Live code preview** — composed code renders big in the poster's token color. The nostalgia moment.
4. Title — *"Headline — make it count"*.
5. Description — *"What you're looking for, where, and when. Right now."*
6. Photo attach (Phase 4): gallery or camera-only LIVE capture.
7. Grok coach (§7).

Submit: `{ title, description, posterIs, lookingFor, lat, lng }`. Restyle submit button from legacy green `#10B981` to the CTA gradient.

---

## 4. Browsing, filters, "for me" matching

- **FilterPanel**: "For me" toggle (posts where `lookingFor === myIdentity` or `ANY`; opens one-time "I am…" picker if identity unset) + manual code chips grouped by poster token. For-me wins when on. Age/distance filters unchanged. Coral active-chip treatment kept.
- **HomePage**: `codeFilters: string[]` + `forMe: boolean`; expose `user.identity` via `useAuth` / `/api/auth/me`.
- **PostPanel / MapView / AnimatedMarker**: code badge + marker colors via `getCodeColor`; token colors verified against the warmed map palette. Live dots stay `#FF9E2C`.
- **API** (`/api/posts`): zod `z.enum` validation for both tokens; server composes/stores the code; `?lookingFor=`/`?posterIs=` params.

---

## 5. Profile & onboarding

- `ProfileEditor`: "I am" token picker above Statement; optional at signup, required lazily when for-me/posting needs it.
- `OnboardingGate`: unchanged — zero added friction.
- `/api/profile`: accept `identity`.

---

## 6. Copy pass

Panel header "what are you into? NOW?" stays. Create panel: *"Who are you looking for — right now?"* List header: *"Who's looking, near you."*

---

## 7. Grok post coach

Rewrite the system prompt: personals coach — punchy headline, honest description, "right now" urgency, respectful tone; context = `posterIs`/`lookingFor`. Guardrails baked in: refuses solicitation/commercial content and anything involving minors. Creation-time moderation for free.

---

## 8. Photos & DMs

### 8.1 Blur-to-reveal — **BUILT, FLAG OFF** ✅

Delivered to the codebase, fully inert until `NEXT_PUBLIC_FEATURE_PHOTO_BLUR=true`:

| File | Role |
|------|------|
| `src/lib/flags.ts` | Central feature flags; `photoBlur` off by default |
| `src/lib/blur.ts` | Browser-side blur-placeholder generation (16px micro-JPEG, ~300 bytes) — no server image library needed |
| `src/components/BlurredPhoto.tsx` | The reveal surface: placeholder + lock overlay + "Ask to reveal" + LIVE badge + crossfade. Renders `null` while the flag is off; mounted nowhere yet |

Type-checked and linted against v2. **Privacy contract encoded in the component:** unrevealed viewers only ever receive the ~300-byte placeholder; the real URL is never sent to a client without a server-granted reveal (CSS-blurring the real image would leave the raw URL liftable from the DOM). Activation after counsel: flip the env var, mount the component, ship migration 0003 + reveal-grant endpoint.

### 8.2 Display mechanics (Phase 4, post-counsel)

Blur-to-reveal on posts/profiles · camera-only **LIVE** capture (realness badge + strongest anti-spam weapon) · photos expire with the post (24h) · per-conversation private albums later.

### 8.3 Where the genitalia classifier acts (decision #8/#9)

- **Profile photos & post photos:** classifier runs at upload; genitalia → instant, friendly rejection: *"That one won't fly here. Suggestion beats exposure."* Suggestive/boudoir → gated tier.
- **DM images:** open. No classifier action, no warning, nothing blocked. Adult expression between consenting users stays free.
- **Everywhere including DMs:** CSAM hash-matching still runs on every upload without exception — that one is a legal floor (mandatory NCMEC reporting), not a product choice, and it's invisible to legitimate users.

### 8.4 DM contact-info warning (decision #10)

Client-side pattern match on outgoing DM text for phone numbers — practical patterns, not perfection: digit runs with separators (`555-867-5309`, `555.867.5309`, `(555) 867 5309`), E.164 (`+15558675309`), spelled digits ("five five five…") skipped as over-engineering for now. On match, a modal before send:

> **"It looks as if you're trying to send a phone number or other contact information. We strongly advise you keep communications on the platform — for your safety and to protect against fraud."**
>
> Buttons: **Edit** (returns to the composer, message intact, cursor restored) · **Send Anyway** (sends exactly as typed).

No logging of message content for this feature; the check runs in the client. Implemented in `MessagePanel`/`ConversationThread` composer path, Phase 3.

### 8.5 Genitalia detection: run it internally or use a third party?

**You can run it internally, and for your stage I recommend it.** Open-source detectors — NudeNet, and Bumble's open-sourced **Private Detector** (built for exactly this: lewd-image detection in a dating app's DMs) — run on your own infrastructure via ONNX/TensorFlow, CPU is adequate at upload latency (~0.5–2s), cost is a small always-on service (Fly.io/Railway box or a beefier serverless function) instead of per-image fees. Two real advantages: **zero per-image cost**, and — significant for this product — **intimate images never leave your infrastructure** for a third-party API. Trade-off: commercial services (Hive, Sightengine, AWS Rekognition; roughly $1–2 per 1,000 images) are a few points more accurate, fully managed, and give you someone to point at in a compliance conversation.

**Design answer: build behind an adapter.** `src/lib/moderation.ts` exposes `classifyImage(buffer) → { genitalia: boolean, tier: 'sfw'|'suggestive', confidence }`; first implementation calls your self-hosted open-source model, and swapping to Hive later is a one-file change. Check the current license of whichever model you deploy before shipping.

**The exception that must be third-party: CSAM matching.** The hash databases (NCMEC/PhotoDNA/Thorn) are restricted-access by design — you can't self-host them. Cloudflare's CSAM Scanning Tool (free with Cloudflare) or Thorn Safer are the practical routes; this also can't wait for scale, it ships with the first user upload surface.

---

## 9. Safety & legal

FOSTA-SESTA context: CL killed casual encounters the week the law passed (March 2018) — platform liability for facilitating commercial sex. The line to hold is *commercial*; non-commercial adult expression is the legal core of the product. Pre-public status lowers immediate exposure, but CSAM scanning/reporting duties attach the moment third parties can upload — build it into the first photo surface, not after. Attorney review is scheduled (photos gated on it); bring them: FOSTA/§230 posture, TAKE IT DOWN Act flow (48h NCII removal, FTC enforcing since May 2026), state age-verification reach post-*FSC v. Paxton* given the no-genitalia public tier, DM-images policy, and 2257 applicability.

Compliance floor in the plan: 18+ hard gate (✅ built) · no-commercial keyword screen on post text + OCR on public images · report post/photo + block user (Pushover admin pipeline exists) · TAKE IT DOWN notice-and-removal flow ships with photos · 24h expiry shrinks the moderation surface · every moderation action logged.

**Strategy note:** the scarce resource is whether women feel the space is *for* them. No-genitalia public surfaces + blur-first design attacks the failure mode at the root, and blur-first makes the platform text-first — writing earns the reveal, so effort competes instead of just faces.

---

## 10. Implementation phases

| Phase | Scope | Status |
|-------|-------|--------|
| **1 — The pivot** | `codes.ts` + `theme.ts`, migration 0002 (wipe + new columns), two-picker form + code preview, badges/markers/colors, posts API, Grok rewrite, copy pass, `--intonow-ember` rename | Ready to build on your go |
| **2 — The magic** | `users.identity`, profile picker, "for me" toggle, code chips, matching logic | Ready after 1 |
| **3 — Safety rails** | Report/block, post-text keyword screen, 24h expiry cron, **DM phone-number warning modal**, ToS | Ready after 1 |
| **4 — Photos** | Migration 0003, upload pipeline (CSAM + classifier adapter + OCR + pHash), blur activation, LIVE capture, reveal grants, TAKE IT DOWN flow | **Blocked on attorney review** (blur module pre-built, flag off) |

## 11. File-by-file change list

| File | Change | Phase |
|------|--------|-------|
| `src/lib/flags.ts` | ✅ Delivered — feature flags, `photoBlur` off | done |
| `src/lib/blur.ts` | ✅ Delivered — placeholder generation | done |
| `src/components/BlurredPhoto.tsx` | ✅ Delivered — reveal surface, inert | done |
| `src/lib/categories.ts` → `src/lib/codes.ts` | Tokens (+`ANY`), compose/parse, `CODE_COLORS` | 1 |
| `src/lib/theme.ts` (new) | Palette constants; `--intonow-ember` rename | 1 |
| `src/lib/schema.ts` | posts tokens; users `identity`; photo tables | 1, 2, 4 |
| `drizzle/0002…`, `0003…` | Migrations | 1, 4 |
| `src/components/PostCreateForm.tsx` | Two pickers, code preview, CTA-gradient submit | 1 |
| `src/components/PostPanel.tsx` | Code badge on cards | 1 |
| `src/components/MapView.tsx` / `AnimatedMarker.tsx` | Marker colors by code | 1 |
| `src/components/FilterPanel.tsx` | For-me toggle + code chips | 2 |
| `src/components/HomePage.tsx` | Filter state & matching | 2 |
| `src/components/ProfileEditor.tsx` | "I am" picker | 2 |
| `src/components/MessagePanel.tsx` / `ConversationThread.tsx` | Phone-number warning modal in composer | 3 |
| `src/app/api/posts/route.ts` | Enum validation, new fields, keyword screen | 1, 3 |
| `src/app/api/profile/route.ts`, `useAuth.ts` | `identity` | 2 |
| `src/app/api/assist/route.ts` | Grok rewrite + guardrails | 1 |
| `src/lib/moderation.ts` (new) | `classifyImage` adapter (self-hosted model first) | 4 |
| `src/app/api/upload/route.ts` | Full photo pipeline | 4 |
| `src/app/api/cron/` | 24h post expiry | 3 |
| New routes | report/block, reveal-grant, NCII takedown | 3, 4 |

## 12. Decision log (was: open questions — all resolved)

All 36 combos ✅ · "Anyone" option ✅ · 24h expiry ✅ · classifier on profile/post uploads only, DMs open ✅ · DM phone-number warning with Edit/Send-Anyway ✅ · wipe dev posts ✅ · blur built but dark pending counsel ✅

**Next step:** your review of this v3. On approval, Phase 1 begins.
