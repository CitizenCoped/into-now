# Handoff: Map Chrome v2 — full-screen bottom panels, exclusive corner controls, ring-only live markers, GPS recenter

## Overview
Iteration on the into.now home map screen (v2 branch, Sunset Pop palette). Four changes to ship:

1. **Bottom corner features (Messages, Posts) expand to cover the whole map** when their corner FAB is tapped. They close by tapping the top of the panel (grab-handle header).
2. **The four corner controls are always visible.** Panels open *underneath* them. Tapping the same corner closes its panel; tapping a different corner swaps panels. **Only one panel is open at a time.**
3. **Live users render a thin orange ring** around the avatar circumference — no blur/glow bleeding off the marker.
4. **Free zoom + GPS recenter.** The user can zoom in/out as far as they like with no snap-back; a fixed crosshair button on the right side of the map recenters/re-zooms onto the user's GPS position. Returning to the app focuses on the user's location.

## About the Design Files
`Into Now Map.dc.html` (open it in a browser; `support.js`, `ios-frame.jsx`, `assets/logo.svg` must sit beside it) is a **design reference built in HTML** — a working prototype of the intended look and behavior, not production code. The task is to recreate this behavior in the existing Next.js/React/Tailwind/MapLibre codebase (`CitizenCoped/into-now`, `main`), using its established components. All target files below are real paths in that repo.

## Fidelity
**High-fidelity.** The prototype reuses the codebase's exact values (Sunset Pop palette from `src/lib/theme.ts`, corner geometry from `src/lib/mapChrome.ts`, panel chrome from the four panel components). Recreate pixel-perfectly.

## Changes by file

### 1. `src/components/HomePage.tsx` — exclusive panel state
Replace the four independent booleans (`panelExpanded`, `messagesExpanded`, `filterExpanded`, `profileExpanded`) with one:

```ts
type OpenPanel = "filters" | "profile" | "messages" | "posts" | null;
const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
const togglePanel = (p: OpenPanel) => setOpenPanel((cur) => (cur === p ? null : p));
```

- Each panel's `expanded` prop becomes `openPanel === "…"`; its `onExpandedChange(true/false)` becomes `togglePanel("…")`.
- Deep links / `startConversation` set `setOpenPanel("messages")` directly.
- Keep sessionStorage persistence if desired (`intonow_panel_expanded` → store `openPanel`); on cold load prefer `null` so the user always returns to the map focused on their location (`center = myLocation`, existing effect already does this).
- The `body.intonow-panel-open` / `intonow-messages-panel-open` classes follow `openPanel === "posts"` / `"messages"`.

### 2. `src/components/CornerControl.tsx` — FABs always on top
- The FAB must render **whether or not its panel is expanded** (today each panel returns the FAB only when collapsed — lift the `<CornerControl>` out of the `if (!expanded)` branch so it always renders).
- Raise stacking: `z-20` → `z-40` so FABs sit above expanded panels.
- `onClick` now always calls the toggle (open ↔ close), so the launching corner also closes the feature.

### 3. `src/components/MessagePanel.tsx` and `src/components/PostPanel.tsx` — full-screen expansion
Replace the corner-anchored `<aside>` sizing:

- Old: `fixed z-20 bottom-[…] left/right-[…] max-h-[min(55vh,480px)] w-[min(380px,…)] rounded-2xl border …`
- New: `fixed inset-0 z-30 flex flex-col overflow-hidden bg-[#0f0d18]/95 backdrop-blur-xl` (no radius, no max-height, covers the map; still under the z-40 FABs).

Header becomes the close affordance (tap anywhere on it):
```tsx
<header onClick={() => onExpandedChange(false)}
  className="flex shrink-0 cursor-pointer flex-col border-b border-white/5 bg-white/[0.02]
             px-[88px] pb-3 pt-[max(3.5rem,env(safe-area-inset-top))]">
  <span className="mx-auto mb-2.5 h-[5px] w-11 rounded-full bg-white/20" />
  {/* existing title row; replace the ▲ button with a passive hint: */}
  <span className="text-[11px] text-white/45">▼ tap to close</span>
</header>
```
- Horizontal padding `88px` keeps the title clear of the top corner FABs; scroll areas get `pb-28` so list bottoms aren't hidden under the bottom FABs.
- `FilterPanel.tsx` / `ProfilePanel.tsx` keep their corner-anchored card layout (unchanged besides the shared toggle wiring).

