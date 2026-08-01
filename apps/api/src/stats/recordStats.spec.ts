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
  // Helper: N results for a user with the given number of wins/losses.
  function record(userId: string, wins: number, losses: number): { userId: string; won: boolean }[] {
    return [...Array(wins).fill({ userId, won: true }), ...Array(losses).fill({ userId, won: false })];
  }

  it('tallies wins, losses, gamesPlayed, and winPct per user', () => {
    const results = record('a', 16, 4);
    const names = new Map([['a', 'Alpha']]);

    const board = buildLeaderboard(results, names, { limit: 10, minGames: 20 });

    expect(board).toEqual([{ userId: 'a', displayName: 'Alpha', wins: 16, losses: 4, gamesPlayed: 20, winPct: 0.8 }]);
  });

  it('excludes players below the minimum games threshold from the ranking entirely', () => {
    const results = [...record('a', 15, 4), ...record('b', 12, 8)]; // a: 19 games, b: 20 games
    const names = new Map([
      ['a', 'Alpha'],
      ['b', 'Beta'],
    ]);

    const board = buildLeaderboard(results, names, { limit: 10, minGames: 20 });

    expect(board.map((e) => e.userId)).toEqual(['b']);
  });

  it('ranks by win percentage, not raw win count', () => {
    // a: 15-5 (75%, 20 games) vs b: 16-14 (53.3%, 30 games) — b has more
    // raw wins but a should rank higher on win%.
    const results = [...record('a', 15, 5), ...record('b', 16, 14)];
    const names = new Map([
      ['a', 'Alpha'],
      ['b', 'Beta'],
    ]);

    const board = buildLeaderboard(results, names, { limit: 10, minGames: 20 });
    expect(board.map((e) => e.userId)).toEqual(['a', 'b']);
  });

  it('breaks a tied win percentage by total wins', () => {
    // Both at exactly 60% — a over 20 games, b over 30 games — b has more wins.
    const results = [...record('a', 12, 8), ...record('b', 18, 12)];
    const names = new Map([
      ['a', 'Alpha'],
      ['b', 'Beta'],
    ]);

    const board = buildLeaderboard(results, names, { limit: 10, minGames: 20 });
    expect(board.map((e) => e.userId)).toEqual(['b', 'a']);
  });

  it('respects the limit', () => {
    const results = [...record('a', 20, 0), ...record('b', 20, 0), ...record('c', 20, 0)];
    const names = new Map([
      ['a', 'Alpha'],
      ['b', 'Beta'],
      ['c', 'Gamma'],
    ]);

    expect(buildLeaderboard(results, names, { limit: 2, minGames: 20 })).toHaveLength(2);
  });

  it('falls back to "Unknown" if a display name is missing', () => {
    const board = buildLeaderboard(record('x', 20, 0), new Map(), { limit: 10, minGames: 20 });
    expect(board[0].displayName).toBe('Unknown');
  });
});
