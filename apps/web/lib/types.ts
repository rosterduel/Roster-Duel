// Hand-mirrored from apps/api's DTOs (apps/web is a separate deployable
// from apps/api, so these aren't imported directly — see lib/api.ts).

export type NbaPosition = 'PG' | 'SG' | 'SF' | 'PF' | 'C' | '6MAN';

export interface PublicUser {
  id: string;
  displayName: string;
}

export interface UserRecord {
  gamesPlayed: number;
  overallWins: number;
  overallLosses: number;
  last10Wins: number;
  last10Losses: number;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winPct: number;
}

export interface PlayerSummary {
  id: string;
  name: string;
  position: string;
  eraStartYear: number;
  eraEndYear: number | null;
  isActive: boolean;
  baseRating: number;
  offenseRating: number;
  defenseRating: number;
  clutchModifier: number;
  stats: Record<string, number>;
}

export interface CreateMatchResponse {
  roomCode: string;
  matchId: string;
  yourSide: 'A' | 'B';
  rosterId: string;
  draftTimerSeconds: number;
  draftDeadline: string;
}

export interface SideStatus {
  joined: boolean;
  isLocked: boolean;
  draftDeadline: string | null;
  teamName: string | null;
}

export type CourtZone = 'paint' | 'mid_range' | 'three_left' | 'three_right' | 'three_top' | 'free_throw_line' | 'backcourt';

export type PlayType =
  | 'three_pointer_made'
  | 'three_pointer_missed'
  | 'two_pointer_made'
  | 'two_pointer_missed'
  | 'free_throw'
  | 'steal'
  | 'turnover'
  | 'block'
  | 'offensive_rebound';

export interface Highlight {
  possessionIndex: number;
  offenseTeamId: string;
  playerId: string;
  playerName: string;
  description: string;
  leverageScore: number;
  periodSecondsRemaining: number;
  quarter: number;
  outcome: string;
  scoreAAfter: number;
  scoreBAfter: number;
  playType: PlayType;
  startLocation: CourtZone;
  endLocation: CourtZone;
}

export interface PlayerBoxScoreLine {
  playerId: string;
  name: string;
  position: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threesMade: number;
  threesAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
}

export interface GameMvp {
  playerId: string;
  playerName: string;
  teamId: string;
  mvpScore: number;
  boxScoreComponent: number;
  leverageComponent: number;
}

export interface GameResult {
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

export interface MatchState {
  roomCode: string;
  sport: 'nba';
  status: 'drafting' | 'simulating' | 'complete' | string;
  draftTimerSeconds: number;
  yourSide: 'A' | 'B' | null;
  yourRosterId: string | null;
  sideA: SideStatus;
  sideB: SideStatus;
  yourSlots: Record<string, string> | null;
  opponentSlots: Record<string, string> | null;
  gameResult: GameResult | null;
}
