/**
 * Automated plausibility check over every seeded stint's stat line — NOT an
 * external-source verification (that's explicitly out of scope for this
 * pass, per the user; the file's own "approximate, not verified line-by-line"
 * caveat stands). This instead catches the cheap, structural class of error
 * the LeBron FG% spot-check surfaced by hand: values outside any realistic
 * range for a real NBA player, or combinations of two stats that can't both
 * be true at once (e.g. a 3-point percentage that's mathematically
 * incompatible with the player's overall FG% given their 3PA rate).
 *
 * Bounds below are deliberately generous (real historical extremes, not
 * "typical" ranges) — the goal is catching typos/transposed digits/obviously
 * wrong entries, not second-guessing legitimate outliers. A flagged row
 * needs a human look, not an automatic "this is wrong."
 *
 * Estimated stats (estimateReason != null) are checked more loosely, or
 * skipped for the internal-consistency check — they're already known,
 * disclosed approximations, not candidates for "is this a typo" scrutiny.
 *
 * Not a Jest test (no pass/fail assertion, just a report) — a standalone
 * script in the same spirit as verifySimEndToEnd.ts. Run with:
 *   npx ts-node --transpile-only scripts/checkStatPlausibility.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Finding {
  player: string;
  team: string;
  era: string;
  severity: 'error' | 'warn';
  message: string;
}

// Real historical extremes across NBA history (not "typical" ranges) — a
// season averaging outside these has essentially never happened for a
// rotation player, regardless of era or position.
const BOUNDS: Record<string, [number, number]> = {
  ppg: [0, 36],
  rpg: [0, 25],
  apg: [0, 14],
  spg: [0, 3.5],
  bpg: [0, 4.5],
  tov_pg: [0, 5.5],
  fg_pct: [0.3, 0.75],
  ft_pct: [0.4, 0.97],
  ast_rate: [0, 0.55],
  reb_rate: [0, 0.35],
  stl_rate: [0, 0.045],
  blk_rate: [0, 0.1],
};
// Checked separately (real rows only — estimated rows get a wider band).
const THREE_PT_PCT_REAL_BOUNDS: [number, number] = [0.15, 0.5];
const THREE_PT_RATE_REAL_BOUNDS: [number, number] = [0, 0.75];
const USAGE_RATE_BOUNDS: [number, number] = [0.08, 0.4];

async function main() {
  const findings: Finding[] = [];
  const stints = await prisma.playerStint.findMany({
    include: { team: true, stats: true, rating: true },
    orderBy: [{ team: { name: 'asc' } }, { era: 'asc' }, { name: 'asc' }],
  });

  for (const stint of stints) {
    const label = `${stint.name} (${stint.team.name}/${stint.era})`;
    const statMap = new Map(stint.stats.map((s) => [s.statKey, { value: Number(s.statValue), estimateReason: s.estimateReason }]));
    const get = (key: string) => statMap.get(key)?.value;
    const isEstimated = (key: string) => statMap.get(key)?.estimateReason !== null && statMap.get(key)?.estimateReason !== undefined;

    // 1. Range checks on the "real, unremarkable" stat set.
    for (const [key, [min, max]] of Object.entries(BOUNDS)) {
      const value = get(key);
      if (value === undefined) continue;
      if (value < min || value > max) {
        findings.push({
          player: label,
          team: stint.team.name,
          era: stint.era,
          severity: 'error',
          message: `${key}=${value} is outside the realistic range [${min}, ${max}]${isEstimated(key) ? ' (estimated stat)' : ''}`,
        });
      }
    }

    // 2. Three-point stats — looser bounds for estimated (hypothetical) rows.
    const threePct = get('three_pt_pct');
    const threeRate = get('three_pt_rate');
    if (threePct !== undefined) {
      const [min, max] = isEstimated('three_pt_pct') ? [0.1, 0.45] : THREE_PT_PCT_REAL_BOUNDS;
      if (threePct !== 0 && (threePct < min || threePct > max)) {
        findings.push({
          player: label, team: stint.team.name, era: stint.era, severity: 'warn',
          message: `three_pt_pct=${threePct} is outside [${min}, ${max}]${isEstimated('three_pt_pct') ? ' (estimated stat)' : ''}`,
        });
      }
    }
    if (threeRate !== undefined && !isEstimated('three_pt_rate')) {
      const [min, max] = THREE_PT_RATE_REAL_BOUNDS;
      if (threeRate < min || threeRate > max) {
        findings.push({
          player: label, team: stint.team.name, era: stint.era, severity: 'warn',
          message: `three_pt_rate=${threeRate} is outside [${min}, ${max}]`,
        });
      }
    }

    // 3. Usage rate sanity (rating input, not a displayed stat, but still catchable here).
    if (stint.rating) {
      const usage = Number(stint.rating.usageRate);
      const [min, max] = USAGE_RATE_BOUNDS;
      if (usage < min || usage > max) {
        findings.push({
          player: label, team: stint.team.name, era: stint.era, severity: 'warn',
          message: `usageRate=${usage} is outside [${min}, ${max}]`,
        });
      }
    }

    // 4. Internal consistency: fgPct, threePtPct, and threePtRate together
    // imply a 2-point percentage (fgPct is a volume-weighted blend of 2PT%
    // and 3PT%). If threePtRate is meaningful and the implied 2PT% falls
    // outside a realistic band, the three numbers can't all be right
    // together — even if each one individually looks fine in isolation.
    // Skipped for estimated 3PT rows (hypothetical by construction, not a
    // real blend to sanity-check) and for negligible 3PA share (a couple
    // of makes/misses on a tiny sample isn't a meaningful signal either way).
    const fgPct = get('fg_pct');
    if (fgPct !== undefined && threePct !== undefined && threeRate !== undefined && !isEstimated('three_pt_pct') && threeRate > 0.03) {
      const impliedTwoPtPct = (fgPct - threeRate * threePct) / (1 - threeRate);
      if (impliedTwoPtPct < 0.35 || impliedTwoPtPct > 0.75) {
        findings.push({
          player: label, team: stint.team.name, era: stint.era, severity: 'error',
          message: `fg_pct=${fgPct}, three_pt_pct=${threePct}, three_pt_rate=${threeRate} together imply an unrealistic 2-point FG% of ${impliedTwoPtPct.toFixed(3)} — these three numbers are inconsistent with each other`,
        });
      }
    }
  }

  console.log(`Checked ${stints.length} stints.\n`);
  if (findings.length === 0) {
    console.log('No plausibility issues found.');
  } else {
    const errors = findings.filter((f) => f.severity === 'error');
    const warns = findings.filter((f) => f.severity === 'warn');
    console.log(`${errors.length} error(s), ${warns.length} warning(s):\n`);
    for (const f of [...errors, ...warns]) {
      console.log(`[${f.severity.toUpperCase()}] ${f.player}: ${f.message}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
