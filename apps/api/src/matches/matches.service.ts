import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Match, Roster, User } from '@prisma/client';
import { GameResult as SimGameResult, simulateGame } from '@roster-duel/sim-engine';
import { PrismaService } from '../prisma/prisma.service';
import { createAnthropicRecapGenerator } from '../recap/anthropicRecapGenerator';
import { generateGameRecap, toRecapPromptInput } from '../recap/generateGameRecap';
import { validateRecapGrounding } from '../recap/validateRecapGrounding';
import { NBA_POSITIONS, SlottedStint, isNbaPosition, toTeamInput } from '../sim/toTeamInput';
import { autoFillRosterSlots, RatedCandidate } from './draftAutoFill';
import { buildPersonKeyToSlot, isAlreadyDrafted, openPositionsForPlayer } from './draftPool';
import { CreateMatchRequest, CreateMatchResponse, CurrentRoundDto, GameResultDto, MatchStateDto, PickResultDto, RoundPlayerDto, SideStatusDto } from './dto';
import { MatchesGateway } from './matches.gateway';
import { generateRoomCode } from './roomCode';
import { drawEraRespinCombo, drawRandomCombo, drawTeamRespinCombo, hasEraRespinAlternative, hasTeamRespinAlternative, TeamEraCombo } from './slotAssignment';

const MIN_DRAFT_TIMER_SECONDS = 60;
const MAX_DRAFT_TIMER_SECONDS = 30 * 60;
const ROOM_CODE_GENERATION_ATTEMPTS = 10;
const VALID_ERAS = ['sixties', 'seventies', 'eighties', 'nineties', 'two_thousands', 'twenty_tens', 'twenty_twenties'];
const REQUIRED_NBA_POSITIONS = NBA_POSITIONS.filter((p) => p !== '6MAN');

