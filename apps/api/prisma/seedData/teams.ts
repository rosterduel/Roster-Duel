/**
 * Spec section 4c: teams shown in the draft as city/moniker only (no full
 * franchise names/logos, per section 10's trademark-avoidance guidance),
 * each with its REAL, recognizable primary color. Expanded from the
 * original 12-team subset to all 30 current NBA franchises — one entry
 * per CURRENT team identity, not one per historical name a franchise has
 * ever played under (see buildRealNbaSeedData.ts's FRANCHISE_ALIASES for
 * the historical-name -> current-identity mapping this drives, e.g.
 * Seattle SuperSonics-era stints get pulled in under "Oklahoma City").
 *
 * Only one city hosts two of the 30 (Los Angeles: Lakers and Clippers) —
 * disambiguated as "Los Angeles" (Lakers, preserving this project's
 * original entry/color) and "LA Clippers" (a casual nickname-inclusive
 * label, not the full trademarked "Los Angeles Clippers" franchise name).
 * Every other team is a bare city name, except Indiana and Minnesota,
 * which use their own real state-level public branding (matching how
 * those two franchises actually present themselves) rather than a city.
 *
 * Colors: real, recognizable primary color per team, same rule as the
 * original 12. With 30 teams, several genuinely share a real-world
 * primary color family — reds and navy/blues especially (roughly a third
 * of the league brands primarily red, another third blue) — so, per the
 * same precedent the original 12 established (shift a shade rather than
 * leave two teams near-identical, flag it instead of picking silently),
 * many entries below use a distinct shade within their real family rather
 * than the literal same hex as a same-family teammate. This is a judgment
 * call, not a colorimetric guarantee of N-way distinctness — same
 * standard the original 12 were held to.
 */
export interface SeedTeam {
  name: string;
  colorHex: string;
}

export const NBA_SEED_TEAMS: SeedTeam[] = [
  { name: 'Boston', colorHex: '#007A33' }, // green
  { name: 'Philadelphia', colorHex: '#FF4500' }, // red — shifted red-orange
  { name: 'Los Angeles', colorHex: '#552583' }, // purple (Lakers)
  { name: 'Chicago', colorHex: '#CE1141' }, // red — crimson
  { name: 'Utah', colorHex: '#002B5C' }, // navy
  { name: 'San Antonio', colorHex: '#1D1D1D' }, // black/silver
  { name: 'Detroit', colorHex: '#ED174C' }, // red — shifted raspberry
  { name: 'Cleveland', colorHex: '#6F263D' }, // wine/maroon
  { name: 'Miami', colorHex: '#75151E' }, // red — shifted dark maroon-red
  { name: 'Golden State', colorHex: '#1D428A' }, // blue
  { name: 'Milwaukee', colorHex: '#00471B' }, // green — darker/forest, distinct from Boston
  { name: 'New York', colorHex: '#006BB6' }, // blue
  { name: 'Atlanta', colorHex: '#E03A3E' }, // red
  { name: 'Brooklyn', colorHex: '#000000' }, // black
  { name: 'Charlotte', colorHex: '#1D1160' }, // purple
  { name: 'Dallas', colorHex: '#007DC5' }, // blue — brighter, shifted from real navy to separate from Denver/OKC/Orlando
  { name: 'Denver', colorHex: '#0E2240' }, // navy
  { name: 'Houston', colorHex: '#F9423A' }, // red-orange — shifted from real crimson, crowded red family
  { name: 'Indiana', colorHex: '#FDBB30' }, // gold — using their secondary to separate from the navy/blue cluster
  { name: 'LA Clippers', colorHex: '#86172D' }, // dark maroon-red — shifted, distinct from Cleveland/Detroit
  { name: 'Memphis', colorHex: '#5D76A9' }, // steel blue
  { name: 'Minnesota', colorHex: '#78BE21' }, // lime green — using their secondary to separate from Boston/Milwaukee greens
  { name: 'New Orleans', colorHex: '#B4975A' }, // gold — using their secondary, crowded navy family
  { name: 'Oklahoma City', colorHex: '#EF3B24' }, // orange — using their secondary, crowded navy/blue family
  { name: 'Orlando', colorHex: '#0077C0' }, // blue
  { name: 'Phoenix', colorHex: '#E56020' }, // orange
  { name: 'Portland', colorHex: '#C41E3A' }, // red — shifted crimson, distinct from Atlanta
  { name: 'Sacramento', colorHex: '#542E71' }, // purple — shifted, distinct from Los Angeles
  { name: 'Toronto', colorHex: '#753BBD' }, // purple — using their original identity color, crowded red family
  { name: 'Washington', colorHex: '#C8102E' }, // red — shifted, distinct from the rest of the red cluster
];
