# Known issues

## NBA roster/stats data provenance (Phase 1 real-data import)

**Pre-2010 roster data is sourced from an unofficial/community-compiled
dataset ultimately derived from Basketball-Reference, not a licensed
source** — this should be reviewed/replaced with a licensed data provider
(e.g. SportRadar, Stats Perform) before any public launch or monetization.
The 2010-present dataset is CC0 Public Domain and does not have this issue.

Specifically:
- **2010–2025** (`twenty_tens`/`twenty_twenties` eras): Kaggle "NBA Player
  Stats and Salaries 2010-2025," CC0 Public Domain. Clean to use.
- **Pre-2010** (`sixties`–`two_thousands` eras): a 23-file Basketball-
  Reference-derived bulk dataset (`Player Per Game.csv`, `Advanced.csv`,
  `Team Abbrev.csv`, etc., checked into `data/raw/`) — unofficial/
  community-compiled, not independently licensed.

The two sources are kept strictly separate in `apps/api/scripts/
buildRealNbaSeedData.ts` specifically so this licensing boundary is real,
not just documentation: no 2010+ player's stats or advanced-rate numbers
are ever read from the pre-2010 source, even though that source's raw
files technically extend through 2026.

## Known simplifications in the real-data import pass

- **30-franchise scope, current-identity mapping.** The Team table now
  covers all 30 current NBA franchises (`apps/api/prisma/seedData/
  teams.ts`). Every historical name a franchise has played under maps to
  its CURRENT identity via `FRANCHISE_ALIASES` in `buildRealNbaSeedData.ts`
  (e.g. Seattle SuperSonics-era stints pull in under "Oklahoma City") —
  built from the actual distinct team-name strings in the source data,
  cross-checked against known NBA franchise lineage, not assumed. Two
  genuinely ambiguous cases (the 1988-2002 vs. 2014-present "Charlotte
  Hornets" name, and the team that physically relocated to New Orleans in
  2002) are resolved by matching the NBA's own official franchise-history
  rulings — documented inline in that file. Small, very short-lived
  defunct pre-1960 teams and ABA franchises that folded outright during
  the 1976 merger are simply omitted (no current-day identity to map to).
  Concrete effect: 26 of the 210 possible (team, era) combos end up with
  zero players and simply aren't rollable (e.g. a franchise that didn't
  exist yet under any name in a given decade) — self-consistent with how
  an empty combo already behaves elsewhere in the app, not a bug; verified
  via `checkPositionCoverage.ts` that every one of the other 184 combos
  still has full 5-position coverage.
- **Position eligibility is a default adjacency rule, not per-player
  judgment.** Every player is eligible for their source-data canonical
  position plus its immediate neighbor(s) along the PG-SG-SF-PF-C chain
  (PG: PG/SG; SG: SG/PG/SF; SF: SF/SG/PF; PF: PF/SF/C; C: C/PF) — applied
  uniformly, including the PF/SF crossover. This is data-driven per STINT,
  not fixed per player: e.g. LeBron James's 2020-2025 Lakers stint is
  PG/SG (matching his actual point-forward-listed position in the source
  data for those seasons), while his earlier stints are SF/SG/PF. A
  manually-curated exception list for well-known single-position
  specialists (to remove, e.g., the PF/SF crossover for a handful of
  players) is a deliberate, separate follow-up — not inferred from stats
  in this pass.
