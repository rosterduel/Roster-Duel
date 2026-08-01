import { GameMvp, PlayerBoxScoreLine } from '@roster-duel/sim-engine';
import { RecapPromptInput } from './types';
import { validateRecapGrounding } from './validateRecapGrounding';

function boxLine(overrides: Partial<PlayerBoxScoreLine> & { playerId: string; name: string }): PlayerBoxScoreLine {
  return {
    position: 'PG',
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threesMade: 0,
    threesAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    ...overrides,
  };
}

function baseInput(): RecapPromptInput {
  const mvp: GameMvp = {
    playerId: 'a1',
    playerName: 'Alpha One',
    teamId: 'A',
    mvpScore: 0.8,
    boxScoreComponent: 0.7,
    leverageComponent: 1,
  };

  return {
    teamAName: 'Team Alpha',
    teamBName: 'Team Beta',
    scoreA: 100,
    scoreB: 98,
    winnerName: 'Team Alpha',
    overtimePeriods: 0,
    boxScore: {
      teamA: [boxLine({ playerId: 'a1', name: 'Alpha One', points: 28 })],
      teamB: [boxLine({ playerId: 'b1', name: 'Beta One', points: 20 })],
    },
    highlights: [],
    mvp,
  };
}

describe('validateRecapGrounding', () => {
  it('passes a recap that names the MVP and no unlisted players', () => {
    const recap = { headline: 'Alpha One Leads the Way', article: 'Alpha One was brilliant in the win over Team Beta.' };
    const issues = validateRecapGrounding(recap, baseInput(), ['LeBron James', 'Stephen Curry']);
    expect(issues).toHaveLength(0);
  });

  it('flags a recap that never mentions the Game MVP by name', () => {
    const recap = { headline: 'Team Alpha Wins', article: 'A hard-fought battle throughout.' };
    const issues = validateRecapGrounding(recap, baseInput(), []);
    expect(issues).toContainEqual(expect.objectContaining({ type: 'missing_mvp_mention' }));
  });

  it('flags a real player mentioned by name who is not in this game', () => {
    const recap = {
      headline: 'Alpha One Outduels a Legend',
      article: 'Alpha One dropped 28, but it was LeBron James who drew all the pregame hype.',
    };
    const issues = validateRecapGrounding(recap, baseInput(), ['LeBron James', 'Stephen Curry']);
    expect(issues).toContainEqual(
      expect.objectContaining({ type: 'unlisted_player_mentioned', detail: expect.stringContaining('LeBron James') }),
    );
  });

  it('does not flag a rostered player even though they are also in the known-names pool', () => {
    const recap = { headline: 'Alpha One Leads the Way', article: 'Alpha One was brilliant.' };
    // Alpha One is both a rostered player AND happens to be in the wider known-name pool.
    const issues = validateRecapGrounding(recap, baseInput(), ['Alpha One', 'LeBron James']);
    expect(issues.some((i) => i.type === 'unlisted_player_mentioned')).toBe(false);
  });

  it('returns multiple issues when more than one problem is present', () => {
    const recap = { headline: 'A Random Recap', article: 'Stephen Curry had a great night, unrelated to this game entirely.' };
    const issues = validateRecapGrounding(recap, baseInput(), ['Stephen Curry']);
    expect(issues).toContainEqual(expect.objectContaining({ type: 'missing_mvp_mention' }));
    expect(issues).toContainEqual(expect.objectContaining({ type: 'unlisted_player_mentioned' }));
    expect(issues).toHaveLength(2);
  });
});
