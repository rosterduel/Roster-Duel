import { GameResult } from '@roster-duel/sim-engine';
import { GeneratedRecap, RecapGenerator, RecapPromptInput } from './types';

/**
 * The same adaptation generateGameRecap() sends to the generator, exposed
 * separately so callers that also want to run validateRecapGrounding()
 * afterward (which needs this same shape) don't have to duplicate it.
 */
export function toRecapPromptInput(game: GameResult): RecapPromptInput {
  const winnerName = game.winner === 'A' ? game.teamA.teamName : game.teamB.teamName;

  return {
    teamAName: game.teamA.teamName,
    teamBName: game.teamB.teamName,
    scoreA: game.teamA.score,
    scoreB: game.teamB.score,
    winnerName,
    overtimePeriods: game.overtimePeriods,
    boxScore: game.boxScore,
    highlights: game.highlights,
    mvp: game.mvp,
  };
}

/** Adapts a completed GameResult into a recap request. The one call site the rest of the app should use. */
export function generateGameRecap(generator: RecapGenerator, game: GameResult): Promise<GeneratedRecap> {
  return generator.generate(toRecapPromptInput(game));
}
