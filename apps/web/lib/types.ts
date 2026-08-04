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
  baseRating: number;
  offenseRating: number;
  defenseRating: number;
  clutchModifier: number;
  stats: Record<string, number>;
  estimatedStats: Record<string, StatEstimateReason>;
}

/** A single player entry within the current round's full, unfiltered roster (spec 4c/4f). */
export interface RoundPlayer {
  id: string;
  name: string;
  eligiblePositions: NbaPosition[];
  personKey: string;
  stintStartYear: number;
  stintEndYear: number;
  isActive: boolean;
  baseRating: number;
  offenseRating: number;
  defenseRating: number;
  clutchModifier: number;
  stats: Record<string, number>;
  estimatedStats: Record<string, StatEstimateReason>;
  /** Which currently-open slots this player could actually be drafted into right now (spec 4c step 4) — empty means no open slot fits them. */
  eligibleOpenPositions: NbaPosition[];
  /** Already locked into a slot on this roster — grayed out, unselectable, regardless of eligibleOpenPositions (spec 4c/4f). */
  isDuplicate: boolean;
}

/** The current round's rolled team+era and its full, unfiltered player roster (spec 4c's sequential redesign). */
export interface CurrentRound {
  roundIndex: number;
  totalRounds: number;
  teamId: string;
  teamName: string;
  teamColorHex: string;
  era: string;
  players: RoundPlayer[];
  teamRespinAvailable: boolean;
  eraRespinAvailable: boolean;
}

/** One filled slot on your own roster, for the post-draft summary screen — real data that survives a reload, unlike the client-only pick-name cache. */
export interface DraftedPlayer {
  position: NbaPosition;
  id: string;
  name: string;
  eligiblePositions: NbaPosition[];
}

/** Response from POST roster/:rosterId/pick — either the pick locked immediately, or it's ambiguous and the caller must resubmit with a chosen position (the "Choose Position" prompt). */
export type PickResult = { status: 'locked'; match: MatchState } | { status: 'choose_position'; eligiblePositions: NbaPosition[] };

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
  /** Null = no draft timer (spec section 4's default). */
  draftTimerSeconds: number | null;
  draftDeadline: string | null;
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
  /**
   * playerId (a PlayerStint id) -> team colorHex, for GameCast sprite
   * personalization (spec 4a) — players are differentiated by their
   * drafted-from team's real color, not any skin-tone-like attribute.
   */
  playerJerseyColors: Record<string, string>;
}

export interface MatchState {
  roomCode: string;
  sport: 'nba';
  status: 'drafting' | 'simulating' | 'complete' | string;
  /** Null = no draft timer (spec section 4's default). */
  draftTimerSeconds: number | null;
  rolesMode: RolesMode;
  includedEras: string[];
  includedTeamIds: string[];
  yourSide: 'A' | 'B' | null;
  yourRosterId: string | null;
  sideA: SideStatus;
  sideB: SideStatus;
  yourSlots: Record<string, string> | null;
  yourDraftedPlayers: DraftedPlayer[];
  opponentSlots: Record<string, string> | null;
  /** Your own roster's current round — the rolled team+era and its full, unfiltered roster (spec 4c). Null once locked, once every slot is filled (ready to lock), or you're not a participant. */
  yourCurrentRound: CurrentRound | null;
  yourTeamRespinUsed: boolean | null;
  yourEraRespinUsed: boolean | null;
  gameResult: GameResult | null;
}
