export type NbaPosition = 'PG' | 'SG' | 'SF' | 'PF' | 'C' | '6MAN';

export interface PlayerRatingInput {
  id: string;
  name: string;
  position: NbaPosition;
  /** 0-100, 50 = league average. Drives team-level offensive PPP. */
  offenseRating: number;
  /** 0-100, 50 = league average. Drives team-level PPP allowed. */
  defenseRating: number;
  /** 0-1 share of the team's offensive possessions this player finishes (shot or trip to the line). */
  usageRate: number;
  /** 0-1 share of teammates' made shots this player assists on. */
  assistRate: number;
  /** 0-1 share of available rebounds (on either end) this player grabs. */
  reboundRate: number;
  /** 0-1 share of live-ball turnovers this player converts into a steal. */
  stealRate: number;
  /** 0-1 share of opponent missed shots this player blocks. */
  blockRate: number;
  /** 0-1 — of this player's field goal attempts, what fraction are 3-pointers. */
  threePointRate: number;
  /** 0-1 free throw make percentage. */
  freeThrowPct: number;
}

export interface TeamInput {
  teamId: string;
  teamName: string;
  /** Exactly the roster's players — PG/SG/SF/PF/C/6MAN for Phase 1. */
  players: PlayerRatingInput[];
  /** Possessions per game; defaults to league average pace if omitted. */
  pace?: number;
}

export interface PlayerBoxScoreLine {
  playerId: string;
  name: string;
  position: NbaPosition;
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

export type PossessionOutcomeType =
  | 'turnover'
  | 'miss_def_reb'
  | 'miss_off_reb'
  | 'make_2'
  | 'make_3'
  | 'ft_trip';

/**
 * A simplified NBA court zone — enough to drive a schematic GameCast-style
 * animation (spec section 4a), not real x/y coordinates. NBA-only for
 * Phase 1; NFL's equivalent (yard line + direction) isn't built yet since
 * NFL itself is Phase 2.
 */
export type CourtZone =
  | 'paint'
  | 'mid_range'
  | 'three_left'
  | 'three_right'
  | 'three_top'
  | 'free_throw_line'
  | 'backcourt';

/**
 * Categorizes a trip for animation purposes (spec section 4a: "play-type
 * category ... so the frontend knows which simple animation to render").
 * Derived entirely from data the sim already tracks (outcome, three-point
 * flag, make/miss, steal/block attribution) — no new simulation mechanics,
 * just a frontend-friendly label for what already happened.
 *
 * No standalone 'defensive_rebound' type: an unblocked miss is already
 * fully described by its shot type (two/three_pointer_missed) — who
 * rebounds it doesn't change what animation plays. 'offensive_rebound' DOES
 * get its own type because it's a different game-flow event, not just a
 * missed-shot flavor: the possession continues instead of ending, which is
 * the kind of thing a schematic animation should visually distinguish.
 */
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

export interface PossessionEvent {
  possessionIndex: number;
  offenseTeamId: string;
  /** Seconds remaining in the current quarter/overtime period after this event. */
  periodSecondsRemaining: number;
  /** 1-4 for regulation quarters, 5+ for overtime periods (5 = OT1, 6 = OT2, ...). */
  quarter: number;
  outcome: PossessionOutcomeType;
  pointsScored: number;
  shooterId?: string;
  assisterId?: string;
  reboundPlayerId?: string;
  turnoverPlayerId?: string;
  stealPlayerId?: string;
  blockPlayerId?: string;
  scoreA: number;
  scoreB: number;
  /** Score margin (offense minus defense) after this event. */
  offenseMarginAfter: number;
  /** Signed swing in the offense team's win probability caused by this event. */
  leverageScore: number;
  playType: PlayType;
  /** Where the ball/play originates for a schematic animation. */
  startLocation: CourtZone;
  /** Where the ball/play ends up. */
  endLocation: CourtZone;
}

export interface Highlight {
  possessionIndex: number;
  /** Which team was on offense for this play — needed to attribute leverage credit to the right side (see mvp.ts). */
  offenseTeamId: string;
  playerId: string;
  playerName: string;
  description: string;
  leverageScore: number;
  periodSecondsRemaining: number;
  quarter: number;
  outcome: PossessionOutcomeType;
  scoreAAfter: number;
  scoreBAfter: number;
  playType: PlayType;
  startLocation: CourtZone;
  endLocation: CourtZone;
}

export interface TeamGameResult {
  teamId: string;
  teamName: string;
  score: number;
}

/**
 * Spec section 4b's "Game MVP" callout. `mvpScore` blends two normalized
 * (0-1) components — see mvp.ts for the formula and the reasoning behind
 * its weights. The raw components are included so the UI/recap prompt can
 * explain *why* this player was picked (stat-line vs. clutch-moment MVP),
 * not just assert it.
 */
export interface GameMvp {
  playerId: string;
  playerName: string;
  teamId: string;
  mvpScore: number;
  boxScoreComponent: number;
  leverageComponent: number;
}

export interface GameResult {
  teamA: TeamGameResult;
  teamB: TeamGameResult;
  winner: 'A' | 'B';
  boxScore: {
    teamA: PlayerBoxScoreLine[];
    teamB: PlayerBoxScoreLine[];
  };
  possessionLog: PossessionEvent[];
  highlights: Highlight[];
  /** 0 if the game was decided in regulation, otherwise how many OT periods were played. */
  overtimePeriods: number;
  mvp: GameMvp;
}
