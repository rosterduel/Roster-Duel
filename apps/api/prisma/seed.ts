import { PrismaClient, StatEstimateReason } from '@prisma/client';
import { computeRatings, RawPlayerStats } from '../src/ratings/computeRatings';
import { estimatePreThreePointStats } from '../src/ratings/estimatePreThreePointStats';
import { NBA_SEED_TEAMS } from './seedData/teams';
import { NBA_SEED_STINTS, SeedPlayerStint } from './seedData/nbaStints';

const prisma = new PrismaClient();

const CLUTCH_MODIFIER_DEFAULT = 1.0;

// Steals/blocks/turnovers weren't official NBA stats before the 1973-74
// season; there was no 3-point line at all before 1979-80. Both cutoffs
// are spec section 10 facts, not tunable knobs — see nbaStints.ts's header
// comment for which stat keys each one flags and why they get DIFFERENT
// estimateReason values (a real-but-unrecorded number vs. a hypothetical
// "what if").
const PRE_TRACKING_DEFENSE_CUTOFF_YEAR = 1974;
const PRE_THREE_POINT_LINE_CUTOFF_YEAR = 1980;
const DEFENSE_ESTIMATE_KEYS = new Set(['spg', 'bpg', 'tov_pg', 'stl_rate', 'blk_rate']);
const THREE_POINT_ESTIMATE_KEYS = new Set(['three_pt_pct', 'three_pt_rate']);

function needsThreePointEstimate(seedStint: SeedPlayerStint): boolean {
  return seedStint.stintEndYear < PRE_THREE_POINT_LINE_CUTOFF_YEAR;
}

/**
 * Single source of truth for a stint's "effective" three-point numbers —
 * the real seeded value for any post-1980 stint, or the computed
 * estimatePreThreePointStats() output for a pre-1980 one. Used both when
 * writing player_stint_stats rows and when building rating computation
 * inputs, so a pre-1980 stint's estimated 3PT signal consistently feeds
 * base_rating/offense_rating too, not just the displayed stat line.
 */
function effectiveThreePointStats(seedStint: SeedPlayerStint): { threePtPct: number; threePtRate: number } {
  if (!needsThreePointEstimate(seedStint)) {
    return { threePtPct: seedStint.stats.threePtPct, threePtRate: seedStint.stats.threePtRate };
  }
  if (!seedStint.shooterReputation) {
    throw new Error(`Stint "${seedStint.name}" (${seedStint.team}/${seedStint.era}) predates the 3-point line but has no shooterReputation set.`);
  }
  return estimatePreThreePointStats({
    position: seedStint.position,
    ftPct: seedStint.stats.ftPct,
    fgPct: seedStint.stats.fgPct,
    shooterReputation: seedStint.shooterReputation,
  });
}

function statRows(stintId: string, seedStint: SeedPlayerStint) {
  const scope = 'stint';
  const stats = seedStint.stats;
  const needsDefenseEstimate = seedStint.stintEndYear <= PRE_TRACKING_DEFENSE_CUTOFF_YEAR;
  const needsThreePoint = needsThreePointEstimate(seedStint);
  const { threePtPct, threePtRate } = effectiveThreePointStats(seedStint);

  const rows = [
    { statKey: 'ppg', statValue: stats.ppg },
    { statKey: 'rpg', statValue: stats.rpg },
    { statKey: 'apg', statValue: stats.apg },
    { statKey: 'spg', statValue: stats.spg },
    { statKey: 'bpg', statValue: stats.bpg },
    { statKey: 'tov_pg', statValue: stats.tovPg },
    { statKey: 'fg_pct', statValue: stats.fgPct },
    { statKey: 'three_pt_pct', statValue: threePtPct },
    { statKey: 'three_pt_rate', statValue: threePtRate },
    { statKey: 'ft_pct', statValue: stats.ftPct },
    { statKey: 'ast_rate', statValue: stats.astRate },
    { statKey: 'reb_rate', statValue: stats.rebRate },
    { statKey: 'stl_rate', statValue: stats.stlRate },
    { statKey: 'blk_rate', statValue: stats.blkRate },
  ];

  return rows.map((row) => {
    let estimateReason: StatEstimateReason | null = null;
    if (needsDefenseEstimate && DEFENSE_ESTIMATE_KEYS.has(row.statKey)) estimateReason = 'pre_tracking_era';
    if (needsThreePoint && THREE_POINT_ESTIMATE_KEYS.has(row.statKey)) estimateReason = 'hypothetical_pre_three_point';
    return { stintId, scope, estimateReason, ...row };
  });
}

