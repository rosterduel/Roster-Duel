# RosterDuel

Head-to-head sports draft & simulation app. This repo currently holds the
**Phase 1 MVP** build (see `docs/spec` conversation / project brief): single
sport (NBA), blind draft, possession-by-possession sim engine, friend-link
matchmaking only, basic box score + top-5 highlights, web only, no auth.

## Repo layout

```
apps/
  web/                 Next.js + TypeScript + Tailwind frontend
  api/                 NestJS + TypeScript backend, Prisma ORM (Postgres)
    prisma/
      schema.prisma      Data model — players/player_stats/player_ratings
                          (spec section 3 only; see "Data model scope" below)
      seedData/
        nbaPlayers.ts     36 hand-curated real NBA players (6/position)
      seed.ts             Seed script (npx prisma db seed)
    scripts/
      verifySimEndToEnd.ts  Standalone script proving DB -> sim-engine works
    src/
      ratings/            Offline rating computation (base/offense/defense)
      sim/                Adapter: Prisma player rows -> sim-engine TeamInput
packages/
  sim-engine/          Pure TypeScript simulation engine — standalone,
                       unit-tested, no dependency on web/api
  shared-types/        TypeScript types shared across sim-engine, api, web
docker-compose.yml     Local Postgres + Redis
```

Current status: scaffold, sim engine (with real overtime periods), and the
players/player_stats/player_ratings data model + seed script are built and
tested. Draft UI, matchmaking, and the users/rosters/matches/game_results
tables land next.

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

4. Apply the database migration and generate the Prisma client:

   ```bash
   npm run prisma:migrate -w apps/api
   ```

5. Seed the database with the Phase 1 NBA player pool:

   ```bash
   npm run db:seed -w apps/api
   ```

   Safe to re-run — upserts by `(sport, name)`, won't duplicate players.

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

- **API tests** (rating computation + DB-adapter unit tests, no live DB
  required — fixtures only):

  ```bash
  npm run test:api
  ```

- **Sim engine demo** (two illustrative sample rosters, no DB):

  ```bash
  npm run demo:sim -- 42        # fixed seed
  npm run demo:sim              # random game
  ```

- **End-to-end verification** (real seeded Postgres data through the sim
  engine — requires the DB to be migrated and seeded first):

  ```bash
  npm run verify:sim -w apps/api -- 42
  ```

## Data model scope

`apps/api/prisma/schema.prisma` currently models **only spec section 3**
(`players` / `player_stats` / `player_ratings`). Section 4's tables
(`users` / `rosters` / `matches` / `game_results`) are deliberately not
built yet — they depend on draft-flow and friend-link-matchmaking design
choices (anonymous session identity, room-code shape, WebSocket draft-room
state) that haven't been made. Building them now would mean guessing at a
schema before the feature that drives its shape exists; they land with the
draft UI / matchmaking step.

## Player data sourcing

The Phase 1 seed pool (`apps/api/prisma/seedData/nbaPlayers.ts`) is **36
real NBA players, hand-curated directly in code** — not scraped, not pulled
from a bulk third-party dataset or a paid stats API. Per this project's
ground rules (open/free data sources only, no scraping sites whose ToS
might prohibit it), and given the spec's own legal notes flag exactly that
risk, the seed set uses widely-known, publicly-cited career statistics
(facts, not copyrightable expression) entered by hand — the same approach
already used for the sim-engine's demo rosters, just a wider pool. The
still-active players' numbers (Curry, LeBron, Durant, Harden, Giannis,
Jokić) were spot-checked against web search since those are moving targets;
retired players' career averages are long-settled facts. None of it is
verified line-by-line against a canonical source — treat it as MVP
placeholder data. The real pipeline (spec section 6: an offline batch job
against a real open dataset) should replace this pool before any real
launch.

Composite ratings (`base_rating`/`offense_rating`/`defense_rating`) are
**computed**, not hand-entered — see `apps/api/src/ratings/computeRatings.ts`
for the position-adjusted z-score formula and why it's original rather than
a reproduction of BPM/PER/any named proprietary metric (spec section 10 is
explicit that reusing those names, even for a similar-in-spirit
calculation, isn't OK). `clutch_modifier` defaults to a neutral `1.0` for
every seed player — the crunch-time mechanic that would consume it (spec
section 5.4) is intentionally deferred to Phase 2, so there's currently no
dataset or reason to compute a non-neutral value.

## Workspace notes

- This is an npm workspaces monorepo — always run `npm install` from the
  repo root, not inside individual `apps/*` or `packages/*` folders.
- `packages/sim-engine` has zero dependency on Postgres, Redis, or either
  app. You should be able to write and run sample-data box-score tests for
  it without Docker running at all.
- `apps/api` depends on `@roster-duel/sim-engine` as a workspace package —
  after changing sim-engine source, run `npm run build -w packages/sim-engine`
  so apps/api picks up the change (it imports the built `dist/`, not the
  TS source directly).
- Redis is stood up now even though Phase 1 only needs friend-link matches
  (no random queue yet) — it's not wired into the draft-room flow until
  that's built.
