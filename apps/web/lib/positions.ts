import { NbaPosition, StatEstimateReason } from './types';

export const NBA_POSITIONS: NbaPosition[] = ['PG', 'SG', 'SF', 'PF', 'C', '6MAN'];

export const POSITION_LABELS: Record<NbaPosition, string> = {
  PG: 'Point Guard',
  SG: 'Shooting Guard',
  SF: 'Small Forward',
  PF: 'Power Forward',
  C: 'Center',
  '6MAN': '6th Man',
};

interface StatField {
  key: string;
  label: string;
  format?: 'pct';
}

/**
 * Per-position visible stat line (spec section 8) — display-only, doesn't
 * affect base_rating/offense_rating/defense_rating/clutch_modifier. Full
 * stat line first, headline advanced stat(s) appended last so they render
 * distinctly in the UI.
 */
export const POSITION_STAT_FIELDS: Record<NbaPosition, StatField[]> = {
  PG: [
    { key: 'ppg', label: 'PPG' },
    { key: 'apg', label: 'APG' },
    { key: 'rpg', label: 'RPG' },
    { key: 'spg', label: 'SPG' },
    { key: 'tov_pg', label: 'TOV' },
    { key: 'fg_pct', label: 'FG%', format: 'pct' },
    { key: 'three_pt_pct', label: '3P%', format: 'pct' },
  ],
  SG: [
    { key: 'ppg', label: 'PPG' },
    { key: 'three_pt_pct', label: '3P%', format: 'pct' },
    { key: 'fg_pct', label: 'FG%', format: 'pct' },
    { key: 'rpg', label: 'RPG' },
    { key: 'apg', label: 'APG' },
    { key: 'spg', label: 'SPG' },
  ],
  SF: [
    { key: 'ppg', label: 'PPG' },
    { key: 'rpg', label: 'RPG' },
    { key: 'apg', label: 'APG' },
    { key: 'spg', label: 'SPG' },
    { key: 'bpg', label: 'BPG' },
    { key: 'three_pt_pct', label: '3P%', format: 'pct' },
    { key: 'fg_pct', label: 'FG%', format: 'pct' },
  ],
  PF: [
    { key: 'rpg', label: 'RPG' },
    { key: 'bpg', label: 'BPG' },
    { key: 'ppg', label: 'PPG' },
    { key: 'apg', label: 'APG' },
    { key: 'spg', label: 'SPG' },
    { key: 'fg_pct', label: 'FG%', format: 'pct' },
  ],
  C: [
    { key: 'rpg', label: 'RPG' },
    { key: 'bpg', label: 'BPG' },
    { key: 'fg_pct', label: 'FG%', format: 'pct' },
    { key: 'ppg', label: 'PPG' },
    { key: 'apg', label: 'APG' },
    { key: 'ft_pct', label: 'FT%', format: 'pct' },
  ],
  '6MAN': [
    { key: 'ppg', label: 'PPG' },
    { key: 'rpg', label: 'RPG' },
    { key: 'apg', label: 'APG' },
    { key: 'fg_pct', label: 'FG%', format: 'pct' },
  ],
};

/**
 * Sort options for the current round's roster (spec 4c) — the round shows
 * every position at once (unfiltered), so unlike POSITION_STAT_FIELDS
 * there's no single position to key the stat line off of. PPG stays the
 * default sort per spec section 4c's "default sort by PPG."
 */
export const ROUND_SORT_FIELDS: StatField[] = [
  { key: 'ppg', label: 'PPG' },
  { key: 'rpg', label: 'RPG' },
  { key: 'apg', label: 'APG' },
  { key: 'spg', label: 'SPG' },
  { key: 'bpg', label: 'BPG' },
  { key: 'fg_pct', label: 'FG%', format: 'pct' },
  { key: 'three_pt_pct', label: '3P%', format: 'pct' },
  { key: 'ft_pct', label: 'FT%', format: 'pct' },
];

export function formatStatValue(value: number | undefined, format?: 'pct'): string {
  if (value === undefined) return '—';
  if (format === 'pct') return `${Math.round(value * 100)}%`;
  return String(value);
}

/**
 * Spec section 10's UI requirement: an estimated stat gets a visible
 * asterisk with a hover/tap tooltip, and the two estimate kinds need
 * DIFFERENT wording (a real-but-unrecorded number vs. a hypothetical
 * "what if") — don't collapse them into one generic tooltip.
 */
export const ESTIMATE_TOOLTIPS: Record<StatEstimateReason, string> = {
  pre_tracking_era: 'Estimated average — pre-stat-tracking era',
  hypothetical_pre_three_point: 'Hypothetical estimate — no 3-point line existed in this era',
};
