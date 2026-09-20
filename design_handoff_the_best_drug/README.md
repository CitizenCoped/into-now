# Handoff: Rebrand into.now → **The Best Drug**

Tagline: **Get On Then Get Off** · URL: **https://thebestdrug.com**

## Overview
Full visual rebrand of `CitizenCoped/into-now` (`main`). Every into.now string, color and mark goes; the map-chrome behavior shipped from `design_handoff_map_chrome/` stays as-is.

## Design files (open in a browser; `support.js` + `ios-frame.jsx` + `assets/` must sit beside them)
- `The Best Drug Landing.dc.html` — landing / age gate → join mode → auth (all three steps; Tweaks: `step`, `showVideo`)
- `The Best Drug Map.dc.html` — home map + corner chrome + four panels, recolored
- `assets/tbd-logo.svg` — type-only wordmark (replaces `public/logo.svg`)

These are HTML design references, not production code — recreate in the existing Next/Tailwind components.

## Brand system

### Palette → `src/lib/theme.ts` (replace Sunset Pop)
```ts
export const THEME = {
  /** Primary — CTAs, active states, titles, unread badges (dark text on it). */
  accent: "#FF2D8A",   // hot pink
  /** Contrast — live presence ring/badge, links-hover, "Message author", focus rings. */
  live: "#00F0FF",     // cyan
  /** Text / bone. */
  ink: "#F5F5F0",
  /** Soft accent for chips: */ accentSoft: "#FF8AC2", liveSoft: "#7DF9FF", violet: "#B48CFF",
  void: "#07060B",     // app background
  panel: "#120A14",    // panel surface (pink-tinted)
} as const;
```
Delete `coral`, `ctaFrom/ctaTo`, `liveGlow`. **CTA is solid pink, no gradient** — `bg-[#FF2D8A] text-[#07060B]`.

### globals.css
```css
:root { --tbd-pink:#ff2d8a; --tbd-cyan:#00f0ff; --tbd-ink:#f5f5f0; --tbd-void:#07060b; --tbd-panel:#120a14; }
body { background: var(--tbd-void); color: var(--tbd-ink); }
```
Rename `--intonow-*` vars and `.intonow-*` classes → `.tbd-*` (`intonow-corner-btn`, `intonow-install-anchor`, `intonow-panel-open`, `intonow-messages-panel-open`; update `HomePage.tsx` + `CornerControl.tsx` + the maplibre rules). MapLibre popup/ctrl bg → `rgba(18,10,20,.95)`.

### Type
- Display: **Anton**, `font-style: italic`, uppercase, tracking `.04–.06em` — wordmark, headline, card titles, panel titles, CTA labels. Add via `next/font/google`: `Anton({ weight: "400", subsets: ["latin"] })`, expose as `--font-display`; Tailwind `fontFamily.display`.
- Body: system-ui stack (unchanged).

### Global find/replace (hex → hex)
`#FF8A1E`→`#FF2D8A` · `#FF4D6D`→`#FF2D8A` · `#FF9E2C`,`#FF7A1A`→`#00F0FF` · `from-[#FFB03A] to-[#F56A00]`→`bg-[#FF2D8A]` · `#06040c`→`#07060B` · `#0f0d18`→`#120A14` · `rgba(255,138,30,…)`/`rgba(255,77,109,…)`→`rgba(255,45,138,…)` · `rgba(255,158,44,…)`→`rgba(0,240,255,…)`
Post/identity code colors (`PostCreateForm`, `FilterPanel` chips, marker fills): `M #FF2D8A · W #00F0FF · T #B48CFF · MW #F5F5F0 · MM #FF8AC2 · WW #7DF9FF`.
Basemap tint (`src/lib/mapStyle.ts`): shift brown recolors to pink-tinted darks — buildings `#1a0f18`, grid `#22121e`, roads `#3a1a30`, water `#0a2a33`, parks `#161018`, labels `#d8c8d2`.

## Copy — every into.now string
| File | Old | New |
| --- | --- | --- |
| `layout.tsx` metadata | `into.now — what are you into? NOW?` | `The Best Drug — Get On Then Get Off` |
| `layout.tsx` description | `Discover and share what you're into, right now…` | `See who's nearby, share what you're into, and connect in the moment.` |
| `layout.tsx` siteName / og / twitter / appleWebApp.title | `into.now` | `The Best Drug` |
| `layout.tsx` APP_URL fallback | `https://into-now.vercel.app` | `https://thebestdrug.com` |
| `public/manifest.json` name/short_name/description | into.now… | `The Best Drug` / `Best Drug` / `Get On Then Get Off`; `theme_color`/`background_color` `#07060B`; icons → new pink/Anton "TBD" icon set on Spaces (192/512 + maskable) |
| `OnboardingGate.tsx` hero | eyebrow `into.now`, h1 `What are you into? / Right now.` | eyebrow **THE BEST DRUG** (Anton italic, "DRUG" pink), `What are you into?` (system 600), h1 **GET ON / THEN GET OFF** (Anton italic 60px; GET ON pink, THEN GET bone, OFF cyan) |
| `OnboardingGate.tsx` error | `…to use Into Now.` | `…to use The Best Drug.` |
| `OnboardingGate.tsx` footer | — | add `18+ only · Terms · thebestdrug.com` (11px, tracking .14em, uppercase, ink/40) |
| `AuthForm.tsx` verify CTA | `Verify & sign in` | `Verify & get on` |
| `PostPanel.tsx:142` | `what are you into? NOW?` | `Get on. <span cyan>Then get off.</span>` |
| `HomePage.tsx:309` logo alt | `into.now` | `The Best Drug` |
| `InstallPrompt.tsx` | `Install into.now` / `…to install into.now…` | `Install The Best Drug` |
| `admin/page.tsx`, `terms/page.tsx`, `api/assist/route.ts`, `adminNotify.ts`, `posts/[id]/report`, `contentScreens.ts`, `flags.ts`, `sw.ts:33` | `into.now` | `The Best Drug` (assist prompt tagline → "Get On Then Get Off") |
| sessionStorage / body classes | `intonow_*`, `intonow-*` | `tbd_*`, `tbd-*` |

