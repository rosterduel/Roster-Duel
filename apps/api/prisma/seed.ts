import { PrismaClient } from '@prisma/client';
import { computeRatings, RawPlayerStats } from '../src/ratings/computeRatings';
import { NBA_SEED_PLAYERS, SeedPlayer } from './seedData/nbaPlayers';

const prisma = new PrismaClient();

const CLUTCH_MODIFIER_DEFAULT = 1.0;

function statRows(playerId: string, stats: SeedPlayer['stats']) {
  const scope = 'career';
  return [
    { statKey: 'ppg', statValue: stats.ppg },
    { statKey: 'rpg', statValue: stats.rpg },
    { statKey: 'apg', statValue: stats.apg },
    { statKey: 'spg', statValue: stats.spg },
    { statKey: 'bpg', statValue: stats.bpg },
    { statKey: 'tov_pg', statValue: stats.tovPg },
    { statKey: 'fg_pct', statValue: stats.fgPct },
    { statKey: 'three_pt_pct', statValue: stats.threePtPct },
    { statKey: 'three_pt_rate', statValue: stats.threePtRate },
    { statKey: 'ft_pct', statValue: stats.ftPct },
    { statKey: 'ast_rate', statValue: stats.astRate },
    { statKey: 'reb_rate', statValue: stats.rebRate },
    { statKey: 'stl_rate', statValue: stats.stlRate },
    { statKey: 'blk_rate', statValue: stats.blkRate },
  ].map((row) => ({ playerId, scope, ...row }));
}

async function main() {
  console.log(`Seeding ${NBA_SEED_PLAYERS.length} NBA players...`);

  // Step 1: upsert player identity rows and their raw stats.
  const playerIdByName = new Map<string, string>();
  for (const seedPlayer of NBA_SEED_PLAYERS) {
    const player = await prisma.player.upsert({
      where: { sport_name: { sport: 'nba', name: seedPlayer.name } },
      update: {
        primaryPosition: seedPlayer.position,
        eraStartYear: seedPlayer.eraStartYear,
        eraEndYear: seedPlayer.eraEndYear,
        isActive: seedPlayer.isActive,
      },
      create: {
        sport: 'nba',
        name: seedPlayer.name,
        primaryPosition: seedPlayer.position,
        eraStartYear: seedPlayer.eraStartYear,
        eraEndYear: seedPlayer.eraEndYear,
        isActive: seedPlayer.isActive,
      },
    });
    playerIdByName.set(seedPlayer.name, player.id);

    for (const row of statRows(player.id, seedPlayer.stats)) {
      await prisma.playerStat.upsert({
        where: { playerId_statKey_scope: { playerId: row.playerId, statKey: row.statKey, scope: row.scope } },
        update: { statValue: row.statValue },
        create: row,
      });
    }
  }

  // Step 2: compute composite ratings offline, from the raw stats just
  // written — matches spec section 6's "recalculated offline, not live".
  // Z-scored against this seed pool itself (see computeRatings.ts for why
  // that's a Phase 1 limitation, not the long-term design).
  const ratingInputs: RawPlayerStats[] = NBA_SEED_PLAYERS.map((seedPlayer) => ({
    playerId: playerIdByName.get(seedPlayer.name)!,
    position: seedPlayer.position,
    ppg: seedPlayer.stats.ppg,
    rpg: seedPlayer.stats.rpg,
    apg: seedPlayer.stats.apg,
    spg: seedPlayer.stats.spg,
    bpg: seedPlayer.stats.bpg,
    fgPct: seedPlayer.stats.fgPct,
    threePtPct: seedPlayer.stats.threePtPct,
    astRate: seedPlayer.stats.astRate,
    rebRate: seedPlayer.stats.rebRate,
    stlRate: seedPlayer.stats.stlRate,
    blkRate: seedPlayer.stats.blkRate,
  }));
  const ratings = computeRatings(ratingInputs);

  const usageRateByPlayerId = new Map(
    NBA_SEED_PLAYERS.map((seedPlayer) => [playerIdByName.get(seedPlayer.name)!, seedPlayer.usageRate]),
  );

  for (const rating of ratings) {
    await prisma.playerRating.upsert({
      where: { playerId: rating.playerId },
      update: {
        baseRating: rating.baseRating,
        offenseRating: rating.offenseRating,
        defenseRating: rating.defenseRating,
        clutchModifier: CLUTCH_MODIFIER_DEFAULT,
        usageRate: usageRateByPlayerId.get(rating.playerId)!,
      },
      create: {
        playerId: rating.playerId,
        baseRating: rating.baseRating,
        offenseRating: rating.offenseRating,
        defenseRating: rating.defenseRating,
        clutchModifier: CLUTCH_MODIFIER_DEFAULT,
        usageRate: usageRateByPlayerId.get(rating.playerId)!,
      },
    });
  }

  console.log(`Seeded ${NBA_SEED_PLAYERS.length} players, ${NBA_SEED_PLAYERS.length * 14} stat rows, and ${ratings.length} rating rows.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
