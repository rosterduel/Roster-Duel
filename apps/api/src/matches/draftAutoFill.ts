export interface RatedCandidate {
  id: string;
  /** Stable identity for the real person this stint represents (spec 4c/4f) — used for cross-slot duplicate prevention. */
  personKey: string;
  baseRating: number;
}

/**
 * Fills any empty slots in a roster with the highest-rated available
 * player at that slot — used when a draft timer expires (spec section 4:
 * "auto-lock their roster with whatever picks they've made plus randomly/
 * optimally filled remaining slots"). "Optimally" here means highest
 * base_rating.
 *
 * `candidatesBySlot` is keyed by slot position, already scoped by the
 * caller to that specific slot's assigned team+era combo AND position
 * eligibility (spec 4c/4f — every slot draws from its own combo, not a
 * shared free-browse pool; 6MAN's candidate list should include everyone
 * from that slot's combo unfiltered by position, per spec 4f's flex rule).
 * This function itself is combo-agnostic — it just picks the best
 * available candidate per slot from whatever list it's given.
 *
 * Duplicate prevention is personKey-based (spec 4c/4f: the same real
 * person can't fill two slots on one roster, regardless of which stint or
 * eligible position got them there) — `usedPersonKeys` seeds this from
 * slots already filled before this call; personKeys picked during this
 * same autofill pass are tracked as they go.
 *
 * Pure and synchronous so it's testable without touching the DB.
 */
export function autoFillRosterSlots(
  positions: readonly string[],
  currentSlots: Record<string, string | undefined>,
  candidatesBySlot: Readonly<Record<string, readonly RatedCandidate[]>>,
  usedPersonKeys: ReadonlySet<string> = new Set(),
): Record<string, string> {
  const filled: Record<string, string> = { ...currentSlots } as Record<string, string>;
  const usedStintIds = new Set(Object.values(filled).filter((id): id is string => Boolean(id)));
  const usedKeys = new Set(usedPersonKeys);

  for (const position of positions) {
    if (filled[position]) continue;
    const pool = [...(candidatesBySlot[position] ?? [])].sort((a, b) => b.baseRating - a.baseRating);
    const pick = pool.find((c) => !usedStintIds.has(c.id) && !usedKeys.has(c.personKey));
    if (pick) {
      filled[position] = pick.id;
      usedStintIds.add(pick.id);
      usedKeys.add(pick.personKey);
    }
  }

  return filled;
}
