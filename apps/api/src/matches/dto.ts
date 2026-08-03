import { GameMvp, Highlight, PlayerBoxScoreLine } from '@roster-duel/sim-engine';

export interface CreateMatchResponse {
  roomCode: string;
  matchId: string;
  yourSide: 'A' | 'B';
  rosterId: string;
  /** Null = no draft timer (spec section 4's default — untimed drafting). */
  draftTimerSeconds: number | null;
  draftDeadline: string | null;
}

/** Spec 4e pre-match settings, chosen once by the match creator and applied to both rosters. */
export interface CreateMatchRequest {
  /** Omitted = no draft timer (spec section 4's new default: untimed unless the creator opts in). A number turns a timer on for that many seconds. */
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

/** A single player entry within the current round's full, unfiltered roster (spec 4c/4f). */
export interface RoundPlayerDto {
  id: string;
  name: string;
  eligiblePositions: string[];
  personKey: string;
  stintStartYear: number;
  stintEndYear: number;
  isActive: boolean;
  baseRating: number;
  offenseRating: number;
  defenseRating: number;
  clutchModifier: number;
  stats: Record<string, number>;
  estimatedStats: Record<string, 'pre_tracking_era' | 'hypothetical_pre_three_point'>;
  /** Which currently-open slots this player could actually be drafted into right now (spec 4c step 4) — empty means no open slot fits them (grayed out for that reason, independent of isDuplicate below). */
  eligibleOpenPositions: string[];
  /** True if this real person (by personKey) is already locked into a slot on this roster — grayed out, unselectable (spec 4c/4f), regardless of eligibleOpenPositions. */
  isDuplicate: boolean;
}

/**
 * The current round's rolled team+era and its full, unfiltered player
 * roster (spec 4c's sequential redesign — supersedes the earlier
 * per-slot SlotPoolDto). Respins here apply only to THIS round, before its
 * pick locks in.
 */
export interface CurrentRoundDto {
  roundIndex: number;
  totalRounds: number;
  teamId: string;
  teamName: string;
  teamColorHex: string;
  era: string;
  players: RoundPlayerDto[];
  /** False when there's no alternative team to respin into (dead end) OR the roster's Team respin is already used. */
  teamRespinAvailable: boolean;
  /** False when there's no alternative era to respin into (dead end) OR the roster's Era respin is already used. */
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
  /**
   * `playerId -> team colorHex` — GameCast sprite personalization (spec
   * 4a), reworked to differentiate players by their drafted-from team's
   * real color instead of any skin-tone-like attribute (no real player's
   * sprite should be interpretable as a depiction of that person's actual
   * race/appearance). `playerId` here is a PlayerStint id, the same id
   * space `boxScore` and `highlights` use — the sim engine itself never
   * carries this, since it has no concept of what a player looks like;
   * this is assembled at the API layer from the two locked rosters' picks.
   */
  playerJerseyColors: Record<string, string>;
}

export interface MatchStateDto {
  roomCode: string;
  sport: 'nba';
  status: string;
  draftTimerSeconds: number | null;
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
  /** Your own roster's current round (spec 4c). Null once your roster is locked, has filled every slot (ready to lock, nothing left to roll), or you're not a participant. */
  yourCurrentRound: CurrentRoundDto | null;
  /** Roster-wide resource state — distinguishes "already used" from "dead-ended this round" (CurrentRoundDto's booleans conflate both). Null if you're not a participant. */
  yourTeamRespinUsed: boolean | null;
  yourEraRespinUsed: boolean | null;
  gameResult: GameResultDto | null;
}

/**
 * Response from POST roster/:rosterId/pick (spec 4c step 4): either the
 * pick locked in immediately (player had exactly one eligible open
 * position, or the caller already supplied one), or it's ambiguous and the
 * caller must re-submit with an explicit `position` chosen from the list
 * given here (the "Choose Position" prompt).
 */
export type PickResultDto = { status: 'locked'; match: MatchStateDto } | { status: 'choose_position'; eligiblePositions: string[] };
