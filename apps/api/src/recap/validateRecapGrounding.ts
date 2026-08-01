import { GeneratedRecap, RecapPromptInput } from './types';

export interface RecapGroundingIssue {
  type: 'missing_mvp_mention' | 'unlisted_player_mentioned';
  detail: string;
}

/**
 * The recap prompt (buildRecapPrompt.ts) instructs the model to use only
 * the given data, but a prompt instruction isn't a guarantee — LLM output
 * isn't deterministic. This is a cheap, deterministic safety net run after
 * generation, catching the two most concrete and checkable failure modes:
 *
 * - The recap never actually names the Game MVP (spec section 4b requires
 *   an MVP callout, not just an implied one).
 * - The recap name-drops a real player who isn't in this game's box score
 *   at all — the most plausible hallucination for a sports-writing model,
 *   which has surely seen these exact names in training data. `knownRealPlayerNames`
 *   should be a wider name pool than just this game's 12 (e.g. the full
 *   seed catalog) so a swapped-in "LeBron James" gets caught even when
 *   he's not one of this game's players.
 *
 * This is NOT a full grounding verifier — it can't catch a fabricated stat
 * line for a real rostered player, an invented play, or a wrong score.
 * Doing that reliably would need a second model call to judge the first
 * one's output, which doubles cost/latency; not worth it for Phase 1 given
 * the prompt-level constraint already in place. Revisit if spot-checks
 * turn up real hallucinations this net misses.
 */
export function validateRecapGrounding(
  recap: GeneratedRecap,
  input: RecapPromptInput,
  knownRealPlayerNames: readonly string[] = [],
): RecapGroundingIssue[] {
  const issues: RecapGroundingIssue[] = [];
  const text = `${recap.headline} ${recap.article}`;

  if (!text.includes(input.mvp.playerName)) {
    issues.push({
      type: 'missing_mvp_mention',
      detail: `Game MVP "${input.mvp.playerName}" is never named in the recap.`,
    });
  }

  const rosterNames = new Set([...input.boxScore.teamA, ...input.boxScore.teamB].map((l) => l.name));
  for (const name of knownRealPlayerNames) {
    if (rosterNames.has(name)) continue; // actually in this game — fine to mention
    if (text.includes(name)) {
      issues.push({
        type: 'unlisted_player_mentioned',
        detail: `"${name}" is mentioned but did not play in this game.`,
      });
    }
  }

  return issues;
}
