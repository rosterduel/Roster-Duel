import { GameMvp, Highlight, PlayerBoxScoreLine } from '@roster-duel/sim-engine';

/** Everything the recap prompt is grounded in — all of it comes straight out of a completed GameResult. */
export interface RecapPromptInput {
  teamAName: string;
  teamBName: string;
  scoreA: number;
  scoreB: number;
  winnerName: string;
  overtimePeriods: number;
  boxScore: {
    teamA: PlayerBoxScoreLine[];
    teamB: PlayerBoxScoreLine[];
  };
  /** Top-5 highlights, already ranked by leverage — same data section 5.5's written highlights use. */
  highlights: Highlight[];
  mvp: GameMvp;
}

export interface GeneratedRecap {
  headline: string;
  article: string;
}

/** Mockable seam — tests supply a fake implementation, no live API key required. */
export interface RecapGenerator {
  generate(input: RecapPromptInput): Promise<GeneratedRecap>;
}
