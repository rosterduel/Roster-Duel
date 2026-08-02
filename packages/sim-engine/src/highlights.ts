import { Highlight, PossessionEvent } from './types';

const ORDINALS: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' };

function ordinal(quarter: number): string {
  return ORDINALS[quarter] ?? `${quarter}th`;
}

function formatClock(seconds: number): string {
  const clamped = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function buildScoreContext(event: PossessionEvent): { clockLabel: string; scoreContext: string } {
  const clockLabel = formatClock(event.periodSecondsRemaining);
  // Framed relative to the offense team for this trip, not a fixed team A —
  // see the comment in simulateGame.ts for why.
  const margin = event.offenseMarginAfter;
  const marginLabel = margin === 0 ? 'Tied' : margin > 0 ? `Up ${margin}` : `Down ${Math.abs(margin)}`;
  const periodLabel = event.quarter <= 4 ? ordinal(event.quarter) : `OT${event.quarter - 4 > 1 ? event.quarter - 4 : ''}`;
  return { clockLabel, scoreContext: `${marginLabel} with ${clockLabel} left in the ${periodLabel},` };
}

function describe(event: PossessionEvent, nameById: Map<string, string>): { description: string; playerId: string; playerName: string } {
  const { scoreContext } = buildScoreContext(event);
  const shooterName = event.shooterId ? nameById.get(event.shooterId) ?? 'A player' : undefined;
  const assisterName = event.assisterId ? nameById.get(event.assisterId) : undefined;
  const rebounderName = event.reboundPlayerId ? nameById.get(event.reboundPlayerId) : undefined;
  const blockerName = event.blockPlayerId ? nameById.get(event.blockPlayerId) : undefined;

  switch (event.outcome) {
    case 'make_3':
      return {
        description: `${scoreContext} ${shooterName} buries a three${assisterName ? `, assisted by ${assisterName}` : ''}.`,
        playerId: event.shooterId!,
        playerName: shooterName!,
      };
    case 'make_2':
      return {
        description: `${scoreContext} ${shooterName} scores inside${assisterName ? `, assisted by ${assisterName}` : ''}.`,
        playerId: event.shooterId!,
        playerName: shooterName!,
      };
    case 'ft_trip':
      return {
        description: `${scoreContext} ${shooterName} delivers from the free-throw line.`,
        playerId: event.shooterId!,
        playerName: shooterName!,
      };
    case 'turnover': {
      const stealerName = event.stealPlayerId ? nameById.get(event.stealPlayerId) : undefined;
      const playerId = event.stealPlayerId ?? event.turnoverPlayerId ?? '';
      return {
        description: stealerName
          ? `${scoreContext} ${stealerName} jumps the passing lane for a steal.`
          : `${scoreContext} a costly turnover changes possession.`,
        playerId,
        playerName: stealerName ?? nameById.get(event.turnoverPlayerId ?? '') ?? 'A player',
      };
    }
    case 'miss_def_reb':
      // A blocked shot headlines the BLOCKER, not whoever grabs the loose
      // ball afterward (spec 4a: the sprite must perform the actual
      // action described — "block" needs to attribute to the player who
      // blocked it, not a bystander to the rebound that followed).
      //
      // An UNBLOCKED miss stays headlined by the SHOOTER, not the
      // rebounder — playType stays 'three_pointer_missed'/
      // 'two_pointer_missed' regardless of who rebounds it (see PlayType's
      // doc comment: "who rebounds it doesn't change what animation
      // plays"), so the highlighted player has to be whoever that
      // shot-missed animation is actually about, or a GameCast build keyed
      // off playType would show the wrong player performing the shooting
      // pose.
      return event.blockPlayerId
        ? {
            description: `${scoreContext} ${blockerName ?? 'the defense'} swats the shot away${shooterName ? `, denying ${shooterName}` : ''}.`,
            playerId: event.blockPlayerId,
            playerName: blockerName ?? 'A player',
          }
        : {
            description: `${scoreContext} ${shooterName}'s shot rims out${rebounderName ? `, ${rebounderName} grabs the rebound` : ''}.`,
            playerId: event.shooterId!,
            playerName: shooterName!,
          };
    case 'miss_off_reb':
      return {
        description: `${scoreContext} ${rebounderName ?? 'the offense'} keeps the possession alive with an offensive rebound.`,
        playerId: event.reboundPlayerId ?? '',
        playerName: rebounderName ?? 'A player',
      };
  }
}

/**
 * Section 5.5: rank every trip by the absolute win-probability swing it
 * caused and return the top N as structured highlight data (not just
 * display strings) so the frontend — or a future video/animation layer —
 * can render them however it wants.
 */
export function buildHighlights(events: PossessionEvent[], nameById: Map<string, string>, count = 5): Highlight[] {
  const ranked = [...events].sort((a, b) => Math.abs(b.leverageScore) - Math.abs(a.leverageScore)).slice(0, count);

  return ranked.map((event) => {
    const { description, playerId, playerName } = describe(event, nameById);
    return {
      possessionIndex: event.possessionIndex,
      offenseTeamId: event.offenseTeamId,
      playerId,
      playerName,
      description,
      leverageScore: event.leverageScore,
      periodSecondsRemaining: event.periodSecondsRemaining,
      quarter: event.quarter,
      outcome: event.outcome,
      scoreAAfter: event.scoreA,
      scoreBAfter: event.scoreB,
      playType: event.playType,
      startLocation: event.startLocation,
      endLocation: event.endLocation,
    };
  });
}
