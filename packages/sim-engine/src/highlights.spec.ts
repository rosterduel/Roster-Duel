import { buildHighlights } from './highlights';
import { PossessionEvent } from './types';

function event(overrides: Partial<PossessionEvent>): PossessionEvent {
  return {
    possessionIndex: 0,
    offenseTeamId: 'A',
    periodSecondsRemaining: 40,
    quarter: 4,
    outcome: 'make_3',
    pointsScored: 3,
    scoreA: 100,
    scoreB: 98,
    offenseMarginAfter: 2,
    leverageScore: 0.3,
    playType: 'three_pointer_made',
    startLocation: 'three_top',
    endLocation: 'paint',
    ...overrides,
  };
}

describe('buildHighlights score-context framing', () => {
  const nameById = new Map([
    ['a-shooter', 'Team A Shooter'],
    ['b-shooter', 'Team B Shooter'],
  ]);

  it('frames a team A possession relative to team A (team A leads, team A scores)', () => {
    // Team A trailed by 2 before this go-ahead-adjacent make; scoreA=100, scoreB=98 => A is up 2.
    const events = [
      event({
        offenseTeamId: 'A',
        shooterId: 'a-shooter',
        scoreA: 100,
        scoreB: 98,
        offenseMarginAfter: 2, // A (the offense) is up 2
      }),
    ];

    const [highlight] = buildHighlights(events, nameById, 1);
    expect(highlight.description).toContain('Up 2');
    expect(highlight.description).not.toContain('Down 2');
  });

  it('frames a team B possession relative to team B, even though team A is numerically ahead', () => {
    // Same raw scoreboard (A=100, B=98, so A leads) but this trip's offense is B,
    // and B is the one trailing by 2 — the highlight should read from B's side.
    const events = [
      event({
        offenseTeamId: 'B',
        shooterId: 'b-shooter',
        scoreA: 100,
        scoreB: 98,
        offenseMarginAfter: -2, // B (the offense) is down 2
        leverageScore: -0.3,
      }),
    ];

    const [highlight] = buildHighlights(events, nameById, 1);
    expect(highlight.description).toContain('Down 2');
    expect(highlight.description).not.toContain('Up 2');
  });

  it('labels a tied offense margin as Tied regardless of which team is on offense', () => {
    const events = [
      event({ offenseTeamId: 'B', shooterId: 'b-shooter', offenseMarginAfter: 0, scoreA: 50, scoreB: 50 }),
    ];

    const [highlight] = buildHighlights(events, nameById, 1);
    expect(highlight.description).toContain('Tied');
  });

  it('labels overtime periods as OT / OT2 / OT3 instead of a 5th/6th/7th quarter', () => {
    const [ot1] = buildHighlights([event({ shooterId: 'a-shooter', quarter: 5 })], nameById, 1);
    const [ot2] = buildHighlights([event({ shooterId: 'a-shooter', quarter: 6 })], nameById, 1);
    const [ot3] = buildHighlights([event({ shooterId: 'a-shooter', quarter: 7 })], nameById, 1);

    expect(ot1.description).toContain('in the OT,');
    expect(ot2.description).toContain('in the OT2,');
    expect(ot3.description).toContain('in the OT3,');
  });
});

describe('buildHighlights block attribution (spec 4a GameCast: the sprite must perform the actual action)', () => {
  const nameById = new Map([
    ['shooter-1', 'The Shooter'],
    ['blocker-1', 'The Blocker'],
    ['rebounder-1', 'The Rebounder'],
  ]);

  it('attributes a blocked shot to the BLOCKER, not the rebounder who recovers it', () => {
    const events = [
      event({
        outcome: 'miss_def_reb',
        playType: 'block',
        shooterId: 'shooter-1',
        blockPlayerId: 'blocker-1',
        reboundPlayerId: 'rebounder-1',
      }),
    ];

    const [highlight] = buildHighlights(events, nameById, 1);
    expect(highlight.playerId).toBe('blocker-1');
    expect(highlight.playerName).toBe('The Blocker');
    expect(highlight.description).toContain('The Blocker');
    expect(highlight.description).toContain('The Shooter');
  });

  it('attributes an UNBLOCKED miss to the SHOOTER, not the rebounder — playType stays a shot-missed type either way, so the highlighted player has to match the shooting-pose animation that type drives', () => {
    const events = [
      event({
        outcome: 'miss_def_reb',
        playType: 'two_pointer_missed',
        shooterId: 'shooter-1',
        reboundPlayerId: 'rebounder-1',
      }),
    ];

    const [highlight] = buildHighlights(events, nameById, 1);
    expect(highlight.playerId).toBe('shooter-1');
    expect(highlight.playerName).toBe('The Shooter');
    expect(highlight.description).toContain('The Shooter');
  });
});

describe('buildHighlights turnover attribution — steal-caused vs. generic (spec 4a follow-up: confirmed already correct, locked in with tests since this exact case had none before)', () => {
  const nameById = new Map([
    ['offense-1', 'The Offense Player'],
    ['defender-1', 'The Defender'],
  ]);

  it('credits the DEFENDER with steal-framed wording when a stealPlayerId caused the turnover', () => {
    const events = [
      event({
        outcome: 'turnover',
        playType: 'steal',
        turnoverPlayerId: 'offense-1',
        stealPlayerId: 'defender-1',
      }),
    ];

    const [highlight] = buildHighlights(events, nameById, 1);
    expect(highlight.playerId).toBe('defender-1');
    expect(highlight.playerName).toBe('The Defender');
    expect(highlight.description).toContain('The Defender');
    expect(highlight.description).toContain('steal');
  });

  it('keeps the generic, unattributed framing for a turnover with NO steal (out of bounds, offensive foul, etc.)', () => {
    const events = [
      event({
        outcome: 'turnover',
        playType: 'turnover',
        turnoverPlayerId: 'offense-1',
        stealPlayerId: undefined,
      }),
    ];

    const [highlight] = buildHighlights(events, nameById, 1);
    expect(highlight.description).toContain('costly turnover');
    expect(highlight.description).not.toContain('steal');
  });
});
