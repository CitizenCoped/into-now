# Simplify pass 1 — onboarding flow

Date: 2026-06-20
Scope: latest commit `052afbb` ("v2: streamline onboarding flow") — `src/components/OnboardingGate.tsx`, `src/components/OnboardingWrapper.tsx`, and the gating logic they touch.

Three read-only review agents (code quality, performance, reuse) inspected the change. Findings were aggregated and the targeted fixes below were applied. Verified with `npm run build` (passing) and lint (clean).

## Fixed

### High
- **Map gate contradicted the new flow.** `HomePage.tsx` still required `profileComplete` before enabling live presence (`mapReady`), so anonymous/new users finished onboarding but landed on a non-functional map (no location sharing, no dot). Changed `mapReady` to require only `user?.ageVerifiedAt`, matching the onboarding gate and the "straight to the map" intent.
  - `src/components/HomePage.tsx`: `const mapReady = Boolean(user?.ageVerifiedAt);`

### Medium
- **Day value could drift out of range.** Picking day 31 then switching to February (or a month with fewer days) left a `<select value>` with no matching option and could submit a different date than shown. Added `changeMonth` / `changeYear` handlers that clamp `day` to the new month length. Removed the masking `Math.min` in the `birthDate` string since the source state is now always valid.
- **Redundant / derived onboarding state.** Replaced the `birthdayConfirmed` boolean + `localStep` + multi-condition `step` derivation with a single `localStep: Step` state machine (`"birthday" | "mode" | "auth"`). Eliminates stale-state risk between `birthdayConfirmed`, `birthDate`, and `isAdult`.
- **Duplicated `isAdult`.** The component, `src/lib/auth.ts`, and `src/lib/geo.ts` (`ageFromBirthDate`) all had parallel age math. Consolidated into one client-safe `isAdult` in `src/lib/geo.ts` (built on `ageFromBirthDate`). `src/lib/auth.ts` now re-exports it (`export { isAdult } from "@/lib/geo"`), and `OnboardingGate.tsx` imports it. Server routes that import `isAdult` from `@/lib/auth` are unaffected.

### Low
- Removed the unused `"ready"` member from the `Step` union (dead type).
- Dropped two premature `useMemo` calls (the year/day lists are tiny static ranges) — plain computation now.
- Removed three empty `<div className="relative">` wrappers around the date `<select>`s.
- Simplified `OnboardingWrapper`'s redundant `async (birthDate) => { await createAnonymous(birthDate) }` to pass `createAnonymous` directly; widened the prop type to `Promise<unknown>` to match the other auth callbacks.

## Skipped / recommended (not done)

- **Timezone sensitivity in age math (low, pre-existing).** `new Date("YYYY-MM-DD")` parses as UTC, so age can be off by one day near midnight in western timezones. Affects both `geo.ts` and the API routes; left as-is to avoid changing verification behavior in this pass. Recommend parsing date parts as local integers if this ever matters.
- **`Promise<unknown>` on verify callbacks (low, pre-existing).** Weak typing carried over from before this commit; not widened further here.
- **No `console.error` in `handleAnonymous` catch.** The catch surfaces a user-facing message but doesn't log. Optional; left out to avoid console noise.
- **Shared form/select UI primitive (reuse, over-engineering for now).** Input/select Tailwind styles are inlined across ~8 components with intentional size variants. Extracting a `FormSelect`/`FormInput` would touch many files with no existing abstraction; defer until a broader form pass.

## Verification
- `npm run build`: passing.
- Lint on all touched files: no errors.
