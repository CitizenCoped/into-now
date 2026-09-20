# The Best Drug

**Get On Then Get Off** · https://thebestdrug.com

A map-first, 18+ personals app: see who's nearby, share what you're into, and connect in the moment. Next.js 14 (App Router) · Tailwind · MapLibre · Drizzle/Neon · Pusher presence · web push.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```

Open http://localhost:3000. The pre-auth landing (age gate → join mode → phone/email auth) lives in `src/components/OnboardingGate.tsx`; the map home and its four corner panels start at `src/components/HomePage.tsx`.

## Brand

Design source of truth: `design_handoff_the_best_drug/README.md` (palette, type, copy, per-component spec) and the `.dc.html` prototypes beside it.

- Tokens: `src/lib/theme.ts` and the `--tbd-*` vars in `src/app/globals.css`
- Display face: Anton (italic, uppercase) via `next/font/google`, exposed as the Tailwind `font-display` family
- Assets: `public/mark.svg`, `public/logo.svg`, `public/favicon.svg`, `public/favicon.ico`, `public/apple-touch-icon.png`, `public/icon-192.png`, `public/icon-512.png`, `public/og.png`

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Applies Drizzle migrations, then `next build` |
| `npm run lint` | `next lint` |
| `npm run db:generate` / `db:migrate` | Drizzle migrations |
| `npm run management:invite` | Issue a management-console invite |
| `npm run photo:dm-test` | Photo DM matrix test (CLI) |

## Deploy

Vercel. Cron routes are declared in `vercel.json`; `NEXT_PUBLIC_APP_URL` should be `https://thebestdrug.com` in production.
