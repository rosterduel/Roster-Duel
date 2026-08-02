/**
 * Pure logic for spec 4c/4f's per-slot draft pool: position-eligibility
 * filtering (6th Man is a flex — unfiltered) and personKey-based duplicate
 * ("grayout") detection across a roster's already-picked slots. No DB
 * access — matches.service.ts loads the data and calls these.
 */

export interface PoolStint {
  id: string;
  personKey: string;
  eligiblePositions: string[];
}

/** Filters a combo's stints to those eligible for the given slot position. 6MAN is unfiltered — any player from the combo is eligible (spec 4f). */
export function filterEligibleForSlot(stints: readonly PoolStint[], slotPosition: string): PoolStint[] {
  if (slotPosition === '6MAN') return [...stints];
  return stints.filter((s) => s.eligiblePositions.includes(slotPosition));
}

/**
 * Builds a personKey -> slot-position map from a roster's currently-picked
 * slots. Used to compute grayout (spec 4c/4f): a real person already
 * picked into ANY slot must show grayed-out everywhere else they'd be
 * eligible — across different stints of the same person AND across
 * different eligible positions of the same stint.
 */
export function buildPersonKeyToSlot(pickedStints: readonly { slotPosition: string; personKey: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const { slotPosition, personKey } of pickedStints) {
    map.set(personKey, slotPosition);
  }
  return map;
}

/**
 * True if this pool entry represents a real person already picked into a
 * DIFFERENT slot on this roster — the entry currently selected for slot
 * `slotPosition` itself is never flagged as a duplicate of itself.
 */
export function isDuplicateInSlot(personKey: string, slotPosition: string, personKeyToSlot: ReadonlyMap<string, string>): boolean {
  const usedSlot = personKeyToSlot.get(personKey);
  return usedSlot !== undefined && usedSlot !== slotPosition;
}
