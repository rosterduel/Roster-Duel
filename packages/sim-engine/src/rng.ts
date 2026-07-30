export type RandomFn = () => number;

/**
 * Deterministic PRNG (mulberry32) so simulations and tests are reproducible
 * from a seed instead of depending on Math.random.
 */
export function createSeededRandom(seed: number): RandomFn {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Picks a key from a weight map, proportional to its weight. */
export function weightedRandom<T extends string>(weights: Record<T, number>, rand: RandomFn): T {
  const keys = Object.keys(weights) as T[];
  const total = keys.reduce((sum, k) => sum + weights[k], 0);
  let roll = rand() * total;
  for (const key of keys) {
    roll -= weights[key];
    if (roll <= 0) return key;
  }
  return keys[keys.length - 1];
}

/** Picks an item from a list, proportional to weightFn(item). */
export function weightedRandomBy<T>(items: T[], weightFn: (item: T) => number, rand: RandomFn): T {
  if (items.length === 0) {
    throw new Error('weightedRandomBy: items must not be empty');
  }
  const weights = items.map(weightFn);
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) {
    // No signal to weight by (e.g. every candidate has 0 rate) — fall back to uniform.
    return items[Math.floor(rand() * items.length)];
  }
  let roll = rand() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}
