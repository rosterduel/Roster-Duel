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
}

export interface Highlight {
  possessionIndex: number;
  playerId: string;
  playerName: string;
  description: string;
  leverageScore: number;
  periodSecondsRemaining: number;
  quarter: number;
  outcome: PossessionOutcomeType;
  scoreAAfter: number;
  scoreBAfter: number;
}

export interface TeamGameResult {
  teamId: string;
  teamName: string;
  score: number;
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
}
