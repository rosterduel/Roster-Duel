/**
 * Single source of truth for a respin button's displayed remaining count
 * AND its clickability — both must be derived from the same two inputs,
 * or the two can disagree (the bug this replaced: the displayed count was
 * computed from `usedGlobally` alone while clickability also factored in
 * `available`, which covers a second, distinct reason to be unusable — no
 * alternative combo to respin into this round, a "dead end" per
 * slotAssignment.ts's hasTeamRespinAlternative/hasEraRespinAlternative,
 * wholly independent of whether the resource has ever been spent).
 *
 * - `usedGlobally`: this roster has already spent its one respin of this
 *   type, for the whole draft.
 * - `available`: the backend's per-round `teamRespinAvailable`/
 *   `eraRespinAvailable` — false whenever `usedGlobally` is true OR
 *   there's no alternative to respin into for the CURRENT round's combo.
 */
export interface RespinDisplay {
  remaining: number;
  disabled: boolean;
}

export function computeRespinDisplay(usedGlobally: boolean, available: boolean): RespinDisplay {
  const disabled = usedGlobally || !available;
  return { remaining: disabled ? 0 : 1, disabled };
}
