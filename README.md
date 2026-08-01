# RosterDuel

Head-to-head sports draft & simulation app. This repo currently holds the
**Phase 1 MVP** build (see `docs/spec` conversation / project brief): single
sport (NBA), blind draft, possession-by-possession sim engine, friend-link
matchmaking only, basic box score + top-5 highlights, web only, no auth.

## Repo layout

```
apps/
  web/                 Next.js + TypeScript + Tailwind frontend
    lib/                 API client, client-generated session token, NBA
                          position/stat display config (spec section 8)
    components/          DraftBoard, PlayerCard, GameCastPlayback,
                          BoxScoreTable, HighlightsList, NewspaperRecap
    app/
      page.tsx             Home — create/join a friend match, nav to
                            profile/leaderboard
      match/[roomCode]/    Draft room + results screen (one page, state
                            machine driven by match status)
      profile/              View/change display name, view your own record
      leaderboard/           Top-N by wins (random-matchmaking only)
  api/                 NestJS + TypeScript backend, Prisma ORM (Postgres)
    prisma/
      schema.prisma      Full data model — players/player_stats/
                          player_ratings (spec section 3) plus users/
                          rosters/matches/game_results (spec section 4,
                          adapted for Phase 1 — see "Draft flow &
                          matchmaking" below)
      seedData/
        nbaPlayers.ts     36 hand-curated real NBA players (6/position)
      seed.ts             Seed script (npx prisma db seed)
    scripts/
      verifySimEndToEnd.ts  Standalone script proving DB -> sim-engine works
      tryRecap.ts            Manual live test for recap generation
    src/
      ratings/            Offline rating computation (base/offense/defense)
      sim/                Adapter: Prisma player rows -> sim-engine TeamInput
      recap/               LLM-generated post-game recap (spec section 4b)
      session/             Anonymous session guard (spec: "no auth")
      players/             GET /players — draft-screen player pool
      matches/              Match/roster lifecycle, draft timer + auto-fill,
                             WebSocket gateway for live draft-room updates
      users/                Moderated, unique display names (spec 9a)
      stats/                Record/last-10/leaderboard, random-matchmaking
                             only (spec 9a)
packages/
  sim-engine/          Pure TypeScript simulation engine — standalone,
                       unit-tested, no dependency on web/api
  shared-types/        TypeScript types shared across sim-engine, api, web
docker-compose.yml     Local Postgres + Redis
```

Current status: **the full Phase 1 loop works end-to-end** — sim engine
(with real overtime periods, GameCast animation data, and a Game MVP
formula), the full data model (players/ratings + users/rosters/matches/
game_results), a post-game recap generation service with a proper
newspaper-masthead UI, the draft UI / friend-link matchmaking / results
screen, and moderated display names + leaderboard/stats plumbing (spec
9a) are all built and tested. See "Draft flow & matchmaking" and
"Accounts, moderation & leaderboards" below for what's in Phase 1 scope
vs. deferred.

### Highlight animation data (spec section 4a)

The results screen's animated GameCast-style playback needs more than
written highlight text — it needs to know *what kind* of play happened and
roughly *where*, so the frontend can pick a simple schematic animation.
`PossessionEvent` and `Highlight` (in `packages/sim-engine/src/types.ts`)
carry three fields for this, computed at simulation time in `possession.ts`
(not inferred after the fact from existing data):

- **`playType`** — a frontend-friendly category (`three_pointer_made`,
  `steal`, `block`, `offensive_rebound`, etc.), derived from data the sim
  already tracks. No standalone `defensive_rebound` type: an unblocked miss
  is already fully described by its shot type, since who rebounds it
  doesn't change what animation plays. `offensive_rebound` does get its own
  type because the possession continuing is a genuinely different
  game-flow event, not just a missed-shot flavor.
- **`startLocation` / `endLocation`** — a small `CourtZone` enum (`paint`,
  `mid_range`, `three_left/right/top`, `free_throw_line`, `backcourt`), not
  real coordinates. Shot zones are randomized at simulation time (uniform
  across the three 3PT zones; paint favored ~60/40 over mid-range for 2PT
  attempts, a rough nod to real NBA shot profiles, not a rigorous model).
  Every shot's ball ends up at `paint` (the hoop) whether it's made or
  missed; only the start zone varies.

NBA-only for now, matching Phase 1 scope — NFL's equivalent (yard line +
direction) isn't built since NFL itself is Phase 2. Run
`npm run demo:sim -- <seed>` and look at the `[playType] start -> end` line
under each highlight to see this data directly.

