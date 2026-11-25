import { buildMatchHistory, HistorySourceMatch } from './matchHistory';

function match(overrides: Partial<HistorySourceMatch>): HistorySourceMatch {
  return {
    roomCode: 'ABC123',
    matchType: 'friend_link',
    createdAt: new Date('2026-11-01T00:00:00Z'),
    sideAUserId: 'me',
    sideBUserId: 'them',
    sideAName: 'Jeff',
    sideBName: 'Rival',
    scoreA: 110,
    scoreB: 100,
    headline: null,
    ...overrides,
  };
}

describe('buildMatchHistory', () => {
  it('reports each match from your side of the scoreboard', () => {
    const history = buildMatchHistory('me', [
      match({ roomCode: 'AAA', sideAUserId: 'me', scoreA: 110, scoreB: 100 }),
      match({ roomCode: 'BBB', sideAUserId: 'them', sideBUserId: 'me', sideAName: 'Rival', sideBName: 'Jeff', scoreA: 120, scoreB: 99 }),
    ]);
    const byCode = Object.fromEntries(history.matches.map((m) => [m.roomCode, m]));
    expect(byCode.AAA).toMatchObject({ yourScore: 110, opponentScore: 100, result: 'win', opponentName: 'Rival' });
    expect(byCode.BBB).toMatchObject({ yourScore: 99, opponentScore: 120, result: 'loss', opponentName: 'Rival' });
  });

  it('lists newest first and caps the list, but counts every friend game in the record', () => {
    const source = [1, 2, 3].map((day) => match({ roomCode: `D${day}`, createdAt: new Date(`2026-11-0${day}T00:00:00Z`) }));
    const history = buildMatchHistory('me', source, 2);
    expect(history.matches.map((m) => m.roomCode)).toEqual(['D3', 'D2']);
    expect(history.friendRecord).toEqual({ gamesPlayed: 3, wins: 3, losses: 0 });
  });

  it('keeps ranked games out of the friend record', () => {
    const history = buildMatchHistory('me', [match({ matchType: 'random_matchmaking' })]);
    expect(history.matches).toHaveLength(1);
    expect(history.friendRecord.gamesPlayed).toBe(0);
  });

  it('shows games against yourself without counting them', () => {
    const history = buildMatchHistory('me', [match({ sideBUserId: 'me' })]);
    expect(history.matches[0]).toMatchObject({ result: 'self', opponentName: 'Yourself' });
    expect(history.friendRecord.gamesPlayed).toBe(0);
  });

  it('skips matches the player was not in', () => {
    expect(buildMatchHistory('me', [match({ sideAUserId: 'x', sideBUserId: 'y' })]).matches).toHaveLength(0);
  });
});
