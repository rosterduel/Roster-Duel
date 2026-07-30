import { createSeededRandom, weightedRandom, weightedRandomBy } from './rng';

describe('createSeededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createSeededRandom(1);
    const b = createSeededRandom(2);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('stays within [0, 1)', () => {
    const rand = createSeededRandom(7);
    for (let i = 0; i < 1000; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('weightedRandom', () => {
  it('always picks the only nonzero-weight key', () => {
    const rand = createSeededRandom(1);
    for (let i = 0; i < 50; i++) {
      const result = weightedRandom({ a: 1, b: 0, c: 0 }, rand);
      expect(result).toBe('a');
    }
  });

  it('respects weighting over many draws', () => {
    const rand = createSeededRandom(99);
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 5000; i++) {
      counts[weightedRandom({ a: 0.9, b: 0.1 }, rand)]++;
    }
    const aShare = counts.a / 5000;
    expect(aShare).toBeGreaterThan(0.85);
    expect(aShare).toBeLessThan(0.95);
  });
});

describe('weightedRandomBy', () => {
  it('always picks the only nonzero-weight item', () => {
    const rand = createSeededRandom(3);
    const items = [{ id: 'x', w: 0 }, { id: 'y', w: 5 }, { id: 'z', w: 0 }];
    for (let i = 0; i < 50; i++) {
      expect(weightedRandomBy(items, (it) => it.w, rand).id).toBe('y');
    }
  });

  it('falls back to uniform selection when all weights are zero', () => {
    const rand = createSeededRandom(3);
    const items = [{ id: 'x', w: 0 }, { id: 'y', w: 0 }];
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      seen.add(weightedRandomBy(items, (it) => it.w, rand).id);
    }
    expect(seen.size).toBe(2);
  });

  it('throws on an empty list', () => {
    const rand = createSeededRandom(3);
    expect(() => weightedRandomBy([], () => 1, rand)).toThrow();
  });
});
