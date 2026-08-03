/**
 * Phase 1 real-data import (spec's Phase 1 data task): reads the raw CSVs
 * checked into data/raw/ and generates apps/api/prisma/seedData/nbaStints.ts
 * — same SeedPlayerStint[] shape the hand-curated file used, so seed.ts
 * itself needs ZERO changes. Run with:
 *   npx ts-node --transpile-only scripts/buildRealNbaSeedData.ts
 *
 * Two sources, kept strictly separate to preserve their distinct licensing
 * provenance (see KNOWN-ISSUES.md):
 * - data/raw/Player Per Game.csv + Advanced.csv + Team Abbrev.csv (a
 *   Basketball-Reference-derived, unofficial/community-compiled bulk
 *   dataset) — used ONLY for seasons before 2010 (sixties..two_thousands
 *   era buckets). Real per-game box stats AND real advanced rate stats
 *   (ast%/trb%/stl%/blk%/usg%) both come from here.
 * - data/raw/NBA Player Stats and Salaries_2010-2025.csv (CC0 Public
 *   Domain) — used ONLY for 2010+ seasons (twenty_tens/twenty_twenties).
 *   This file has no advanced rate stats, so ast/reb/stl/blk/usage "rate"
 *   fields for this era are a per-36-minutes proxy, calibrated (see
 *   CALIBRATION below) against the historical file's own real percentages
 *   for an EARLIER, already-historical-sourced period — never against
 *   actual 2010+ player data from the other file, to avoid quietly mixing
 *   the two sources' provenance for the same players.
 *
 * A real person can appear in both sources (e.g. a player whose career
 * spans 2008-2012) — personKey is a normalized name slug applied
 * IDENTICALLY to both sources specifically so cross-source stints for the
 * same person are still recognized as the same person (spec 4c's "no
 * duplicate real person on one roster" rule depends on this). This trades
 * away Basketball-Reference's collision-proof player_id for cross-source
 * consistency — a small, accepted risk of two different real players
 * sharing an identical normalized name (see KNOWN-ISSUES.md).
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Era, NbaPosition, RealNbaPosition, SeedPlayerStint, ShooterReputation, SkinTone } from '../prisma/seedData/nbaStints';

const DATA_DIR = join(__dirname, '../../../data/raw');
const OUT_FILE = join(__dirname, '../prisma/seedData/nbaStints.ts');

const MIN_GAMES_THRESHOLD = 50;
const PRE_1980_END_YEAR = 1980;

// The 12 real franchises this app's de-branded Team table represents (see
// seedData/teams.ts) — full historical name as it appears in Team
// Abbrev.csv, mapped to this app's city/moniker-only team name. Matching
// on the EXACT full franchise name (not abbreviation, which changed for
// some franchises, e.g. San Antonio's SAA->SAS) and, crucially, NOT
// matching predecessor/relocated names (e.g. "San Francisco Warriors",
// "New Orleans Jazz") — those are real but different eras of team
// identity, and including them would need franchise-continuity judgment
// calls beyond this Phase 1 pass's scope (see KNOWN-ISSUES.md: some
// team+era combos, like Golden State/sixties, end up with zero players as
// a result and simply won't be a rollable combo — self-consistent with
// how the draft pool already treats any empty combo).
const TARGET_TEAMS: Record<string, string> = {
  'Boston Celtics': 'Boston',
  'Philadelphia 76ers': 'Philadelphia',
  'Los Angeles Lakers': 'Los Angeles',
  'Chicago Bulls': 'Chicago',
  'Utah Jazz': 'Utah',
  'San Antonio Spurs': 'San Antonio',
  'Detroit Pistons': 'Detroit',
  'Cleveland Cavaliers': 'Cleveland',
  'Miami Heat': 'Miami',
  'Golden State Warriors': 'Golden State',
  'Milwaukee Bucks': 'Milwaukee',
  'New York Knicks': 'New York',
};

const REAL_POSITIONS = new Set(['PG', 'SG', 'SF', 'PF', 'C']);

function eraForSeason(season: number): Era | null {
  if (season >= 1960 && season <= 1969) return 'sixties';
  if (season >= 1970 && season <= 1979) return 'seventies';
  if (season >= 1980 && season <= 1989) return 'eighties';
  if (season >= 1990 && season <= 1999) return 'nineties';
  if (season >= 2000 && season <= 2009) return 'two_thousands';
  if (season >= 2010 && season <= 2019) return 'twenty_tens';
  if (season >= 2020 && season <= 2029) return 'twenty_twenties';
  return null;
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function num(v: string | undefined): number | null {
  if (v === undefined || v === '' || v === 'NA') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// --- tiny CSV reader (files here are plain comma-separated, no quoting) ---
function readCsv(filename: string): { header: string[]; rows: string[][] } {
  const text = readFileSync(join(DATA_DIR, filename), 'utf8').replace(/^﻿/, '');
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const header = lines[0].split(',');
  const rows = lines.slice(1).map((l) => l.split(','));
  return { header, rows };
}

function indexRows(header: string[], rows: string[][]): Record<string, string>[] {
  return rows.map((cols) => Object.fromEntries(header.map((h, i) => [h, cols[i]])));
}

// ---------------------------------------------------------------------
// Step 1: Team Abbrev.csv -> (season, abbreviation) -> full team name.
// Robust to a franchise's abbreviation changing over time (e.g. San
// Antonio's SAA->SAS) since it's keyed per-season, not a static table.
// ---------------------------------------------------------------------
const teamAbbrevCsv = readCsv('Team Abbrev.csv');
const fullNameBySeasonAbbrev = new Map<string, string>();
for (const row of indexRows(teamAbbrevCsv.header, teamAbbrevCsv.rows)) {
  fullNameBySeasonAbbrev.set(`${row.season}|${row.abbreviation}`, row.team);
}

interface SeasonRow {
  season: number;
  personKey: string;
  playerName: string;
  pos: string;
  games: number;
  seedTeam: string;
  // per-game counting stats
  pts: number;
  trb: number;
  ast: number;
  stl: number | null;
  blk: number | null;
  tov: number | null;
  fg: number;
  fga: number;
  x3p: number;
  x3pa: number;
  ft: number;
  fta: number;
  // advanced rate stats (0-100 scale as sourced) -- only populated for pre-2010 rows
  astPct: number | null;
  trbPct: number | null;
  stlPct: number | null;
  blkPct: number | null;
  usgPct: number | null;
  // MP per game -- only needed for the 2010+ per-36 proxy
  mp: number | null;
}

const AGGREGATE_TEAM_RE = /^\d+TM$/;

// ---------------------------------------------------------------------
// Step 2: pre-2010 seasons from the historical (Basketball-Reference-
// derived) files, joined on (season, player_id, team).
// ---------------------------------------------------------------------
function loadHistoricalRows(): SeasonRow[] {
  const perGame = indexRows(...Object.values(readCsv('Player Per Game.csv')) as [string[], string[][]]);
  const advanced = indexRows(...Object.values(readCsv('Advanced.csv')) as [string[], string[][]]);
  const advByKey = new Map<string, Record<string, string>>();
  for (const row of advanced) {
    advByKey.set(`${row.season}|${row.player_id}|${row.team}`, row);
  }

  const out: SeasonRow[] = [];
  for (const row of perGame) {
    const season = Number(row.season);
    if (!(season >= 1960 && season < 2010)) continue; // strict pre-2010 scope for this source
    if (AGGREGATE_TEAM_RE.test(row.team)) continue; // "2TM"/"3TM" multi-team rollups, not a real team
    const seedTeam = TARGET_TEAMS[fullNameBySeasonAbbrev.get(`${row.season}|${row.team}`) ?? ''];
    if (!seedTeam) continue; // not one of our 12 franchises (or not that franchise's identity yet)
    const pos = row.pos;
    if (!REAL_POSITIONS.has(pos)) continue; // 'NA' or otherwise unclassifiable

    const games = num(row.g);
    if (!games || games <= 0) continue;

    const adv = advByKey.get(`${row.season}|${row.player_id}|${row.team}`);

    out.push({
      season,
      personKey: slugify(row.player),
      playerName: row.player,
      pos,
      games,
      seedTeam,
      pts: num(row.pts_per_game) ?? 0,
      trb: num(row.trb_per_game) ?? 0,
      ast: num(row.ast_per_game) ?? 0,
      stl: num(row.stl_per_game),
      blk: num(row.blk_per_game),
      tov: num(row.tov_per_game),
      fg: num(row.fg_per_game) ?? 0,
      fga: num(row.fga_per_game) ?? 0,
      x3p: num(row.x3p_per_game) ?? 0,
      x3pa: num(row.x3pa_per_game) ?? 0,
      ft: num(row.ft_per_game) ?? 0,
      fta: num(row.fta_per_game) ?? 0,
      astPct: adv ? num(adv.ast_percent) : null,
      trbPct: adv ? num(adv.trb_percent) : null,
      stlPct: adv ? num(adv.stl_percent) : null,
      blkPct: adv ? num(adv.blk_percent) : null,
      usgPct: adv ? num(adv.usg_percent) : null,
      mp: null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------
// Step 3: calibration constants for the 2010+ proxy formula -- derived
// from the historical file's OWN real percentages for 1990-2009 (a period
// already properly sourced from that file), never from the CC0 file's
// player data. Ratio of true percent-stat to a simple per-36 figure,
// averaged across a broad qualifying sample, so the 2010+ proxy lands on
// roughly the same scale as the real percentages used for earlier eras --
// important because computeRatings.ts z-scores every era together in one
// pool per position.
// ---------------------------------------------------------------------
function calibrateProxyRatios(_historicalRows: SeasonRow[]) {
  // Recomputed directly from the raw rows (join Player Per Game.csv against
  // Advanced.csv by (season, player_id, team)) rather than reusing
  // historicalRows, since SeasonRow doesn't carry player_id/mp through and
  // this is only a one-time calibration pass.
  const advanced = indexRows(...Object.values(readCsv('Advanced.csv')) as [string[], string[][]]);
  const advByKey = new Map<string, Record<string, string>>();
  for (const row of advanced) {
    advByKey.set(`${row.season}|${row.player_id}|${row.team}`, row);
  }
  const perGame = indexRows(...Object.values(readCsv('Player Per Game.csv')) as [string[], string[][]]);
  let astPctSum = 0;
  let astPer36Sum = 0;
  let trbPctSum = 0;
  let trbPer36Sum = 0;
  let stlPctSum = 0;
  let stlPer36Sum = 0;
  let blkPctSum = 0;
  let blkPer36Sum = 0;
  let usgPctSum = 0;
  let usgPer36Sum = 0;
  let count = 0;

  for (const row of perGame) {
    const season = Number(row.season);
    if (!(season >= 1990 && season <= 2009)) continue;
    if (AGGREGATE_TEAM_RE.test(row.team)) continue;
    const g = num(row.g);
    if (!g || g < 20) continue; // meaningful sample only, for calibration purposes
    const adv = advByKey.get(`${row.season}|${row.player_id}|${row.team}`);
    if (!adv) continue;
    const mp = num(adv.mp);
    if (!mp || mp < 200) continue;
    const mpPerGame = mp / g;
    if (mpPerGame <= 0) continue;

    const astPct = num(adv.ast_percent);
    const trbPct = num(adv.trb_percent);
    const stlPct = num(adv.stl_percent);
    const blkPct = num(adv.blk_percent);
    const usgPct = num(adv.usg_percent);
    const astPer36 = (num(row.ast_per_game) ?? 0) * (36 / mpPerGame);
    const trbPer36 = (num(row.trb_per_game) ?? 0) * (36 / mpPerGame);
    const stlPer36 = (num(row.stl_per_game) ?? 0) * (36 / mpPerGame);
    const blkPer36 = (num(row.blk_per_game) ?? 0) * (36 / mpPerGame);
    const fgaPer36 = (num(row.fga_per_game) ?? 0) * (36 / mpPerGame);
    const ftaPer36 = (num(row.fta_per_game) ?? 0) * (36 / mpPerGame);
    const tovPer36 = (num(row.tov_per_game) ?? 0) * (36 / mpPerGame);
    const usgProxy36 = fgaPer36 + 0.44 * ftaPer36 + tovPer36;

    if (astPct !== null && astPer36 > 0) {
      astPctSum += astPct;
      astPer36Sum += astPer36;
    }
    if (trbPct !== null && trbPer36 > 0) {
      trbPctSum += trbPct;
      trbPer36Sum += trbPer36;
    }
    if (stlPct !== null && stlPer36 > 0) {
      stlPctSum += stlPct;
      stlPer36Sum += stlPer36;
    }
    if (blkPct !== null && blkPer36 > 0) {
      blkPctSum += blkPct;
      blkPer36Sum += blkPer36;
    }
    if (usgPct !== null && usgProxy36 > 0) {
      usgPctSum += usgPct;
      usgPer36Sum += usgProxy36;
    }
    count++;
  }

  console.log(`  Calibration sample: ${count} historical 1990-2009 player-seasons.`);
  return {
    astRatio: astPer36Sum ? astPctSum / astPer36Sum : 3, // percent-per-unit-of-per36
    trbRatio: trbPer36Sum ? trbPctSum / trbPer36Sum : 1.6,
    stlRatio: stlPer36Sum ? stlPctSum / stlPer36Sum : 25,
    blkRatio: blkPer36Sum ? blkPctSum / blkPer36Sum : 25,
    usgRatio: usgPer36Sum ? usgPctSum / usgPer36Sum : 1,
  };
}

// ---------------------------------------------------------------------
// Step 4: 2010-2025 seasons from the CC0 combined file.
// ---------------------------------------------------------------------
function loadCc0Rows(calibration: ReturnType<typeof calibrateProxyRatios>): SeasonRow[] {
  const { header, rows } = readCsv('NBA Player Stats and Salaries_2010-2025.csv');
  const cleanHeader = header.map((h) => h.replace(/^﻿/, ''));
  const data = indexRows(cleanHeader, rows);

  const out: SeasonRow[] = [];
  for (const row of data) {
    const season = Number(row.Year);
    if (!(season >= 2010 && season <= 2029)) continue;
    const seedTeam = TARGET_TEAMS[fullNameBySeasonAbbrev.get(`${season}|${row.Team}`) ?? ''];
    if (!seedTeam) continue;
    const pos = (row.Pos ?? '').split('-')[0]; // this file's Pos is already single-token in practice; defensive split just in case
    if (!REAL_POSITIONS.has(pos)) continue;

    const games = num(row.G);
    if (!games || games <= 0) continue;
    const mp = num(row.MP);
    if (!mp || mp <= 0) continue; // MP here is PER-GAME already (this file has no total-minutes column)

    const astPer36 = (num(row.AST) ?? 0) * (36 / mp);
    const trbPer36 = (num(row.TRB) ?? 0) * (36 / mp);
    const stlPer36 = (num(row.STL) ?? 0) * (36 / mp);
    const blkPer36 = (num(row.BLK) ?? 0) * (36 / mp);
    const fgaPer36 = (num(row.FGA) ?? 0) * (36 / mp);
    const ftaPer36 = (num(row.FTA) ?? 0) * (36 / mp);
    const tovPer36 = (num(row.TOV) ?? 0) * (36 / mp);
    const usgProxy36 = fgaPer36 + 0.44 * ftaPer36 + tovPer36;

    out.push({
      season,
      personKey: slugify(row.Player),
      playerName: row.Player,
      pos,
      games,
      seedTeam,
      pts: num(row.PTS) ?? 0,
      trb: num(row.TRB) ?? 0,
      ast: num(row.AST) ?? 0,
      stl: num(row.STL),
      blk: num(row.BLK),
      tov: num(row.TOV),
      fg: num(row.FG) ?? 0,
      fga: num(row.FGA) ?? 0,
      x3p: num(row['3P']) ?? 0,
      x3pa: num(row['3PA']) ?? 0,
      ft: num(row.FT) ?? 0,
      fta: num(row.FTA) ?? 0,
      astPct: astPer36 * calibration.astRatio,
      trbPct: trbPer36 * calibration.trbRatio,
      stlPct: stlPer36 * calibration.stlRatio,
      blkPct: blkPer36 * calibration.blkRatio,
      usgPct: usgProxy36 * calibration.usgRatio,
      mp,
    });
  }
  return out;
}

// ---------------------------------------------------------------------
// Step 5: group into (personKey, seedTeam, era) stints and aggregate.
// ---------------------------------------------------------------------
function mode<T extends string>(values: T[]): T {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function weightedAvg(pairs: { value: number | null; weight: number }[]): number {
  let sumW = 0;
  let sumWV = 0;
  for (const { value, weight } of pairs) {
    if (value === null || weight <= 0) continue;
    sumW += weight;
    sumWV += value * weight;
  }
  return sumW > 0 ? sumWV / sumW : 0;
}

function buildStints(allRows: SeasonRow[]): { name: string; personKey: string; team: string; era: Era; stintStartYear: number; stintEndYear: number; pos: RealNbaPosition; stats: SeedPlayerStint['stats']; usageRate: number }[] {
  const groups = new Map<string, SeasonRow[]>();
  for (const row of allRows) {
    const era = eraForSeason(row.season);
    if (!era) continue;
    const key = `${row.personKey}|${row.seedTeam}|${era}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const results: ReturnType<typeof buildStints> = [];
  for (const [key, rows] of groups) {
    const [, team, era] = key.split('|');
    const totalGames = rows.reduce((s, r) => s + r.games, 0);
    if (totalGames < MIN_GAMES_THRESHOLD) continue;

    const totalFGA = rows.reduce((s, r) => s + r.fga * r.games, 0);
    const total3PA = rows.reduce((s, r) => s + r.x3pa * r.games, 0);
    const totalFTA = rows.reduce((s, r) => s + r.fta * r.games, 0);

    const stats: SeedPlayerStint['stats'] = {
      ppg: rows.reduce((s, r) => s + r.pts * r.games, 0) / totalGames,
      rpg: rows.reduce((s, r) => s + r.trb * r.games, 0) / totalGames,
      apg: rows.reduce((s, r) => s + r.ast * r.games, 0) / totalGames,
      spg: weightedAvg(rows.map((r) => ({ value: r.stl, weight: r.stl !== null ? r.games : 0 }))),
      bpg: weightedAvg(rows.map((r) => ({ value: r.blk, weight: r.blk !== null ? r.games : 0 }))),
      tovPg: weightedAvg(rows.map((r) => ({ value: r.tov, weight: r.tov !== null ? r.games : 0 }))),
      fgPct: totalFGA > 0 ? rows.reduce((s, r) => s + r.fg * r.games, 0) / totalFGA : 0,
      threePtPct: total3PA > 0 ? rows.reduce((s, r) => s + r.x3p * r.games, 0) / total3PA : 0,
      threePtRate: totalFGA > 0 ? total3PA / totalFGA : 0,
      ftPct: totalFTA > 0 ? rows.reduce((s, r) => s + r.ft * r.games, 0) / totalFTA : 0,
      astRate: weightedAvg(rows.map((r) => ({ value: r.astPct !== null ? r.astPct / 100 : null, weight: r.games }))),
      rebRate: weightedAvg(rows.map((r) => ({ value: r.trbPct !== null ? r.trbPct / 100 : null, weight: r.games }))),
      stlRate: weightedAvg(rows.map((r) => ({ value: r.stlPct !== null ? r.stlPct / 100 : null, weight: r.games }))),
      blkRate: weightedAvg(rows.map((r) => ({ value: r.blkPct !== null ? r.blkPct / 100 : null, weight: r.games }))),
    };
    const usageRate = weightedAvg(rows.map((r) => ({ value: r.usgPct !== null ? r.usgPct / 100 : null, weight: r.games })));

    results.push({
      name: rows[0].playerName,
      personKey: rows[0].personKey,
      team,
      era: era as Era,
      stintStartYear: Math.min(...rows.map((r) => r.season)),
      stintEndYear: Math.max(...rows.map((r) => r.season)),
      pos: mode(rows.map((r) => r.pos)) as RealNbaPosition,
      stats,
      usageRate,
    });
  }
  return results;
}

// ---------------------------------------------------------------------
// Step 6: missing-source-data fallback for early-era rate stats. The
// ORIGINAL hand-curated pool used per-player reputation judgment (e.g.
// All-Defensive voting) for its 12 pre-1974 stints, which doesn't scale to
// a bulk import of ~3000. Simple, documented, transparent substitute
// instead: the position-average of REAL (non-fallback) values within this
// same imported pool, applied flat to any stint whose value came out
// suspiciously exactly 0 -- which for spg/bpg/tovPg/astRate/rebRate/
// stlRate/blkRate/usageRate never happens from genuine data (every
// rotation player has some non-zero rate for all of these), so a computed
// 0 reliably means the source's advanced-stat columns were empty for that
// stint, not that the true value was actually zero.
//
// Deliberately NOT tied to a single hardcoded year cutoff (an earlier
// version of this used stintEndYear<=1974, matching seed.ts's existing
// PRE_TRACKING_DEFENSE_CUTOFF_YEAR) -- the source data's actual gaps are
// messier than one clean date: usg_percent is ~100% missing through the
// 1950s-60s and still ~52% missing in the 1970s (it depends on team pace/
// turnover context that wasn't fully tracked until partway through that
// decade), and ast_percent/trb_percent have their own, different partial
// gaps concentrated in the 1960s. Detecting "computed as exactly 0" per
// stint catches all of these directly from the actual data, rather than
// requiring a hand-verified year boundary per field.
//
// spg/bpg/tovPg/stlRate/blkRate stints affected by this are still tagged
// with the existing 'pre_tracking_era' reason in seed.ts (based on that
// same stintEndYear<=1974 cutoff) -- only the estimation METHOD differs
// from the original hand-curated version, not the tagging/UI treatment.
// astRate/rebRate/usageRate have no equivalent estimateReason tagging in
// the schema (they were never flagged as estimates even in the original
// hand-curated pool), so this fallback is silent for those three, same as
// upstream convention.
// ---------------------------------------------------------------------
const ZERO_EPSILON = 1e-9;
type FallbackField = 'spg' | 'bpg' | 'tovPg' | 'astRate' | 'rebRate' | 'stlRate' | 'blkRate';
const FALLBACK_FIELDS: FallbackField[] = ['spg', 'bpg', 'tovPg', 'astRate', 'rebRate', 'stlRate', 'blkRate'];

function fillMissingRateStatFallbacks(stints: ReturnType<typeof buildStints>): void {
  const byPosition = new Map<string, ReturnType<typeof buildStints>>();
  for (const s of stints) byPosition.set(s.pos, [...(byPosition.get(s.pos) ?? []), s]);

  const avgByPosition = new Map<string, Record<FallbackField, number> & { usageRate: number }>();
  for (const [pos, group] of byPosition) {
    const avgOf = (get: (s: (typeof group)[number]) => number) => {
      const real = group.map(get).filter((v) => v > ZERO_EPSILON);
      return real.length > 0 ? real.reduce((s, v) => s + v, 0) / real.length : 0;
    };
    avgByPosition.set(pos, {
      spg: avgOf((s) => s.stats.spg),
      bpg: avgOf((s) => s.stats.bpg),
      tovPg: avgOf((s) => s.stats.tovPg),
      astRate: avgOf((s) => s.stats.astRate),
      rebRate: avgOf((s) => s.stats.rebRate),
      stlRate: avgOf((s) => s.stats.stlRate),
      blkRate: avgOf((s) => s.stats.blkRate),
      usageRate: avgOf((s) => s.usageRate),
    });
  }

  for (const s of stints) {
    const avg = avgByPosition.get(s.pos);
    if (!avg) continue;
    for (const field of FALLBACK_FIELDS) {
      if (s.stats[field] <= ZERO_EPSILON) s.stats[field] = avg[field];
    }
    if (s.usageRate <= ZERO_EPSILON) s.usageRate = avg.usageRate;
  }
}

// ---------------------------------------------------------------------
// Step 7: emit apps/api/prisma/seedData/nbaStints.ts
// ---------------------------------------------------------------------
function fmt(n: number): string {
  return Number(n.toFixed(4)).toString();
}

const DATA_JSON_FILE = join(__dirname, '../prisma/seedData/nbaStints.data.json');

function emit(stints: ReturnType<typeof buildStints>): void {
  // The data itself goes in a plain .json file, imported and type-asserted
  // rather than written as a literal TS array -- a ~3100-element object
  // literal checked structurally against SeedPlayerStint[] blows past
  // TypeScript's internal complexity limit (TS2590 "union type too complex
  // to represent"), both under plain tsc (nest build) and, differently,
  // under ts-node's full-checking mode. A JSON import is asserted as a
  // single blob, not checked element-by-element, which sidesteps the
  // problem entirely rather than working around it with --transpile-only
  // everywhere it's consumed.
  const jsonData = stints.map((s) => {
    const shooterReputation = s.stintEndYear < PRE_1980_END_YEAR ? 'average' : undefined;
    return {
      personKey: s.personKey,
      name: s.name,
      eligiblePositions: [s.pos],
      team: s.team,
      era: s.era,
      stintStartYear: s.stintStartYear,
      stintEndYear: s.stintEndYear,
      skinTone: 'medium',
      usageRate: Number(fmt(s.usageRate)),
      ...(shooterReputation ? { shooterReputation } : {}),
      stats: {
        ppg: Number(fmt(s.stats.ppg)),
        rpg: Number(fmt(s.stats.rpg)),
        apg: Number(fmt(s.stats.apg)),
        spg: Number(fmt(s.stats.spg)),
        bpg: Number(fmt(s.stats.bpg)),
        tovPg: Number(fmt(s.stats.tovPg)),
        fgPct: Number(fmt(s.stats.fgPct)),
        threePtPct: Number(fmt(s.stats.threePtPct)),
        threePtRate: Number(fmt(s.stats.threePtRate)),
        ftPct: Number(fmt(s.stats.ftPct)),
        astRate: Number(fmt(s.stats.astRate)),
        rebRate: Number(fmt(s.stats.rebRate)),
        stlRate: Number(fmt(s.stats.stlRate)),
        blkRate: Number(fmt(s.stats.blkRate)),
      },
    };
  });
  writeFileSync(DATA_JSON_FILE, JSON.stringify(jsonData));

  const ts = `export type NbaPosition = 'PG' | 'SG' | 'SF' | 'PF' | 'C' | '6MAN';
export type RealNbaPosition = Exclude<NbaPosition, '6MAN'>;
export type Era = 'sixties' | 'seventies' | 'eighties' | 'nineties' | 'two_thousands' | 'twenty_tens' | 'twenty_twenties';
export type SkinTone = 'light' | 'medium' | 'dark';
export type ShooterReputation = 'low' | 'average' | 'high';

export interface SeedStintStats {
  ppg: number; rpg: number; apg: number; spg: number; bpg: number; tovPg: number;
  fgPct: number; threePtPct: number; threePtRate: number; ftPct: number;
  astRate: number; rebRate: number; stlRate: number; blkRate: number;
}

export interface SeedPlayerStint {
  personKey: string; name: string; eligiblePositions: RealNbaPosition[]; team: string; era: Era;
  stintStartYear: number; stintEndYear: number; skinTone: SkinTone; stats: SeedStintStats;
  usageRate: number; shooterReputation?: ShooterReputation;
}

// GENERATED FILE -- see apps/api/scripts/buildRealNbaSeedData.ts, which produced
// this (and the sibling nbaStints.data.json it imports) from data/raw/*.csv.
// Do not hand-edit; re-run the script instead.
// Real historical NBA data (spec Phase 1 data task) -- see KNOWN-ISSUES.md for
// source provenance/licensing notes and this pass's known simplifications
// (single-position eligibility, flat skinTone/shooterReputation defaults,
// 12-franchise scope, pre-1974 defensive-stat estimate methodology). The bulk
// data lives in nbaStints.data.json, not inline here -- see that decision's
// rationale on the emit() function in the generator script.
import stintsData from './nbaStints.data.json';
export const NBA_SEED_STINTS: SeedPlayerStint[] = stintsData as SeedPlayerStint[];
`;
  writeFileSync(OUT_FILE, ts);
}

function main(): void {
  console.log('Loading historical (pre-2010) rows...');
  const historicalRows = loadHistoricalRows();
  console.log(`  ${historicalRows.length} qualifying pre-2010 player-team-season rows for our 12 franchises.`);

  console.log('Calibrating 2010+ proxy ratios against 1990-2009 real data...');
  const calibration = calibrateProxyRatios(historicalRows);
  console.log(`  ${JSON.stringify(calibration)}`);

  console.log('Loading CC0 2010-2025 rows...');
  const cc0Rows = loadCc0Rows(calibration);
  console.log(`  ${cc0Rows.length} qualifying 2010+ player-team-season rows for our 12 franchises.`);

  console.log('Aggregating into team+era stints...');
  const stints = buildStints([...historicalRows, ...cc0Rows]);
  console.log(`  ${stints.length} stints before missing-rate-stat fallback fill.`);

  fillMissingRateStatFallbacks(stints);

  console.log('Writing generated seed data file...');
  emit(stints);
  console.log(`Done. Wrote ${stints.length} stints to ${OUT_FILE}`);

  const eraCounts = new Map<string, number>();
  for (const s of stints) eraCounts.set(s.era, (eraCounts.get(s.era) ?? 0) + 1);
  console.log('Stints per era:', Object.fromEntries(eraCounts));
  const teamCounts = new Map<string, number>();
  for (const s of stints) teamCounts.set(s.team, (teamCounts.get(s.team) ?? 0) + 1);
  console.log('Stints per team:', Object.fromEntries(teamCounts));
}

main();