### 4. `src/components/LiveUserMarker.tsx` — ring only, no glow
Delete both glow `<span>`s (the `blur-md animate-pulse` halo and the multi-layer `boxShadow` ring). Replace with a single hard ring on the avatar wrapper:

```tsx
<div className={`relative flex items-center justify-center ${isLit ? "" : "opacity-50 grayscale"}`}>
  <ProfileAvatar … />           {/* give wrapper: boxShadow: `0 0 0 2px #FF7A1A` when isLit */}
  {isSelf && <span …self dot unchanged… />}
</div>
```
Exact value: `box-shadow: 0 0 0 2px #FF7A1A` (GLOW_ORANGE), zero blur, zero spread beyond 2px. Unlit users unchanged (50% opacity + grayscale, no ring).

### 5. `src/components/MapView.tsx` — free zoom + GPS recenter
- **Zoom freedom:** rely on MapLibre's native pinch/scroll zoom; do not clamp or reset zoom after gestures (`maxZoom` default, `minZoom` ~3). Remove/avoid any `flyTo` triggered by state echoes that would "snap back" — only fly on explicit events (post tap, recenter, initial location fix).
- **Return focus:** existing `useEffect` that flies to `myLocation` on change already restores focus when the app regains the location fix; keep it, and on visibilitychange → visible, `flyTo(myLocation)` at zoom 13.
- **Recenter control (new, fixed map chrome):**

```tsx
{/* inside the map container, sibling of <Map> */}
<button
  aria-label="Center map on my location"
  onClick={() => myLocation && mapRef.current?.flyTo({ center: [myLocation.lng, myLocation.lat], zoom: 13, duration: 800 })}
  className="absolute right-[18px] bottom-[118px] z-[15] flex h-12 w-12 items-center justify-center
             rounded-full border-[1.5px] border-white/75 bg-[#0f0d18]/35 text-white/90 backdrop-blur
             transition hover:border-[#FF9E2C] hover:bg-[#0f0d18]/60"
>
  {/* crosshair: circle r=6.5 + 4 ticks + filled center dot, stroke-width 1.8 */}
</button>
```
Position: right 18px, bottom 118px (above the Posts FAB footprint: 56px button + 34px safe-area margin + gap). It never moves and stays tappable at z-15 (above map, below panels/FABs).

## Interactions & Behavior
- Corner FAB tap: opens its feature (closing any other), or closes it if already open. 150ms border/color hover transitions (existing).
- Full-screen panel header tap: closes, returns to map. Grab-handle (44×5px, `bg-white/20`) + "▼ tap to close" hint (11px, `text-white/45`).
- Recenter tap: ~800ms eased flyTo to GPS position, default zoom 13.
- Live ring: static, no pulse animation.
- Markers stay constant screen size at every zoom (MapLibre markers already do this natively — the prototype counter-scales by 1/zoom to simulate it).

## State Management
- `openPanel: "filters" | "profile" | "messages" | "posts" | null` in HomePage (single source of truth).
- Map camera owned by MapLibre; no React state echo of zoom.
- `myLocation` from `useLivePresence` powers both the recenter button and return-focus.

## Design Tokens (Sunset Pop — `src/lib/theme.ts`)
- accent `#FF8A1E` · coral `#FF4D6D` · CTA gradient `#FFB03A → #F56A00` · live glow/ring `#FF9E2C` (marker ring uses `#FF7A1A` = GLOW_ORANGE in LiveUserMarker) · void `#06040c` · panel `#0f0d18`
- Panel surface: `rgba(15,13,24,.95)` + `backdrop-blur-xl`; hairlines `white/5`–`white/10`
- Corner FAB: 56px circle, border `white/10`, bg `#0f0d18/90`
- Recenter button: 48px circle, border 1.5px `white/75`
- Radii: FAB/avatars 9999px, cards 16px; full-screen panels 0

## Assets
- `assets/logo.svg` — copied from `public/logo.svg` in the repo (unchanged).
- Map imagery in the prototype is a synthetic SVG stand-in for the Carto dark-matter basemap recolored per `src/lib/mapStyle.ts`.

## Files
- `Into Now Map.dc.html` — the interactive prototype (open in browser)
- `support.js`, `ios-frame.jsx`, `assets/logo.svg` — runtime/frame/asset dependencies of the prototype
