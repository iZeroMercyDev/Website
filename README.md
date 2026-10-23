# Bankai

Anime browsing and watching app built with Next.js (App Router), Prisma/PostgreSQL and AniList metadata.
Features: browse/search/schedule, anime pages, watch page with history and resume, personal list, reviews & comments,
watch parties, AniList account sync, profiles with uploads, settings, data export, and an admin dashboard.

## Tech stack

Next.js 15 · React 19 · TypeScript · Tailwind CSS · Prisma 6 + PostgreSQL · Zustand · zod · bcryptjs · Vercel Blob (uploads)

## Quick start

```bash
npm install
cp .env.example .env          # set DATABASE_URL and AUTH_SECRET at minimum
npm run db:push               # create tables
SEED_ADMIN_USERNAME=you SEED_ADMIN_PASSWORD='at-least-10-chars' npm run db:seed
npm run dev                   # http://localhost:3000
```

Local Postgres: `docker compose up db -d` (connection string is in `.env.example`).

## Environment variables

Validated at server start by `src/lib/env.ts`; the log lists optional features that are switched off.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `AUTH_SECRET` | recommended | Signs login sessions (16+ chars). **Without it the app runs in insecure legacy mode and `/admin` is locked.** Generate: `openssl rand -base64 32` |
| `STREAMING_API_URL` | no | Playback API base URL (must start with `https://`) |
| `ANILIST_CLIENT_ID` / `ANILIST_CLIENT_SECRET` | no | AniList account linking |
| `BLOB_READ_WRITE_TOKEN` | no | Profile picture / banner uploads |
| `ASSEMBLYAI_API_KEY` | no | Live captions |
| `OPENAI_API_KEY` / `GROQ_API_KEY` | no | AI captions / translation |
| `FANART_TV_API_KEY` | no | Anime logos |
| `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` | seed only | Creates or promotes the admin user |

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Develop, production build (runs `prisma generate`), serve |
| `npm run typecheck` / `lint` | TypeScript and ESLint checks (also run in CI) |
| `npm run db:push` | Sync the Prisma schema to the database |
| `npm run db:migrate` / `db:studio` | Create a migration / browse data |
| `npm run db:seed` | Idempotent seed: admin user + welcome announcement |

## Project structure

```
src/
  app/            Routing only. Route groups: (public) (auth) (user), plus watch/, admin/, api/
  features/       One folder per feature (anime, watch, browse, home, profile, ...), each with components/
  components/     Shared UI: ui/ and layout/
  server/         Backend-only code (never import from client components)
    auth/         session.ts (signed cookie), actor.ts (who is calling), guards.ts (requireAdmin), cookie.ts
    db/           Prisma client
    providers/    metadata/ (AniList, Jikan) and playback/ (stream sources)
    services/     Business logic (AniList sync/push, anime cache)
    cache/        API response cache
    security/     rate-limit.ts
    repositories/ Reserved for DB query modules
  lib/            env.ts (zod validation), utils.ts
  hooks/ store/ types/ styles/
  middleware.ts   Gates /admin and /api/admin
  instrumentation.ts  Runs env validation on server start
prisma/           schema.prisma, seed.ts
docs/             architecture.md
tests/            unit/ integration/ e2e/ (placeholders)
```

## Authentication

- Login/signup set an `httpOnly` signed session cookie (`bankai_session`, 30 days, HMAC-SHA256).
- API routes identify the caller with `getActor(req)` from the cookie, never from a username sent by the client.
  Roles (`USER`, `MODERATOR`, `ADMIN`) are always re-read from the database.
- `/admin` is protected twice: `middleware.ts` and `requireAdmin()` in the page.
- Public by design: reading comments/reviews/sources, party lookup by code, public profiles.
- Rate limits protect login, signup and write endpoints. The limiter is in-memory per server instance;
  use a shared store (e.g. Upstash Redis) for hard global limits.

## Deployment

- **Vercel:** set the env vars above, then run `npm run db:push` once against the production database
  (the build only runs `prisma generate`).
- **Docker:** `docker compose up --build` (the container runs `prisma db push` on start).
- **Render:** see `render.yaml`.

## Before going public

- **Playback sources.** Streams are currently fetched through third-party playback APIs. Use only sources you have
  the rights to, and keep them behind `src/server/providers/playback/`.
- Add tests for the auth/session and rate-limit modules, and run CI on every pull request.
