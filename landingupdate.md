# landingupdate.md — Landing / Age-Gate Redesign

**Date:** 2026-08-02
**Repo:** github.com/CitizenCoped/into-now, branch `v2` (working folder `~/Documents/into-now`)
**Reference:** owner's annotated mockup (screenshot of into-now.vercel.app age gate) — fullscreen background video, age gate centered, old Cloudinary embed removed.

---

## Goal

Redesign the first screen everyone sees (the pre-auth landing / age gate) so a looping video plays fullscreen behind the entire onboarding flow, heavily dimmed, with the age-gate card centered on top of it. The current boxed Cloudinary player embed — which is broken on iOS ("Something went wrong / Video cannot be played" in the mockup) — is removed entirely.

## Locked decisions (confirmed 2026-08-02)

1. **Video look:** fullscreen, dimmed to **~30% visible** (i.e., a ~70% dark layer over it). Reads as a subtle moving backdrop; text stays readable. Matches the mockup's dark treatment.
2. **Hosting:** **everything video-related lives on DigitalOcean Spaces — nothing hosted from Vercel** (owner's constraint, confirmed 2026-08-02). Owner optimizes the file locally with ffmpeg (commands below) and uploads the optimized MP4 **and the poster jpg** to Spaces, then provides both CDN URLs.
3. **Layout:** keep the **heading + tagline** — "INTO.NOW" eyebrow, "What are you into? / Right now." headline at top, tagline text — with the age-gate card **centered in the middle** of the screen. Only the boxed video card goes away.
4. **Card style:** age-gate card becomes a **semi-transparent frosted panel** (dark glass + backdrop blur) so the video is faintly visible behind the birthday fields, like the mockup.
5. **Playback:** autoplay, muted, **loops forever** (`loop` attribute — plays, replays, replays), inline on mobile (`playsInline`), no controls, no audio track in the file at all.

## Source video

- Original: `https://thebestdrug.sfo3.cdn.digitaloceanspaces.com/Video/bestdrugasses.MP4`
- Note: Claude's cloud sandbox cannot reach that CDN domain (blocked at the network layer), so the owner runs the optimization locally (section 5). Browsers/the deployed app can reach the URL fine — the block is only in the sandbox.

---

## Implementation

### 1. New component: `src/components/LandingVideoBackdrop.tsx`

Fixed, fullscreen, behind everything on the onboarding screen:

```tsx
"use client";

const VIDEO_URL = "<final Spaces CDN URL>";  // e.g. .../Video/landing-loop.mp4
const POSTER_URL = "<final Spaces CDN URL>"; // e.g. .../Video/landing-poster.jpg (first-frame still)

export default function LandingVideoBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden bg-[#06040c]" aria-hidden>
      <video
        src={VIDEO_URL}
        poster={POSTER_URL}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        className="h-full w-full object-cover opacity-30"
      />
      {/* optional extra bottom gradient so the tagline/legal text stays crisp */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#06040c]/80 to-transparent" />
    </div>
  );
}
```

Details:

- `opacity-30` on the video over the `#06040c` page background = the agreed "70% transparency" dimming. Tune between `opacity-25` and `opacity-35` on a real phone.
- `object-cover` + `fixed inset-0` = covers the whole screen at any aspect ratio, cropping as needed.
- `muted` + `playsInline` are what make iOS Safari allow autoplay at all.
- **Low Power Mode fallback:** iOS blocks autoplay in Low Power Mode. The `poster` frame shows instead, so the screen still looks intentional, never broken. (Optional nicety: `onCanPlay` fade-in from poster to video.)
- `pointer-events-none` so it can never swallow taps meant for the form.

### 2. Delete the Cloudinary embed

- Delete `src/components/IntroVideo.tsx` and its import/usage in `OnboardingGate.tsx`. This removes the broken iframe player (the "Video cannot be played" error in the mockup) and the Cloudinary dependency from the landing entirely.

### 3. Rework `src/components/OnboardingGate.tsx` layout

Current: two-column on desktop (hero + video card left, auth card right); on mobile the video card sits between heading and tagline, card below.

New: **single centered column at every breakpoint**, video behind everything:

- Render `<LandingVideoBackdrop />` first inside `<main>` (also on the `loading` state so there's no flash of plain background).
- Keep `OnboardingBackdrop` glows layered above the video — they're subtle and add depth; drop them if they fight the footage.
- Order, all centered: eyebrow `into.now` → headline "What are you into? / Right now." → tagline "See who's nearby, share what you're into, and connect in the moment." → age-gate card, vertically centered in the remaining space (`flex flex-col items-center justify-center`, max-w-md card).
- The video keeps playing behind **all three steps** — birthday → join mode → auth form — nothing unmounts it between steps.

### 4. Card restyle (semi-transparent)

- From: `bg-[#0f0d18]/90` → to roughly `bg-[#0f0d18]/60 backdrop-blur-xl border border-white/10` (keep the shadow). Verify the `<select>` popovers and error text still read clearly; if legibility suffers on real footage, nudge back toward `/70`.

### 5. Video optimization — owner runs locally, hosts on Spaces

What the optimization does: strips audio (plays muted anyway), caps at 720p (invisible difference behind 70% dimming), H.264 CRF 27 (small + iOS-safe), 30fps cap, `yuv420p` pixel format (iOS Safari requirement), strips metadata, `+faststart` (playback starts before download finishes).

Run in Terminal (install ffmpeg first if needed: `brew install ffmpeg`):

```bash
cd ~/Downloads   # wherever bestdrugasses.MP4 lives

# optional: inspect the original
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,r_frame_rate,duration,bit_rate \
  -of default=noprint_wrappers=1 bestdrugasses.MP4

# the optimization
ffmpeg -i bestdrugasses.MP4 -an -c:v libx264 -preset slow -crf 27 \
  -vf "scale=720:1280:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30" \
  -pix_fmt yuv420p -profile:v high -level 4.0 \
  -movflags +faststart -map_metadata -1 \
  landing-loop.mp4

# poster frame (shows while loading / in iOS Low Power Mode)
ffmpeg -i landing-loop.mp4 -frames:v 1 -q:v 3 landing-poster.jpg

ls -lh landing-loop.mp4 landing-poster.jpg
```

Tuning:

- Target ~2–8 MB. Too big → raise `-crf` to 29–30. Looks soft on device → scale `1080:1920` instead.
- Long clip? Add `-t 15` right after `-i bestdrugasses.MP4` to keep only the first 15s — plenty for a loop.
- Loop seam: `loop` restarts instantly; if last frame ≠ first frame there's a jump cut each cycle. Usually fine dimmed to 30%; a crossfade-loop command is available if it bothers.

Then: upload **both** `landing-loop.mp4` and `landing-poster.jpg` to Spaces, public-read — suggested keys `Video/landing-loop.mp4` and `Video/landing-poster.jpg` — and give Claude the two CDN URLs to wire into `LandingVideoBackdrop.tsx`.

### Files touched

- `src/components/LandingVideoBackdrop.tsx` — new
- `src/components/OnboardingGate.tsx` — layout rework, card restyle, remove IntroVideo
- `src/components/IntroVideo.tsx` — deleted

No schema, API, or migration changes. No env vars needed (URLs are public constants). Nothing ships in `/public` — video **and** poster both live on Spaces.

---

## Deploy (standard workflow)

Claude delivers files via the bridge → you commit + push `v2` (pushes = preview only) → check the preview → promote via the Vercel dashboard. As always: no git through the bridge.

## Test checklist

- iPhone Safari (the mockup device): video autoplays muted, covers full screen, loops seamlessly, ~30% visible.
- Low Power Mode: poster shows, no broken-player UI.
- All three onboarding steps render over the video; birthday selects, error states, and buttons are readable.
- Under-18 rejection and the full sign-up + anonymous flows still work (no logic changes expected, but the layout touch is in the same component).
- Desktop: single centered column looks right at wide widths.
- Lighthouse/feel check: page is interactive before the video finishes loading (poster + faststart).

## Open items

- [ ] Owner runs the ffmpeg commands (section 5) → `landing-loop.mp4` + `landing-poster.jpg`
- [ ] Owner uploads both to Spaces (public-read), provides the two CDN URLs
- [ ] Claude builds per sections 1–4 once URLs are in hand
- [ ] Tune exact opacity (25–35%) on device with real footage
