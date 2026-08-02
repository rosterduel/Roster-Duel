import { GameMvp, Highlight, PlayerBoxScoreLine } from '@roster-duel/sim-engine';

export interface CreateMatchResponse {
  roomCode: string;
  matchId: string;
  yourSide: 'A' | 'B';
  rosterId: string;
  draftTimerSeconds: number;
  draftDeadline: string;
}

/** Spec 4e pre-match settings, chosen once by the match creator and applied to both rosters. */
export interface CreateMatchRequest {
  draftTimerSeconds?: number;
  rolesMode?: 'same_roles' | 'independent_roles';
  /** Empty/omitted = no narrowing (full era pool eligible). */
  includedEras?: string[];
  /** Empty/omitted = no narrowing (full team pool eligible). */
  includedTeamIds?: string[];
}

export interface SideStatusDto {
  joined: boolean;
  isLocked: boolean;
  draftDeadline: string | null;
  teamName: string | null;
}

/** A single player entry within a slot's draft pool (spec 4c/4f). */
export interface DraftPoolPlayerDto {
  id: string;
  name: string;
  eligiblePositions: string[];
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
  estimatedStats: Record<string, 'pre_tracking_era' | 'hypothetical_pre_three_point'>;
  /** True if this real person (by personKey) is already picked into a DIFFERENT slot on this roster — grayed out, unselectable (spec 4c/4f). */
  isDuplicate: boolean;
}

/** The offered team+era combo and its player pool for one draft slot. */
export interface SlotPoolDto {
  teamId: string;
  teamName: string;
  teamColorHex: string;
  era: string;
  players: DraftPoolPlayerDto[];
  /** False when there's no alternative team to respin into for this slot (dead end) OR the roster's Team respin is already used. */
  teamRespinAvailable: boolean;
  /** False when there's no alternative era to respin into for this slot (dead end) OR the roster's Era respin is already used. */
  eraRespinAvailable: boolean;
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
  rolesMode: 'same_roles' | 'independent_roles';
  includedEras: string[];
  includedTeamIds: string[];
  yourSide: 'A' | 'B' | null;
  yourRosterId: string | null;
  sideA: SideStatusDto;
  sideB: SideStatusDto;
  /** Always visible if you're a participant — it's your own data. */
  yourSlots: Record<string, string> | null;
  /** Blind draft: only revealed once BOTH rosters are locked. */
  opponentSlots: Record<string, string> | null;
  /** Your own roster's per-slot offered team+era + player pool (spec 4c/4f). Null once your roster is locked (no longer drafting) or you're not a participant. */
  yourDraftPool: Record<string, SlotPoolDto> | null;
  gameResult: GameResultDto | null;
}
