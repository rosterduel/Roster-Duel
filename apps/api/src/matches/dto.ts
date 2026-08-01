import { GameMvp, Highlight, PlayerBoxScoreLine } from '@roster-duel/sim-engine';

export interface CreateMatchResponse {
  roomCode: string;
  matchId: string;
  yourSide: 'A' | 'B';
  rosterId: string;
  draftTimerSeconds: number;
  draftDeadline: string;
}

export interface SideStatusDto {
  joined: boolean;
  isLocked: boolean;
  draftDeadline: string | null;
  teamName: string | null;
}

export interface GameResultDto {
  scoreA: number;
  scoreB: number;
  winnerSide: 'A' | 'B';
  boxScore: { teamA: PlayerBoxScoreLine[]; teamB: PlayerBoxScoreLine[] };
  highlights: Highlight[];
  mvp: GameMvp;
  overtimePeriods: number;
  recapHeadline: string | null;
  recapArticle: string | null;
}

export interface MatchStateDto {
  roomCode: string;
  sport: 'nba';
  status: string;
  draftTimerSeconds: number;
  yourSide: 'A' | 'B' | null;
  yourRosterId: string | null;
  sideA: SideStatusDto;
  sideB: SideStatusDto;
  /** Always visible if you're a participant — it's your own data. */
  yourSlots: Record<string, string> | null;
  /** Blind draft: only revealed once BOTH rosters are locked. */
  opponentSlots: Record<string, string> | null;
  gameResult: GameResultDto | null;
}