async function main() {
  // Step 1: upsert teams (spec 4c — city/moniker + cosmetic color).
  console.log(`Seeding ${NBA_SEED_TEAMS.length} teams...`);
  const teamIdByName = new Map<string, string>();
  for (const seedTeam of NBA_SEED_TEAMS) {
    const team = await prisma.team.upsert({
      where: { sport_name: { sport: 'nba', name: seedTeam.name } },
      update: { colorHex: seedTeam.colorHex },
      create: { sport: 'nba', name: seedTeam.name, colorHex: seedTeam.colorHex },
    });
    teamIdByName.set(seedTeam.name, team.id);
  }

  // Step 2: upsert stint identity rows and their raw stats. Natural key is
  // (sport, team, era, name) — a real person can have multiple stint rows
  // (see nbaStints.ts's LeBron/Ray Allen/Karl Malone examples), so identity
  // is per-stint, not per-person.
  console.log(`Seeding ${NBA_SEED_STINTS.length} player stints...`);
  const stintIdByNaturalKey = new Map<string, string>();
  for (const seedStint of NBA_SEED_STINTS) {
    const teamId = teamIdByName.get(seedStint.team);
    if (!teamId) throw new Error(`Stint "${seedStint.name}" references unknown team "${seedStint.team}"`);

    const stint = await prisma.playerStint.upsert({
      where: { sport_teamId_era_name: { sport: 'nba', teamId, era: seedStint.era, name: seedStint.name } },
      update: {
        personKey: seedStint.personKey,
        primaryPosition: seedStint.position,
        stintStartYear: seedStint.stintStartYear,
        stintEndYear: seedStint.stintEndYear,
        isActive: false,
        skinTone: seedStint.skinTone,
      },
      create: {
        sport: 'nba',
        personKey: seedStint.personKey,
        name: seedStint.name,
        primaryPosition: seedStint.position,
        teamId,
        era: seedStint.era,
        stintStartYear: seedStint.stintStartYear,
        stintEndYear: seedStint.stintEndYear,
        isActive: false,
        skinTone: seedStint.skinTone,
      },
    });
    stintIdByNaturalKey.set(`${seedStint.team}|${seedStint.era}|${seedStint.name}`, stint.id);

    for (const row of statRows(stint.id, seedStint)) {
      await prisma.playerStintStat.upsert({
        where: { stintId_statKey_scope: { stintId: row.stintId, statKey: row.statKey, scope: row.scope } },
        update: { statValue: row.statValue, estimateReason: row.estimateReason },
        create: row,
      });
    }
  }

  // Step 3: compute composite ratings offline, from the raw stats just
  // written — matches spec section 6's "recalculated offline, not live".
  // Z-scored against this seed pool itself (see computeRatings.ts for why
  // that's a Phase 1 limitation, not the long-term design) — computed per
  // stint now, not per career player, but the formula itself is unchanged.
  const ratingInputs: RawPlayerStats[] = NBA_SEED_STINTS.map((seedStint) => ({
    playerId: stintIdByNaturalKey.get(`${seedStint.team}|${seedStint.era}|${seedStint.name}`)!,
    position: seedStint.position,
    ppg: seedStint.stats.ppg,
    rpg: seedStint.stats.rpg,
    apg: seedStint.stats.apg,
    spg: seedStint.stats.spg,
    bpg: seedStint.stats.bpg,
    fgPct: seedStint.stats.fgPct,
    // Uses the same effective (real-or-estimated) 3PT% as the stored stat
    // row — a pre-1980 stint's estimate should feed offense_rating too, not
    // just the displayed value, or the two would silently disagree.
    threePtPct: effectiveThreePointStats(seedStint).threePtPct,
    astRate: seedStint.stats.astRate,
    rebRate: seedStint.stats.rebRate,
    stlRate: seedStint.stats.stlRate,
    blkRate: seedStint.stats.blkRate,
  }));
  const ratings = computeRatings(ratingInputs);

  const usageRateByStintId = new Map(
    NBA_SEED_STINTS.map((seedStint) => [stintIdByNaturalKey.get(`${seedStint.team}|${seedStint.era}|${seedStint.name}`)!, seedStint.usageRate]),
  );

  for (const rating of ratings) {
    await prisma.playerStintRating.upsert({
      where: { stintId: rating.playerId },
      update: {
        baseRating: rating.baseRating,
        offenseRating: rating.offenseRating,
        defenseRating: rating.defenseRating,
        clutchModifier: CLUTCH_MODIFIER_DEFAULT,
        usageRate: usageRateByStintId.get(rating.playerId)!,
      },
      create: {
        stintId: rating.playerId,
        baseRating: rating.baseRating,
        offenseRating: rating.offenseRating,
        defenseRating: rating.defenseRating,
        clutchModifier: CLUTCH_MODIFIER_DEFAULT,
        usageRate: usageRateByStintId.get(rating.playerId)!,
      },
    });
  }

  console.log(
    `Seeded ${NBA_SEED_TEAMS.length} teams, ${NBA_SEED_STINTS.length} stints, ${NBA_SEED_STINTS.length * 14} stat rows, and ${ratings.length} rating rows.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
