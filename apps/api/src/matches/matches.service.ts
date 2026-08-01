import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Match, Roster, User } from '@prisma/client';
import { GameResult as SimGameResult, simulateGame } from '@roster-duel/sim-engine';
import { PrismaService } from '../prisma/prisma.service';
import { createAnthropicRecapGenerator } from '../recap/anthropicRecapGenerator';
import { generateGameRecap, toRecapPromptInput } from '../recap/generateGameRecap';
import { validateRecapGrounding } from '../recap/validateRecapGrounding';
import { NBA_POSITIONS, isNbaPosition, toTeamInput } from '../sim/toTeamInput';
import { autoFillRosterSlots, RatedCandidate } from './draftAutoFill';
import { CreateMatchResponse, GameResultDto, MatchStateDto, SideStatusDto } from './dto';
import { MatchesGateway } from './matches.gateway';
import { generateRoomCode } from './roomCode';

const MIN_DRAFT_TIMER_SECONDS = 60;
const MAX_DRAFT_TIMER_SECONDS = 30 * 60;
const DEFAULT_DRAFT_TIMER_SECONDS = 5 * 60;
const ROOM_CODE_GENERATION_ATTEMPTS = 10;

type MatchWithRosters = Match & { rosterA: (Roster & { user: User }) | null; rosterB: (Roster & { user: User }) | null };

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MatchesGateway,
  ) {}

  async createMatch(user: User, draftTimerSecondsInput?: number): Promise<CreateMatchResponse> {
    const draftTimerSeconds = clampDraftTimer(draftTimerSecondsInput);
    const draftDeadline = new Date(Date.now() + draftTimerSeconds * 1000);

    const roster = await this.prisma.roster.create({
      data: { userId: user.id, sport: 'nba', slots: {}, draftDeadline },
    });

    const roomCode = await this.generateUniqueRoomCode();
    const match = await this.prisma.match.create({
      // Explicit even though it's the schema default: every match created
      // through this friend-link flow is friend_link, never eligible for
      // leaderboard stats (spec 9a) — the random-matchmaking queue that
      // would set the other value doesn't exist yet (agreed deferred scope).
      data: { roomCode, sport: 'nba', matchType: 'friend_link', draftTimerSeconds, rosterAId: roster.id, status: 'drafting' },
    });

    return {
      roomCode: match.roomCode,
      matchId: match.id,
      yourSide: 'A',
      rosterId: roster.id,
      draftTimerSeconds,
      draftDeadline: draftDeadline.toISOString(),
    };
  }

  async joinMatch(roomCode: string, user: User): Promise<CreateMatchResponse> {
    const match = await this.findMatchOrThrow(roomCode);

    if (match.rosterA?.userId === user.id) {
      return toCreateMatchResponse(match, 'A');
    }
    if (match.rosterB?.userId === user.id) {
      return toCreateMatchResponse(match, 'B');
    }
    if (match.rosterB) {
      throw new ConflictException('This match already has two players.');
    }

    const draftDeadline = new Date(Date.now() + match.draftTimerSeconds * 1000);
    const roster = await this.prisma.roster.create({
      data: { userId: user.id, sport: 'nba', slots: {}, draftDeadline },
    });
    const updated = await this.prisma.match.update({
      where: { id: match.id },
      data: { rosterBId: roster.id },
      include: { rosterA: { include: { user: true } }, rosterB: { include: { user: true } } },
    });

    return toCreateMatchResponse(updated, 'B');
  }

  async saveDraftSlots(rosterId: string, user: User, slots: Record<string, string>): Promise<void> {
    const roster = await this.getOwnedRosterOrThrow(rosterId, user);

    if (roster.isLocked) {
      throw new BadRequestException('This roster is already locked.');
    }
    if (roster.draftDeadline.getTime() <= Date.now()) {
      await this.autoLockRoster(roster);
      throw new BadRequestException('Your draft time expired — your roster was auto-locked.');
    }

    validateSlots(slots);
    await this.assertPlayersExist(Object.values(slots));

    await this.prisma.roster.update({ where: { id: roster.id }, data: { slots } });
  }

  /** Manual lock — requires a complete roster. Timer-expiry locks go through autoLockRoster instead. */
  async lockRoster(rosterId: string, user: User): Promise<MatchStateDto> {
    const roster = await this.getOwnedRosterOrThrow(rosterId, user);
    const match = await this.findMatchByRosterOrThrow(roster.id);

    if (roster.isLocked) {
      return this.getMatchState(match.roomCode, user);
    }

    if (roster.draftDeadline.getTime() <= Date.now()) {
      await this.autoLockRoster(roster);
    } else {
      const slots = roster.slots as Record<string, string>;
      const missing = NBA_POSITIONS.filter((p) => !slots[p]);
      if (missing.length > 0) {
        throw new BadRequestException(`Fill all positions before locking — missing: ${missing.join(', ')}.`);
      }
      await this.prisma.roster.update({ where: { id: roster.id }, data: { isLocked: true, lockedAt: new Date() } });
    }

    await this.afterRosterLocked(match.id, match.roomCode);

    return this.getMatchState(match.roomCode, user);
  }

  async getMatchState(roomCode: string, requestingUser: User | null): Promise<MatchStateDto> {
    let match = await this.findMatchOrThrow(roomCode);
    match = await this.applyLazyExpiry(match);

    const yourSide: 'A' | 'B' | null =
      requestingUser && match.rosterA?.userId === requestingUser.id
        ? 'A'
        : requestingUser && match.rosterB?.userId === requestingUser.id
          ? 'B'
          : null;

    const bothLocked = Boolean(match.rosterA?.isLocked && match.rosterB?.isLocked);
    const yourRoster = yourSide === 'A' ? match.rosterA : yourSide === 'B' ? match.rosterB : null;
    const opponentRoster = yourSide === 'A' ? match.rosterB : yourSide === 'B' ? match.rosterA : null;

    const gameResult = match.status === 'complete' ? await this.prisma.gameResult.findFirst({ where: { matchId: match.id }, orderBy: { gameNumber: 'desc' } }) : null;

    return {
      roomCode: match.roomCode,
      sport: 'nba',
      status: match.status,
      draftTimerSeconds: match.draftTimerSeconds,
      yourSide,
      yourRosterId: yourRoster?.id ?? null,
      sideA: toSideStatus(match.rosterA),
      sideB: toSideStatus(match.rosterB),
      yourSlots: yourRoster ? (yourRoster.slots as Record<string, string>) : null,
      opponentSlots: bothLocked && opponentRoster ? (opponentRoster.slots as Record<string, string>) : null,
      gameResult: gameResult ? toGameResultDto(gameResult) : null,
    };
  }

  async regenerateRecap(roomCode: string): Promise<GameResultDto> {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new BadRequestException(
        'ANTHROPIC_API_KEY is not configured on the server — recap generation needs a real Anthropic API key. See apps/api/.env.example.',
      );
    }

    const match = await this.findMatchOrThrow(roomCode);
    if (match.status !== 'complete') {
      throw new BadRequestException('This match has not finished simulating yet.');
    }
    const gameResult = await this.prisma.gameResult.findFirst({ where: { matchId: match.id }, orderBy: { gameNumber: 'desc' } });
    if (!gameResult) {
      throw new NotFoundException('No game result found for this match.');
    }

    await this.generateRecapForGameResult(gameResult.id, match);
    const refreshed = await this.prisma.gameResult.findUniqueOrThrow({ where: { id: gameResult.id } });
    this.gateway.notifyRecapReady(match.roomCode);
    return toGameResultDto(refreshed);
  }

  // --- internals ---

  private async generateUniqueRoomCode(): Promise<string> {
    for (let attempt = 0; attempt < ROOM_CODE_GENERATION_ATTEMPTS; attempt++) {
      const code = generateRoomCode();
      const existing = await this.prisma.match.findUnique({ where: { roomCode: code } });
      if (!existing) return code;
    }
    throw new Error('Could not generate a unique room code — this should be astronomically unlikely.');
  }

  private async findMatchOrThrow(roomCode: string): Promise<MatchWithRosters> {
    const match = await this.prisma.match.findUnique({
      where: { roomCode: roomCode.toUpperCase() },
      include: { rosterA: { include: { user: true } }, rosterB: { include: { user: true } } },
    });
    if (!match) throw new NotFoundException(`No match found for room code "${roomCode}".`);
    return match;
  }

  private async findMatchByRosterOrThrow(rosterId: string): Promise<MatchWithRosters> {
    const match = await this.prisma.match.findFirst({
      where: { OR: [{ rosterAId: rosterId }, { rosterBId: rosterId }] },
      include: { rosterA: { include: { user: true } }, rosterB: { include: { user: true } } },
    });
    if (!match) throw new NotFoundException('No match found for this roster.');
    return match;
  }

  private async getOwnedRosterOrThrow(rosterId: string, user: User): Promise<Roster> {
    const roster = await this.prisma.roster.findUnique({ where: { id: rosterId } });
    if (!roster) throw new NotFoundException('Roster not found.');
    if (roster.userId !== user.id) throw new ForbiddenException('This is not your roster.');
    return roster;
  }

  /** Runs on every GET so a returning client always sees an up-to-date status, without needing a background worker. */
  private async applyLazyExpiry(match: MatchWithRosters): Promise<MatchWithRosters> {
    let changed = false;
    for (const roster of [match.rosterA, match.rosterB]) {
      if (roster && !roster.isLocked && roster.draftDeadline.getTime() <= Date.now()) {
        await this.autoLockRoster(roster);
        changed = true;
      }
    }
    if (!changed) return match;

    const refreshed = await this.findMatchOrThrow(match.roomCode);
    if (refreshed.rosterA?.isLocked && refreshed.rosterB?.isLocked && refreshed.status === 'drafting') {
      await this.afterRosterLocked(refreshed.id, refreshed.roomCode);
      return this.findMatchOrThrow(match.roomCode);
    }
    return refreshed;
  }

  private async autoLockRoster(roster: Roster): Promise<void> {
    const candidates = await this.loadRatedCandidates();
    const filledSlots = autoFillRosterSlots(NBA_POSITIONS, roster.slots as Record<string, string>, candidates);
    await this.prisma.roster.update({
      where: { id: roster.id },
      data: { slots: filledSlots, isLocked: true, lockedAt: new Date() },
    });
  }

  private async loadRatedCandidates(): Promise<RatedCandidate[]> {
    const stints = await this.prisma.playerStint.findMany({ where: { sport: 'nba' }, include: { rating: true } });
    return stints
      .filter((s) => s.rating !== null)
      .map((s) => ({ id: s.id, position: s.primaryPosition, baseRating: Number(s.rating!.baseRating) }));
  }

  /** Called once a roster becomes locked (manually or via timer) — notifies the room, and runs the sim once both sides are in. */
  private async afterRosterLocked(matchId: string, roomCode: string): Promise<void> {
    const match = await this.prisma.match.findUniqueOrThrow({
      where: { id: matchId },
      include: { rosterA: { include: { user: true } }, rosterB: { include: { user: true } } },
    });

    if (match.rosterA?.isLocked && match.rosterB?.isLocked) {
      await this.runSimulation(match);
      this.gateway.notifyMatchComplete(roomCode);
    } else {
      this.gateway.notifyOpponentLocked(roomCode);
    }
  }

  private async runSimulation(match: MatchWithRosters): Promise<void> {
    if (!match.rosterA || !match.rosterB) return;

    await this.prisma.match.update({ where: { id: match.id }, data: { status: 'simulating' } });

    const [playersA, playersB] = await Promise.all([
      this.loadRosterPlayers(match.rosterA.slots as Record<string, string>),
      this.loadRosterPlayers(match.rosterB.slots as Record<string, string>),
    ]);

    const teamA = toTeamInput(match.rosterA.id, `${match.rosterA.user.displayName}'s Team`, playersA);
    const teamB = toTeamInput(match.rosterB.id, `${match.rosterB.user.displayName}'s Team`, playersB);

    const result = simulateGame({ teamA, teamB, seed: Date.now() });

    const gameResult = await this.prisma.gameResult.create({
      data: {
        matchId: match.id,
        gameNumber: 1,
        scoreA: result.teamA.score,
        scoreB: result.teamB.score,
        boxScore: result.boxScore as object,
        playLog: result.possessionLog as object,
        highlights: result.highlights as object,
        mvp: result.mvp as object,
        overtimePeriods: result.overtimePeriods,
      },
    });

    await this.prisma.match.update({ where: { id: match.id }, data: { status: 'complete' } });

    if (process.env.ANTHROPIC_API_KEY) {
      // Fire-and-forget: a missing/slow recap should never block the game
      // result itself from being ready. Errors are logged, not thrown.
      this.generateRecapForGameResult(gameResult.id, match)
        .then(() => this.gateway.notifyRecapReady(match.roomCode))
        .catch((err) => this.logger.warn(`Recap generation failed for match ${match.roomCode}: ${err}`));
    } else {
      this.logger.log(`ANTHROPIC_API_KEY not set — skipping recap generation for match ${match.roomCode}.`);
    }
  }

  private async generateRecapForGameResult(gameResultId: string, match: MatchWithRosters): Promise<void> {
    const gameResult = await this.prisma.gameResult.findUniqueOrThrow({ where: { id: gameResultId } });
    if (!match.rosterA || !match.rosterB) return;

    const gameForRecap: SimGameResult = {
      teamA: { teamId: match.rosterA.id, teamName: `${match.rosterA.user.displayName}'s Team`, score: gameResult.scoreA },
      teamB: { teamId: match.rosterB.id, teamName: `${match.rosterB.user.displayName}'s Team`, score: gameResult.scoreB },
      winner: gameResult.scoreA >= gameResult.scoreB ? 'A' : 'B',
      boxScore: gameResult.boxScore as unknown as SimGameResult['boxScore'],
      possessionLog: gameResult.playLog as unknown as SimGameResult['possessionLog'],
      highlights: gameResult.highlights as unknown as SimGameResult['highlights'],
      overtimePeriods: gameResult.overtimePeriods,
      mvp: gameResult.mvp as unknown as SimGameResult['mvp'],
    };

    const generator = createAnthropicRecapGenerator();
    const recap = await generateGameRecap(generator, gameForRecap);

    const issues = validateRecapGrounding(recap, toRecapPromptInput(gameForRecap));
    if (issues.length > 0) {
      this.logger.warn(`Recap grounding issues for match ${match.roomCode}: ${JSON.stringify(issues)}`);
    }

    await this.prisma.gameResult.update({
      where: { id: gameResultId },
      data: { recapHeadline: recap.headline, recapArticle: recap.article },
    });
  }

  private async loadRosterPlayers(slots: Record<string, string>) {
    const stintIds = Object.values(slots).filter(Boolean);
    const stints = await this.prisma.playerStint.findMany({
      where: { id: { in: stintIds } },
      include: { stats: true, rating: true },
    });
    // Preserve draft-slot order (PG..6MAN) rather than whatever order the DB returns.
    return NBA_POSITIONS.map((pos) => stints.find((s) => s.id === slots[pos])).filter((s): s is NonNullable<typeof s> => Boolean(s));
  }

  private async assertPlayersExist(stintIds: string[]): Promise<void> {
    if (stintIds.length === 0) return;
    const count = await this.prisma.playerStint.count({ where: { id: { in: stintIds }, sport: 'nba' } });
    if (count !== new Set(stintIds).size) {
      throw new BadRequestException('One or more selected players are invalid.');
    }
  }
}

