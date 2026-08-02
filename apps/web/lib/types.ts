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

export type StatEstimateReason = 'pre_tracking_era' | 'hypothetical_pre_three_point';

/** Legacy free-browse shape from GET /players — interim/superseded by the per-slot draft pool below (spec 4c). Kept only for that one endpoint's response type. */
export interface PlayerSummary {
  id: string;
  name: string;
  eligiblePositions: NbaPosition[];
  personKey: string;
  teamId: string;
  teamName: string;
  teamColorHex: string;
  era: string;
  stintStartYear: number;
  stintEndYear: number;
  isActive: boolean;
  skinTone: string;
  baseRating: number;
  offenseRating: number;
  defenseRating: number;
  clutchModifier: number;
  stats: Record<string, number>;
  estimatedStats: Record<string, StatEstimateReason>;
}

/** A single player entry within a slot's draft pool (spec 4c/4f). */
export interface DraftPoolPlayer {
  id: string;
  name: string;
  eligiblePositions: NbaPosition[];
  personKey: string;
  stintStartYear: number;
  stintEndYear: number;
  isActive: boolean;
  skinTone: string;
  baseRating: number;
  offenseRating: number;
  defenseRating: number;
  clutchModifier: number;
  stats: Record<string, number>;
  estimatedStats: Record<string, StatEstimateReason>;
  /** Already picked into a different slot on this roster — grayed out, unselectable (spec 4c/4f). */
  isDuplicate: boolean;
}

/** The offered team+era combo and its player pool for one draft slot. */
export interface SlotPool {
  teamId: string;
  teamName: string;
  teamColorHex: string;
  era: string;
  players: DraftPoolPlayer[];
  teamRespinAvailable: boolean;
  eraRespinAvailable: boolean;
}

export interface Team {
  id: string;
  name: string;
  colorHex: string;
}

export type RolesMode = 'same_roles' | 'independent_roles';

export interface CreateMatchRequest {
  draftTimerSeconds?: number;
  rolesMode?: RolesMode;
  includedEras?: string[];
  includedTeamIds?: string[];
}

export const ALL_ERAS = ['sixties', 'seventies', 'eighties', 'nineties', 'two_thousands', 'twenty_tens', 'twenty_twenties'] as const;
export type Era = (typeof ALL_ERAS)[number];
export const ERA_LABELS: Record<Era, string> = {
  sixties: '1960s',
  seventies: '1970s',
  eighties: '1980s',
  nineties: '1990s',
  two_thousands: '2000s',
  twenty_tens: '2010s',
  twenty_twenties: '2020s',
};

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
  rolesMode: RolesMode;
  includedEras: string[];
  includedTeamIds: string[];
  yourSide: 'A' | 'B' | null;
  yourRosterId: string | null;
  sideA: SideStatus;
  sideB: SideStatus;
  yourSlots: Record<string, string> | null;
  opponentSlots: Record<string, string> | null;
  /** Your own roster's per-slot offered team+era + player pool (spec 4c/4f). Null once locked or you're not a participant. */
  yourDraftPool: Record<string, SlotPool> | null;
  yourTeamRespinUsed: boolean | null;
  yourEraRespinUsed: boolean | null;
  gameResult: GameResult | null;
}
