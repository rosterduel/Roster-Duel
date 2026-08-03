export type NbaPosition = 'PG' | 'SG' | 'SF' | 'PF' | 'C' | '6MAN';
export type RealNbaPosition = Exclude<NbaPosition, '6MAN'>;
export type Era = 'sixties' | 'seventies' | 'eighties' | 'nineties' | 'two_thousands' | 'twenty_tens' | 'twenty_twenties';
export type ShooterReputation = 'low' | 'average' | 'high';

export interface SeedStintStats {
  ppg: number; rpg: number; apg: number; spg: number; bpg: number; tovPg: number;
  fgPct: number; threePtPct: number; threePtRate: number; ftPct: number;
  astRate: number; rebRate: number; stlRate: number; blkRate: number;
}

export interface SeedPlayerStint {
  personKey: string; name: string; eligiblePositions: RealNbaPosition[]; team: string; era: Era;
  stintStartYear: number; stintEndYear: number; stats: SeedStintStats;
  usageRate: number; shooterReputation?: ShooterReputation;
}

// GENERATED FILE -- see apps/api/scripts/buildRealNbaSeedData.ts, which produced
// this (and the sibling nbaStints.data.json it imports) from data/raw/*.csv.
// Do not hand-edit; re-run the script instead.
// Real historical NBA data (spec Phase 1 data task) -- see KNOWN-ISSUES.md for
// source provenance/licensing notes and this pass's known simplifications
// (PG-SG-SF-PF-C adjacency-based position eligibility rather than a
// per-player judgment call, flat shooterReputation defaults, 30-franchise
// scope via FRANCHISE_ALIASES, pre-1974 defensive-stat estimate
// methodology). The bulk data lives in nbaStints.data.json, not inline
// here -- see that decision's rationale on the emit() function in the
// generator script. No skinTone field -- sprites are differentiated by
// each player's drafted-from team color instead (see PlayerSprite.tsx).
import stintsData from './nbaStints.data.json';
export const NBA_SEED_STINTS: SeedPlayerStint[] = stintsData as SeedPlayerStint[];