### Game MVP formula (spec section 4b)

`GameResult.mvp` (computed in `packages/sim-engine/src/mvp.ts`) is an
explicit, documented formula rather than "top scorer" — the spec calls out
that raw points alone would let a garbage-time stat-padder beat someone who
hit the actual game-deciding shots. It blends two components, each
min-max normalized (0-1) across every player in the box score before being
combined:

- **Box-score composite** — an original weighting (not a reproduction of
  Game Score/PER/BPM/any named metric; see "Player data sourcing" below for
  why that distinction matters here): points, plus rebounds/assists
  weighted above 1x to value playmaking beyond scoring, plus steals/blocks
  weighted higher still since they're rarer defensive events, minus
  turnovers and missed shots at a moderate penalty.
- **Leverage component** — credit for authoring the game's biggest
  win-probability swings (from the same top-5 highlights section 5.5
  already generates). Because leverage is stored signed relative to the
  offense team, credit is re-signed relative to *the credited player's own
  team* before counting it — a defender who causes a highlight-worthy
  steal or block gets positive credit, and a costly turnover doesn't
  double-penalize its own committer (it's already reflected in the
  box-score composite).

The two normalized components are blended 60% box score / 40% leverage
(`MVP_BOX_SCORE_WEIGHT` / `MVP_LEVERAGE_WEIGHT` in `constants.ts`) — box
score is the primary signal (a full game's stat line), leverage is a
meaningful but secondary boost for clutch moments. Exact weighting is
called out in the spec as an implementation decision; see the doc comment
on `computeMvp()` for the full reasoning. Run `npm run demo:sim -- <seed>`
and look at the `GAME MVP` line to see it end-to-end.

## Post-game recap ("newspaper" feature, spec section 4b)

`apps/api/src/recap/` generates the headline + written recap article shown
under the folded newspaper UI element (`apps/web/components/NewspaperRecap.tsx`).
Two design decisions here were made by the user, not chosen by me:

- **LLM-generated, not templated** — recap writing is a well-scoped
  structured-writing task, so a cost-efficient model is used rather than a
  top-tier one (`claude-haiku-4-5`, see `RECAP_MODEL` in
  `anthropicRecapGenerator.ts`).
- **Grounded strictly in simulated data** — `buildRecapPrompt.ts` builds
  the prompt from only the final score, full box score, and the same
  top-5 highlight data section 5.5 already produces, plus the
  already-computed `GameMvp` (the model narrates *why* that player was the
  MVP, it doesn't pick who). The system prompt explicitly forbids
  inventing players, plays, or stats not present in that data.

**Architecture**: `RecapGenerator` (`types.ts`) is a one-method interface
(`generate(input) -> {headline, article}`), so nothing in the app depends
directly on the Anthropic SDK except `anthropicRecapGenerator.ts` itself.
`generateGameRecap.ts` adapts a full sim-engine `GameResult` into a prompt
request — that's the one call site the rest of the app should use.
Structured output uses the SDK's `client.messages.parse()` with a Zod
schema (`recapSchema.ts`), not free-form text parsing.

**Testing**: `buildRecapPrompt.spec.ts`, `generateGameRecap.spec.ts`, and
`validateRecapGrounding.spec.ts` run with no network access at all, via
`createFakeRecapGenerator()` (`testUtils.ts`) — a stand-in `RecapGenerator`
that returns a fixed response. **A live Anthropic API key is only needed
to actually call the real API** — none of the automated test suite
requires one.

**Consistency with the highlights list and GameCast animation**: there is
no separate recap-generation step that recomputes highlights or re-derives
plays — `buildRecapPrompt.ts` is handed the exact same `GameResult.highlights`
array (the same top-5, same order, same `playType`/`startLocation`/
`endLocation` data) that both the written highlights list and the section
4a GameCast animation consume. All three views read from one array
produced once by `simulateGame()`, so the plays they show can't drift out
of sync with each other by construction — there's nothing that recomputes
"what happened" three separate times.

What *isn't* guaranteed by construction is that the LLM's free-text prose
stays faithful to that data — the system prompt instructs it to, but a
prompt instruction isn't a guarantee. `validateRecapGrounding.ts` is a
deterministic check run after generation that catches the two most
concrete, checkable failure modes: the recap never actually naming the
Game MVP, and the recap name-dropping a real player (checked against the
wider 36-player seed catalog, not just this game's 12) who isn't actually
in this game's box score — the most plausible hallucination for a
sports-writing model that has certainly seen these real names in training.
It does **not** catch a fabricated stat line for a real rostered player, an
invented play, or a wrong score — reliably catching those would need a
second model call to grade the first one's output, which doubles cost and
latency; not worth it for Phase 1 on top of the prompt-level constraint
already in place. `try:recap` runs this check and prints any issues found
on every live call, so this is easy to revisit if spot-checks turn up
hallucinations the current net misses.

**⚠️ Needs a real API key to run for real.** Nothing in this repo has an
`ANTHROPIC_API_KEY` configured — set one in `apps/api/.env` (see
`.env.example`) to actually generate a recap. To try it end-to-end with a
sample simulated game (no database required):

```bash
ANTHROPIC_API_KEY=sk-... npm run try:recap -w apps/api
```

Get a key at https://console.anthropic.com/settings/keys. Cost is small
and usage-based (a fraction of a cent per ~600-word recap on Haiku), not a
fixed monthly expense — see spec section 4b for the cost reasoning this
was already weighed against.

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

6. (Optional) copy the web app's env file — the default already points at
   `http://localhost:4000`, so this is only needed if you're running the
   API somewhere else:

   ```bash
   cp apps/web/.env.local.example apps/web/.env.local
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

- **Playing a full match locally**: with both `dev:api` and `dev:web`
  running (and the DB migrated + seeded), open http://localhost:3000,
  click "Create match" to get a room link, then open that link in a
  second browser window (or a private/incognito window — since the
  session token lives in `localStorage`, two windows of the *same*
  non-private profile would share a session and both act as the same
  player). Draft both sides and lock them to see the sim run and the
  results screen render. This exact flow (two isolated browser contexts,
  full draft → lock → simulate → results) was verified with Playwright
  during development — see the "Draft flow & matchmaking" section above
  for how blind draft and async timing are enforced server-side.

## Draft flow & matchmaking (spec section 4)

`apps/api/prisma/schema.prisma` now models the full data model — spec
section 3 (`players`/`player_stats`/`player_ratings`) plus section 4
(`users`/`rosters`/`matches`/`game_results`), adapted for Phase 1 scope.
Full reasoning is in the schema file's header comment; summary:

- **No auth ("anonymous sessions")**: the browser generates its own random
  UUID (`crypto.randomUUID()`, `apps/web/lib/session.ts`), persists it in
  `localStorage`, and sends it as `X-Session-Token` on every API call.
  `SessionGuard` (`apps/api/src/session/session.guard.ts`) lazily upserts a
  `User` row the first time a token is seen — there's no signup step. This
  is **not a security boundary**: anyone who learns another session's token
  can act as that session. Fine for a casual friend-match MVP; would need
  real auth before any real launch. It also sidesteps cross-origin cookie
  friction between the web app (`:3000`) and API (`:4000`) in local dev.
- **Friend-link matchmaking only**: creating a match generates a short,
  shareable `roomCode` (`apps/api/src/matches/roomCode.ts` — 6 characters,
  excludes visually-ambiguous letters/digits) immediately; a second
  visitor joining that link claims the other roster slot. No random-queue
  matchmaking in Phase 1 (per the build phase list), so `matches` doesn't
  need queue state.
- **Shared, uncontested player pool**: the spec's draft flow says picks
  aren't streamed live but never describes a shared pool where a pick
  removes that player for the opponent. Both drafters can independently
  draft the same real player — the skill is in roster construction, not
  who clicks faster. `autoFillRosterSlots` (`draftAutoFill.ts`) only avoids
  a player filling two slots on the *same* roster.
- **Blind draft, enforced server-side**: `GET /matches/:roomCode` only
  ever returns *your own* roster's slots; the opponent's `slots` are
  withheld until **both** rosters are locked, at which point the "blind"
  period is over and both are revealed together — matching spec section 9
  ("server only receives the final locked roster").
- **Draft timer, no background worker**: each roster gets a
  `draftDeadline` at creation/join time. Rather than run a cron job or
  queue worker to enforce it, expiry is checked *lazily* — on every
  `GET /matches/:roomCode` (and on save/lock attempts), any roster past its
  deadline is auto-locked right then using `autoFillRosterSlots` (highest
  `base_rating` available player per empty position). This means an
  expired-but-unvisited match won't resolve until someone (either player)
  loads the room again — an acceptable tradeoff for Phase 1 MVP scope
  instead of standing up a scheduler.
- **Real-time updates are a nice-to-have, not the source of truth**: spec
  section 4 explicitly allows drafting asynchronously ("not required to be
  online simultaneously"). `MatchesGateway` (Socket.IO) pushes
  `opponent:locked` / `match:complete` / `recap:ready` events to instant
  refresh a client that's currently online, but the web app also polls
  `GET /matches/:roomCode` every few seconds as the reliable fallback for
  a client that reconnects later having missed the event entirely.
- **Single game only**: `matches.games_to_play` is kept in the schema (per
  spec) but hardcoded to `1` — best-of-N series (spec 5.6) is out of scope
  for Phase 1.
- **Recap generation is wired into the match lifecycle**: once both
  rosters lock and the sim runs, if `ANTHROPIC_API_KEY` is configured the
  recap generates automatically (fire-and-forget — a slow/failed recap
  never blocks the game result itself from being ready). If no key is
  configured, the game result is still fully usable; the newspaper UI
  (`apps/web/components/NewspaperRecap.tsx`) shows a masthead-styled
  "Generate recap" prompt that hits `POST /matches/:roomCode/recap`
  instead — clicking it plays the same unfold animation used once a recap
  exists, but as a loading state while the request is in flight (a
  `max-height`-driven collapse/expand on a region below an always-visible
  masthead, so body text is revealed rather than squashed by scaling).

## Accounts, moderation & leaderboards (spec section 9a)

- **Still no real auth.** The anonymous session token (`X-Session-Token`,
  client-generated, stored in `localStorage`) already persists across
  matches on the same device/browser — that already satisfies "persistent
  identity beyond a single match." What's new here is a user-*chosen*
  display name (previously only ever auto-generated) and the stats to
  actually show on it. Clearing browser storage or switching devices still
  loses continuity — an inherent limitation of skipping real auth, not
  something fixed in this round.
- **`users.display_name` is now `@unique`.** The auto-generated default
  (`"Player 4821"`) is uniqueness-safe via retry-on-collision
  (`session.guard.ts`), the same pattern `roomCode` generation already
  used. A user can change it via `PATCH /users/me/display-name`
  (`apps/api/src/users/`), which runs `validateDisplayName.ts` — a pure,
  independently-testable function checking length/charset, then real
  profanity moderation via **`leo-profanity`** (an established,
  actively-maintained, multi-language wordlist library — not a hand-rolled
  filter, per the spec's explicit requirement since minors may use the
  app) — before hitting the DB, where the unique constraint is the final
  backstop against a race.
- **Leaderboard eligibility is real, the queue that feeds it isn't yet.**
  `matches.match_type` (`friend_link` | `random_matchmaking`) drives
  `apps/api/src/stats/` — both `GET /stats/me` (your own record + last-10)
  and `GET /leaderboard` filter strictly on `matchType: 'random_matchmaking'`
  and `status: 'complete'`, per the spec's reasoning: a friend link is
  trivially self-matchable, so only matches where you don't control the
  opponent count toward a public record. Every match created so far is
  `friend_link` (set explicitly in `matches.service.ts`), so these
  endpoints correctly return empty/zero data right now — **the
  random-matchmaking queue itself is a deliberately deferred scope line**,
  agreed on explicitly rather than assumed: the leaderboard/moderation
  plumbing needed to exist regardless of when the queue lands, but the
  queue (presence-free pairing, same async draft model as friend matches)
  is its own follow-up. The frontend (`apps/web/app/profile`,
  `apps/web/app/leaderboard`) shows an explicit "no ranked games yet"
  state rather than an error for this reason.
- **Stats are computed on read**, not maintained as persisted running
  counters (`apps/api/src/stats/recordStats.ts` — pure functions,
  independently tested, fed by a Prisma query in `stats.service.ts`).
  Simpler and can't drift out of sync; revisit only if this becomes a
  measurable perf issue at real scale.

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
  it imports the built `dist/`, not the TS source directly. `dist/` is
  gitignored (it's a build artifact), so a root `postinstall` hook runs
  `npm run build -w packages/sim-engine` automatically after every
  `npm install`. If you ever see `Cannot find module '@roster-duel/sim-engine'`
  or a cascade of `implicitly has an 'any' type` errors from anything that
  imports it (`apps/api/scripts/verifySimEndToEnd.ts`,
  `apps/api/src/sim/toTeamInput.ts`), that means `dist/` is missing or stale
  — after changing sim-engine source, re-run
  `npm run build -w packages/sim-engine` (or just `npm install` again) to
  refresh it.
- Redis is stood up now even though Phase 1 only needs friend-link matches
  (no random queue yet) — it's not wired into the draft-room flow until
  that's built.
