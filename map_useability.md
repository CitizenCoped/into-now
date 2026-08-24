# Map usability: pin the chrome, confine gestures to the middle frame

## Context

On iPhone Safari (thebestdrug.com), the whole page scrolls/shifts so the four corner FABs slide off screen. Annotated screenshots (M1.0) define the required model:

- The phone screen never moves: top band (Filters FAB + logo + Profile FAB) and bottom band (Messages FAB + Posts FAB) pinned at all times.
- The middle region is the **gesture frame**: pan/zoom gestures there act on the map with full global freedom (any location, any zoom). The frame limits where *touches* act, not where the map can travel.
- Drags starting on the top/bottom bands must NOT pan the map (bands are control territory).
- Visuals stay **full-bleed**: map imagery still renders edge-to-edge behind the controls; the frame is invisible.

Root causes:
1. `src/app/layout.tsx` — viewport export was only `{ themeColor }`: no `viewport-fit=cover` (so `env(safe-area-inset-*)` = 0 → bottom FABs sat under Safari's toolbar), no `maximumScale` (double-tap/pinch page zoom possible).
2. `src/components/HomePage.tsx` — root `<main>` was `h-screen` (100vh = iOS *large* viewport) and html/body had no height/overflow lock → document taller than visual viewport → page scrolled, fixed FABs drifted.
3. No `overscroll-behavior` anywhere → rubber-band / pull-to-refresh moved the page.
4. InstallPrompt anchor was a normal-flow div with `transform: translateZ(0)`; InstallPrompt's `fixed` banners positioned against it, and its padding assumed inset 0.
5. Map chrome padding re-applied on `window.resize` only; iOS toolbar changes fire `visualViewport.resize`.
6. Full-screen panels' inner scrollers had no `overscroll-contain` → scroll chaining.

## Changes

1. **Viewport export** (`src/app/layout.tsx`): add `width: device-width`, `initialScale: 1`, `maximumScale: 1`, `userScalable: false`, `viewportFit: "cover"`, `interactiveWidget: "resizes-content"`. `viewport-fit=cover` gives real safe-area insets to the FAB offsets and to `getMapChromePadding()`'s probe.
2. **Lock the document** (`src/app/globals.css`): `html, body { height: 100%; overflow: hidden; overscroll-behavior: none; }`. HomePage root `h-screen` → `h-dvh`.
3. **InstallPrompt anchor** (`src/components/HomePage.tsx`): anchor becomes `fixed inset-x-0 top-0` with safe-area-aware paddingTop (`calc(max(0.75rem, env(safe-area-inset-top)) + 2.5rem)`); keeps the translateZ containing-block trick.
4. **Gesture-guard bands** (`src/components/HomePage.tsx`): two transparent `fixed` divs at `z-[12]` with `touch-action: none`, heights `max(16px, safe-area-inset) + 66px` (from `mapChrome.ts` constants: 56px FAB + 10px buffer). Touches there never reach the map canvas; FABs (z-40), panels (z-30), logo (z-20) and the recenter button (z-15) all sit above.
5. **Map padding refresh** (`src/components/MapView.tsx`): re-apply chrome padding on `visualViewport.resize` and `orientationchange`, not just `window.resize`.
6. **Panel scroll containment**: `overscroll-contain` on all inner scrollers (PostPanel, PostCreateForm, ConversationList, ConversationThread, FilterPanel, ProfilePanel).
7. **Double-tap zoom on controls**: `touch-action: manipulation` on `.intonow-corner-btn`, the recenter button, and InstallPrompt buttons.

## Verification

Desktop preview: no document scrollbar; viewport meta contains `viewport-fit=cover, maximum-scale=1`; drags starting in the top/bottom bands don't pan the map, middle drags do; all controls still clickable; panels scroll internally.

Real iPhone (manual): rubber-band from center/bands never moves the FABs; no pull-to-refresh; bottom FABs above the Safari toolbar; double-tap on controls doesn't zoom the page; map pinch still zooms. Installed PWA: FABs clear notch/home indicator; panel headers grow with the inset.

## Risks

- Bands eat taps on markers mid-pan under them (settled content stays inside the frame thanks to camera padding). Accepted.
- Safe-area insets becoming nonzero shifts FABs inward on notched phones — intended.
- If dvh resize thrash appears on device, fall back `main` to `h-svh`.
