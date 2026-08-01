import { GameMvp, Highlight, PlayerBoxScoreLine } from '@roster-duel/sim-engine';
import { buildRecapPrompt, RECAP_SYSTEM_PROMPT } from './buildRecapPrompt';
import { RecapPromptInput } from './types';

function boxLine(overrides: Partial<PlayerBoxScoreLine> & { playerId: string }): PlayerBoxScoreLine {
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

function highlight(overrides: Partial<Highlight> = {}): Highlight {
  return {
    possessionIndex: 0,
    offenseTeamId: 'A',
    playerId: 'a1',
    playerName: 'Alpha One',
    description: 'Alpha One buries a go-ahead three.',
    leverageScore: 0.42,
    periodSecondsRemaining: 30,
    quarter: 4,
    outcome: 'make_3',
    scoreAAfter: 100,
    scoreBAfter: 98,
    playType: 'three_pointer_made',
    startLocation: 'three_top',
    endLocation: 'paint',
    ...overrides,
  };
}

function baseInput(overrides: Partial<RecapPromptInput> = {}): RecapPromptInput {
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
    highlights: [highlight()],
    mvp,
    ...overrides,
  };
}

describe('buildRecapPrompt', () => {
  it('includes the final score and winner', () => {
    const prompt = buildRecapPrompt(baseInput());
    expect(prompt).toContain('Team Alpha 100 — 98 Team Beta');
    expect(prompt).toContain('winner: Team Alpha');
  });

  it('labels overtime games distinctly from a regulation FINAL', () => {
    const regulation = buildRecapPrompt(baseInput({ overtimePeriods: 0 }));
    const overtime = buildRecapPrompt(baseInput({ overtimePeriods: 1 }));
    const doubleOt = buildRecapPrompt(baseInput({ overtimePeriods: 2 }));
    expect(regulation).toContain('FINAL:');
    expect(overtime).toContain('FINAL/OT:');
    expect(doubleOt).toContain('FINAL/2OT:');
  });

  it('includes every box score line with its stats', () => {
    const prompt = buildRecapPrompt(baseInput());
    expect(prompt).toContain('Alpha One (PG): 28 pts');
    expect(prompt).toContain('Beta One (PG): 20 pts');
  });

  it('includes highlight descriptions in ranked order', () => {
    const input = baseInput({
      highlights: [
        highlight({ description: 'First highlight.' }),
        highlight({ description: 'Second highlight.' }),
      ],
    });
    const prompt = buildRecapPrompt(input);
    const firstIdx = prompt.indexOf('First highlight.');
    const secondIdx = prompt.indexOf('Second highlight.');
    expect(firstIdx).toBeGreaterThan(-1);
    expect(secondIdx).toBeGreaterThan(firstIdx);
  });

  it('names the MVP and their team', () => {
    const prompt = buildRecapPrompt(baseInput());
    expect(prompt).toContain('GAME MVP: Alpha One (Team Alpha)');
  });

  it('correctly attributes an MVP from team B', () => {
    const mvp: GameMvp = { playerId: 'b1', playerName: 'Beta One', teamId: 'B', mvpScore: 0.9, boxScoreComponent: 0.9, leverageComponent: 0 };
    const prompt = buildRecapPrompt(baseInput({ mvp }));
    expect(prompt).toContain('GAME MVP: Beta One (Team Beta)');
  });

  it('does not leak raw internal mvpScore/boxScoreComponent numbers into the prompt data section', () => {
    // The model should justify the pick in prose, not parrot our internal scoring fields.
    const prompt = buildRecapPrompt(baseInput());
    expect(prompt).not.toContain('0.8');
    expect(prompt).not.toContain('mvpScore');
  });
});

describe('RECAP_SYSTEM_PROMPT', () => {
  it('constrains the model to only use provided data', () => {
    expect(RECAP_SYSTEM_PROMPT).toMatch(/only the facts given/i);
    expect(RECAP_SYSTEM_PROMPT).toMatch(/do not invent/i);
  });
});
