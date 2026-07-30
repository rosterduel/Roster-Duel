/**
 * Proves the full pipeline works: seeded Postgres data -> Prisma query ->
 * toTeamInput adapter -> sim-engine's simulateGame -> a box score.
 *
 * Not a Jest test (it needs a live, seeded database) — a standalone script
 * in the same spirit as packages/sim-engine/demo/run.ts. Run with:
 *   npm run verify:sim -w apps/api
 */
import { PrismaClient } from '@prisma/client';
import { simulateGame } from '@roster-duel/sim-engine';
import { PlayerWithStatsAndRating, toTeamInput } from '../src/sim/toTeamInput';

const prisma = new PrismaClient();

const TEAM_LEGENDS = ['Magic Johnson', 'Michael Jordan', 'Larry Bird', 'Karl Malone', 'Kareem Abdul-Jabbar', 'Manu Ginobili'];
const TEAM_MODERN = ['Stephen Curry', 'James Harden', 'LeBron James', 'Giannis Antetokounmpo', 'Nikola Jokić', 'Lou Williams'];

async function loadTeamByNames(names: string[]): Promise<PlayerWithStatsAndRating[]> {
  const players = await prisma.player.findMany({
    where: { sport: 'nba', name: { in: names } },
    include: { stats: true, rating: true },
  });
  if (players.length !== names.length) {
    const found = new Set(players.map((p) => p.name));
    const missing = names.filter((n) => !found.has(n));
    throw new Error(`Missing seeded players: ${missing.join(', ')} — did you run \`npm run db:seed -w apps/api\`?`);
  }
  // Preserve draft order rather than whatever order the DB returns.
  return names.map((name) => players.find((p) => p.name === name)!);
}

async function main() {
  const legends = await loadTeamByNames(TEAM_LEGENDS);
  const modern = await loadTeamByNames(TEAM_MODERN);

  const teamA = toTeamInput('legends', 'The Legends', legends);
  const teamB = toTeamInput('modern', 'The Modern Game', modern);

  const seed = process.argv[2] ? Number(process.argv[2]) : Date.now();
  const result = simulateGame({ teamA, teamB, seed });

  console.log('='.repeat(70));
  console.log(`End-to-end sim verification (DB -> adapter -> sim-engine), seed ${seed}`);
  console.log('='.repeat(70));
  const finalLabel = result.overtimePeriods > 0 ? `FINAL/${result.overtimePeriods > 1 ? `${result.overtimePeriods}OT` : 'OT'}` : 'FINAL';
  console.log(`\n${finalLabel}: ${result.teamA.teamName} ${result.teamA.score} — ${result.teamB.score} ${result.teamB.teamName}`);

  for (const [team, box] of [
    [result.teamA.teamName, result.boxScore.teamA],
    [result.teamB.teamName, result.boxScore.teamB],
  ] as const) {
    console.log(`\n${team}`);
    for (const line of box) {
      console.log(
        `  ${line.name.padEnd(24)} ${String(line.points).padStart(3)} pts  ${line.rebounds} reb  ${line.assists} ast  ` +
          `${line.fieldGoalsMade}-${line.fieldGoalsAttempted} FG  ${line.threesMade}-${line.threesAttempted} 3PT`,
      );
    }
  }

  console.log('\nTOP 5 HIGHLIGHTS');
  result.highlights.forEach((h, i) => console.log(`${i + 1}. ${h.description}`));

  console.log(`\n(${result.possessionLog.length} possessions simulated from real seeded player data)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