type MatchWithRosters = Match & { rosterA: (Roster & { user: User }) | null; rosterB: (Roster & { user: User }) | null };
/** One entry per draft round (spec 4c's sequential redesign) — NOT keyed by position, since a round's roll isn't "for" any particular slot ahead of time. Always length NBA_POSITIONS.length once computed. */
type RollSequence = TeamEraCombo[];

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MatchesGateway,
  ) {}

  async createMatch(user: User, options?: CreateMatchRequest): Promise<CreateMatchResponse> {
    const draftTimerSeconds = options?.draftTimerSeconds !== undefined ? clampDraftTimer(options.draftTimerSeconds) : null;
    const draftDeadline = draftTimerSeconds !== null ? new Date(Date.now() + draftTimerSeconds * 1000) : null;
    const rolesMode = options?.rolesMode === 'same_roles' ? 'same_roles' : 'independent_roles';
    const includedEras = validateIncludedEras(options?.includedEras);
    const includedTeamIds = options?.includedTeamIds ?? [];
    await this.assertTeamIdsExist(includedTeamIds);
    await this.assertFilterIsDraftable(includedEras, includedTeamIds);

    const availableCombos = await this.loadAvailableCombos(includedEras, includedTeamIds);
    // Spec 4e: "same roles" means both rosters play the IDENTICAL sequence
    // of rolls, round by round — computed ONCE here and stored on the
    // match, not independently re-drawn per roster (which would just be
    // two separately-random sequences that happen to use the same method,
    // not actually identical).
    const sharedRollSequence = rolesMode === 'same_roles' ? this.computeRollSequence(availableCombos) : null;
    const rosterARollSequence = sharedRollSequence ?? this.computeRollSequence(availableCombos);

    const roster = await this.prisma.roster.create({
      data: { userId: user.id, sport: 'nba', slots: {}, rollSequence: rosterARollSequence as object, draftDeadline },
    });

    const roomCode = await this.generateUniqueRoomCode();
    const match = await this.prisma.match.create({
      // matchType explicit even though it's the schema default: every match
      // created through this friend-link flow is friend_link, never
      // eligible for leaderboard stats (spec 9a) — the random-matchmaking
      // queue that would set the other value doesn't exist yet (agreed
      // deferred scope).
      data: {
        roomCode,
        sport: 'nba',
        matchType: 'friend_link',
        draftTimerSeconds,
        rosterAId: roster.id,
        status: 'drafting',
        rolesMode,
        includedEras: includedEras as never,
        includedTeamIds,
        sharedRollSequence: (sharedRollSequence as object | null) ?? undefined,
      },
    });

    return {
      roomCode: match.roomCode,
      matchId: match.id,
      yourSide: 'A',
      rosterId: roster.id,
      draftTimerSeconds,
      draftDeadline: draftDeadline ? draftDeadline.toISOString() : null,
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

    const draftDeadline = match.draftTimerSeconds !== null ? new Date(Date.now() + match.draftTimerSeconds * 1000) : null;
    // Same-roles: copy the match's shared sequence exactly, not a fresh
    // draw. Independent-roles: this roster draws its own.
    const rollSequence: RollSequence =
      match.rolesMode === 'same_roles' && match.sharedRollSequence
        ? (match.sharedRollSequence as unknown as RollSequence)
        : this.computeRollSequence(await this.loadAvailableCombos(match.includedEras, match.includedTeamIds));

    const roster = await this.prisma.roster.create({
      data: { userId: user.id, sport: 'nba', slots: {}, rollSequence: rollSequence as object, draftDeadline },
    });
    const updated = await this.prisma.match.update({
      where: { id: match.id },
      data: { rosterBId: roster.id },
      include: { rosterA: { include: { user: true } }, rosterB: { include: { user: true } } },
    });

    return toCreateMatchResponse(updated, 'B');
  }

  /** Respins the Team or Era of the CURRENT round's not-yet-picked roll (spec 4c) — each is a single-use resource for the whole draft, usable on any round. */
  async respinCurrentRound(rosterId: string, user: User, respinType: 'team' | 'era'): Promise<MatchStateDto> {
    const roster = await this.getOwnedRosterOrThrow(rosterId, user);
    const match = await this.findMatchByRosterOrThrow(roster.id);

    if (roster.isLocked) {
      throw new BadRequestException('This roster is already locked.');
    }
    if (this.isExpired(roster)) {
      await this.autoLockRoster(roster);
      throw new BadRequestException('Your draft time expired — your roster was auto-locked.');
    }
    if (respinType === 'team' && roster.teamRespinUsed) {
      throw new BadRequestException('Your Team respin has already been used.');
    }
    if (respinType === 'era' && roster.eraRespinUsed) {
      throw new BadRequestException('Your Era respin has already been used.');
    }

    const slots = roster.slots as Record<string, string>;
    const openPositions = NBA_POSITIONS.filter((p) => !slots[p]);
    if (openPositions.length === 0) {
      throw new BadRequestException('Every slot is already filled — there is no current round to respin.');
    }
    const roundIndex = NBA_POSITIONS.length - openPositions.length;
    const rollSequence = roster.rollSequence as unknown as RollSequence;
    const current = rollSequence[roundIndex];
    if (!current) {
      throw new BadRequestException('The current round has no rolled team+era yet.');
    }

    const availableCombos = await this.loadAvailableCombos(match.includedEras, match.includedTeamIds);
    const newCombo = respinType === 'team' ? drawTeamRespinCombo(current, availableCombos) : drawEraRespinCombo(current, availableCombos);
    if (!newCombo) {
      throw new BadRequestException(`No alternative ${respinType} available to respin into — this is a dead end with the current seed pool.`);
    }

    const updatedRollSequence = [...rollSequence];
    updatedRollSequence[roundIndex] = newCombo;

    await this.prisma.roster.update({
      where: { id: roster.id },
      data: {
        rollSequence: updatedRollSequence as object,
        ...(respinType === 'team' ? { teamRespinUsed: true } : { eraRespinUsed: true }),
      },
    });

    return this.getMatchState(match.roomCode, user);
  }

  /**
   * Locks in a pick for the CURRENT round (spec 4c step 4). If the tapped
   * player is eligible for exactly one currently-open position, they're
   * auto-assigned there. If eligible for more than one, the caller must
   * supply `position` (chosen from a prior `choose_position` response) —
   * omitting it when it's genuinely ambiguous returns the choice back to
   * the caller rather than guessing.
   */
  async pickPlayer(rosterId: string, user: User, stintId: string, position: string | undefined): Promise<PickResultDto> {
    const roster = await this.getOwnedRosterOrThrow(rosterId, user);
    const match = await this.findMatchByRosterOrThrow(roster.id);

    if (roster.isLocked) {
      throw new BadRequestException('This roster is already locked.');
    }
    if (this.isExpired(roster)) {
      await this.autoLockRoster(roster);
      throw new BadRequestException('Your draft time expired — your roster was auto-locked.');
    }

    const slots = roster.slots as Record<string, string>;
    const openPositions = NBA_POSITIONS.filter((p) => !slots[p]);
    if (openPositions.length === 0) {
      throw new BadRequestException('Your roster is already full.');
    }
    const roundIndex = NBA_POSITIONS.length - openPositions.length;
    const rollSequence = roster.rollSequence as unknown as RollSequence;
    const combo = rollSequence[roundIndex];
    if (!combo) {
      throw new BadRequestException('The current round has no rolled team+era yet.');
    }

    const stint = await this.prisma.playerStint.findUnique({ where: { id: stintId } });
    if (!stint || stint.sport !== 'nba') {
      throw new BadRequestException('That player is not valid.');
    }
    if (stint.teamId !== combo.teamId || stint.era !== combo.era) {
      throw new BadRequestException(`"${stint.name}" is not part of the current round's roster.`);
    }

    const personKeyToSlot = buildPersonKeyToSlot(await this.loadLockedPicks(slots));
    if (isAlreadyDrafted(stint.personKey, personKeyToSlot)) {
      throw new BadRequestException(`"${stint.name}" is already drafted onto your roster.`);
    }

    const eligibleOpen = openPositionsForPlayer(stint.eligiblePositions, openPositions);
    if (eligibleOpen.length === 0) {
      throw new BadRequestException(`"${stint.name}" has no eligible open position left on your roster.`);
    }

    let chosenPosition: string;
    if (position !== undefined) {
      if (!isNbaPosition(position) || !eligibleOpen.includes(position)) {
        throw new BadRequestException(`"${stint.name}" cannot fill slot "${position}".`);
      }
      chosenPosition = position;
    } else if (eligibleOpen.length === 1) {
      chosenPosition = eligibleOpen[0];
    } else {
      return { status: 'choose_position', eligiblePositions: eligibleOpen };
    }

    await this.prisma.roster.update({
      where: { id: roster.id },
      data: { slots: { ...slots, [chosenPosition]: stintId } },
    });

    return { status: 'locked', match: await this.getMatchState(match.roomCode, user) };
  }

  /** Manual lock — requires a complete roster. Timer-expiry locks go through autoLockRoster instead. */
  async lockRoster(rosterId: string, user: User): Promise<MatchStateDto> {
    const roster = await this.getOwnedRosterOrThrow(rosterId, user);
    const match = await this.findMatchByRosterOrThrow(roster.id);

    if (roster.isLocked) {
      return this.getMatchState(match.roomCode, user);
    }

    if (this.isExpired(roster)) {
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
    const playerJerseyColors = gameResult ? await this.buildPlayerJerseyColors(match) : null;

    const yourCurrentRound = yourRoster && !yourRoster.isLocked ? await this.buildCurrentRound(yourRoster, match) : null;

    return {
      roomCode: match.roomCode,
      sport: 'nba',
      status: match.status,
      draftTimerSeconds: match.draftTimerSeconds,
      rolesMode: match.rolesMode,
      includedEras: match.includedEras,
      includedTeamIds: match.includedTeamIds,
      yourSide,
      yourRosterId: yourRoster?.id ?? null,
      sideA: toSideStatus(match.rosterA),
      sideB: toSideStatus(match.rosterB),
      yourSlots: yourRoster ? (yourRoster.slots as Record<string, string>) : null,
      opponentSlots: bothLocked && opponentRoster ? (opponentRoster.slots as Record<string, string>) : null,
      yourCurrentRound,
      yourTeamRespinUsed: yourRoster?.teamRespinUsed ?? null,
      yourEraRespinUsed: yourRoster?.eraRespinUsed ?? null,
      gameResult: gameResult ? toGameResultDto(gameResult, playerJerseyColors ?? {}) : null,
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
    const playerJerseyColors = await this.buildPlayerJerseyColors(match);
    this.gateway.notifyRecapReady(match.roomCode);
    return toGameResultDto(refreshed, playerJerseyColors);
  }

  // --- internals ---

  private isExpired(roster: Roster): boolean {
    return roster.draftDeadline !== null && roster.draftDeadline.getTime() <= Date.now();
  }

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
      if (roster && !roster.isLocked && this.isExpired(roster)) {
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
    const slots = roster.slots as Record<string, string>;
    const openPositions = NBA_POSITIONS.filter((p) => !slots[p]);

    if (openPositions.length === 0) {
      await this.prisma.roster.update({ where: { id: roster.id }, data: { isLocked: true, lockedAt: new Date() } });
      return;
    }

    // Fill remaining open slots from whatever rounds this roster hasn't
    // played yet (spec section 4: "randomly/optimally filled remaining
    // slots," reusing the same highest-rated-available fill logic as
    // "Beat the AI") — already-played rounds are done and gone, so only
    // the NOT-YET-ROLLED portion of the sequence is a fair source.
    const rollSequence = roster.rollSequence as unknown as RollSequence;
    const roundIndex = NBA_POSITIONS.length - openPositions.length;
    const remainingCombos = rollSequence.slice(roundIndex);

    const [candidatesByPosition, usedPersonKeys] = await Promise.all([
      this.loadRatedCandidatesForOpenPositions(remainingCombos, openPositions),
      this.loadUsedPersonKeys(slots),
    ]);
    const filledSlots = autoFillRosterSlots(openPositions, slots, candidatesByPosition, usedPersonKeys);
    await this.prisma.roster.update({
      where: { id: roster.id },
      data: { slots: filledSlots, isLocked: true, lockedAt: new Date() },
    });
  }

  /** Rated candidates for each still-open position, drawn from the union of the roster's not-yet-played rounds (spec 4c/4f — 6MAN unfiltered by position, everything else eligibility-checked). */
  private async loadRatedCandidatesForOpenPositions(combos: readonly TeamEraCombo[], openPositions: readonly string[]): Promise<Record<string, RatedCandidate[]>> {
    if (combos.length === 0 || openPositions.length === 0) return {};

    // Dedup — the same team+era can legitimately appear more than once
    // across rounds (repeated rolls are allowed, spec 4c).
    const uniqueCombos = [...new Map(combos.map((c) => [`${c.teamId}|${c.era}`, c])).values()];
    const stints = await this.prisma.playerStint.findMany({
      where: { sport: 'nba', OR: uniqueCombos.map((c) => ({ teamId: c.teamId, era: c.era as never })) },
      include: { rating: true },
    });

    const result: Record<string, RatedCandidate[]> = {};
    for (const position of openPositions) {
      result[position] = stints
        .filter((s) => s.rating !== null && (position === '6MAN' || s.eligiblePositions.includes(position)))
        .map((s) => ({ id: s.id, personKey: s.personKey, baseRating: Number(s.rating!.baseRating) }));
    }
    return result;
  }

  private async loadUsedPersonKeys(slots: Record<string, string>): Promise<Set<string>> {
    const stintIds = Object.values(slots).filter(Boolean);
    if (stintIds.length === 0) return new Set();
    const stints = await this.prisma.playerStint.findMany({ where: { id: { in: stintIds } }, select: { personKey: true } });
    return new Set(stints.map((s) => s.personKey));
  }

  /** The already-LOCKED picks on a roster, as {slotPosition, personKey} pairs (spec 4c/4f grayout input) — looks up each locked stint id's personKey. */
  private async loadLockedPicks(slots: Record<string, string>): Promise<{ slotPosition: string; personKey: string }[]> {
    const entries = Object.entries(slots).filter((e): e is [string, string] => Boolean(e[1]));
    if (entries.length === 0) return [];
    const stints = await this.prisma.playerStint.findMany({ where: { id: { in: entries.map(([, id]) => id) } }, select: { id: true, personKey: true } });
    const personKeyById = new Map(stints.map((s) => [s.id, s.personKey]));
    return entries.map(([slotPosition, stintId]) => ({ slotPosition, personKey: personKeyById.get(stintId)! })).filter((e) => Boolean(e.personKey));
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

  /**
   * A `playerId -> team colorHex` map covering both rosters' locked picks
   * (spec 4a's GameCast sprite personalization, reworked to differentiate
   * players by their drafted-from team's real color instead of any
   * skin-tone-like attribute — see schema.prisma's PlayerStint doc
   * comment). Box score / highlight `playerId`s are PlayerStint ids (see
   * toTeamInput.ts's SlottedStint — the sim engine is fed `id: stint.id`
   * and never itself knows what a player looks like), so this is a small,
   * cheap lookup keyed the same way.
   */
  private async buildPlayerJerseyColors(match: MatchWithRosters): Promise<Record<string, string>> {
    const stintIds = [
      ...Object.values((match.rosterA?.slots as Record<string, string>) ?? {}),
      ...Object.values((match.rosterB?.slots as Record<string, string>) ?? {}),
    ].filter(Boolean);
    if (stintIds.length === 0) return {};
    const stints = await this.prisma.playerStint.findMany({ where: { id: { in: stintIds } }, select: { id: true, team: { select: { colorHex: true } } } });
    return Object.fromEntries(stints.map((s) => [s.id, s.team.colorHex]));
  }

  private async loadRosterPlayers(slots: Record<string, string>): Promise<SlottedStint[]> {
    const stintIds = Object.values(slots).filter(Boolean);
    const stints = await this.prisma.playerStint.findMany({
      where: { id: { in: stintIds } },
      include: { stats: true, rating: true },
    });
    const stintById = new Map(stints.map((s) => [s.id, s]));
    // Preserve draft-slot order (PG..6MAN) rather than whatever order the DB returns.
    // slotPosition comes from the roster's own slot key, NOT any field on the
    // stint — see toTeamInput.ts's SlottedStint doc comment for why.
    return NBA_POSITIONS.map((slotPosition) => {
      const stint = stintById.get(slots[slotPosition]);
      return stint ? { stint, slotPosition } : undefined;
    }).filter((entry): entry is SlottedStint => Boolean(entry));
  }

  /** Distinct (teamId, era) combos actually seeded, narrowed by the match's spec 4e era/team filters (empty = unrestricted). The single source of "what can a round draw from" for both the initial sequence and respins. */
  private async loadAvailableCombos(includedEras: string[], includedTeamIds: string[]): Promise<TeamEraCombo[]> {
    const stints = await this.prisma.playerStint.findMany({
      where: {
        sport: 'nba',
        ...(includedEras.length > 0 ? { era: { in: includedEras as never } } : {}),
        ...(includedTeamIds.length > 0 ? { teamId: { in: includedTeamIds } } : {}),
      },
      select: { teamId: true, era: true },
      distinct: ['teamId', 'era'],
    });
    return stints.map((s) => ({ teamId: s.teamId, era: s.era }));
  }

  /** Draws the full sequence of rolls for one roster's draft (spec 4c) — one entry per round, repeats across rounds allowed (each round is an independent random draw). */
  private computeRollSequence(availableCombos: TeamEraCombo[]): RollSequence {
    const sequence: RollSequence = [];
    for (let i = 0; i < NBA_POSITIONS.length; i++) {
      const combo = drawRandomCombo(availableCombos);
      if (!combo) {
        // Should be unreachable — assertFilterIsDraftable is always called
        // before this at match-creation/join time.
        throw new Error('No available team+era combos to draw from.');
      }
      sequence.push(combo);
    }
    return sequence;
  }

  /** Blocks creating a match whose era/team narrowing (spec 4e) would leave some required position undraftable anywhere in the filtered pool. */
  private async assertFilterIsDraftable(includedEras: string[], includedTeamIds: string[]): Promise<void> {
    const stints = await this.prisma.playerStint.findMany({
      where: {
        sport: 'nba',
        ...(includedEras.length > 0 ? { era: { in: includedEras as never } } : {}),
        ...(includedTeamIds.length > 0 ? { teamId: { in: includedTeamIds } } : {}),
      },
      select: { eligiblePositions: true },
    });
    if (stints.length === 0) {
      throw new BadRequestException('This era/team selection has no players at all — widen the filter.');
    }
    const missing = REQUIRED_NBA_POSITIONS.filter((pos) => !stints.some((s) => s.eligiblePositions.includes(pos)));
    if (missing.length > 0) {
      throw new BadRequestException(`This era/team selection has no eligible player for [${missing.join(', ')}] — widen the filter.`);
    }
  }

  private async assertTeamIdsExist(teamIds: string[]): Promise<void> {
    if (teamIds.length === 0) return;
    const count = await this.prisma.team.count({ where: { id: { in: teamIds }, sport: 'nba' } });
    if (count !== new Set(teamIds).size) {
      throw new BadRequestException('One or more selected teams are invalid.');
    }
  }

  /** Builds the requesting roster's current round: the rolled team+era and its full, unfiltered player roster, with per-player eligible-open-position/grayout info and this round's respin availability (spec 4c/4f). Null once every slot is filled (nothing left to roll). */
  private async buildCurrentRound(roster: Roster, match: Match): Promise<CurrentRoundDto | null> {
    const slots = roster.slots as Record<string, string>;
    const openPositions = NBA_POSITIONS.filter((p) => !slots[p]);
    if (openPositions.length === 0) return null;

    const roundIndex = NBA_POSITIONS.length - openPositions.length;
    const rollSequence = roster.rollSequence as unknown as RollSequence;
    const combo = rollSequence[roundIndex];
    if (!combo) return null;

    const [stints, availableCombos, lockedPicks] = await Promise.all([
      this.prisma.playerStint.findMany({
        where: { sport: 'nba', teamId: combo.teamId, era: combo.era as never },
        include: { stats: true, rating: true, team: true },
      }),
      this.loadAvailableCombos(match.includedEras, match.includedTeamIds),
      this.loadLockedPicks(slots),
    ]);

    const rated = stints.filter((s) => s.rating !== null);
    const team = rated[0]?.team;
    const personKeyToSlot = buildPersonKeyToSlot(lockedPicks);

    const players: RoundPlayerDto[] = rated.map((s) => ({
      id: s.id,
      name: s.name,
      eligiblePositions: s.eligiblePositions,
      personKey: s.personKey,
      stintStartYear: s.stintStartYear,
      stintEndYear: s.stintEndYear,
      isActive: s.isActive,
      baseRating: Number(s.rating!.baseRating),
      offenseRating: Number(s.rating!.offenseRating),
      defenseRating: Number(s.rating!.defenseRating),
      clutchModifier: Number(s.rating!.clutchModifier),
      stats: Object.fromEntries(s.stats.map((stat) => [stat.statKey, Number(stat.statValue)])),
      estimatedStats: Object.fromEntries(
        s.stats.filter((stat) => stat.estimateReason !== null).map((stat) => [stat.statKey, stat.estimateReason as 'pre_tracking_era' | 'hypothetical_pre_three_point']),
      ),
      eligibleOpenPositions: openPositionsForPlayer(s.eligiblePositions, openPositions),
      isDuplicate: isAlreadyDrafted(s.personKey, personKeyToSlot),
    }));

    return {
      roundIndex,
      totalRounds: NBA_POSITIONS.length,
      teamId: combo.teamId,
      teamName: team?.name ?? '',
      teamColorHex: team?.colorHex ?? '',
      era: combo.era,
      players,
      teamRespinAvailable: !roster.teamRespinUsed && hasTeamRespinAlternative(combo, availableCombos),
      eraRespinAvailable: !roster.eraRespinUsed && hasEraRespinAlternative(combo, availableCombos),
    };
  }
}

function clampDraftTimer(seconds: number): number {
  if (Number.isNaN(seconds)) return MIN_DRAFT_TIMER_SECONDS;
  return Math.min(MAX_DRAFT_TIMER_SECONDS, Math.max(MIN_DRAFT_TIMER_SECONDS, Math.round(seconds)));
}

function validateIncludedEras(eras: string[] | undefined): string[] {
  if (!eras || eras.length === 0) return [];
  const invalid = eras.filter((e) => !VALID_ERAS.includes(e));
  if (invalid.length > 0) {
    throw new BadRequestException(`Invalid era(s): ${invalid.join(', ')}.`);
  }
  return [...new Set(eras)];
}

function toSideStatus(roster: (Roster & { user: User }) | null): SideStatusDto {
  if (!roster) return { joined: false, isLocked: false, draftDeadline: null, teamName: null };
  return {
    joined: true,
    isLocked: roster.isLocked,
    draftDeadline: roster.draftDeadline ? roster.draftDeadline.toISOString() : null,
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
    draftDeadline: roster.draftDeadline ? roster.draftDeadline.toISOString() : null,
  };
}

function toGameResultDto(
  gameResult: { scoreA: number; scoreB: number; boxScore: unknown; highlights: unknown; mvp: unknown; overtimePeriods: number; recapHeadline: string | null; recapArticle: string | null },
  playerJerseyColors: Record<string, string>,
): GameResultDto {
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
    playerJerseyColors,
  };
}
