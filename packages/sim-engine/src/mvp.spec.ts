import { computeMvp } from './mvp';
import { Highlight, PlayerBoxScoreLine } from './types';

function line(overrides: Partial<PlayerBoxScoreLine> & { playerId: string }): PlayerBoxScoreLine {
  return {
    name: overrides.playerId,
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

function highlight(overrides: Partial<Highlight> & { playerId: string; offenseTeamId: string; leverageScore: number }): Highlight {
  return {
    possessionIndex: 0,
    description: 'a play',
    playerName: overrides.playerId,
    periodSecondsRemaining: 100,
    quarter: 4,
    outcome: 'make_3',
    scoreAAfter: 90,
    scoreBAfter: 88,
    playType: 'three_pointer_made',
    startLocation: 'three_top',
    endLocation: 'paint',
    ...overrides,
  };
}

describe('computeMvp', () => {
  it('picks the player with the best box-score composite when leverage is equal (all zero)', () => {
    const teamA = {
      teamId: 'A',
      box: [
        line({ playerId: 'a1', points: 30, rebounds: 5, assists: 5 }),
        line({ playerId: 'a2', points: 5 }),
      ],
    };
    const teamB = {
      teamId: 'B',
      box: [line({ playerId: 'b1', points: 10 })],
    };

    const result = computeMvp(teamA, teamB, []);

    expect(result.playerId).toBe('a1');
    expect(result.teamId).toBe('A');
    expect(result.leverageComponent).toBe(0);
  });

  it('lets leverage break a tie when box-score composites are equal', () => {
    const teamA = {
      teamId: 'A',
      box: [line({ playerId: 'a1', points: 15, rebounds: 2, assists: 1 })],
    };
    const teamB = {
      teamId: 'B',
      box: [line({ playerId: 'b1', points: 15, rebounds: 2, assists: 1 })],
    };
    // a1 hits the game-winner — a big positive leverage swing for team A,
    // credited while a1 is on offense for team A. Box composites are
    // identical, so leverage is the only thing that can decide it.
    const highlights = [highlight({ playerId: 'a1', offenseTeamId: 'A', leverageScore: 0.45 })];

    const result = computeMvp(teamA, teamB, highlights);

    expect(result.playerId).toBe('a1');
    expect(result.leverageComponent).toBeGreaterThan(0);
  });

  it('flips the sign to credit a defender for a highlight that swung leverage away from the offense', () => {
    // b1 is on defense (team B) during this highlight; the offense (team A)
    // lost win probability, so the raw leverageScore is negative from A's
    // frame but should credit b1 (defense) positively. Box composites are
    // equal (6 each), so only a correctly-signed leverage credit can win it
    // for b1.
    const teamA = { teamId: 'A', box: [line({ playerId: 'a1', points: 6 })] };
    const teamB = { teamId: 'B', box: [line({ playerId: 'b1', points: 4, steals: 1 })] };
    const highlights = [
      highlight({ playerId: 'b1', offenseTeamId: 'A', leverageScore: -0.4, outcome: 'turnover', playType: 'steal' }),
    ];

    const result = computeMvp(teamA, teamB, highlights);

    expect(result.playerId).toBe('b1');
    expect(result.leverageComponent).toBeGreaterThan(0);
  });

  it('does not credit a player for a highlight that hurt their own team', () => {
    // a1 turns it over — a highlight-worthy swing against team A, credited
    // to a1 (the turnover committer, no steal). a1 still wins MVP here on
    // box score alone (20 pts vs. 10), but their leverage credit must be
    // exactly 0 — the bad turnover should not also add positive leverage.
    const teamA = { teamId: 'A', box: [line({ playerId: 'a1', points: 20, turnovers: 1 })] };
    const teamB = { teamId: 'B', box: [line({ playerId: 'b1', points: 10 })] };
    const highlights = [
      highlight({ playerId: 'a1', offenseTeamId: 'A', leverageScore: -0.4, outcome: 'turnover', playType: 'turnover' }),
    ];

    const result = computeMvp(teamA, teamB, highlights);

    expect(result.playerId).toBe('a1');
    expect(result.leverageComponent).toBe(0);
  });

  it('always returns a player from one of the two rosters', () => {
    const teamA = { teamId: 'A', box: [line({ playerId: 'a1' })] };
    const teamB = { teamId: 'B', box: [line({ playerId: 'b1' })] };
    const result = computeMvp(teamA, teamB, []);
    expect(['a1', 'b1']).toContain(result.playerId);
    expect(result.mvpScore).toBeGreaterThanOrEqual(0);
  });
});
