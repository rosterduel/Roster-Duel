/**
 * Pure logic for spec 4c/4f's sequential draft round: which of a player's
 * eligible positions are actually pickable given which slots are still
 * open (6th Man is a flex — unfiltered by eligiblePositions, but still
 * only pickable while the slot itself is open), and personKey-based
 * duplicate ("grayout") detection across a roster's already-locked picks.
 * No DB access — matches.service.ts loads the data and calls these.
 *
 * This supersedes the earlier per-slot-simultaneous design's
 * `filterEligibleForSlot` (which filtered a combo's roster DOWN TO one
 * slot's pool at roll time). Spec 4c's sequential redesign shows the FULL,
 * unfiltered roster on every roll — eligibility only narrows things down
 * at the moment of picking, to whichever open positions a tapped player
 * could actually fill.
 */

export interface PoolStint {
  id: string;
  personKey: string;
  eligiblePositions: string[];
}

/**
 * Which of `openPositions` this player could actually be drafted into
 * right now: the intersection of their real eligible positions with the
 * still-open slots, PLUS 6th Man whenever IT is open — 6th Man is a true
 * flex (spec 4f), so it's always a valid target regardless of
 * `eligiblePositions`. Empty return means "no open slot for this player"
 * (grayout reason, spec 4c step 4/5).
 */
export function openPositionsForPlayer(eligiblePositions: readonly string[], openPositions: readonly string[]): string[] {
  const matches = openPositions.filter((pos) => pos === '6MAN' || eligiblePositions.includes(pos));
  return matches;
}

/**
 * Builds a personKey -> slot-position map from a roster's currently-LOCKED
 * picks (one entry per round already resolved). Used to compute grayout
 * (spec 4c/4f): a real person already picked into ANY slot must show
 * grayed-out in every later round's roster where they'd otherwise appear.
 */
export function buildPersonKeyToSlot(pickedStints: readonly { slotPosition: string; personKey: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const { slotPosition, personKey } of pickedStints) {
    map.set(personKey, slotPosition);
  }
  return map;
}

/** True if this real person (by personKey) is already locked into a slot on this roster — grayed out, unselectable in the current round's roster. */
export function isAlreadyDrafted(personKey: string, personKeyToSlot: ReadonlyMap<string, string>): boolean {
  return personKeyToSlot.has(personKey);
}
