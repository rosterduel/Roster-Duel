import { OVERTIME_PERIOD_SECONDS } from './constants';
import { simulateGame } from './simulateGame';
import { GameResult, NbaPosition, PlayerRatingInput, TeamInput } from './types';

function makeRoster(teamId: string, teamName: string, seedOffset: number): TeamInput {
  const positions: NbaPosition[] = ['PG', 'SG', 'SF', 'PF', 'C', '6MAN'];
  const players: PlayerRatingInput[] = positions.map((position, i) => ({
    id: `${teamId}-${position}`,
    name: `${teamName} ${position}`,
    position,
    offenseRating: 45 + ((i + seedOffset) % 6) * 8, // spread of 45-85
    defenseRating: 45 + ((i * 2 + seedOffset) % 6) * 8,
    usageRate: 0.1 + i * 0.03,
    assistRate: 0.1 + ((i + 1) % 6) * 0.03,
    reboundRate: 0.05 + ((i + 2) % 6) * 0.03,
    stealRate: 0.05 + ((i + 3) % 6) * 0.02,
    blockRate: 0.02 + ((i + 4) % 6) * 0.02,
    threePointRate: position === 'C' || position === 'PF' ? 0.1 : 0.4,
    freeThrowPct: 0.65 + ((i + seedOffset) % 4) * 0.07,
  }));
  return { teamId, teamName, players };
}

const teamA = makeRoster('A', 'Alpha', 0);
const teamB = makeRoster('B', 'Beta', 3);

describe('simulateGame', () => {
  it('is deterministic for a given seed', () => {
    const first = simulateGame({ teamA, teamB, seed: 12345 });
    const second = simulateGame({ teamA, teamB, seed: 12345 });
    expect(second).toEqual(first);
  });

  it('produces a believable final score for both teams', () => {
    const result = simulateGame({ teamA, teamB, seed: 1 });
    expect(result.teamA.score).toBeGreaterThan(60);
    expect(result.teamA.score).toBeLessThan(170);
    expect(result.teamB.score).toBeGreaterThan(60);
    expect(result.teamB.score).toBeLessThan(170);
  });

  it('sums individual box score points to the team score', () => {
    const result = simulateGame({ teamA, teamB, seed: 2 });
    const sumA = result.boxScore.teamA.reduce((s, l) => s + l.points, 0);
    const sumB = result.boxScore.teamB.reduce((s, l) => s + l.points, 0);
    expect(sumA).toBe(result.teamA.score);
    expect(sumB).toBe(result.teamB.score);
  });

  it('never has field goals made exceed field goals attempted, or threes exceed FGs, per player', () => {
    const result = simulateGame({ teamA, teamB, seed: 3 });
    for (const line of [...result.boxScore.teamA, ...result.boxScore.teamB]) {
      expect(line.fieldGoalsMade).toBeLessThanOrEqual(line.fieldGoalsAttempted);
      expect(line.threesMade).toBeLessThanOrEqual(line.threesAttempted);
      expect(line.threesAttempted).toBeLessThanOrEqual(line.fieldGoalsAttempted);
      expect(line.freeThrowsMade).toBeLessThanOrEqual(line.freeThrowsAttempted);
      expect(line.points).toBeGreaterThanOrEqual(0);
      expect(line.rebounds).toBeGreaterThanOrEqual(0);
    }
  });

  it('declares a winner consistent with the final score', () => {
    const result = simulateGame({ teamA, teamB, seed: 4 });
    if (result.teamA.score > result.teamB.score) expect(result.winner).toBe('A');
    if (result.teamB.score > result.teamA.score) expect(result.winner).toBe('B');
  });

  it('returns exactly the requested number of highlights, ranked by descending leverage magnitude', () => {
    const result = simulateGame({ teamA, teamB, seed: 5, highlightCount: 5 });
    expect(result.highlights).toHaveLength(5);
    const magnitudes = result.highlights.map((h) => Math.abs(h.leverageScore));
    for (let i = 1; i < magnitudes.length; i++) {
      expect(magnitudes[i]).toBeLessThanOrEqual(magnitudes[i - 1]);
    }
  });

  it('gives every highlight a non-empty, player-attributed description', () => {
    const result = simulateGame({ teamA, teamB, seed: 6 });
    for (const highlight of result.highlights) {
      expect(highlight.description.length).toBeGreaterThan(0);
      expect(highlight.playerName.length).toBeGreaterThan(0);
    }
  });

  it('produces a full possession log covering both teams', () => {
    const result = simulateGame({ teamA, teamB, seed: 7 });
    expect(result.possessionLog.length).toBeGreaterThan(150);
    const teamIds = new Set(result.possessionLog.map((e) => e.offenseTeamId));
    expect(teamIds).toEqual(new Set(['A', 'B']));
  });

  it('never ends in a tie, playing real overtime periods instead of a coin flip', () => {
    // Search deterministically for a seed whose regulation ends tied — with
    // ~100 possessions/team this happens for a meaningful fraction of seeds,
    // so a few hundred tries reliably finds one without flaking across runs.
    let otResult: GameResult | undefined;
    for (let seed = 0; seed < 3000 && !otResult; seed++) {
      const result = simulateGame({ teamA, teamB, seed });
      if (result.overtimePeriods > 0) otResult = result;
    }

    expect(otResult).toBeDefined();
    const result = otResult!;

    // The game must be decided — no tie-breaking coin flip.
    expect(result.teamA.score).not.toBe(result.teamB.score);
    expect(result.winner).toBe(result.teamA.score > result.teamB.score ? 'A' : 'B');

    // At least one possession was actually played beyond regulation.
    const otEvents = result.possessionLog.filter((e) => e.quarter > 4);
    expect(otEvents.length).toBeGreaterThan(0);
    for (const event of otEvents) {
      expect(event.quarter).toBe(4 + result.overtimePeriods);
      expect(event.periodSecondsRemaining).toBeGreaterThanOrEqual(0);
      expect(event.periodSecondsRemaining).toBeLessThanOrEqual(OVERTIME_PERIOD_SECONDS);
    }

    // Box score totals still reconcile with OT possessions included.
    const sumA = result.boxScore.teamA.reduce((s, l) => s + l.points, 0);
    const sumB = result.boxScore.teamB.reduce((s, l) => s + l.points, 0);
    expect(sumA).toBe(result.teamA.score);
    expect(sumB).toBe(result.teamB.score);
  });

  it('reports overtimePeriods of 0 and no OT events for a game decided in regulation', () => {
    // Seed 1 is asserted elsewhere to be a normal, non-tied final score.
    const result = simulateGame({ teamA, teamB, seed: 1 });
    expect(result.teamA.score).not.toBe(result.teamB.score);
    expect(result.overtimePeriods).toBe(0);
    expect(result.possessionLog.every((e) => e.quarter <= 4)).toBe(true);
  });
});
