# AGENTS.md

## Cursor Cloud specific instructions

`into-now` ("into.now") is a single Next.js 14 (App Router) PWA — there is one service, the
Next.js app. It is a map-first local discovery app: users drop posts onto a MapLibre map,
see live presence, and direct-message each other.

### Running / building / linting / testing
- Standard scripts live in `package.json`: `npm run dev` (port 3000), `npm run build`,
  `npm run lint`. There is no automated test suite.
- The service worker (Serwist) is disabled in development; `npm run build` bundles it to
  `public/sw.js`.

### Environment / secrets (important, non-obvious)
- Local dev secrets live in `.env.local` (gitignored, preserved in the VM snapshot — NOT in
  git). Next.js auto-loads it for `dev`/`build`. It contains a provisioned dev Neon
  `DATABASE_URL`, plus a dev `AUTH_SECRET` and `ADMIN_SECRET`.
- All secrets are read lazily inside request handlers, so `next dev` boots even with no env
  vars. But the home page calls `GET /api/posts` on load, which hits the DB — without a valid
  `DATABASE_URL` (and a migrated schema) most flows fail at runtime.
- Only **Postgres (`DATABASE_URL`)** is required to exercise the core browse/create-post flow.
  `AUTH_SECRET` + Twilio Verify (`TWILIO_*`) are required only for phone login, messaging, and
  push. Pusher, web-push/VAPID, xAI (`XAI_API_KEY`), and Pushover are all optional and fail
  soft (return 503 / no-op) when unset.

### Database (Drizzle + Neon)
- The DB is Neon serverless, accessed via the `@neondatabase/serverless` HTTP driver, so it
  must be a real Neon/Neon-compatible Postgres (a plain local Postgres will not work with this
  driver).
- Schema is in `src/lib/schema.ts`; there are no migration files. Apply the schema with
  `npx drizzle-kit push`. drizzle-kit reads `DATABASE_URL` from the process env, so load it
  first, e.g. `set -a && . ./.env.local && set +a && npx drizzle-kit push`.
- Gotcha: values in `.env.local` that contain `&` (the Neon URL does) must be quoted, or
  shell `source`/`set -a` will mis-parse them (Next.js itself does not care about quoting).

### Hello-world / smoke test
- Anonymous posting works without auth (`posts.authorId` is nullable). Quick check:
  `curl -X POST localhost:3000/api/posts -H 'Content-Type: application/json' -d '{"title":"t","description":"d","category":"events","lat":37.77,"lng":-122.41}'`
  then `curl localhost:3000/api/posts`.