- **`shooterReputation` is a flat default, not per-player judgment.** The
  original 84-player pool hand-assigned this (one input to the pre-1980
  3-point estimate) from contemporary scoring reputation. Doesn't scale to
  thousands of real people — every stint ending before 1980 gets
  `shooterReputation: 'average'`, a neutral, documented default rather
  than an inferred guess. (Skin-tone personalization for the GameCast
  sprite has been removed entirely, not defaulted — see "Sprite
  personalization" below.)
- **`personKey` is a normalized name slug, not Basketball-Reference's
  collision-proof player ID.** Needed so a real person who has stints in
  BOTH the pre-2010 and 2010+ sources (a career spanning that boundary,
  e.g. Kobe Bryant) is still recognized as the same person by the "no
  duplicate real person on one roster" rule — the two sources don't share
  a common ID. Verified working (see Phase 1 report): LeBron James's 5
  stints across 3 teams/eras all resolve to one `personKey`. Small,
  accepted risk: two different real players who happen to share an
  identical normalized name would incorrectly collide. Not hit in
  practice for the ~2,919 people imported, but not exhaustively checked
  for every name either.
- **Pre-1974 defensive stats (steals/blocks/turnovers) use a coarser
  estimate than the original hand-curated pool.** Steals/blocks/turnovers
  weren't officially tracked before the 1973-74 season. The original
  12-stint hand-curated pool estimated these per-player from contemporary
  reputation (All-Defensive voting, etc.) — a judgment call that doesn't
  scale to the real-data pool's affected stints. This pass instead uses
  the position-average of REAL (non-estimated) values within the imported
  pool, applied flat to every stint predating that tracking start —
  documented, transparent, but flatter than a real individual signal (e.g.
  Bill Russell's true rebounding/shot-blocking dominance isn't reflected
  in his estimated defensive rate stats, only his real, tracked rpg/ppg).
  Still tagged with the schema's existing `pre_tracking_era` reason.
- **2010+ ast/reb/stl/blk/usage "rate" stats are a per-36-minute proxy,
  not Basketball-Reference's true advanced percentages.** The CC0 dataset
  has only basic per-game box stats, no team-context advanced metrics. To
  keep 2010+ players on a comparable scale to pre-2010 players (important
  since `computeRatings.ts` z-scores every era together in one pool per
  position), the proxy is calibrated against the pre-2010 source's own
  real percentages for 1990-2009 — never against 2010+ player data from
  the other source, to keep the two sources' provenance separate. An
  approximation, not a precision claim.
- **The same defensive-stat/usage-rate fallback also silently backfills
  a small number of other early-era gaps** (`usg_percent` is ~52% missing
  even in the 1970s in the source data, `ast_percent`/`trb_percent` have
  their own partial 1960s gaps) — detected as "computed value came out
  suspiciously exactly 0" rather than tied to one hardcoded year, since
  the actual source gaps don't line up on a single clean boundary.
- **Minimum threshold:** a stint (one person's aggregated seasons with one
  team within one era bucket) is included only if it totals at least 50
  games played, summed across its constituent seasons — the games-played
  reading of the "min 1 season OR min 50 games" instruction, chosen since
  it was the more directly available, unambiguous field in the source
  data (a single literal "games played" column vs. inferring what counts
  as one qualifying "season").

## Sprite personalization: team color, not skin tone

The GameCast sprite (spec 4a) originally personalized each player with a
skin-tone attribute (light/medium/dark). This has been removed entirely —
not defaulted, not approximated, not inferred from any data — since no
player's sprite should be interpretable as a depiction of that real
person's actual race/appearance, positive or negative. There is no
`skinTone` field anywhere in the schema, seed data, API, or frontend
anymore (`SkinTone` enum and `player_stints.skin_tone` column dropped via
migration `20260804000000_drop_skin_tone`).

Sprites are now differentiated by each player's drafted-from team's real
color instead, applied to the jersey portion of the sprite — reusing the
exact same per-player lookup-map data flow the skin-tone mechanism already
had (`GameResultDto.playerJerseyColors`, `playerId -> team colorHex`,
assembled the same way `playerSkinTones` used to be). The body/limb
portions of every sprite use one flat, stylized, clearly-non-skin-toned
gray (`PlayerSprite.tsx`'s `BODY_FILL`) for every player, uniformly.

## Regenerating the real-data seed set

`npx ts-node --transpile-only apps/api/scripts/buildRealNbaSeedData.ts`
(run from `apps/api/`) rebuilds `apps/api/prisma/seedData/nbaStints.ts` and
its sibling `nbaStints.data.json` from `data/raw/*.csv`. The bulk data
lives in the `.json` file, not inline in the `.ts` file — a ~7,500-element
object literal checked structurally against the `SeedPlayerStint[]`
interface exceeds TypeScript's internal complexity limit (`TS2590`) under
both `nest build` and full-type-checking `ts-node`; a JSON import sidesteps
this since it's type-asserted as one blob, not checked element-by-element.
`apps/api/package.json`'s `prisma.seed` script also runs with
`--transpile-only` for the same underlying reason (full type-checking
`prisma/seed.ts`, which transitively imports the JSON-backed data, was
still impractically slow even after the JSON split).
