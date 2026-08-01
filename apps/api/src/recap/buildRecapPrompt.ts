import { PlayerBoxScoreLine } from '@roster-duel/sim-engine';
import { RecapPromptInput } from './types';

export const RECAP_SYSTEM_PROMPT = `You are a sports journalist writing a postgame recap in the style of ESPN or a similar major outlet.

You will be given the final score, both teams' full box scores, the game's top-5 highlight plays (already ranked by how much each swung the outcome), and the Game MVP (already determined by the app, not something you decide).

Rules:
- Use ONLY the facts given below. Do not invent players, plays, stats, quotes, or storylines that aren't present in the data.
- Do not contradict any given fact (final score, box score numbers, highlight order/description).
- Reference the given Game MVP by name and explain why they earned it using the data provided.
- Write roughly 500-650 words, in flowing prose (not bullet points), covering the arc of the game — not just a stat recitation.
- Output a headline (under 12 words, capturing the game's storyline) and the article body.`;

function formatBoxLine(line: PlayerBoxScoreLine): string {
  return `${line.name} (${line.position}): ${line.points} pts, ${line.rebounds} reb, ${line.assists} ast, ${line.steals} stl, ${line.blocks} blk, ${line.turnovers} tov, ${line.fieldGoalsMade}/${line.fieldGoalsAttempted} FG, ${line.threesMade}/${line.threesAttempted} 3PT, ${line.freeThrowsMade}/${line.freeThrowsAttempted} FT`;
}

/**
 * Builds the user-turn prompt from grounded game data only — no fabricated
 * or inferred content. Pure and synchronous so it's independently testable
 * without touching the network.
 */
export function buildRecapPrompt(input: RecapPromptInput): string {
  const finalLabel = input.overtimePeriods > 0 ? `FINAL/${input.overtimePeriods > 1 ? `${input.overtimePeriods}OT` : 'OT'}` : 'FINAL';

  const boxScoreSection = [
    `${input.teamAName}:`,
    ...input.boxScore.teamA.map((l) => `  ${formatBoxLine(l)}`),
    `${input.teamBName}:`,
    ...input.boxScore.teamB.map((l) => `  ${formatBoxLine(l)}`),
  ].join('\n');

  const highlightsSection = input.highlights
    .map((h, i) => `${i + 1}. ${h.description} (win-probability swing: ${(Math.abs(h.leverageScore) * 100).toFixed(1)}%)`)
    .join('\n');

  const mvpTeamName = input.boxScore.teamA.some((l) => l.playerId === input.mvp.playerId) ? input.teamAName : input.teamBName;

  return `${finalLabel}: ${input.teamAName} ${input.scoreA} — ${input.scoreB} ${input.teamBName} (winner: ${input.winnerName})

BOX SCORE:
${boxScoreSection}

TOP-5 HIGHLIGHTS (in descending order of impact):
${highlightsSection}

GAME MVP: ${input.mvp.playerName} (${mvpTeamName}) — a blend of box-score impact and clutch-moment leverage picked this player; use the box score and highlight data above to justify it in prose, don't restate the raw score numbers.

Write the headline and recap article now, grounded only in the data above.`;
}
