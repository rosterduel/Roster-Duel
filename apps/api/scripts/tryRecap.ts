/**
 * Manual, live verification for the recap service (spec section 4b) — the
 * one piece of this repo that needs a real external credential. Simulates
 * a sample game with the sim-engine (no DB needed) and sends it to the
 * real Anthropic API to generate a headline + article.
 *
 * Requires ANTHROPIC_API_KEY to be set (see apps/api/.env.example). Not a
 * Jest test — the recap unit tests use a fake generator and never touch
 * the network. Run with:
 *   ANTHROPIC_API_KEY=sk-... npm run try:recap -w apps/api
 */
import { simulateGame, TeamInput } from '@roster-duel/sim-engine';
import { createAnthropicRecapGenerator } from '../src/recap/anthropicRecapGenerator';
import { generateGameRecap } from '../src/recap/generateGameRecap';

const teamLegends: TeamInput = {
  teamId: 'legends',
  teamName: 'The Legends',
  players: [
    { id: 'l1', name: 'Magic Johnson', position: 'PG', offenseRating: 78, defenseRating: 60, usageRate: 0.24, assistRate: 0.45, reboundRate: 0.12, stealRate: 0.15, blockRate: 0.02, threePointRate: 0.1, freeThrowPct: 0.85 },
    { id: 'l2', name: 'Michael Jordan', position: 'SG', offenseRating: 90, defenseRating: 75, usageRate: 0.32, assistRate: 0.15, reboundRate: 0.1, stealRate: 0.2, blockRate: 0.05, threePointRate: 0.2, freeThrowPct: 0.84 },
    { id: 'l3', name: 'Larry Bird', position: 'SF', offenseRating: 82, defenseRating: 55, usageRate: 0.26, assistRate: 0.2, reboundRate: 0.18, stealRate: 0.1, blockRate: 0.02, threePointRate: 0.25, freeThrowPct: 0.88 },
    { id: 'l4', name: 'Karl Malone', position: 'PF', offenseRating: 75, defenseRating: 62, usageRate: 0.25, assistRate: 0.08, reboundRate: 0.22, stealRate: 0.08, blockRate: 0.06, threePointRate: 0.02, freeThrowPct: 0.74 },
    { id: 'l5', name: 'Kareem Abdul-Jabbar', position: 'C', offenseRating: 80, defenseRating: 78, usageRate: 0.27, assistRate: 0.1, reboundRate: 0.24, stealRate: 0.04, blockRate: 0.15, threePointRate: 0.0, freeThrowPct: 0.72 },
    { id: 'l6', name: 'Manu Ginobili', position: '6MAN', offenseRating: 65, defenseRating: 58, usageRate: 0.2, assistRate: 0.18, reboundRate: 0.1, stealRate: 0.12, blockRate: 0.02, threePointRate: 0.35, freeThrowPct: 0.83 },
  ],
};

const teamModern: TeamInput = {
  teamId: 'modern',
  teamName: 'The Modern Game',
  players: [
    { id: 'm1', name: 'Stephen Curry', position: 'PG', offenseRating: 92, defenseRating: 45, usageRate: 0.3, assistRate: 0.3, reboundRate: 0.08, stealRate: 0.1, blockRate: 0.01, threePointRate: 0.6, freeThrowPct: 0.91 },
    { id: 'm2', name: 'James Harden', position: 'SG', offenseRating: 85, defenseRating: 40, usageRate: 0.31, assistRate: 0.35, reboundRate: 0.1, stealRate: 0.09, blockRate: 0.01, threePointRate: 0.45, freeThrowPct: 0.86 },
    { id: 'm3', name: 'LeBron James', position: 'SF', offenseRating: 88, defenseRating: 65, usageRate: 0.29, assistRate: 0.35, reboundRate: 0.15, stealRate: 0.12, blockRate: 0.04, threePointRate: 0.3, freeThrowPct: 0.73 },
    { id: 'm4', name: 'Giannis Antetokounmpo', position: 'PF', offenseRating: 84, defenseRating: 72, usageRate: 0.32, assistRate: 0.2, reboundRate: 0.25, stealRate: 0.08, blockRate: 0.1, threePointRate: 0.1, freeThrowPct: 0.68 },
    { id: 'm5', name: 'Nikola Jokić', position: 'C', offenseRating: 87, defenseRating: 55, usageRate: 0.28, assistRate: 0.4, reboundRate: 0.28, stealRate: 0.1, blockRate: 0.05, threePointRate: 0.2, freeThrowPct: 0.82 },
    { id: 'm6', name: 'Lou Williams', position: '6MAN', offenseRating: 60, defenseRating: 35, usageRate: 0.22, assistRate: 0.2, reboundRate: 0.06, stealRate: 0.07, blockRate: 0.01, threePointRate: 0.35, freeThrowPct: 0.85 },
  ],
};

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      'ANTHROPIC_API_KEY is not set. This script calls the real Anthropic API and needs a key.\n' +
        'Get one at https://console.anthropic.com/settings/keys, then either add it to apps/api/.env\n' +
        'or run: ANTHROPIC_API_KEY=sk-... npm run try:recap -w apps/api',
    );
    process.exit(1);
  }

  const seed = process.argv[2] ? Number(process.argv[2]) : Date.now();
  const game = simulateGame({ teamA: teamLegends, teamB: teamModern, seed });

  console.log(`Simulated game (seed ${seed}): ${game.teamA.teamName} ${game.teamA.score} — ${game.teamB.score} ${game.teamB.teamName}`);
  console.log(`Computed MVP: ${game.mvp.playerName}\n`);
  console.log('Calling Anthropic API for the recap...\n');

  const generator = createAnthropicRecapGenerator();
  const recap = await generateGameRecap(generator, game);

  console.log('='.repeat(70));
  console.log(recap.headline);
  console.log('='.repeat(70));
  console.log(recap.article);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
