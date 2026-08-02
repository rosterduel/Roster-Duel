/**
 * Pure logic for spec 4c's team+era random-assignment and respin mechanic —
 * no DB access here (the caller in matches.service.ts is responsible for
 * loading `availableCombos` from Postgres and calling these), so it's
 * testable without touching the database.
 */

export interface TeamEraCombo {
  teamId: string;
  era: string;
}

function sameCombo(a: TeamEraCombo, b: TeamEraCombo): boolean {
  return a.teamId === b.teamId && a.era === b.era;
}

/**
 * Draws a random team+era combo from the actually-seeded, (optionally
 * match-filtered) pool. `exclude`, when given, removes that exact combo
 * from consideration first — used for respins, so spending a respin is
 * never a no-op that lands back on the same value. Returns null if the
 * pool is empty after excluding (the caller must have already checked
 * `hasTeamRespinAlternative`/`hasEraRespinAlternative` before offering a
 * respin in the first place; this is the defensive fallback).
 */
export function drawRandomCombo(availableCombos: readonly TeamEraCombo[], exclude?: TeamEraCombo, random: () => number = Math.random): TeamEraCombo | null {
  const pool = exclude ? availableCombos.filter((c) => !sameCombo(c, exclude)) : availableCombos;
  if (pool.length === 0) return null;
  const index = Math.floor(random() * pool.length);
  return pool[index];
}

/**
 * Team respin: keep era fixed, swap team. Dead-ends (no alternative) when
 * `current` is the only team seeded for that era — e.g. "New York +
 * seventies" (New York is the only seeded seventies team). This is a
 * different check from `hasEraRespinAlternative` — a slot can be dead-
 * ended on one respin type and not the other.
 */
export function hasTeamRespinAlternative(current: TeamEraCombo, availableCombos: readonly TeamEraCombo[]): boolean {
  return availableCombos.some((c) => c.era === current.era && c.teamId !== current.teamId);
}

/**
 * Era respin: keep team fixed, swap era. Dead-ends when `current` is the
 * only era seeded for that team — e.g. most teams in the current 14-combo
 * pool have exactly one seeded era each (see README's respin dead-end
 * documentation).
 */
export function hasEraRespinAlternative(current: TeamEraCombo, availableCombos: readonly TeamEraCombo[]): boolean {
  return availableCombos.some((c) => c.teamId === current.teamId && c.era !== current.era);
}

/** Draws a Team respin result: same era, a different team (spec 4c). Null if `hasTeamRespinAlternative` would be false. */
export function drawTeamRespinCombo(current: TeamEraCombo, availableCombos: readonly TeamEraCombo[], random: () => number = Math.random): TeamEraCombo | null {
  const sameEraPool = availableCombos.filter((c) => c.era === current.era);
  return drawRandomCombo(sameEraPool, current, random);
}

/** Draws an Era respin result: same team, a different era (spec 4c). Null if `hasEraRespinAlternative` would be false. */
export function drawEraRespinCombo(current: TeamEraCombo, availableCombos: readonly TeamEraCombo[], random: () => number = Math.random): TeamEraCombo | null {
  const sameTeamPool = availableCombos.filter((c) => c.teamId === current.teamId);
  return drawRandomCombo(sameTeamPool, current, random);
}