function clampDraftTimer(seconds: number | undefined): number {
  if (seconds === undefined || Number.isNaN(seconds)) return DEFAULT_DRAFT_TIMER_SECONDS;
  return Math.min(MAX_DRAFT_TIMER_SECONDS, Math.max(MIN_DRAFT_TIMER_SECONDS, Math.round(seconds)));
}

function validateSlots(slots: Record<string, string>): void {
  for (const position of Object.keys(slots)) {
    if (!isNbaPosition(position)) {
      throw new BadRequestException(`"${position}" is not a valid NBA draft slot.`);
    }
  }
}

function toSideStatus(roster: (Roster & { user: User }) | null): SideStatusDto {
  if (!roster) return { joined: false, isLocked: false, draftDeadline: null, teamName: null };
  return {
    joined: true,
    isLocked: roster.isLocked,
    draftDeadline: roster.draftDeadline.toISOString(),
    teamName: `${roster.user.displayName}'s Team`,
  };
}

function toCreateMatchResponse(match: MatchWithRosters, side: 'A' | 'B'): CreateMatchResponse {
  const roster = side === 'A' ? match.rosterA : match.rosterB;
  if (!roster) throw new NotFoundException('Roster not found for this side.');
  return {
    roomCode: match.roomCode,
    matchId: match.id,
    yourSide: side,
    rosterId: roster.id,
    draftTimerSeconds: match.draftTimerSeconds,
    draftDeadline: roster.draftDeadline.toISOString(),
  };
}

function toGameResultDto(gameResult: { scoreA: number; scoreB: number; boxScore: unknown; highlights: unknown; mvp: unknown; overtimePeriods: number; recapHeadline: string | null; recapArticle: string | null }): GameResultDto {
  return {
    scoreA: gameResult.scoreA,
    scoreB: gameResult.scoreB,
    winnerSide: gameResult.scoreA >= gameResult.scoreB ? 'A' : 'B',
    boxScore: gameResult.boxScore as GameResultDto['boxScore'],
    highlights: gameResult.highlights as GameResultDto['highlights'],
    mvp: gameResult.mvp as GameResultDto['mvp'],
    overtimePeriods: gameResult.overtimePeriods,
    recapHeadline: gameResult.recapHeadline,
    recapArticle: gameResult.recapArticle,
  };
}
