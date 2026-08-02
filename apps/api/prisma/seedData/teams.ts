/**
 * Spec section 4c: teams shown in the draft as city/moniker only (no full
 * franchise names/logos, per section 10's trademark-avoidance guidance),
 * each with its REAL, recognizable primary color (spec 4c's revised
 * guidance — an earlier version of this file said colors just needed to be
 * mutually distinct, not accurate; corrected because e.g. Miami showing as
 * blue-green read as a bug, not a design choice).
 *
 * The spec's own color table assigns the literal same color family to more
 * than one team in this 12-team set: four teams are nominally "red"
 * (Chicago/Detroit/Miami/Philadelphia), and two are nominally "purple"
 * (Los Angeles/Utah). Per the spec's own instruction to shift a shade
 * rather than leave two teams near-identical, flagging the adjustment
 * rather than picking silently:
 * - Chicago/Detroit/Miami/Philadelphia each got a genuinely distinct hue
 *   within the red family (crimson / raspberry / dark maroon / red-orange)
 *   instead of four identical reds.
 * - Utah was shifted to navy (the spec's explicit either/or: "Purple or
 *   navy — pick one consistently") specifically because Los Angeles is
 *   already purple — literal purple for both would be the same clash the
 *   spec is asking to avoid.
 * Every other team uses its real, unadjusted primary color.
 */
export interface SeedTeam {
  name: string;
  colorHex: string;
}

export const NBA_SEED_TEAMS: SeedTeam[] = [
  { name: 'Boston', colorHex: '#007A33' }, // green
  { name: 'Philadelphia', colorHex: '#FF4500' }, // red — shifted red-orange, distinct from Chicago/Detroit/Miami
  { name: 'Los Angeles', colorHex: '#552583' }, // purple
  { name: 'Chicago', colorHex: '#CE1141' }, // red — crimson
  { name: 'Utah', colorHex: '#002B5C' }, // navy — chosen over purple to avoid clashing with Los Angeles
  { name: 'San Antonio', colorHex: '#1D1D1D' }, // black/silver
  { name: 'Detroit', colorHex: '#ED174C' }, // red — shifted raspberry, distinct from Chicago/Miami/Philadelphia
  { name: 'Cleveland', colorHex: '#6F263D' }, // wine/maroon
  { name: 'Miami', colorHex: '#75151E' }, // red — shifted dark maroon-red, distinct from Chicago/Detroit/Philadelphia
  { name: 'Golden State', colorHex: '#1D428A' }, // blue
  { name: 'Milwaukee', colorHex: '#00471B' }, // green — darker/forest, distinct from Boston
  { name: 'New York', colorHex: '#006BB6' }, // blue
];
