# CLAUDE CODE PROMPT — The Best Drug rebrand on branch `v6`

Paste everything below this line into Claude Code, run from `~/Documents/into-now` with the `design_handoff_the_best_drug/` folder dropped in the repo root.

---

You are working in the `CitizenCoped/into-now` Next.js 14 / Tailwind / MapLibre app. Branch `v6` is checked out — all work lands there. Commit in small, logical commits and push `v6` at the end. Do not touch `main`.

## Goal
Rebrand the entire product from **into.now** to **The Best Drug** (tagline **Get On Then Get Off**, domain **https://thebestdrug.com**). The visual spec, prototypes, and assets are in `design_handoff_the_best_drug/`. Read `design_handoff_the_best_drug/README.md` first — it is the source of truth for colors, type, copy, and per-component changes. Open the two `.dc.html` prototypes in a browser to see the target look (they need `support.js` + `ios-frame.jsx` beside them, already included).

## Brand tokens
- Pink `#FF2D8A` (primary: CTAs, titles, active states, unread badge) — **dark text `#07060B` on pink, never white**
- Cyan `#00F0FF` (live presence ring/badge, "Message author", focus rings, link hover)
- Bone `#F5F5F0` (text), Void `#07060B` (bg), Panel `#120A14`
- Chip/code colors: M `#FF2D8A` · W `#00F0FF` · T `#B48CFF` · MW `#F5F5F0` · MM `#FF8AC2` · WW `#7DF9FF`
- Display font: **Anton** (Google), italic, uppercase. Body: system-ui (unchanged).

## Work plan — do in this order

### 1. Assets → `public/`
- `design_handoff_the_best_drug/assets/tbd-mark.svg` → `public/mark.svg`
- `assets/tbd-logo.svg` → `public/logo.svg` (replace; wordmark "THE BEST DRUG", DRUG in pink)
- `assets/favicon.svg` → `public/favicon.svg`; generate `public/favicon.ico` (16/32/48) and `public/apple-touch-icon.png` (180) from `assets/app-icon-512.png` (use `sharp` or `png-to-ico` as a devDependency, or a one-off script — do not commit the tooling if avoidable)
- `assets/app-icon-512.png` → `public/icon-512.png`, plus a 192 downscale → `public/icon-192.png`
- `assets/og-image.png` → `public/og.png` (1200×630)
- Delete `src/app/favicon.ico` (replaced by public/ icons).

### 2. Theme foundation
- `src/lib/theme.ts`: replace the Sunset Pop palette with the THEME object from README §"Palette". Remove `coral`, `ctaFrom/ctaTo`, `liveGlow`.
- `src/app/globals.css`: rename `--intonow-*` → `--tbd-*` with new values; body bg `#07060B`, color `#F5F5F0`; rename `.intonow-corner-btn`, `.intonow-install-anchor`, `body.intonow-panel-open`, `body.intonow-messages-panel-open` → `.tbd-*` / `body.tbd-*`; MapLibre popup/ctrl backgrounds → `rgba(18,10,20,.95)` / `.85`.
- `src/app/layout.tsx`: add `Anton` via `next/font/google` (`weight: "400", subsets: ["latin"], variable: "--font-display"`), put the variable class on `<html>`. `tailwind.config.ts`: `fontFamily.display: ["var(--font-display)", "Impact", "sans-serif"]`.
- Grep the whole `src/` tree and replace every hex per README §"Global find/replace". Also update `src/lib/mapStyle.ts` basemap tints per README.
- Update every `intonow`/`into.now` identifier: body classes in `HomePage.tsx`, `CornerControl.tsx`, sessionStorage keys, CSS var references.

### 3. Metadata / PWA (`layout.tsx`, `public/manifest.json`)
- `metadata.title` → `The Best Drug — Get On Then Get Off`; description → `See who's nearby, share what you're into, and connect in the moment. 18+.`
- `APP_URL` fallback → `https://thebestdrug.com`
- `OG_IMAGE` → `/og.png` (absolute via metadataBase), `openGraph.images[{ width: 1200, height: 630, alt: "The Best Drug — Get On Then Get Off" }]`, `twitter.card: "summary_large_image"`, siteName / og.title / twitter.title / appleWebApp.title → `The Best Drug`, og/twitter description → `Get On Then Get Off`.
- `icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/favicon.ico", sizes: "48x48" }], apple: "/apple-touch-icon.png" }`
- `viewport.themeColor` → `#07060B`.
- `manifest.json`: `name` "The Best Drug", `short_name` "Best Drug", `description` "Get On Then Get Off", `theme_color`/`background_color` `#07060B`, icons → `/icon-192.png`, `/icon-512.png` (any) + `/icon-512.png` (maskable). Remove the Cloudinary URLs.

### 4. Landing / age gate (`OnboardingGate.tsx`, `AuthForm.tsx`, `LandingVideoBackdrop.tsx`)
Match `The Best Drug Landing.dc.html` exactly:
- `LandingVideoBackdrop`: video `opacity-55` (was 30); replace bottom gradient with the full scrim `linear-gradient(180deg, rgba(7,6,11,.45) 0%, transparent 28%, transparent 60%, rgba(7,6,11,.6) 100%)`; glows: pink `bg-[#FF2D8A]/[.14] blur-[110px]` top-left, cyan `bg-[#00F0FF]/[.08] blur-[100px]` bottom-right. Delete `OnboardingBackdrop`.
- Layout: single centered column, `pt-[170px]` (≈ status bar + 10% push-down), hero is `flex-none`, card follows directly beneath, remaining video space below. No `justify-center` on the column.
- Hero (centered, gap 6px): `<img src="/mark.svg">` 52×56 with `drop-shadow(0 4px 18px rgba(255,45,138,.45))` → `<h1>` "THE BEST DRUG" `font-display italic text-[40px] tracking-[.04em] leading-none text-[#F5F5F0]` with `DRUG` in `#FF2D8A` → tagline `font-display italic uppercase text-[14px] tracking-[.16em]`: "GET ON" pink, "THEN GET" bone, "OFF" cyan → sub-line `text-[12px] leading-[1.4] text-[#F5F5F0]/70 max-w-[280px]`: "See who's nearby, share what you're into, and connect in the moment." **Remove "What are you into?" and "Right now." entirely.**
- Card: `mx-7 rounded-[22px] border border-[#F5F5F0]/10 bg-[#120A14]/45 backdrop-blur-[18px] shadow-[0_30px_60px_-20px_rgba(0,0,0,.8)] p-4`; 3-segment step indicator (22×3px bars, pink reached / bone-18% pending); title `font-display italic uppercase text-[16px] tracking-[.04em]` ("When is your birthday?" / "How do you want to join?" / "Create your free account").
- Birthday step: hint `text-[11px] text-[#F5F5F0]/45`; selects `rounded-[14px] border-[#F5F5F0]/12 bg-[#F5F5F0]/6 py-[11px] text-[14px]`, border → `cyan/50` once a value is chosen, custom `▾` chevron; error text pink; error copy "You must be 18 or older to use The Best Drug."; Continue `rounded-[14px] bg-[#FF2D8A] py-3 font-display italic uppercase text-[16px] tracking-[.06em] text-[#07060B] shadow-[0_10px_30px_-8px_rgba(255,45,138,.6)] disabled:opacity-45`.
- Mode step: "Sign up free" (`border-pink/45 bg-pink/12`, title Anton pink, `→` pink) / "Stay anonymous" (`border-bone/12 bg-bone/5`, title Anton bone, `→` cyan); add `← Back`.
- Auth step: Phone/Email segmented control (`bg-bone/6 rounded-xl p-1`, active `bg-pink text-void`); inputs like selects, focus `border-cyan/60`; code input `text-[22px] tracking-[.3em] text-center`; CTA copy "Send code" / "Verify & get on"; footer row `← Back` + "Free account · 24-hour sessions".
- Below the card: `18+ ONLY · TERMS · THEBESTDRUG.COM` (`text-[10px] tracking-[.14em] uppercase text-bone/40`, Terms links `/terms`) then **"Already a member? Sign in"** (`text-[12px] text-bone/60`, "Sign in" cyan 600) → jumps to the auth step with `step="auth"`.
- Loading state: pulse dot pink, over the same backdrop.

### 5. Map home + chrome (`HomePage.tsx`, `CornerControl.tsx`, `LiveUserMarker.tsx`, `MapView.tsx`)
Match `The Best Drug Map.dc.html`:
- Header logo → `/logo.svg`, `alt="The Best Drug"`, `h-[26px]`.
- `CornerControl` default `accentColor="#FF2D8A"`, bg `bg-[#120A14]/90`.
- `LiveUserMarker`: ring `box-shadow: 0 0 0 2px #00F0FF`; self dot `#00F0FF` with `#120A14` border.
- Recenter button hover border → `#00F0FF`.
- Location-denied banner: border `pink/40`, bg `#1a0a14/90`, "Your light is off." in pink.

### 6. Panels (`FilterPanel`, `ProfilePanel`, `MessagePanel`, `PostPanel`, `PostCreateForm`, `ConversationThread`, `PhotoSheet`, `InstallPrompt`)
- Panel titles → `font-display italic uppercase text-[17px] tracking-[.05em] text-[#FF2D8A]`.
- PostPanel sub-line → `Get on. <span className="text-[#00F0FF]">Then get off.</span>`
- Posts FAB live badge `bg-[#00F0FF] text-[#07060B]`; Messages unread badge `bg-[#FF2D8A] text-[#07060B]`; presence dots `#00F0FF`.
- Popup "Message author" → `border-[#00F0FF]/35 bg-[#00F0FF]/10 text-[#00F0FF]`.
- Sliders / "For me" toggle / all CTAs → solid `#FF2D8A` (no gradients anywhere).
- Profile "Sign up free" → `bg-pink font-display italic uppercase text-[15px] text-void`.
- Chip colors per token list above (FilterPanel + PostCreateForm + marker fills).
- `InstallPrompt`: "Install The Best Drug".

### 7. Copy sweep — every remaining `into.now` / `Into Now` / `intonow`
Files: `admin/page.tsx`, `terms/page.tsx` (title + body), `api/assist/route.ts` (system prompt: app name + tagline "Get On Then Get Off"), `api/posts/[id]/report/route.ts`, `lib/adminNotify.ts` (4 notification titles), `lib/contentScreens.ts`, `lib/flags.ts` comment, `sw.ts:33` default push title, `README.md`. Final check: `grep -ri "into.now\|intonow\|into now" src public` must return zero.

### 8. Verify, commit, push
- `npm run lint && npm run build` clean.
- Run locally on a phone-sized viewport: landing renders over the video with the card fully visible without scrolling; all three onboarding steps + anonymous flow work; map chrome, all four panels, badges, live ring are pink/cyan; tab shows the heart favicon; `/og.png`, `/manifest.json`, `/favicon.svg` return 200.
- Paste the deployed preview URL into https://www.opengraph.xyz (or iMessage) and confirm the OG card shows the heart + GET ON THEN GET OFF.
- Commits (suggested): `chore(v6): brand assets + theme tokens` · `feat(v6): landing/age-gate rebrand` · `feat(v6): map chrome + panels recolor` · `chore(v6): metadata, manifest, copy sweep`.
- `git push -u origin v6`. Report the Vercel preview URL.

### Out of scope on v6 (do not do)
Schema/API/migration changes, presence/messaging logic, map behavior (already shipped from `design_handoff_map_chrome/`).
