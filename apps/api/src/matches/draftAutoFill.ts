export interface RatedCandidate {
  id: string;
  position: string;
  baseRating: number;
}

/**
 * Fills any empty slots in a roster with the highest-rated available
 * player at that position — used when a draft timer expires (spec section
 * 4: "auto-lock their roster with whatever picks they've made plus
 * randomly/optimally filled remaining slots"). "Optimally" here means
 * highest base_rating; a player already used elsewhere in THIS roster is
 * skipped (a player can't fill two slots on the same roster), but the
 * opponent's picks are irrelevant — both rosters draft from the same
 * always-available pool (see schema.prisma header for why).
 *
 * Pure and synchronous so it's testable without touching the DB — the
 * caller is responsible for fetching `candidates` (already sorted by
 * position, doesn't need to be pre-sorted by rating; this function sorts).
 */
export function autoFillRosterSlots(
  positions: readonly string[],
  currentSlots: Record<string, string | undefined>,
  candidates: readonly RatedCandidate[],
): Record<string, string> {
  const filled: Record<string, string> = { ...currentSlots } as Record<string, string>;
  const used = new Set(Object.values(filled).filter((id): id is string => Boolean(id)));

  const byPosition = new Map<string, RatedCandidate[]>();
  for (const candidate of candidates) {
    const list = byPosition.get(candidate.position) ?? [];
    list.push(candidate);
    byPosition.set(candidate.position, list);
  }
  for (const list of byPosition.values()) {
    list.sort((a, b) => b.baseRating - a.baseRating);
  }

  for (const position of positions) {
    if (filled[position]) continue;
    const pick = (byPosition.get(position) ?? []).find((c) => !used.has(c.id));
    if (pick) {
      filled[position] = pick.id;
      used.add(pick.id);
    }
  }

  return filled;
}
