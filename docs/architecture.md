# Architecture

## Layers

```
Browser (features/*, components/*)
   │  fetch /api/...  (session cookie sent automatically)
   ▼
src/app/api/**/route.ts      thin HTTP handlers: parse input → getActor() → call logic → JSON
   ▼
src/server/services/*        business logic (AniList sync, anime cache, ...)
src/server/providers/*       external data: metadata/ (AniList, Jikan), playback/
   ▼
src/server/db                Prisma client → PostgreSQL
```

Rules: client components never import from `src/server`. Routes do not trust anything about *who* is calling except
the signed cookie.

## Request identity

1. `POST /api/auth/login|signup` verifies credentials and sets `bankai_session` (`server/auth/cookie.ts`).
2. Any route calls `getActor(req, claimedUsername?)` (`server/auth/actor.ts`):
   - `AUTH_SECRET` set → identity from the verified cookie; a username sent by the client must match it.
   - `AUTH_SECRET` missing → legacy mode (claimed username, role forced to `USER`) so the site keeps working.
3. `middleware.ts` blocks `/admin` and `/api/admin/*` unless the cookie says `ADMIN`; `requireAdmin()` re-checks the
   role in the database.

## Data

- `Anime` is a cache table filled on demand from AniList (`server/services/ensure-anime.ts`). It is not seeded.
- User-owned rows: `ListEntry`, `WatchHistory`, `Review`, `Comment`, `Favorite`, `WatchParty`, `EpisodeSource`.
- `Announcement` is shown on the site and listed in `/admin`.

## Adding things

- **New API route:** `src/app/api/<name>/route.ts`; call `getActor()` for anything private; add `rateLimit()` for writes.
- **New feature UI:** `src/features/<name>/components/`, imported by a page in `src/app/`.
- **New env var:** add it to `src/lib/env.ts` and `.env.example`.
- **New admin tool:** under `src/app/admin/`, start the page with `await requireAdmin()`.
