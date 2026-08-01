/**
 * Proves the full pipeline works with the spec section 4c team+era stint
 * model: seeded Postgres data -> Prisma query -> toTeamInput adapter ->
 * sim-engine's simulateGame -> a box score.
 *
 * Loads two full team+era rosters (not by arbitrary player name list —
 * the draftable unit is now a stint, see schema.prisma) and also proves
 * the deliberate cross-stint duplicate case works correctly at the data
 * layer: LeBron James exists as two separate PlayerStint rows (Cleveland/
 * two_thousands and Miami/twenty_tens), and both resolve independently
 * without collision. Enforcing "no duplicate real person on one roster"
 * is a draft-flow concern (spec 4c's grayout rule) landing in the next
 * step, not something this script's plain DB query needs to check.
 *
 * Not a Jest test (it needs a live, seeded database) — a standalone script
 * in the same spirit as packages/sim-engine/demo/run.ts. Run with:
 *   npm run verify:sim -w apps/api
 */
import { PrismaClient } from '@prisma/client';
import { simulateGame } from '@roster-duel/sim-engine';
import { NBA_POSITIONS, StintWithStatsAndRating, toTeamInput } from '../src/sim/toTeamInput';

const prisma = new PrismaClient();

async function loadTeamByCombo(teamName: string, era: string): Promise<StintWithStatsAndRating[]> {
  const stints = await prisma.playerStint.findMany({
    where: { sport: 'nba', era: era as never, team: { name: teamName } },
    include: { stats: true, rating: true },
  });
  const missing = NBA_POSITIONS.filter((pos) => !stints.some((s) => s.primaryPosition === pos));
  if (missing.length > 0) {
    throw new Error(`"${teamName}/${era}" is missing positions [${missing.join(', ')}] — did you run \`npm run db:seed -w apps/api\`?`);
  }
  // Preserve draft-slot order rather than whatever order the DB returns.
  return NBA_POSITIONS.map((pos) => stints.find((s) => s.primaryPosition === pos)!);
}

async function verifyCrossStintDuplicate(): Promise<void> {
  const lebronStints = await prisma.playerStint.findMany({ where: { personKey: 'lebron_james' }, include: { team: true } });
  if (lebronStints.length < 2) {
    throw new Error(`Expected at least 2 seeded LeBron James stints (cross-stint duplicate case), found ${lebronStints.length}.`);
  }
  console.log(
    `Cross-stint duplicate check OK: personKey "lebron_james" resolves to ${lebronStints.length} distinct stints — ` +
      lebronStints.map((s) => `${s.team.name}/${s.era} (id ${s.id.slice(0, 8)})`).join(', '),
  );
}

async function main() {
  await verifyCrossStintDuplicate();

  const chicago90s = await loadTeamByCombo('Chicago', 'nineties');
  const warriors10s = await loadTeamByCombo('Golden State', 'twenty_tens');

  const teamA = toTeamInput('chicago-nineties', 'Chicago (90s)', chicago90s);
  const teamB = toTeamInput('golden-state-twenty-tens', 'Golden State (2010s)', warriors10s);

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

  console.log(`\n(${result.possessionLog.length} possessions simulated from real seeded team+era stint data)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
