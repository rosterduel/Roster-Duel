/**
 * Phase 1 team+era stint pool (spec section 4c) — supersedes the original
 * 36-player career-aggregate seed set entirely (see schema.prisma's header
 * for why this was a breaking rebuild, not a migration).
 *
 * 14 team+era combinations, 6 players each (one per NBA position slot),
 * covering all 7 spec-defined era buckets at least once. Combos were
 * chosen for being real, recognizable "stacked" rosters (title teams or
 * iconic stretches) so a randomly-assigned team+era reliably produces a
 * fun, legible pool rather than an obscure one — not an attempt at
 * exhaustive team/era coverage (real NBA history has far more playable
 * combinations than 14; this is a bounded MVP seed, same spirit as the
 * original 36-player pool).
 *
 * Two REAL cross-stint duplicates are deliberately included, matching the
 * spec's own worked example almost exactly:
 * - LeBron James: Cleveland/two_thousands (his rookie stint) AND
 *   Miami/twenty_tens (the Big Three years) — the spec's own example.
 * - Ray Allen: Boston/two_thousands AND Miami/twenty_tens (he really did
 *   play for both, in that order) — a second real demonstration of the
 *   same "no duplicate real person across stints" rule (personKey ties
 *   them together; see schema.prisma).
 * - Karl Malone: Utah/nineties AND Los Angeles/two_thousands — a third
 *   real case (he signed with the Lakers for his final season).
 *
 * WHY hand-curated: same reasoning and ground rules as the original pool
 * (see git history) — no scraping, no bulk third-party dataset, no paid
 * API. These are widely-known, publicly-cited stint-year statistics
 * (facts, not copyrightable expression) entered by hand.
 *
 * Accuracy caveat: illustrative, approximate per-stint averages compiled
 * from general public knowledge, not verified line-by-line against a
 * canonical source — treat as MVP placeholder data, same as before.
 *
 * "Stint years" approximate each player's actual tenure with that specific
 * team within the named decade, not the full decade uniformly — a bench
 * piece who joined a dynasty three years in has stint years reflecting
 * that, not the whole era bucket.
 *
 * Rate stats (astRate/rebRate/stlRate/blkRate/threePtRate) do double duty
 * exactly as before: they feed both offline rating computation
 * (computeRatings.ts) and, unchanged, the sim-engine's per-trip
 * attribution weights.
 *
 * Estimated stats (spec section 10, "Estimating stats from pre-tracking
 * eras") — exactly the 12 stints below in the two combos that predate the
 * 1973-74 season (Boston/sixties, New York/seventies) carry estimates
 * rather than sourced figures, for two DIFFERENT reasons that seed.ts
 * flags with a distinct `estimateReason` on the affected player_stint_stats
 * rows (so the frontend can show a distinct tooltip per spec 10 for each):
 *
 * - `pre_tracking_era` (spg/bpg/tovPg/stlRate/blkRate): steals, blocks, and
 *   turnovers weren't official NBA statistics before the 1973-74 season —
 *   these ARE real historical quantities, just unrecorded. The numbers
 *   below are reasonable recovery estimates built from signals that DO
 *   exist for this era: All-Defensive Team voting (started 1968-69, well
 *   before steals/blocks were tracked) and reputation for the era's
 *   well-known defensive standouts (Russell, Frazier, DeBusschere,
 *   Havlicek all carry contemporary reputations as elite defenders and are
 *   estimated above the era's average accordingly); position-typical
 *   involvement for everyone else, landing near a league-average rate for
 *   their role rather than either extreme.
 * - `hypothetical_pre_three_point` (threePtPct/threePtRate): there was no
 *   3-point line at all before the 1979-80 season, so this is a genuinely
 *   hypothetical "how would this player likely have shot from three,"
 *   computed by `estimatePreThreePointStats()`
 *   (apps/api/src/ratings/estimatePreThreePointStats.ts) from FT% (primary
 *   signal), position-adjusted FG% (secondary signal), and each player's
 *   `shooterReputation` below (qualitative nudge — hand-assigned per
 *   spec 10's third signal, e.g. Sam Jones/Walt Frazier/Bill Bradley
 *   carried contemporary reputations as sharp outside shooters and are
 *   tagged 'high'; Bill Russell famously had no outside shot at all and is
 *   tagged 'low'). The `threePtPct`/`threePtRate` literals below are left
 *   at their old placeholder `0` for these 12 stints — seed.ts overrides
 *   them with the computed estimate at seed time (see PRE_THREE_POINT_LINE_
 *   CUTOFF_YEAR there), so the estimator function is the actual source of
 *   truth, not a hand-copied number that could drift out of sync with it.
 *   Explicitly NOT sourced from shot-location data (doesn't exist pre-1980)
 *   or NBA 2K ratings (proprietary editorial judgment, off-limits per spec
 *   section 10) — see the estimator's own doc comment.
 *
 * Position eligibility (spec section 4f) — `eligiblePositions` replaces
 * the old single `position` field entirely:
 * - Most players list a single real position, matching what was previously
 *   their sole `position` value.
 * - A subset of genuinely well-established multi-position players list 2
 *   (rarely 3) — e.g. LeBron James is `['SF','PF','SG']` per the spec's
 *   own worked example, Draymond Green and Giannis Antetokounmpo are
 *   PF/C-and-more given their extensively documented "positionless"
 *   defensive/small-ball roles. These are a judgment call from general
 *   basketball knowledge, deliberately conservative — not added for role
 *   players whose versatility isn't well-established.
 * - `eligiblePositions[0]` is the CANONICAL position for two purposes: (1)
 *   rating peer-grouping in computeRatings.ts (a player is z-scored against
 *   same-canonical-position peers, not every position they're eligible
 *   for), and (2) documentation/display convenience. Order the array with
 *   the most representative real position first.
 * - `'6MAN'` never appears inside `eligiblePositions` — 6th Man is a ROSTER
 *   SLOT requirement (a bench-scorer role), not a real basketball position
 *   a player can be "eligible" for (spec 4f: the 6th Man pool is entirely
 *   unfiltered by position). The 14 players previously tagged with the
 *   placeholder `position: '6MAN'` (one per combo, whoever filled that
 *   slot when this pool was first built) have their REAL position(s)
 *   below instead — e.g. Manu Ginóbili is `['SG','SF']`, not `['6MAN']`.
 * - Side effect, expected not a bug: because peer groups are now bigger
 *   (no more separate 14-player "6MAN" bucket; those players redistribute
 *   into real-position groups) and slightly different in composition,
 *   every player's computed base/offense/defense rating shifts a small
 *   amount versus the pre-4f numbers, purely from re-grouping — no stat
 *   inputs changed for these players.
 */

export type NbaPosition = 'PG' | 'SG' | 'SF' | 'PF' | 'C' | '6MAN';
/** Real basketball positions — the only values allowed inside `eligiblePositions`. Never includes '6MAN' (see header comment). */
export type RealNbaPosition = Exclude<NbaPosition, '6MAN'>;
export type Era = 'sixties' | 'seventies' | 'eighties' | 'nineties' | 'two_thousands' | 'twenty_tens' | 'twenty_twenties';
export type SkinTone = 'light' | 'medium' | 'dark';
export type ShooterReputation = 'low' | 'average' | 'high';

export interface SeedStintStats {
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  tovPg: number;
  fgPct: number;
  threePtPct: number;
  /** Share of this player's FGA that are 3-point attempts. 0 for any stint before the 1979-80 introduction of the 3-point line. */
  threePtRate: number;
  ftPct: number;
  astRate: number;
  rebRate: number;
  stlRate: number;
  blkRate: number;
}

export interface SeedPlayerStint {
  /** Stable identity shared across a real person's multiple stints — see schema.prisma's PlayerStint doc comment. */
  personKey: string;
  name: string;
  /** Real position(s) this player is eligible to fill a draft slot at (spec 4f) — index 0 is canonical, see header comment. Never includes '6MAN'. */
  eligiblePositions: RealNbaPosition[];
  /** Must match a name in NBA_SEED_TEAMS. */
  team: string;
  era: Era;
  stintStartYear: number;
  stintEndYear: number;
  skinTone: SkinTone;
  stats: SeedStintStats;
  /** Goes directly to player_stint_ratings.usage_rate — hand-authored like the rest, not computed. */
  usageRate: number;
  /**
   * Only meaningful (and required by seed.ts) for stints before the 1979-80
   * introduction of the 3-point line — the qualitative "scoring role /
   * reputation" nudge in estimatePreThreePointStats()'s methodology (spec
   * section 10, signal 3). Omitted for every post-1980 stint, where real
   * 3PT numbers exist and no estimate is computed.
   */
  shooterReputation?: ShooterReputation;
}

