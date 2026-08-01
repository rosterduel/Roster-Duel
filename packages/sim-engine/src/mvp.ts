import { MVP_BOX_SCORE_WEIGHT, MVP_LEVERAGE_WEIGHT, NO_SPREAD_EPSILON } from './constants';
import { GameMvp, Highlight, PlayerBoxScoreLine } from './types';

interface MvpTeamInput {
  teamId: string;
  box: PlayerBoxScoreLine[];
}

/**
 * Section 4b: an explicit, documented Game MVP formula rather than "top
 * scorer" — blends a box-score composite (a full-game stat line, not just
 * points) with a leverage-moment component (credit for authoring the
 * game's biggest win-probability swings), so a garbage-time stat-padder
 * doesn't beat someone who hit the actual deciding shots.
 *
 * Box-score composite: an original weighting (not a reproduction of Game
 * Score/PER/BPM/any named metric — see README "Player data sourcing" for
 * why that matters here). Rebounds/assists are weighted above 1 to value
 * playmaking beyond scoring; steals/blocks above that since they're rarer
 * defensive events; turnovers and missed shots are penalized moderately.
 *
 * Leverage component: for each of the game's top-5 highlights, credit goes
 * to whichever team actually benefited from that swing — leverageScore is
 * stored signed relative to the *offense* team, so a great defensive play
 * (a steal, a highlight-worthy block) needs its sign flipped before
 * crediting the defender. Only positive swings for the credited player's
 * own team count: a costly turnover already shows up as a penalty in the
 * box-score composite above, so it isn't subtracted again here, and a
 * player shouldn't lose MVP ground for an opponent's response to one of
 * their own makes.
 *
 * Both components are min-max normalized across every player who appeared
 * in either box score before blending, since raw leverage swings (roughly
 * 0-1) and raw box-score composites (roughly 0-50) live on very different
 * scales.
 */
export function computeMvp(teamA: MvpTeamInput, teamB: MvpTeamInput, highlights: Highlight[]): GameMvp {
  const allLines = [...teamA.box, ...teamB.box];
  const teamIdByPlayer = new Map<string, string>();
  for (const line of teamA.box) teamIdByPlayer.set(line.playerId, teamA.teamId);
  for (const line of teamB.box) teamIdByPlayer.set(line.playerId, teamB.teamId);

  const boxComposite = new Map<string, number>();
  for (const line of allLines) {
    const missedFieldGoals = line.fieldGoalsAttempted - line.fieldGoalsMade;
    const missedFreeThrows = line.freeThrowsAttempted - line.freeThrowsMade;
    const value =
      line.points +
      1.2 * line.rebounds +
      1.5 * line.assists +
      2 * line.steals +
      2 * line.blocks -
      1.5 * line.turnovers -
      0.5 * missedFieldGoals -
      0.5 * missedFreeThrows;
    boxComposite.set(line.playerId, value);
  }

  const leverageCredit = new Map<string, number>();
  for (const line of allLines) leverageCredit.set(line.playerId, 0);
  for (const highlight of highlights) {
    const playerTeamId = teamIdByPlayer.get(highlight.playerId);
    if (!playerTeamId) continue; // every credited player is on one of the two rosters in Phase 1
    const signedForPlayerTeam = playerTeamId === highlight.offenseTeamId ? highlight.leverageScore : -highlight.leverageScore;
    if (signedForPlayerTeam <= 0) continue; // only reward swings that actually favored the credited player's team
    leverageCredit.set(highlight.playerId, (leverageCredit.get(highlight.playerId) ?? 0) + signedForPlayerTeam);
  }

  const normalize = (values: Map<string, number>): Map<string, number> => {
    const nums = [...values.values()];
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const spread = max - min;
    const normalized = new Map<string, number>();
    for (const [playerId, value] of values) {
      normalized.set(playerId, spread > NO_SPREAD_EPSILON ? (value - min) / spread : 0);
    }
    return normalized;
  };

  const normBox = normalize(boxComposite);
  const normLeverage = normalize(leverageCredit);

  let best: GameMvp | undefined;
  for (const line of allLines) {
    const boxScoreComponent = normBox.get(line.playerId) ?? 0;
    const leverageComponent = normLeverage.get(line.playerId) ?? 0;
    const mvpScore = MVP_BOX_SCORE_WEIGHT * boxScoreComponent + MVP_LEVERAGE_WEIGHT * leverageComponent;
    const isBetter =
      !best || mvpScore > best.mvpScore || (mvpScore === best.mvpScore && boxScoreComponent > best.boxScoreComponent);
    if (isBetter) {
      best = {
        playerId: line.playerId,
        playerName: line.name,
        teamId: teamIdByPlayer.get(line.playerId)!,
        mvpScore,
        boxScoreComponent,
        leverageComponent,
      };
    }
  }

  return best!; // allLines always has at least one player per team in Phase 1
}
