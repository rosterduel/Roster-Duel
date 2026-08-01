import { GameResult } from '@roster-duel/sim-engine';
import { GeneratedRecap, RecapGenerator } from './types';

/** Adapts a completed GameResult into a recap request. The one call site the rest of the app should use. */
export function generateGameRecap(generator: RecapGenerator, game: GameResult): Promise<GeneratedRecap> {
  const winnerName = game.winner === 'A' ? game.teamA.teamName : game.teamB.teamName;

  return generator.generate({
    teamAName: game.teamA.teamName,
    teamBName: game.teamB.teamName,
    scoreA: game.teamA.score,
    scoreB: game.teamB.score,
    winnerName,
    overtimePeriods: game.overtimePeriods,
    boxScore: game.boxScore,
    highlights: game.highlights,
    mvp: game.mvp,
  });
}
