import { GameResult } from '@roster-duel/sim-engine';
import { generateGameRecap } from './generateGameRecap';
import { createFakeRecapGenerator } from './testUtils';
import { RecapPromptInput } from './types';

function makeGameResult(overrides: Partial<GameResult> = {}): GameResult {
  return {
    teamA: { teamId: 'A', teamName: 'Team Alpha', score: 100 },
    teamB: { teamId: 'B', teamName: 'Team Beta', score: 98 },
    winner: 'A',
    boxScore: { teamA: [], teamB: [] },
    possessionLog: [],
    highlights: [],
    overtimePeriods: 0,
    mvp: { playerId: 'a1', playerName: 'Alpha One', teamId: 'A', mvpScore: 0.8, boxScoreComponent: 0.7, leverageComponent: 1 },
    ...overrides,
  };
}

describe('generateGameRecap', () => {
  it('adapts a GameResult into a RecapPromptInput and returns the generator output', async () => {
    let captured: RecapPromptInput | undefined;
    const fake = createFakeRecapGenerator({ headline: 'Alpha Wins It', article: 'A great game.' }, (input) => {
      captured = input;
    });

    const result = await generateGameRecap(fake, makeGameResult());

    expect(result).toEqual({ headline: 'Alpha Wins It', article: 'A great game.' });
    expect(captured?.teamAName).toBe('Team Alpha');
    expect(captured?.teamBName).toBe('Team Beta');
    expect(captured?.scoreA).toBe(100);
    expect(captured?.scoreB).toBe(98);
    expect(captured?.winnerName).toBe('Team Alpha');
    expect(captured?.mvp.playerName).toBe('Alpha One');
  });

  it('resolves the winner name from team B when team B wins', async () => {
    let captured: RecapPromptInput | undefined;
    const fake = createFakeRecapGenerator({ headline: 'h', article: 'a' }, (input) => {
      captured = input;
    });

    await generateGameRecap(fake, makeGameResult({ winner: 'B', teamA: { teamId: 'A', teamName: 'Team Alpha', score: 90 }, teamB: { teamId: 'B', teamName: 'Team Beta', score: 95 } }));

    expect(captured?.winnerName).toBe('Team Beta');
  });
});
