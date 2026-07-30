import { simulateGame } from '../src/simulateGame';
import { PlayerBoxScoreLine } from '../src/types';
import { teamDynasty, teamLegacy } from './sampleRosters';

function fmtPct(made: number, attempted: number): string {
  if (attempted === 0) return '-';
  return `${Math.round((made / attempted) * 100)}%`;
}

function printBoxScore(teamName: string, lines: PlayerBoxScoreLine[]): void {
  console.log(`\n${teamName}`);
  console.log(
    ['Player'.padEnd(18), 'PTS', 'REB', 'AST', 'STL', 'BLK', 'TOV', 'FG', 'FG%', '3PT', '3P%', 'FT', 'FT%']
      .map((h) => h.padStart(6))
      .join(''),
  );
  for (const l of lines) {
    console.log(
      [
        l.name.padEnd(18),
        String(l.points).padStart(6),
        String(l.rebounds).padStart(6),
        String(l.assists).padStart(6),
        String(l.steals).padStart(6),
        String(l.blocks).padStart(6),
        String(l.turnovers).padStart(6),
        `${l.fieldGoalsMade}-${l.fieldGoalsAttempted}`.padStart(6),
        fmtPct(l.fieldGoalsMade, l.fieldGoalsAttempted).padStart(6),
        `${l.threesMade}-${l.threesAttempted}`.padStart(6),
        fmtPct(l.threesMade, l.threesAttempted).padStart(6),
        `${l.freeThrowsMade}-${l.freeThrowsAttempted}`.padStart(6),
        fmtPct(l.freeThrowsMade, l.freeThrowsAttempted).padStart(6),
      ].join(''),
    );
  }
}

const seed = process.argv[2] ? Number(process.argv[2]) : Date.now();
const result = simulateGame({ teamA: teamLegacy, teamB: teamDynasty, seed });

console.log('='.repeat(70));
console.log(`RosterDuel sim-engine demo (seed ${seed})`);
console.log('='.repeat(70));
console.log(
  `\nFINAL: ${result.teamA.teamName} ${result.teamA.score} — ${result.teamB.score} ${result.teamB.teamName}` +
    ` (winner: ${result.winner === 'A' ? result.teamA.teamName : result.teamB.teamName})`,
);

printBoxScore(result.teamA.teamName, result.boxScore.teamA);
printBoxScore(result.teamB.teamName, result.boxScore.teamB);

console.log('\nTOP 5 HIGHLIGHTS');
result.highlights.forEach((h, i) => {
  console.log(`${i + 1}. ${h.description} (leverage ${(h.leverageScore * 100).toFixed(1)}%)`);
});

console.log(`\n(${result.possessionLog.length} possessions simulated)`);
