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
 * Canonical stat display order, for every player card regardless of
 * position — general/offense stats first, then defensive stats, matching
 * how box scores are typically read. Which stats apply to a given position
 * is still position-specific (POSITION_STAT_KEYS below); this list is only
 * what fixes the ORDER they show up in once selected.
 */
const STAT_FIELD_ORDER: StatField[] = [
  { key: 'ppg', label: 'PPG' },
  { key: 'rpg', label: 'RPG' },
  { key: 'apg', label: 'APG' },
  { key: 'fg_pct', label: 'FG%', format: 'pct' },
  { key: 'three_pt_pct', label: '3P%', format: 'pct' },
  { key: 'spg', label: 'SPG' },
  { key: 'bpg', label: 'BPG' },
  { key: 'ft_pct', label: 'FT%', format: 'pct' },
  { key: 'tov_pg', label: 'TOV' },
];

/** Which stats show up on a given position's card (spec section 8) — display-only, doesn't affect base_rating/offense_rating/defense_rating/clutch_modifier. */
const POSITION_STAT_KEYS: Record<NbaPosition, string[]> = {
  PG: ['ppg', 'apg', 'rpg', 'spg', 'tov_pg', 'fg_pct', 'three_pt_pct'],
  SG: ['ppg', 'three_pt_pct', 'fg_pct', 'rpg', 'apg', 'spg'],
  SF: ['ppg', 'rpg', 'apg', 'spg', 'bpg', 'three_pt_pct', 'fg_pct'],
  PF: ['rpg', 'bpg', 'ppg', 'apg', 'spg', 'fg_pct'],
  C: ['rpg', 'bpg', 'fg_pct', 'ppg', 'apg', 'ft_pct'],
  '6MAN': ['ppg', 'rpg', 'apg', 'fg_pct'],
};

/**
 * Per-position visible stat line — POSITION_STAT_KEYS filtered down from
 * STAT_FIELD_ORDER, so every position's card shows only its own relevant
 * stats but always in the same fixed sequence.
 */
export const POSITION_STAT_FIELDS: Record<NbaPosition, StatField[]> = Object.fromEntries(
  (Object.keys(POSITION_STAT_KEYS) as NbaPosition[]).map((position) => {
    const keys = new Set(POSITION_STAT_KEYS[position]);
    return [position, STAT_FIELD_ORDER.filter((field) => keys.has(field.key))];
  }),
) as Record<NbaPosition, StatField[]>;

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
  return value.toFixed(1);
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