export const NBA_SEED_STINTS: SeedPlayerStint[] = [
  // ==================== Boston, 1960s (Celtics dynasty) ====================
  {
    personKey: 'bob_cousy', name: 'Bob Cousy', eligiblePositions: ['PG'], team: 'Boston', era: 'sixties',
    stintStartYear: 1957, stintEndYear: 1963, skinTone: 'light',
    stats: { ppg: 18.5, rpg: 4.9, apg: 8.9, spg: 1.6, bpg: 0.2, tovPg: 3.8, fgPct: 0.373, threePtPct: 0, threePtRate: 0, ftPct: 0.803, astRate: 0.36, rebRate: 0.10, stlRate: 0.020, blkRate: 0.004 },
    usageRate: 0.25,
    shooterReputation: 'average', // slick passer/ball-handler by reputation, not specifically known for outside shooting
  },
  {
    personKey: 'sam_jones', name: 'Sam Jones', eligiblePositions: ['SG'], team: 'Boston', era: 'sixties',
    stintStartYear: 1957, stintEndYear: 1969, skinTone: 'dark',
    stats: { ppg: 18.9, rpg: 4.9, apg: 2.5, spg: 1.2, bpg: 0.3, tovPg: 2.8, fgPct: 0.458, threePtPct: 0, threePtRate: 0, ftPct: 0.800, astRate: 0.12, rebRate: 0.10, stlRate: 0.015, blkRate: 0.006 },
    usageRate: 0.23,
    shooterReputation: 'high', // widely cited as one of the best pure/clutch shooters of his era ("Mr. Clutch")
  },
  {
    personKey: 'john_havlicek', name: 'John Havlicek', eligiblePositions: ['SF', 'SG'], team: 'Boston', era: 'sixties',
    stintStartYear: 1962, stintEndYear: 1969, skinTone: 'light',
    stats: { ppg: 20.1, rpg: 6.3, apg: 4.1, spg: 1.5, bpg: 0.4, tovPg: 2.9, fgPct: 0.439, threePtPct: 0, threePtRate: 0, ftPct: 0.806, astRate: 0.18, rebRate: 0.12, stlRate: 0.018, blkRate: 0.008 },
    usageRate: 0.24,
    shooterReputation: 'average', // versatile, high-volume all-around scorer, not specifically a deep-range specialist
  },
  {
    personKey: 'tom_heinsohn', name: 'Tom Heinsohn', eligiblePositions: ['PF', 'SF'], team: 'Boston', era: 'sixties',
    stintStartYear: 1957, stintEndYear: 1965, skinTone: 'light',
    stats: { ppg: 18.6, rpg: 8.8, apg: 2.0, spg: 1.0, bpg: 0.5, tovPg: 3.0, fgPct: 0.404, threePtPct: 0, threePtRate: 0, ftPct: 0.766, astRate: 0.10, rebRate: 0.17, stlRate: 0.014, blkRate: 0.012 },
    usageRate: 0.23,
    shooterReputation: 'average', // solid role-player scorer, no strong outside-shooting reputation either way
  },
  {
    personKey: 'bill_russell', name: 'Bill Russell', eligiblePositions: ['C'], team: 'Boston', era: 'sixties',
    stintStartYear: 1957, stintEndYear: 1969, skinTone: 'dark',
    stats: { ppg: 15.1, rpg: 22.5, apg: 4.3, spg: 1.5, bpg: 2.5, tovPg: 3.2, fgPct: 0.440, threePtPct: 0, threePtRate: 0, ftPct: 0.561, astRate: 0.17, rebRate: 0.28, stlRate: 0.015, blkRate: 0.055 },
    usageRate: 0.20,
    shooterReputation: 'low', // famously poor free-throw shooter with essentially no outside game — a pure rim/defensive center
  },
  {
    // Real position(s), not the old '6MAN' placeholder (spec 4f) — Ramsey is
    // generally described as a forward/guard swingman.
    personKey: 'frank_ramsey', name: 'Frank Ramsey', eligiblePositions: ['SF', 'SG'], team: 'Boston', era: 'sixties',
    stintStartYear: 1957, stintEndYear: 1964, skinTone: 'light',
    stats: { ppg: 13.4, rpg: 5.5, apg: 1.9, spg: 0.8, bpg: 0.3, tovPg: 2.2, fgPct: 0.422, threePtPct: 0, threePtRate: 0, ftPct: 0.800, astRate: 0.11, rebRate: 0.12, stlRate: 0.012, blkRate: 0.008 },
    usageRate: 0.19,
    shooterReputation: 'average', // reliable early "sixth man" bench scorer, no particular deep-shooting reputation
  },

  // ==================== New York, 1970s (Knicks champions) ====================
  {
    personKey: 'walt_frazier', name: 'Walt Frazier', eligiblePositions: ['PG', 'SG'], team: 'New York', era: 'seventies',
    stintStartYear: 1970, stintEndYear: 1974, skinTone: 'dark',
    stats: { ppg: 20.7, rpg: 6.4, apg: 6.2, spg: 1.9, bpg: 0.3, tovPg: 3.0, fgPct: 0.506, threePtPct: 0, threePtRate: 0, ftPct: 0.786, astRate: 0.28, rebRate: 0.12, stlRate: 0.022, blkRate: 0.006 },
    usageRate: 0.24,
    shooterReputation: 'high', // stylish, smooth-shooting guard reputation ("Clyde") on top of elite defensive reputation
  },
  {
    personKey: 'dick_barnett', name: 'Dick Barnett', eligiblePositions: ['SG'], team: 'New York', era: 'seventies',
    stintStartYear: 1970, stintEndYear: 1973, skinTone: 'dark',
    stats: { ppg: 13.3, rpg: 2.7, apg: 2.5, spg: 1.0, bpg: 0.2, tovPg: 2.0, fgPct: 0.461, threePtPct: 0, threePtRate: 0, ftPct: 0.789, astRate: 0.13, rebRate: 0.07, stlRate: 0.015, blkRate: 0.004 },
    usageRate: 0.18,
    shooterReputation: 'average', // known for an unorthodox effective jumper, but mostly a close/mid-range shot, not deep range
  },
  {
    personKey: 'bill_bradley', name: 'Bill Bradley', eligiblePositions: ['SF'], team: 'New York', era: 'seventies',
    stintStartYear: 1970, stintEndYear: 1974, skinTone: 'light',
    stats: { ppg: 12.4, rpg: 3.6, apg: 3.4, spg: 1.0, bpg: 0.2, tovPg: 2.1, fgPct: 0.471, threePtPct: 0, threePtRate: 0, ftPct: 0.827, astRate: 0.16, rebRate: 0.08, stlRate: 0.015, blkRate: 0.004 },
    usageRate: 0.16,
    shooterReputation: 'high', // widely cited as an excellent long-range set shooter dating back to his Princeton days
  },
  {
    personKey: 'dave_debusschere', name: 'Dave DeBusschere', eligiblePositions: ['PF'], team: 'New York', era: 'seventies',
    stintStartYear: 1970, stintEndYear: 1974, skinTone: 'light',
    stats: { ppg: 16.7, rpg: 11.0, apg: 2.6, spg: 1.1, bpg: 0.5, tovPg: 2.4, fgPct: 0.448, threePtPct: 0, threePtRate: 0, ftPct: 0.747, astRate: 0.12, rebRate: 0.20, stlRate: 0.016, blkRate: 0.010 },
    usageRate: 0.21,
    shooterReputation: 'average', // a reliable mid-range jumper for a power forward of his era, not a specialist reputation
  },
  {
    personKey: 'willis_reed', name: 'Willis Reed', eligiblePositions: ['C', 'PF'], team: 'New York', era: 'seventies',
    stintStartYear: 1970, stintEndYear: 1973, skinTone: 'dark',
    stats: { ppg: 17.9, rpg: 12.6, apg: 2.1, spg: 0.9, bpg: 1.0, tovPg: 2.6, fgPct: 0.476, threePtPct: 0, threePtRate: 0, ftPct: 0.747, astRate: 0.10, rebRate: 0.22, stlRate: 0.013, blkRate: 0.022 },
    usageRate: 0.22,
    shooterReputation: 'average', // a good face-up jumper for a center of his era, but not a "sharpshooter" reputation
  },
  {
    // Real position(s), not the old '6MAN' placeholder (spec 4f) — "Earl the
    // Pearl" was a shooting guard who also ran point.
    personKey: 'earl_monroe', name: 'Earl Monroe', eligiblePositions: ['SG', 'PG'], team: 'New York', era: 'seventies',
    stintStartYear: 1971, stintEndYear: 1974, skinTone: 'dark',
    stats: { ppg: 15.5, rpg: 3.0, apg: 3.5, spg: 1.0, bpg: 0.2, tovPg: 2.4, fgPct: 0.449, threePtPct: 0, threePtRate: 0, ftPct: 0.797, astRate: 0.17, rebRate: 0.07, stlRate: 0.015, blkRate: 0.005 },
    usageRate: 0.20,
    shooterReputation: 'average', // creative, flashy scoring reputation ("Earl the Pearl"), but built on shot craft, not deep range
  },

  // ==================== Philadelphia, 1980s (Dr. J / Moses Malone) ====================
  {
    personKey: 'maurice_cheeks', name: 'Maurice Cheeks', eligiblePositions: ['PG'], team: 'Philadelphia', era: 'eighties',
    stintStartYear: 1980, stintEndYear: 1986, skinTone: 'dark',
    stats: { ppg: 12.5, rpg: 3.4, apg: 6.5, spg: 2.2, bpg: 0.4, tovPg: 2.2, fgPct: 0.527, threePtPct: 0.200, threePtRate: 0.01, ftPct: 0.784, astRate: 0.30, rebRate: 0.08, stlRate: 0.034, blkRate: 0.008 },
    usageRate: 0.17,
  },
  {
    personKey: 'andrew_toney', name: 'Andrew Toney', eligiblePositions: ['SG'], team: 'Philadelphia', era: 'eighties',
    stintStartYear: 1980, stintEndYear: 1986, skinTone: 'dark',
    stats: { ppg: 17.9, rpg: 2.9, apg: 4.4, spg: 1.2, bpg: 0.2, tovPg: 2.5, fgPct: 0.482, threePtPct: 0.310, threePtRate: 0.05, ftPct: 0.862, astRate: 0.18, rebRate: 0.06, stlRate: 0.016, blkRate: 0.003 },
    usageRate: 0.24,
  },
  {
    personKey: 'julius_erving', name: 'Julius Erving', eligiblePositions: ['SF'], team: 'Philadelphia', era: 'eighties',
    stintStartYear: 1980, stintEndYear: 1986, skinTone: 'dark',
    stats: { ppg: 22.8, rpg: 6.7, apg: 3.7, spg: 1.7, bpg: 1.5, tovPg: 3.0, fgPct: 0.519, threePtPct: 0.224, threePtRate: 0.02, ftPct: 0.777, astRate: 0.17, rebRate: 0.12, stlRate: 0.023, blkRate: 0.026 },
    usageRate: 0.27,
  },
  {
    personKey: 'charles_barkley', name: 'Charles Barkley', eligiblePositions: ['PF', 'SF'], team: 'Philadelphia', era: 'eighties',
    stintStartYear: 1984, stintEndYear: 1986, skinTone: 'dark',
    stats: { ppg: 16.9, rpg: 10.5, apg: 3.5, spg: 1.6, bpg: 0.7, tovPg: 3.0, fgPct: 0.545, threePtPct: 0.200, threePtRate: 0.02, ftPct: 0.679, astRate: 0.15, rebRate: 0.20, stlRate: 0.022, blkRate: 0.014 },
    usageRate: 0.24,
  },
  {
    personKey: 'moses_malone', name: 'Moses Malone', eligiblePositions: ['C', 'PF'], team: 'Philadelphia', era: 'eighties',
    stintStartYear: 1982, stintEndYear: 1986, skinTone: 'dark',
    stats: { ppg: 24.3, rpg: 13.7, apg: 1.5, spg: 1.0, bpg: 1.3, tovPg: 3.0, fgPct: 0.490, threePtPct: 0, threePtRate: 0, ftPct: 0.762, astRate: 0.07, rebRate: 0.27, stlRate: 0.014, blkRate: 0.022 },
    usageRate: 0.27,
  },
  {
    // Real position(s), not the old '6MAN' placeholder (spec 4f) — a
    // defensive-minded forward.
    personKey: 'bobby_jones', name: 'Bobby Jones', eligiblePositions: ['SF', 'PF'], team: 'Philadelphia', era: 'eighties',
    stintStartYear: 1980, stintEndYear: 1986, skinTone: 'light',
    stats: { ppg: 10.9, rpg: 4.7, apg: 2.1, spg: 1.3, bpg: 1.0, tovPg: 1.5, fgPct: 0.544, threePtPct: 0, threePtRate: 0, ftPct: 0.793, astRate: 0.11, rebRate: 0.10, stlRate: 0.022, blkRate: 0.022 },
    usageRate: 0.15,
  },

  // ==================== Los Angeles, 1980s (Showtime Lakers) ====================
  {
    personKey: 'magic_johnson', name: 'Magic Johnson', eligiblePositions: ['PG', 'SF'], team: 'Los Angeles', era: 'eighties',
    stintStartYear: 1980, stintEndYear: 1989, skinTone: 'dark',
    stats: { ppg: 19.0, rpg: 7.5, apg: 11.5, spg: 1.9, bpg: 0.4, tovPg: 3.7, fgPct: 0.524, threePtPct: 0.224, threePtRate: 0.04, ftPct: 0.831, astRate: 0.43, rebRate: 0.14, stlRate: 0.024, blkRate: 0.010 },
    usageRate: 0.23,
  },
  {
    personKey: 'byron_scott', name: 'Byron Scott', eligiblePositions: ['SG'], team: 'Los Angeles', era: 'eighties',
    stintStartYear: 1983, stintEndYear: 1989, skinTone: 'dark',
    stats: { ppg: 15.8, rpg: 3.1, apg: 2.9, spg: 1.1, bpg: 0.2, tovPg: 1.9, fgPct: 0.491, threePtPct: 0.353, threePtRate: 0.15, ftPct: 0.820, astRate: 0.12, rebRate: 0.06, stlRate: 0.015, blkRate: 0.003 },
    usageRate: 0.19,
  },
  {
    personKey: 'james_worthy', name: 'James Worthy', eligiblePositions: ['SF'], team: 'Los Angeles', era: 'eighties',
    stintStartYear: 1982, stintEndYear: 1989, skinTone: 'dark',
    stats: { ppg: 18.6, rpg: 5.5, apg: 3.0, spg: 1.1, bpg: 0.6, tovPg: 2.4, fgPct: 0.552, threePtPct: 0.231, threePtRate: 0.02, ftPct: 0.766, astRate: 0.13, rebRate: 0.10, stlRate: 0.015, blkRate: 0.012 },
    usageRate: 0.22,
  },
  {
    personKey: 'ac_green', name: 'A.C. Green', eligiblePositions: ['PF'], team: 'Los Angeles', era: 'eighties',
    stintStartYear: 1985, stintEndYear: 1989, skinTone: 'dark',
    stats: { ppg: 11.4, rpg: 7.7, apg: 1.2, spg: 0.9, bpg: 0.4, tovPg: 1.4, fgPct: 0.524, threePtPct: 0.000, threePtRate: 0.00, ftPct: 0.759, astRate: 0.06, rebRate: 0.16, stlRate: 0.015, blkRate: 0.009 },
    usageRate: 0.16,
  },
  {
    personKey: 'kareem_abdul_jabbar', name: 'Kareem Abdul-Jabbar', eligiblePositions: ['C'], team: 'Los Angeles', era: 'eighties',
    stintStartYear: 1980, stintEndYear: 1989, skinTone: 'dark',
    stats: { ppg: 21.4, rpg: 8.4, apg: 3.0, spg: 0.7, bpg: 2.1, tovPg: 2.7, fgPct: 0.578, threePtPct: 0.200, threePtRate: 0.00, ftPct: 0.749, astRate: 0.13, rebRate: 0.18, stlRate: 0.010, blkRate: 0.050 },
    usageRate: 0.25,
  },
  {
    // Real position(s), not the old '6MAN' placeholder (spec 4f) — defensive
    // guard/wing.
    personKey: 'michael_cooper', name: 'Michael Cooper', eligiblePositions: ['SG', 'SF'], team: 'Los Angeles', era: 'eighties',
    stintStartYear: 1980, stintEndYear: 1989, skinTone: 'dark',
    stats: { ppg: 10.2, rpg: 3.1, apg: 3.6, spg: 1.3, bpg: 0.5, tovPg: 1.7, fgPct: 0.448, threePtPct: 0.327, threePtRate: 0.20, ftPct: 0.756, astRate: 0.17, rebRate: 0.07, stlRate: 0.022, blkRate: 0.012 },
    usageRate: 0.16,
  },

  // ==================== Chicago, 1990s (Bulls dynasty) ====================
  {
    personKey: 'ron_harper', name: 'Ron Harper', eligiblePositions: ['PG', 'SG'], team: 'Chicago', era: 'nineties',
    stintStartYear: 1994, stintEndYear: 1998, skinTone: 'dark',
    stats: { ppg: 7.4, rpg: 3.4, apg: 3.0, spg: 1.0, bpg: 0.4, tovPg: 1.3, fgPct: 0.440, threePtPct: 0.309, threePtRate: 0.18, ftPct: 0.755, astRate: 0.17, rebRate: 0.08, stlRate: 0.017, blkRate: 0.010 },
    usageRate: 0.14,
  },
  {
    personKey: 'michael_jordan', name: 'Michael Jordan', eligiblePositions: ['SG'], team: 'Chicago', era: 'nineties',
    stintStartYear: 1990, stintEndYear: 1998, skinTone: 'dark',
    stats: { ppg: 30.6, rpg: 6.1, apg: 4.9, spg: 2.3, bpg: 0.7, tovPg: 2.6, fgPct: 0.502, threePtPct: 0.323, threePtRate: 0.10, ftPct: 0.836, astRate: 0.21, rebRate: 0.11, stlRate: 0.031, blkRate: 0.015 },
    usageRate: 0.34,
  },
  {
    personKey: 'scottie_pippen', name: 'Scottie Pippen', eligiblePositions: ['SF', 'PF'], team: 'Chicago', era: 'nineties',
    stintStartYear: 1990, stintEndYear: 1998, skinTone: 'dark',
    stats: { ppg: 19.4, rpg: 7.0, apg: 5.7, spg: 2.1, bpg: 0.8, tovPg: 2.7, fgPct: 0.485, threePtPct: 0.316, threePtRate: 0.18, ftPct: 0.696, astRate: 0.25, rebRate: 0.13, stlRate: 0.029, blkRate: 0.016 },
    usageRate: 0.24,
  },
  {
    personKey: 'dennis_rodman', name: 'Dennis Rodman', eligiblePositions: ['PF', 'C'], team: 'Chicago', era: 'nineties',
    stintStartYear: 1995, stintEndYear: 1998, skinTone: 'dark',
    stats: { ppg: 5.5, rpg: 16.1, apg: 2.8, spg: 0.6, bpg: 0.3, tovPg: 1.3, fgPct: 0.404, threePtPct: 0.231, threePtRate: 0.04, ftPct: 0.582, astRate: 0.11, rebRate: 0.30, stlRate: 0.011, blkRate: 0.007 },
    usageRate: 0.10,
  },
  {
    personKey: 'luc_longley', name: 'Luc Longley', eligiblePositions: ['C'], team: 'Chicago', era: 'nineties',
    stintStartYear: 1994, stintEndYear: 1998, skinTone: 'light',
    stats: { ppg: 9.1, rpg: 5.1, apg: 1.8, spg: 0.4, bpg: 0.9, tovPg: 1.5, fgPct: 0.499, threePtPct: 0.000, threePtRate: 0.00, ftPct: 0.703, astRate: 0.10, rebRate: 0.13, stlRate: 0.008, blkRate: 0.022 },
    usageRate: 0.16,
  },
  {
    // Real position(s), not the old '6MAN' placeholder (spec 4f) — a
    // versatile "point forward."
    personKey: 'toni_kukoc', name: 'Toni Kukoč', eligiblePositions: ['SF', 'PF'], team: 'Chicago', era: 'nineties',
    stintStartYear: 1990, stintEndYear: 1998, skinTone: 'light',
    stats: { ppg: 12.9, rpg: 4.0, apg: 3.7, spg: 1.0, bpg: 0.4, tovPg: 2.0, fgPct: 0.464, threePtPct: 0.347, threePtRate: 0.30, ftPct: 0.800, astRate: 0.19, rebRate: 0.09, stlRate: 0.017, blkRate: 0.009 },
    usageRate: 0.19,
  },

  // ==================== Utah, 1990s (Stockton-Malone) ====================
  {
    personKey: 'john_stockton', name: 'John Stockton', eligiblePositions: ['PG'], team: 'Utah', era: 'nineties',
    stintStartYear: 1990, stintEndYear: 1999, skinTone: 'light',
    stats: { ppg: 15.4, rpg: 2.8, apg: 11.6, spg: 2.3, bpg: 0.2, tovPg: 2.7, fgPct: 0.519, threePtPct: 0.400, threePtRate: 0.16, ftPct: 0.833, astRate: 0.46, rebRate: 0.06, stlRate: 0.034, blkRate: 0.005 },
    usageRate: 0.19,
  },
  {
    personKey: 'jeff_hornacek', name: 'Jeff Hornacek', eligiblePositions: ['SG', 'PG'], team: 'Utah', era: 'nineties',
    stintStartYear: 1994, stintEndYear: 1999, skinTone: 'light',
    stats: { ppg: 14.5, rpg: 3.5, apg: 4.6, spg: 1.0, bpg: 0.2, tovPg: 1.8, fgPct: 0.492, threePtPct: 0.432, threePtRate: 0.35, ftPct: 0.878, astRate: 0.19, rebRate: 0.07, stlRate: 0.014, blkRate: 0.004 },
    usageRate: 0.18,
  },
  {
    personKey: 'bryon_russell', name: 'Bryon Russell', eligiblePositions: ['SF'], team: 'Utah', era: 'nineties',
    stintStartYear: 1994, stintEndYear: 1999, skinTone: 'dark',
    stats: { ppg: 10.5, rpg: 4.0, apg: 1.5, spg: 0.9, bpg: 0.3, tovPg: 1.4, fgPct: 0.441, threePtPct: 0.359, threePtRate: 0.35, ftPct: 0.759, astRate: 0.09, rebRate: 0.09, stlRate: 0.015, blkRate: 0.008 },
    usageRate: 0.16,
  },
  {
    personKey: 'karl_malone', name: 'Karl Malone', eligiblePositions: ['PF'], team: 'Utah', era: 'nineties',
    stintStartYear: 1990, stintEndYear: 1999, skinTone: 'dark',
    stats: { ppg: 27.2, rpg: 10.5, apg: 3.9, spg: 1.4, bpg: 0.9, tovPg: 2.9, fgPct: 0.541, threePtPct: 0.231, threePtRate: 0.01, ftPct: 0.741, astRate: 0.13, rebRate: 0.19, stlRate: 0.017, blkRate: 0.019 },
    usageRate: 0.28,
  },
  {
    personKey: 'greg_ostertag', name: 'Greg Ostertag', eligiblePositions: ['C'], team: 'Utah', era: 'nineties',
    stintStartYear: 1996, stintEndYear: 1999, skinTone: 'light',
    stats: { ppg: 5.5, rpg: 6.4, apg: 0.8, spg: 0.4, bpg: 1.8, tovPg: 1.5, fgPct: 0.500, threePtPct: 0.000, threePtRate: 0.00, ftPct: 0.559, astRate: 0.06, rebRate: 0.16, stlRate: 0.009, blkRate: 0.046 },
    usageRate: 0.12,
  },
  {
    // Real position(s), not the old '6MAN' placeholder (spec 4f) — a
    // reserve forward/center big.
    personKey: 'antoine_carr', name: 'Antoine Carr', eligiblePositions: ['PF', 'C'], team: 'Utah', era: 'nineties',
    stintStartYear: 1994, stintEndYear: 1999, skinTone: 'dark',
    stats: { ppg: 9.5, rpg: 3.2, apg: 0.9, spg: 0.5, bpg: 0.5, tovPg: 1.1, fgPct: 0.486, threePtPct: 0.217, threePtRate: 0.05, ftPct: 0.738, astRate: 0.07, rebRate: 0.09, stlRate: 0.012, blkRate: 0.015 },
    usageRate: 0.17,
  },

  // ==================== San Antonio, 2000s (Duncan-era Spurs) ====================
  {
    personKey: 'tony_parker', name: 'Tony Parker', eligiblePositions: ['PG'], team: 'San Antonio', era: 'two_thousands',
    stintStartYear: 2001, stintEndYear: 2007, skinTone: 'light',
    stats: { ppg: 16.7, rpg: 2.9, apg: 5.8, spg: 0.9, bpg: 0.1, tovPg: 2.3, fgPct: 0.481, threePtPct: 0.327, threePtRate: 0.10, ftPct: 0.750, astRate: 0.27, rebRate: 0.06, stlRate: 0.014, blkRate: 0.002 },
    usageRate: 0.23,
  },
  {
    personKey: 'manu_ginobili', name: 'Manu Ginóbili', eligiblePositions: ['SG', 'SF'], team: 'San Antonio', era: 'two_thousands',
    stintStartYear: 2002, stintEndYear: 2007, skinTone: 'light',
    stats: { ppg: 15.6, rpg: 4.2, apg: 4.0, spg: 1.5, bpg: 0.3, tovPg: 2.4, fgPct: 0.461, threePtPct: 0.376, threePtRate: 0.35, ftPct: 0.830, astRate: 0.23, rebRate: 0.10, stlRate: 0.024, blkRate: 0.010 },
    usageRate: 0.22,
  },
  {
    personKey: 'bruce_bowen', name: 'Bruce Bowen', eligiblePositions: ['SF'], team: 'San Antonio', era: 'two_thousands',
    stintStartYear: 2001, stintEndYear: 2007, skinTone: 'dark',
    stats: { ppg: 6.7, rpg: 2.9, apg: 1.3, spg: 1.1, bpg: 0.3, tovPg: 0.8, fgPct: 0.430, threePtPct: 0.393, threePtRate: 0.55, ftPct: 0.790, astRate: 0.08, rebRate: 0.07, stlRate: 0.017, blkRate: 0.008 },
    usageRate: 0.10,
  },
  {
    personKey: 'tim_duncan', name: 'Tim Duncan', eligiblePositions: ['PF', 'C'], team: 'San Antonio', era: 'two_thousands',
    stintStartYear: 2000, stintEndYear: 2007, skinTone: 'dark',
    stats: { ppg: 22.3, rpg: 12.2, apg: 3.3, spg: 0.8, bpg: 2.5, tovPg: 2.9, fgPct: 0.502, threePtPct: 0.143, threePtRate: 0.01, ftPct: 0.680, astRate: 0.16, rebRate: 0.24, stlRate: 0.014, blkRate: 0.057 },
    usageRate: 0.27,
  },
  {
    personKey: 'david_robinson', name: 'David Robinson', eligiblePositions: ['C'], team: 'San Antonio', era: 'two_thousands',
    stintStartYear: 2000, stintEndYear: 2003, skinTone: 'dark',
    stats: { ppg: 11.9, rpg: 8.6, apg: 1.6, spg: 0.7, bpg: 1.9, tovPg: 1.8, fgPct: 0.511, threePtPct: 0.000, threePtRate: 0.00, ftPct: 0.729, astRate: 0.10, rebRate: 0.21, stlRate: 0.014, blkRate: 0.046 },
    usageRate: 0.19,
  },
  {
    // Real position(s), not the old '6MAN' placeholder (spec 4f) — "Big
    // Shot Rob," a stretch forward.
    personKey: 'robert_horry', name: 'Robert Horry', eligiblePositions: ['PF', 'SF'], team: 'San Antonio', era: 'two_thousands',
    stintStartYear: 2003, stintEndYear: 2007, skinTone: 'dark',
    stats: { ppg: 6.9, rpg: 4.5, apg: 2.1, spg: 0.8, bpg: 0.6, tovPg: 1.1, fgPct: 0.410, threePtPct: 0.353, threePtRate: 0.40, ftPct: 0.750, astRate: 0.13, rebRate: 0.11, stlRate: 0.014, blkRate: 0.013 },
    usageRate: 0.12,
  },

  // ==================== Los Angeles, 2000s (Kobe, w/ and w/o Shaq) ====================
  {
    personKey: 'derek_fisher', name: 'Derek Fisher', eligiblePositions: ['PG'], team: 'Los Angeles', era: 'two_thousands',
    stintStartYear: 2000, stintEndYear: 2009, skinTone: 'dark',
    stats: { ppg: 9.7, rpg: 2.2, apg: 2.8, spg: 0.8, bpg: 0.1, tovPg: 1.5, fgPct: 0.420, threePtPct: 0.373, threePtRate: 0.40, ftPct: 0.820, astRate: 0.16, rebRate: 0.06, stlRate: 0.014, blkRate: 0.002 },
    usageRate: 0.16,
  },
  {
    personKey: 'kobe_bryant', name: 'Kobe Bryant', eligiblePositions: ['SG', 'SF'], team: 'Los Angeles', era: 'two_thousands',
    stintStartYear: 2000, stintEndYear: 2009, skinTone: 'dark',
    stats: { ppg: 27.7, rpg: 5.5, apg: 4.9, spg: 1.5, bpg: 0.5, tovPg: 3.1, fgPct: 0.454, threePtPct: 0.339, threePtRate: 0.22, ftPct: 0.840, astRate: 0.21, rebRate: 0.09, stlRate: 0.019, blkRate: 0.011 },
    usageRate: 0.33,
  },
  {
    personKey: 'rick_fox', name: 'Rick Fox', eligiblePositions: ['SF'], team: 'Los Angeles', era: 'two_thousands',
    stintStartYear: 2000, stintEndYear: 2003, skinTone: 'dark',
    stats: { ppg: 9.6, rpg: 4.4, apg: 2.8, spg: 1.0, bpg: 0.3, tovPg: 1.6, fgPct: 0.435, threePtPct: 0.353, threePtRate: 0.30, ftPct: 0.762, astRate: 0.13, rebRate: 0.09, stlRate: 0.017, blkRate: 0.008 },
    usageRate: 0.16,
  },
  {
    personKey: 'karl_malone', name: 'Karl Malone', eligiblePositions: ['PF'], team: 'Los Angeles', era: 'two_thousands',
    stintStartYear: 2003, stintEndYear: 2004, skinTone: 'dark',
    stats: { ppg: 13.2, rpg: 8.7, apg: 3.6, spg: 0.9, bpg: 0.6, tovPg: 2.4, fgPct: 0.500, threePtPct: 0.000, threePtRate: 0.00, ftPct: 0.789, astRate: 0.13, rebRate: 0.18, stlRate: 0.012, blkRate: 0.012 },
    usageRate: 0.19,
  },
  {
    personKey: 'shaquille_oneal', name: 'Shaquille O’Neal', eligiblePositions: ['C'], team: 'Los Angeles', era: 'two_thousands',
    stintStartYear: 2000, stintEndYear: 2004, skinTone: 'dark',
    stats: { ppg: 27.5, rpg: 11.5, apg: 3.0, spg: 0.6, bpg: 2.4, tovPg: 2.8, fgPct: 0.579, threePtPct: 0.000, threePtRate: 0.00, ftPct: 0.551, astRate: 0.12, rebRate: 0.25, stlRate: 0.009, blkRate: 0.058 },
    usageRate: 0.32,
  },
  {
    // Real position(s), not the old '6MAN' placeholder (spec 4f) — a
    // versatile forward.
    personKey: 'lamar_odom', name: 'Lamar Odom', eligiblePositions: ['PF', 'SF'], team: 'Los Angeles', era: 'two_thousands',
    stintStartYear: 2004, stintEndYear: 2009, skinTone: 'dark',
    stats: { ppg: 14.8, rpg: 9.0, apg: 3.4, spg: 0.9, bpg: 0.7, tovPg: 2.1, fgPct: 0.481, threePtPct: 0.310, threePtRate: 0.10, ftPct: 0.705, astRate: 0.16, rebRate: 0.18, stlRate: 0.014, blkRate: 0.015 },
    usageRate: 0.20,
  },

  // ==================== Boston, 2000s (Big Three) ====================
  {
    personKey: 'rajon_rondo', name: 'Rajon Rondo', eligiblePositions: ['PG'], team: 'Boston', era: 'two_thousands',
    stintStartYear: 2007, stintEndYear: 2010, skinTone: 'dark',
    stats: { ppg: 8.5, rpg: 4.2, apg: 6.1, spg: 1.7, bpg: 0.2, tovPg: 2.3, fgPct: 0.488, threePtPct: 0.231, threePtRate: 0.04, ftPct: 0.627, astRate: 0.32, rebRate: 0.09, stlRate: 0.026, blkRate: 0.005 },
    usageRate: 0.16,
  },
  {
    personKey: 'ray_allen', name: 'Ray Allen', eligiblePositions: ['SG'], team: 'Boston', era: 'two_thousands',
    stintStartYear: 2007, stintEndYear: 2010, skinTone: 'dark',
    stats: { ppg: 17.4, rpg: 3.3, apg: 3.1, spg: 0.8, bpg: 0.2, tovPg: 1.7, fgPct: 0.477, threePtPct: 0.415, threePtRate: 0.50, ftPct: 0.913, astRate: 0.14, rebRate: 0.07, stlRate: 0.012, blkRate: 0.003 },
    usageRate: 0.20,
  },
  {
    personKey: 'paul_pierce', name: 'Paul Pierce', eligiblePositions: ['SF'], team: 'Boston', era: 'two_thousands',
    stintStartYear: 2007, stintEndYear: 2010, skinTone: 'dark',
    stats: { ppg: 20.4, rpg: 5.4, apg: 3.9, spg: 1.3, bpg: 0.4, tovPg: 2.6, fgPct: 0.459, threePtPct: 0.396, threePtRate: 0.30, ftPct: 0.827, astRate: 0.18, rebRate: 0.10, stlRate: 0.018, blkRate: 0.009 },
    usageRate: 0.25,
  },
  {
    personKey: 'kevin_garnett', name: 'Kevin Garnett', eligiblePositions: ['PF', 'C'], team: 'Boston', era: 'two_thousands',
    stintStartYear: 2007, stintEndYear: 2010, skinTone: 'dark',
    stats: { ppg: 18.7, rpg: 8.5, apg: 3.4, spg: 1.2, bpg: 1.2, tovPg: 2.0, fgPct: 0.530, threePtPct: 0.000, threePtRate: 0.00, ftPct: 0.823, astRate: 0.16, rebRate: 0.17, stlRate: 0.017, blkRate: 0.033 },
    usageRate: 0.23,
  },
  {
    personKey: 'kendrick_perkins', name: 'Kendrick Perkins', eligiblePositions: ['C'], team: 'Boston', era: 'two_thousands',
    stintStartYear: 2007, stintEndYear: 2010, skinTone: 'dark',
    stats: { ppg: 6.9, rpg: 6.1, apg: 0.6, spg: 0.4, bpg: 1.0, tovPg: 1.3, fgPct: 0.567, threePtPct: 0.000, threePtRate: 0.00, ftPct: 0.611, astRate: 0.05, rebRate: 0.15, stlRate: 0.009, blkRate: 0.028 },
    usageRate: 0.13,
  },
  {
    // Real position(s), not the old '6MAN' placeholder (spec 4f) — a
    // forward/center reserve big.
    personKey: 'glen_davis', name: 'Glen Davis', eligiblePositions: ['PF', 'C'], team: 'Boston', era: 'two_thousands',
    stintStartYear: 2007, stintEndYear: 2010, skinTone: 'dark',
    stats: { ppg: 8.9, rpg: 4.6, apg: 0.9, spg: 0.4, bpg: 0.2, tovPg: 1.3, fgPct: 0.478, threePtPct: 0.091, threePtRate: 0.02, ftPct: 0.719, astRate: 0.07, rebRate: 0.12, stlRate: 0.010, blkRate: 0.008 },
    usageRate: 0.17,
  },

  // ==================== Detroit, 2000s (Bad Boys 2.0, 2004 champs) ====================
  {
    personKey: 'chauncey_billups', name: 'Chauncey Billups', eligiblePositions: ['PG'], team: 'Detroit', era: 'two_thousands',
    stintStartYear: 2003, stintEndYear: 2006, skinTone: 'dark',
    stats: { ppg: 18.2, rpg: 3.0, apg: 6.7, spg: 1.2, bpg: 0.2, tovPg: 2.5, fgPct: 0.430, threePtPct: 0.404, threePtRate: 0.35, ftPct: 0.895, astRate: 0.28, rebRate: 0.07, stlRate: 0.015, blkRate: 0.003 },
    usageRate: 0.22,
  },
  {
    personKey: 'richard_hamilton', name: 'Richard Hamilton', eligiblePositions: ['SG'], team: 'Detroit', era: 'two_thousands',
    stintStartYear: 2003, stintEndYear: 2006, skinTone: 'dark',
    stats: { ppg: 19.9, rpg: 3.5, apg: 3.7, spg: 1.1, bpg: 0.1, tovPg: 2.0, fgPct: 0.462, threePtPct: 0.333, threePtRate: 0.10, ftPct: 0.864, astRate: 0.16, rebRate: 0.07, stlRate: 0.014, blkRate: 0.002 },
    usageRate: 0.24,
  },
  {
    personKey: 'tayshaun_prince', name: 'Tayshaun Prince', eligiblePositions: ['SF'], team: 'Detroit', era: 'two_thousands',
    stintStartYear: 2003, stintEndYear: 2006, skinTone: 'dark',
    stats: { ppg: 13.7, rpg: 5.6, apg: 2.9, spg: 1.1, bpg: 0.9, tovPg: 1.6, fgPct: 0.459, threePtPct: 0.353, threePtRate: 0.15, ftPct: 0.789, astRate: 0.12, rebRate: 0.10, stlRate: 0.017, blkRate: 0.019 },
    usageRate: 0.17,
  },
  {
    personKey: 'rasheed_wallace', name: 'Rasheed Wallace', eligiblePositions: ['PF', 'C'], team: 'Detroit', era: 'two_thousands',
    stintStartYear: 2004, stintEndYear: 2006, skinTone: 'dark',
    stats: { ppg: 14.4, rpg: 6.9, apg: 1.9, spg: 0.8, bpg: 1.5, tovPg: 1.9, fgPct: 0.451, threePtPct: 0.378, threePtRate: 0.30, ftPct: 0.751, astRate: 0.11, rebRate: 0.16, stlRate: 0.014, blkRate: 0.033 },
    usageRate: 0.19,
  },
  {
    personKey: 'ben_wallace', name: 'Ben Wallace', eligiblePositions: ['C'], team: 'Detroit', era: 'two_thousands',
    stintStartYear: 2003, stintEndYear: 2006, skinTone: 'dark',
    stats: { ppg: 8.0, rpg: 12.4, apg: 1.6, spg: 1.6, bpg: 2.2, tovPg: 1.7, fgPct: 0.500, threePtPct: 0.000, threePtRate: 0.00, ftPct: 0.420, astRate: 0.09, rebRate: 0.28, stlRate: 0.026, blkRate: 0.053 },
    usageRate: 0.13,
  },
  {
    // Real position(s), not the old '6MAN' placeholder (spec 4f) — a
    // forward/center reserve big.
    personKey: 'antonio_mcdyess', name: 'Antonio McDyess', eligiblePositions: ['PF', 'C'], team: 'Detroit', era: 'two_thousands',
    stintStartYear: 2004, stintEndYear: 2006, skinTone: 'dark',
    stats: { ppg: 8.0, rpg: 6.2, apg: 0.7, spg: 0.4, bpg: 0.8, tovPg: 1.1, fgPct: 0.478, threePtPct: 0.000, threePtRate: 0.00, ftPct: 0.733, astRate: 0.05, rebRate: 0.17, stlRate: 0.010, blkRate: 0.022 },
    usageRate: 0.15,
  },

  // ==================== Cleveland, 2000s (LeBron's rookie stint) ====================
  {
    personKey: 'mo_williams', name: 'Mo Williams', eligiblePositions: ['PG'], team: 'Cleveland', era: 'two_thousands',
    stintStartYear: 2008, stintEndYear: 2009, skinTone: 'dark',
    stats: { ppg: 17.1, rpg: 3.3, apg: 4.5, spg: 0.9, bpg: 0.1, tovPg: 2.4, fgPct: 0.458, threePtPct: 0.441, threePtRate: 0.40, ftPct: 0.880, astRate: 0.20, rebRate: 0.07, stlRate: 0.014, blkRate: 0.002 },
    usageRate: 0.21,
  },
  {
    personKey: 'larry_hughes', name: 'Larry Hughes', eligiblePositions: ['SG', 'PG'], team: 'Cleveland', era: 'two_thousands',
    stintStartYear: 2005, stintEndYear: 2008, skinTone: 'dark',
    stats: { ppg: 14.9, rpg: 3.7, apg: 3.6, spg: 1.8, bpg: 0.4, tovPg: 2.4, fgPct: 0.409, threePtPct: 0.323, threePtRate: 0.20, ftPct: 0.756, astRate: 0.17, rebRate: 0.08, stlRate: 0.028, blkRate: 0.008 },
    usageRate: 0.21,
  },
  {
    // The spec's own worked example (section 4f) — LeBron is eligible at
    // SF (canonical), PF, and SG, both stints (a stable property of the
    // real person, not stint-dependent).
    personKey: 'lebron_james', name: 'LeBron James', eligiblePositions: ['SF', 'PF', 'SG'], team: 'Cleveland', era: 'two_thousands',
    stintStartYear: 2003, stintEndYear: 2009, skinTone: 'dark',
    // fgPct corrected from an earlier hand-typed 0.476 to 0.470 after a
    // user-prompted spot-check against real season splits (2003-04 through
    // 2008-09: .417/.472/.480/.476/.484/.489, unweighted average ~.4697) —
    // a true volume-weighted average would need full FGM/FGA per season,
    // which wasn't retrievable (basketball-reference/landofbasketball both
    // block direct fetches); the two seasons whose exact attempt volumes
    // WERE retrievable (2003-04: 1492 FGA; 2008-09: 1613 FGA) don't differ
    // wildly enough to expect the weighted figure to land far from this.
    stats: { ppg: 27.8, rpg: 7.0, apg: 6.9, spg: 1.7, bpg: 0.7, tovPg: 3.4, fgPct: 0.470, threePtPct: 0.327, threePtRate: 0.20, ftPct: 0.733, astRate: 0.32, rebRate: 0.13, stlRate: 0.021, blkRate: 0.014 },
    usageRate: 0.32,
  },
  {
    personKey: 'drew_gooden', name: 'Drew Gooden', eligiblePositions: ['PF', 'C'], team: 'Cleveland', era: 'two_thousands',
    stintStartYear: 2004, stintEndYear: 2008, skinTone: 'dark',
    stats: { ppg: 13.2, rpg: 8.5, apg: 1.2, spg: 0.7, bpg: 0.6, tovPg: 1.8, fgPct: 0.482, threePtPct: 0.167, threePtRate: 0.02, ftPct: 0.705, astRate: 0.07, rebRate: 0.18, stlRate: 0.013, blkRate: 0.013 },
    usageRate: 0.18,
  },
  {
    personKey: 'zydrunas_ilgauskas', name: 'Zydrunas Ilgauskas', eligiblePositions: ['C'], team: 'Cleveland', era: 'two_thousands',
    stintStartYear: 2003, stintEndYear: 2009, skinTone: 'light',
    stats: { ppg: 13.5, rpg: 7.9, apg: 1.2, spg: 0.4, bpg: 1.4, tovPg: 1.9, fgPct: 0.488, threePtPct: 0.000, threePtRate: 0.00, ftPct: 0.786, astRate: 0.08, rebRate: 0.19, stlRate: 0.008, blkRate: 0.033 },
    usageRate: 0.19,
  },
  {
    // Real position(s), not the old '6MAN' placeholder (spec 4f) — a
    // hustle center/forward big.
    personKey: 'anderson_varejao', name: 'Anderson Varejão', eligiblePositions: ['C', 'PF'], team: 'Cleveland', era: 'two_thousands',
    stintStartYear: 2004, stintEndYear: 2009, skinTone: 'light',
    stats: { ppg: 7.8, rpg: 7.6, apg: 1.1, spg: 0.7, bpg: 0.6, tovPg: 1.4, fgPct: 0.512, threePtPct: 0.000, threePtRate: 0.00, ftPct: 0.684, astRate: 0.08, rebRate: 0.19, stlRate: 0.015, blkRate: 0.015 },
    usageRate: 0.13,
  },

  // ==================== Miami, 2010s (Big Three) ====================
  {
    personKey: 'mario_chalmers', name: 'Mario Chalmers', eligiblePositions: ['PG'], team: 'Miami', era: 'twenty_tens',
    stintStartYear: 2010, stintEndYear: 2014, skinTone: 'dark',
    stats: { ppg: 9.8, rpg: 2.5, apg: 3.3, spg: 1.1, bpg: 0.2, tovPg: 1.8, fgPct: 0.421, threePtPct: 0.383, threePtRate: 0.40, ftPct: 0.786, astRate: 0.18, rebRate: 0.06, stlRate: 0.017, blkRate: 0.004 },
    usageRate: 0.16,
  },
  {
    personKey: 'dwyane_wade', name: 'Dwyane Wade', eligiblePositions: ['SG', 'PG'], team: 'Miami', era: 'twenty_tens',
    stintStartYear: 2010, stintEndYear: 2014, skinTone: 'dark',
    stats: { ppg: 22.0, rpg: 4.6, apg: 4.9, spg: 1.6, bpg: 0.8, tovPg: 3.0, fgPct: 0.511, threePtPct: 0.282, threePtRate: 0.05, ftPct: 0.719, astRate: 0.23, rebRate: 0.08, stlRate: 0.022, blkRate: 0.017 },
    usageRate: 0.29,
  },
  {
    // Same real person as the Cleveland stint above — eligiblePositions is
    // a property of LeBron, not the stint, so it stays identical.
    personKey: 'lebron_james', name: 'LeBron James', eligiblePositions: ['SF', 'PF', 'SG'], team: 'Miami', era: 'twenty_tens',
    stintStartYear: 2010, stintEndYear: 2014, skinTone: 'dark',
    stats: { ppg: 26.9, rpg: 7.6, apg: 6.7, spg: 1.7, bpg: 0.8, tovPg: 3.3, fgPct: 0.543, threePtPct: 0.379, threePtRate: 0.20, ftPct: 0.753, astRate: 0.32, rebRate: 0.14, stlRate: 0.021, blkRate: 0.015 },
    usageRate: 0.32,
  },
  {
    personKey: 'chris_bosh', name: 'Chris Bosh', eligiblePositions: ['PF', 'C'], team: 'Miami', era: 'twenty_tens',
    stintStartYear: 2010, stintEndYear: 2014, skinTone: 'dark',
    stats: { ppg: 17.4, rpg: 7.5, apg: 1.9, spg: 0.5, bpg: 0.9, tovPg: 1.7, fgPct: 0.500, threePtPct: 0.333, threePtRate: 0.10, ftPct: 0.797, astRate: 0.09, rebRate: 0.16, stlRate: 0.009, blkRate: 0.020 },
    usageRate: 0.21,
  },
  {
    personKey: 'chris_andersen', name: 'Chris Andersen', eligiblePositions: ['C'], team: 'Miami', era: 'twenty_tens',
    stintStartYear: 2013, stintEndYear: 2014, skinTone: 'light',
    stats: { ppg: 5.6, rpg: 4.4, apg: 0.4, spg: 0.4, bpg: 1.1, tovPg: 0.7, fgPct: 0.631, threePtPct: 0.000, threePtRate: 0.00, ftPct: 0.646, astRate: 0.04, rebRate: 0.16, stlRate: 0.012, blkRate: 0.043 },
    usageRate: 0.11,
  },
  {
    // Same real person as the Boston stint above — a pure shooting guard,
    // both stints. Real position, not the old '6MAN' placeholder (spec 4f).
    personKey: 'ray_allen', name: 'Ray Allen', eligiblePositions: ['SG'], team: 'Miami', era: 'twenty_tens',
    stintStartYear: 2012, stintEndYear: 2014, skinTone: 'dark',
    stats: { ppg: 10.7, rpg: 2.5, apg: 2.1, spg: 0.6, bpg: 0.1, tovPg: 1.1, fgPct: 0.448, threePtPct: 0.396, threePtRate: 0.60, ftPct: 0.906, astRate: 0.10, rebRate: 0.06, stlRate: 0.009, blkRate: 0.002 },
    usageRate: 0.16,
  },

  // ==================== Golden State, 2010s (Curry dynasty) ====================
  {
    personKey: 'stephen_curry', name: 'Stephen Curry', eligiblePositions: ['PG'], team: 'Golden State', era: 'twenty_tens',
    stintStartYear: 2014, stintEndYear: 2019, skinTone: 'light',
    stats: { ppg: 26.3, rpg: 4.8, apg: 6.3, spg: 1.6, bpg: 0.2, tovPg: 3.0, fgPct: 0.479, threePtPct: 0.437, threePtRate: 0.58, ftPct: 0.906, astRate: 0.30, rebRate: 0.07, stlRate: 0.019, blkRate: 0.004 },
    usageRate: 0.30,
  },
  {
    personKey: 'klay_thompson', name: 'Klay Thompson', eligiblePositions: ['SG'], team: 'Golden State', era: 'twenty_tens',
    stintStartYear: 2014, stintEndYear: 2019, skinTone: 'light',
    stats: { ppg: 20.5, rpg: 3.8, apg: 2.3, spg: 0.8, bpg: 0.5, tovPg: 1.9, fgPct: 0.467, threePtPct: 0.430, threePtRate: 0.55, ftPct: 0.865, astRate: 0.10, rebRate: 0.06, stlRate: 0.012, blkRate: 0.008 },
    usageRate: 0.23,
  },
  {
    personKey: 'kevin_durant', name: 'Kevin Durant', eligiblePositions: ['SF', 'PF'], team: 'Golden State', era: 'twenty_tens',
    stintStartYear: 2016, stintEndYear: 2019, skinTone: 'dark',
    stats: { ppg: 26.0, rpg: 6.8, apg: 5.4, spg: 0.7, bpg: 1.1, tovPg: 2.9, fgPct: 0.537, threePtPct: 0.385, threePtRate: 0.30, ftPct: 0.885, astRate: 0.22, rebRate: 0.12, stlRate: 0.010, blkRate: 0.022 },
    usageRate: 0.29,
  },
  {
    personKey: 'draymond_green', name: 'Draymond Green', eligiblePositions: ['PF', 'C'], team: 'Golden State', era: 'twenty_tens',
    stintStartYear: 2014, stintEndYear: 2019, skinTone: 'dark',
    stats: { ppg: 10.2, rpg: 7.7, apg: 6.8, spg: 1.5, bpg: 1.2, tovPg: 2.6, fgPct: 0.441, threePtPct: 0.309, threePtRate: 0.30, ftPct: 0.698, astRate: 0.30, rebRate: 0.16, stlRate: 0.022, blkRate: 0.028 },
    usageRate: 0.15,
  },
  {
    personKey: 'andrew_bogut', name: 'Andrew Bogut', eligiblePositions: ['C'], team: 'Golden State', era: 'twenty_tens',
    stintStartYear: 2014, stintEndYear: 2016, skinTone: 'light',
    stats: { ppg: 5.9, rpg: 7.3, apg: 2.3, spg: 0.6, bpg: 1.4, tovPg: 1.3, fgPct: 0.570, threePtPct: 0.000, threePtRate: 0.00, ftPct: 0.570, astRate: 0.16, rebRate: 0.18, stlRate: 0.013, blkRate: 0.045 },
    usageRate: 0.10,
  },
  {
    // Real position(s), not the old '6MAN' placeholder (spec 4f) — a
    // 3-and-D wing.
    personKey: 'andre_iguodala', name: 'Andre Iguodala', eligiblePositions: ['SF', 'SG'], team: 'Golden State', era: 'twenty_tens',
    stintStartYear: 2014, stintEndYear: 2019, skinTone: 'dark',
    stats: { ppg: 7.6, rpg: 4.0, apg: 3.4, spg: 1.1, bpg: 0.5, tovPg: 1.3, fgPct: 0.462, threePtPct: 0.343, threePtRate: 0.30, ftPct: 0.658, astRate: 0.19, rebRate: 0.10, stlRate: 0.017, blkRate: 0.011 },
    usageRate: 0.12,
  },

  // ==================== Milwaukee, 2020s (2021 championship run) ====================
  {
    personKey: 'jrue_holiday', name: 'Jrue Holiday', eligiblePositions: ['PG', 'SG'], team: 'Milwaukee', era: 'twenty_twenties',
    stintStartYear: 2020, stintEndYear: 2021, skinTone: 'dark',
    stats: { ppg: 17.7, rpg: 5.0, apg: 7.1, spg: 1.2, bpg: 0.4, tovPg: 3.0, fgPct: 0.477, threePtPct: 0.391, threePtRate: 0.35, ftPct: 0.810, astRate: 0.27, rebRate: 0.09, stlRate: 0.017, blkRate: 0.009 },
    usageRate: 0.21,
  },
  {
    personKey: 'khris_middleton', name: 'Khris Middleton', eligiblePositions: ['SG', 'SF'], team: 'Milwaukee', era: 'twenty_twenties',
    stintStartYear: 2020, stintEndYear: 2021, skinTone: 'dark',
    stats: { ppg: 20.4, rpg: 6.0, apg: 5.4, spg: 1.0, bpg: 0.3, tovPg: 2.3, fgPct: 0.491, threePtPct: 0.411, threePtRate: 0.35, ftPct: 0.906, astRate: 0.21, rebRate: 0.10, stlRate: 0.014, blkRate: 0.006 },
    usageRate: 0.24,
  },
  {
    personKey: 'wesley_matthews', name: 'Wesley Matthews', eligiblePositions: ['SF', 'SG'], team: 'Milwaukee', era: 'twenty_twenties',
    stintStartYear: 2020, stintEndYear: 2021, skinTone: 'dark',
    stats: { ppg: 6.2, rpg: 2.1, apg: 1.1, spg: 0.6, bpg: 0.1, tovPg: 0.7, fgPct: 0.405, threePtPct: 0.379, threePtRate: 0.70, ftPct: 0.800, astRate: 0.07, rebRate: 0.05, stlRate: 0.012, blkRate: 0.003 },
    usageRate: 0.12,
  },
  {
    // Extensively documented "positionless" defender/small-ball-5 — a third
    // eligible position, matching the spec's own LeBron-style worked
    // example for a well-established multi-position case.
    personKey: 'giannis_antetokounmpo', name: 'Giannis Antetokounmpo', eligiblePositions: ['PF', 'C', 'SF'], team: 'Milwaukee', era: 'twenty_twenties',
    stintStartYear: 2020, stintEndYear: 2021, skinTone: 'dark',
    stats: { ppg: 28.1, rpg: 11.0, apg: 5.9, spg: 1.2, bpg: 1.2, tovPg: 3.4, fgPct: 0.569, threePtPct: 0.303, threePtRate: 0.10, ftPct: 0.685, astRate: 0.27, rebRate: 0.22, stlRate: 0.016, blkRate: 0.033 },
    usageRate: 0.34,
  },
  {
    personKey: 'brook_lopez', name: 'Brook Lopez', eligiblePositions: ['C'], team: 'Milwaukee', era: 'twenty_twenties',
    stintStartYear: 2020, stintEndYear: 2021, skinTone: 'light',
    stats: { ppg: 12.3, rpg: 4.7, apg: 1.1, spg: 0.4, bpg: 1.6, tovPg: 1.1, fgPct: 0.487, threePtPct: 0.343, threePtRate: 0.55, ftPct: 0.800, astRate: 0.07, rebRate: 0.12, stlRate: 0.009, blkRate: 0.043 },
    usageRate: 0.17,
  },
  {
    // Real position(s), not the old '6MAN' placeholder (spec 4f) — a
    // forward/center reserve big.
    personKey: 'bobby_portis', name: 'Bobby Portis', eligiblePositions: ['PF', 'C'], team: 'Milwaukee', era: 'twenty_twenties',
    stintStartYear: 2020, stintEndYear: 2021, skinTone: 'dark',
    stats: { ppg: 12.0, rpg: 6.6, apg: 1.0, spg: 0.5, bpg: 0.4, tovPg: 1.0, fgPct: 0.460, threePtPct: 0.391, threePtRate: 0.35, ftPct: 0.743, astRate: 0.06, rebRate: 0.16, stlRate: 0.012, blkRate: 0.012 },
    usageRate: 0.18,
  },
];
