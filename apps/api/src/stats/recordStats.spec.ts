import { buildLeaderboard, computeRecord } from './recordStats';

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

describe('computeRecord', () => {
  it('returns zeros for no games', () => {
    expect(computeRecord([])).toEqual({
      gamesPlayed: 0,
      overallWins: 0,
      overallLosses: 0,
      last10Wins: 0,
      last10Losses: 0,
    });
  });

  it('computes overall wins/losses', () => {
    const entries = [
      { createdAt: daysAgo(3), won: true },
      { createdAt: daysAgo(2), won: false },
      { createdAt: daysAgo(1), won: true },
    ];
    const record = computeRecord(entries);
    expect(record.gamesPlayed).toBe(3);
    expect(record.overallWins).toBe(2);
    expect(record.overallLosses).toBe(1);
  });

  it('scopes last-10 to only the most recent 10 games, not the full history', () => {
    // 15 games: the oldest 5 are all wins, the most recent 10 are all losses.
    const entries = [
      ...Array.from({ length: 5 }, (_, i) => ({ createdAt: daysAgo(20 - i), won: true })),
      ...Array.from({ length: 10 }, (_, i) => ({ createdAt: daysAgo(9 - i), won: false })),
    ];
    const record = computeRecord(entries);
    expect(record.gamesPlayed).toBe(15);
    expect(record.overallWins).toBe(5);
    expect(record.overallLosses).toBe(10);
    expect(record.last10Wins).toBe(0);
    expect(record.last10Losses).toBe(10);
  });

  it('does not mutate the input array order', () => {
    const entries = [
      { createdAt: daysAgo(1), won: true },
      { createdAt: daysAgo(5), won: false },
    ];
    const copy = [...entries];
    computeRecord(entries);
    expect(entries).toEqual(copy);
  });
});

describe('buildLeaderboard', () => {
  it('tallies wins and losses per user across matches', () => {
    const results = [
      { userId: 'a', won: true },
      { userId: 'b', won: false },
      { userId: 'a', won: true },
      { userId: 'c', won: false },
    ];
    const names = new Map([
      ['a', 'Alpha'],
      ['b', 'Beta'],
      ['c', 'Gamma'],
    ]);

    const board = buildLeaderboard(results, names, 10);

    expect(board).toEqual([
      { userId: 'a', displayName: 'Alpha', wins: 2, losses: 0 },
      { userId: 'b', displayName: 'Beta', wins: 0, losses: 1 },
      { userId: 'c', displayName: 'Gamma', wins: 0, losses: 1 },
    ]);
  });

  it('sorts by wins descending, then losses ascending as a tiebreaker', () => {
    const results = [
      { userId: 'a', won: true },
      { userId: 'a', won: false },
      { userId: 'a', won: false },
      { userId: 'b', won: true },
      { userId: 'b', won: false },
    ];
    const names = new Map([
      ['a', 'Alpha'],
      ['b', 'Beta'],
    ]);

    const board = buildLeaderboard(results, names, 10);
    expect(board.map((e) => e.userId)).toEqual(['b', 'a']);
  });

  it('respects the limit', () => {
    const results = [
      { userId: 'a', won: true },
      { userId: 'b', won: true },
      { userId: 'c', won: true },
    ];
    const names = new Map([
      ['a', 'Alpha'],
      ['b', 'Beta'],
      ['c', 'Gamma'],
    ]);

    expect(buildLeaderboard(results, names, 2)).toHaveLength(2);
  });

  it('falls back to "Unknown" if a display name is missing', () => {
    const board = buildLeaderboard([{ userId: 'x', won: true }], new Map(), 10);
    expect(board[0].displayName).toBe('Unknown');
  });
});
