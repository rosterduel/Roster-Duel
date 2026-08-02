/**
 * Confirms every seeded team+era combo has at least one eligible player
 * for each of the 5 real required NBA positions (spec section 4f) — 6th
 * Man is deliberately excluded from this check since it's a roster-slot
 * flex exemption, not a position any player needs to be "eligible" for
 * (any player from the combo fills it, unfiltered).
 *
 * This is the automated check promised when eligiblePositions replaced
 * primaryPosition: since every player's eligiblePositions array always
 * includes whatever position originally guaranteed this combo's coverage,
 * a gap here should be structurally impossible — this script proves that,
 * rather than just asserting it, and is safe to re-run any time the seed
 * data changes (e.g. a future combo added, or an existing player's
 * eligiblePositions edited).
 *
 * Not a Jest test (needs a live, seeded database) — a standalone script in
 * the same spirit as checkStatPlausibility.ts. Run with:
 *   npx ts-node --transpile-only scripts/checkPositionCoverage.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const REQUIRED_POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'] as const;

async function main() {
  const stints = await prisma.playerStint.findMany({ include: { team: true } });

  const byCombo = new Map<string, typeof stints>();
  for (const stint of stints) {
    const key = `${stint.team.name}/${stint.era}`;
    byCombo.set(key, [...(byCombo.get(key) ?? []), stint]);
  }

  let issues = 0;
  for (const [combo, players] of byCombo) {
    for (const position of REQUIRED_POSITIONS) {
      const eligible = players.filter((p) => p.eligiblePositions.includes(position));
      if (eligible.length === 0) {
        console.log(`[EMPTY POOL] ${combo}: no player eligible for ${position}`);
        issues++;
      }
    }
  }

  console.log(`\nChecked ${byCombo.size} team+era combos across ${REQUIRED_POSITIONS.length} required positions each.`);
  console.log(issues === 0 ? 'No empty-pool gaps found.' : `${issues} empty-pool gap(s) found — see above.`);

  await prisma.$disconnect();
  if (issues > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
