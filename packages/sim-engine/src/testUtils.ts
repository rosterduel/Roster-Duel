import { RandomFn } from './rng';

/** Returns a RandomFn that yields the given values in sequence, for deterministic branch testing. */
export function createFixedRandom(values: number[]): RandomFn {
  let i = 0;
  return () => {
    if (i >= values.length) {
      throw new Error(`createFixedRandom: exhausted after ${values.length} call(s)`);
    }
    return values[i++];
  };
}
