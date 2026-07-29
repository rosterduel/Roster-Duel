# RosterDuel

Head-to-head sports draft & simulation app. This repo currently holds the
**Phase 1 MVP** build (see `docs/spec` conversation / project brief): single
sport (NBA), blind draft, possession-by-possession sim engine, friend-link
matchmaking only, basic box score + top-5 highlights, web only, no auth.

## Repo layout

```
apps/
  web/              Next.js + TypeScript + Tailwind frontend
  api/               NestJS + TypeScript backend, Prisma ORM (Postgres)
packages/
  sim-engine/         Pure TypeScript simulation engine — standalone,
                       unit-tested, no dependency on web/api
  shared-types/        TypeScript types shared across sim-engine, api, web
scripts/
  seed.ts              Seed script for sample NBA players (added once the
                        data model exists)
docker-compose.yml     Local Postgres + Redis
```

Current status: scaffold only. The sim engine, data model, seed script, and
UI are built in later steps.

## Prerequisites

- Node.js 20+ (developed against Node 22)
- npm 10+
- Docker (for local Postgres + Redis)

## Setup

1. Install dependencies (installs all workspaces from the repo root):

   ```bash
   npm install
   ```

2. Start local Postgres + Redis:

   ```bash
   docker compose up -d
   ```

3. Copy the API environment file and adjust if needed (defaults match
   `docker-compose.yml`):

   ```bash
   cp apps/api/.env.example apps/api/.env
   ```

4. Generate the Prisma client (safe to run even before any models exist):

   ```bash
   npm run prisma:generate -w apps/api
   ```

## Running things

- **API** (NestJS, http://localhost:4000, health check at `/health`):

  ```bash
  npm run dev:api
  ```

- **Web** (Next.js, http://localhost:3000):

  ```bash
  npm run dev:web
  ```

- **Simulation engine tests** (no API/DB required — this is the whole point
  of keeping it an isolated package):

  ```bash
  npm run test:sim
  ```

## Workspace notes

- This is an npm workspaces monorepo — always run `npm install` from the
  repo root, not inside individual `apps/*` or `packages/*` folders.
- `packages/sim-engine` has zero dependency on Postgres, Redis, or either
  app. You should be able to write and run sample-data box-score tests for
  it without Docker running at all.
- Redis is stood up now even though Phase 1 only needs friend-link matches
  (no random queue yet) — it's not wired into the draft-room flow until
  that's built.
