/**
 * Spec section 4c: teams shown in the draft as city/moniker only (no full
 * franchise names/logos, per section 10's trademark-avoidance guidance),
 * each with a cosmetic, consistent color for visual scanning on the draft
 * screen. Colors are picked for mutual distinctiveness across this specific
 * set of teams — they deliberately do not attempt to match real franchise
 * branding (spec is explicit that they don't need to).
 */
export interface SeedTeam {
  name: string;
  colorHex: string;
}

export const NBA_SEED_TEAMS: SeedTeam[] = [
  { name: 'Boston', colorHex: '#16A34A' },
  { name: 'Philadelphia', colorHex: '#0EA5E9' },
  { name: 'Los Angeles', colorHex: '#CA8A04' },
  { name: 'Chicago', colorHex: '#DC2626' },
  { name: 'Utah', colorHex: '#7C3AED' },
  { name: 'San Antonio', colorHex: '#475569' },
  { name: 'Detroit', colorHex: '#4338CA' },
  { name: 'Cleveland', colorHex: '#B45309' },
  { name: 'Miami', colorHex: '#0D9488' },
  { name: 'Golden State', colorHex: '#2563EB' },
  { name: 'Milwaukee', colorHex: '#DB2777' },
  { name: 'New York', colorHex: '#EA580C' },
];