## Component changes

### `OnboardingGate.tsx` (see Landing prototype)
- `OnboardingBackdrop` glows: pink `bg-[#FF2D8A]/14 blur-[110px]` top-left, cyan `bg-[#00F0FF]/8 blur-[100px]` bottom-right.
- Backdrop scrim: `linear-gradient(180deg, void/55 0%, transparent 30%, transparent 55%, void/85 100%)` over the 30%-opacity video.
- Card: `rounded-[22px] border-[#F5F5F0]/12 bg-[#120A14]/60 backdrop-blur-xl`, padding `22px 20px 20px`. Add 3-segment step indicator (22×3px bars, pink = reached, ink/18 = pending) above the title.
- Card title: Anton italic 20px uppercase, ink.
- Selects: `rounded-[14px] border-ink/12 bg-ink/6 px-3.5 py-3.5 text-base`; when a value is chosen border → `cyan/50`; custom `▾` chevron (ink/40).
- Continue: `rounded-[14px] bg-[#FF2D8A] py-4 font-display italic uppercase text-[19px] tracking-[.06em] text-[#07060B] shadow-[0_10px_30px_-8px_rgba(255,45,138,.6)]`, disabled `opacity-45`.
- Mode step: "Sign up free" card `border-pink/45 bg-pink/12`, title Anton pink + `→`; "Stay anonymous" `border-ink/12 bg-ink/5`, Anton ink + cyan `→`. Add `← Back`.
- Auth step (`AuthForm.tsx`): Phone/Email → segmented control (`bg-ink/6 rounded-xl p-1`; active `bg-pink text-void`). Inputs same as selects; focus `border-cyan/60`. Code input 22px, `tracking-[.3em]`, centered. Footer row: `← Back` + `Free account · 24-hour sessions`.

### `CornerControl.tsx`
`accentColor` default `#FF2D8A`; bg `bg-[#120A14]/90`. Unchanged geometry / z-40.

### `LiveUserMarker.tsx`
Ring `box-shadow: 0 0 0 2px #00F0FF` (cyan replaces GLOW_ORANGE). Self dot `#00F0FF`, border `#120A14`.

### Panels (`FilterPanel`, `ProfilePanel`, `MessagePanel`, `PostPanel`)
- Titles → `font-display italic uppercase text-[17px] tracking-[.05em] text-[#FF2D8A]`.
- Posts corner: live-count badge `bg-[#00F0FF] text-[#07060B]`; Messages unread badge `bg-[#FF2D8A] text-[#07060B]`; presence dot `#00F0FF`.
- Map popup "Message author" → `border-cyan/35 bg-cyan/10 text-cyan`.
- Sliders / "For me" toggle track: solid `#FF2D8A`.
- Profile "Sign up free": `bg-pink font-display italic uppercase text-[15px] text-void`.

### `public/logo.svg`
Replace with `assets/tbd-logo.svg` (THE BEST in `#F5F5F0`, DRUG in `#FF2D8A`, Anton italic — export with the font outlined so it renders without the webfont). Header height 26px.

### Mark, favicon, app icon, link preview (see `The Best Drug Brand Kit.dc.html`)
Mark = heart (pink stroke) with ♂ arrow top-right and ♀ cross below (cyan) — cleaned-up version of the small heart from the reference logo.
- `assets/tbd-mark.svg` → `public/mark.svg` (landing hero, 52×56 above the wordmark)
- `assets/favicon.svg` → `public/favicon.svg`; also export `favicon.ico` (16/32/48) and `apple-touch-icon.png` (180) from `assets/app-icon-512.png`
- `assets/app-icon-512.png` → Spaces `images/icon-512.png` (+ 192 downscale); use for `manifest.json` icons (any + maskable — mark sits inside the 80% safe zone) and `layout.tsx` `PWA_ICON`
- `assets/og-image.png` (1200×630) → Spaces `images/og.png`; `layout.tsx` `OG_IMAGE`, `openGraph.images[{width:1200,height:630}]`, `twitter.card: "summary_large_image"`. This is what iMessage/RCS/SMS/email/Slack render.

```tsx
// layout.tsx metadata additions
icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/favicon.ico", sizes: "48x48" }], apple: "/apple-touch-icon.png" },
openGraph: { title: "The Best Drug", description: "Get On Then Get Off", siteName: "The Best Drug", url: "https://thebestdrug.com", images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "The Best Drug — Get On Then Get Off" }] },
twitter: { card: "summary_large_image", title: "The Best Drug", description: "Get On Then Get Off", images: [OG_IMAGE] },
```
`manifest.json`: `theme_color`/`background_color` `#07060B`, `name` "The Best Drug", `short_name` "Best Drug", `description` "Get On Then Get Off".

## Contrast notes
- `#07060B` on `#FF2D8A` ≈ 6:1 — dark text on pink CTAs, never white.
- `#00F0FF` on `#07060B` ≈ 14:1 — cyan is safe as small text.
- Ink at ≥ 72% opacity for body on the dimmed video; the bottom scrim keeps the card region ≥ 85% void.
