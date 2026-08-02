import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Match, Roster, User } from '@prisma/client';
import { GameResult as SimGameResult, NbaPosition, simulateGame } from '@roster-duel/sim-engine';
import { PrismaService } from '../prisma/prisma.service';
import { createAnthropicRecapGenerator } from '../recap/anthropicRecapGenerator';
import { generateGameRecap, toRecapPromptInput } from '../recap/generateGameRecap';
import { validateRecapGrounding } from '../recap/validateRecapGrounding';
import { NBA_POSITIONS, SlottedStint, isNbaPosition, toTeamInput } from '../sim/toTeamInput';
import { autoFillRosterSlots, RatedCandidate } from './draftAutoFill';
import { buildPersonKeyToSlot, filterEligibleForSlot, isDuplicateInSlot } from './draftPool';
import { CreateMatchRequest, CreateMatchResponse, DraftPoolPlayerDto, GameResultDto, MatchStateDto, SideStatusDto, SlotPoolDto } from './dto';
import { MatchesGateway } from './matches.gateway';
import { generateRoomCode } from './roomCode';
import { drawEraRespinCombo, drawRandomCombo, drawTeamRespinCombo, hasEraRespinAlternative, hasTeamRespinAlternative, TeamEraCombo } from './slotAssignment';

const MIN_DRAFT_TIMER_SECONDS = 60;
const MAX_DRAFT_TIMER_SECONDS = 30 * 60;
const DEFAULT_DRAFT_TIMER_SECONDS = 5 * 60;
const ROOM_CODE_GENERATION_ATTEMPTS = 10;
const VALID_ERAS = ['sixties', 'seventies', 'eighties', 'nineties', 'two_thousands', 'twenty_tens', 'twenty_twenties'];
const REQUIRED_NBA_POSITIONS = NBA_POSITIONS.filter((p) => p !== '6MAN');

type MatchWithRosters = Match & { rosterA: (Roster & { user: User }) | null; rosterB: (Roster & { user: User }) | null };
type SlotAssignments = Record<string, TeamEraCombo>;

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MatchesGateway,
  ) {}

  async createMatch(user: User, options?: CreateMatchRequest): Promise<CreateMatchResponse> {
    const draftTimerSeconds = clampDraftTimer(options?.draftTimerSeconds);
    const draftDeadline = new Date(Date.now() + draftTimerSeconds * 1000);
    const rolesMode = options?.rolesMode === 'same_roles' ? 'same_roles' : 'independent_roles';
    const includedEras = validateIncludedEras(options?.includedEras);
    const includedTeamIds = options?.includedTeamIds ?? [];
    await this.assertTeamIdsExist(includedTeamIds);
    await this.assertFilterIsDraftable(includedEras, includedTeamIds);

    const availableCombos = await this.loadAvailableCombos(includedEras, includedTeamIds);
    // Spec 4e: "same roles" means both rosters get the IDENTICAL initial
    // sequence — computed ONCE here and stored on the match, not
    // independently re-drawn per roster (which would just be two
    // separately-random sequences that happen to use the same method, not
    // actually identical).
    const sharedSlotAssignments = rolesMode === 'same_roles' ? this.computeSlotAssignments(availableCombos) : null;
    const rosterASlotAssignments = sharedSlotAssignments ?? this.computeSlotAssignments(availableCombos);

    const roster = await this.prisma.roster.create({
      data: { userId: user.id, sport: 'nba', slots: {}, slotAssignments: rosterASlotAssignments as object, draftDeadline },
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
        sharedSlotAssignments: (sharedSlotAssignments as object | null) ?? undefined,
      },
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
    // Same-roles: copy the match's shared sequence exactly, not a fresh
    // draw. Independent-roles: this roster draws its own.
    const slotAssignments: SlotAssignments =
      match.rolesMode === 'same_roles' && match.sharedSlotAssignments
        ? (match.sharedSlotAssignments as unknown as SlotAssignments)
        : this.computeSlotAssignments(await this.loadAvailableCombos(match.includedEras, match.includedTeamIds));

    const roster = await this.prisma.roster.create({
      data: { userId: user.id, sport: 'nba', slots: {}, slotAssignments: slotAssignments as object, draftDeadline },
    });
    const updated = await this.prisma.match.update({
      where: { id: match.id },
      data: { rosterBId: roster.id },
      include: { rosterA: { include: { user: true } }, rosterB: { include: { user: true } } },
    });

    return toCreateMatchResponse(updated, 'B');
  }

  /** Respins the Team or Era for one slot (spec 4c) — each is a single-use resource shared across all 6 slots on this roster. */
  async respinSlot(rosterId: string, user: User, position: string, respinType: 'team' | 'era'): Promise<MatchStateDto> {
    const roster = await this.getOwnedRosterOrThrow(rosterId, user);
    const match = await this.findMatchByRosterOrThrow(roster.id);

    if (roster.isLocked) {
      throw new BadRequestException('This roster is already locked.');
    }
    if (roster.draftDeadline.getTime() <= Date.now()) {
      await this.autoLockRoster(roster);
      throw new BadRequestException('Your draft time expired — your roster was auto-locked.');
    }
    if (!isNbaPosition(position)) {
      throw new BadRequestException(`"${position}" is not a valid NBA draft slot.`);
    }
    if (respinType === 'team' && roster.teamRespinUsed) {
      throw new BadRequestException('Your Team respin has already been used.');
    }
    if (respinType === 'era' && roster.eraRespinUsed) {
      throw new BadRequestException('Your Era respin has already been used.');
    }

    const slotAssignments = roster.slotAssignments as unknown as SlotAssignments;
    const current = slotAssignments[position];
    if (!current) {
      throw new BadRequestException(`Slot "${position}" has no assigned team+era yet.`);
    }

    const availableCombos = await this.loadAvailableCombos(match.includedEras, match.includedTeamIds);
    const newCombo = respinType === 'team' ? drawTeamRespinCombo(current, availableCombos) : drawEraRespinCombo(current, availableCombos);
    if (!newCombo) {
      throw new BadRequestException(`No alternative ${respinType} available to respin into for this slot — this is a known dead end with the current seed pool.`);
    }

    // The old pick for this slot (if any) belonged to the OLD combo — it's
    // no longer valid once the slot's pool changes, so clear it.
    const updatedSlots = { ...(roster.slots as Record<string, string>) };
    delete updatedSlots[position];

    await this.prisma.roster.update({
      where: { id: roster.id },
      data: {
        slotAssignments: { ...slotAssignments, [position]: newCombo } as object,
        slots: updatedSlots,
        ...(respinType === 'team' ? { teamRespinUsed: true } : { eraRespinUsed: true }),
      },
    });

    return this.getMatchState(match.roomCode, user);
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
    await this.assertSlotPicksAreValid(slots, roster.slotAssignments as unknown as SlotAssignments);

    await this.prisma.roster.update({ where: { id: roster.id }, data: { slots } });
  }

  /**
   * Server-side enforcement of spec 4c/4f's draft rules — the frontend
   * should already prevent all of these, but the server is the actual
   * authority (a client can't be trusted to only submit valid picks):
   * 1. Each picked stint must exist and actually belong to ITS slot's
   *    currently-assigned team+era combo (not some other combo, and not
   *    stale after a respin changed the combo out from under it).
   * 2. Each picked stint must be eligible for its slot's position (6MAN
   *    accepts anyone from the combo, unfiltered).
   * 3. No two slots may hold the same real person (personKey), regardless
   *    of which stint/eligible position got them there.
   */
  private async assertSlotPicksAreValid(slots: Record<string, string>, slotAssignments: SlotAssignments): Promise<void> {
    const stintIds = Object.values(slots).filter(Boolean);
    if (stintIds.length === 0) return;

    const stints = await this.prisma.playerStint.findMany({ where: { id: { in: stintIds }, sport: 'nba' } });
    const stintById = new Map(stints.map((s) => [s.id, s]));

    const seenPersonKeys = new Map<string, string>(); // personKey -> first slot that used it
    for (const [position, stintId] of Object.entries(slots)) {
      if (!stintId) continue;
      const stint = stintById.get(stintId);
      if (!stint) {
        throw new BadRequestException(`One or more selected players are invalid.`);
      }
      const combo = slotAssignments[position];
      if (!combo || stint.teamId !== combo.teamId || stint.era !== combo.era) {
        throw new BadRequestException(`"${stint.name}" does not belong to slot "${position}"'s currently-assigned team+era.`);
      }
      if (position !== '6MAN' && !stint.eligiblePositions.includes(position)) {
        throw new BadRequestException(`"${stint.name}" is not eligible for slot "${position}".`);
      }
      const existingSlot = seenPersonKeys.get(stint.personKey);
      if (existingSlot && existingSlot !== position) {
        throw new BadRequestException(`"${stint.name}" is already drafted in slot "${existingSlot}" — the same real person can't fill two slots.`);
      }
      seenPersonKeys.set(stint.personKey, position);
    }
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

    const yourDraftPool = yourRoster && !yourRoster.isLocked ? await this.buildDraftPool(yourRoster, match) : null;

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
      yourDraftPool,
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
    const slotAssignments = roster.slotAssignments as unknown as SlotAssignments;
    const currentSlots = roster.slots as Record<string, string>;
    const [candidatesBySlot, usedPersonKeys] = await Promise.all([
      this.loadRatedCandidatesBySlot(slotAssignments),
      this.loadUsedPersonKeys(currentSlots),
    ]);
    const filledSlots = autoFillRosterSlots(NBA_POSITIONS, currentSlots, candidatesBySlot, usedPersonKeys);
    await this.prisma.roster.update({
      where: { id: roster.id },
      data: { slots: filledSlots, isLocked: true, lockedAt: new Date() },
    });
  }

  /** Builds one rated-candidate list PER SLOT, scoped to that slot's assigned team+era combo and position eligibility (spec 4c/4f) — replaces the old sport-wide free-browse candidate pool. */
  private async loadRatedCandidatesBySlot(slotAssignments: SlotAssignments): Promise<Record<string, RatedCandidate[]>> {
    const combos = NBA_POSITIONS.map((pos) => slotAssignments[pos]).filter((c): c is TeamEraCombo => Boolean(c));
    if (combos.length === 0) return {};

    const stints = await this.prisma.playerStint.findMany({
      where: { sport: 'nba', OR: combos.map((c) => ({ teamId: c.teamId, era: c.era as never })) },
      include: { rating: true },
    });

    const result: Record<string, RatedCandidate[]> = {};
    for (const position of NBA_POSITIONS) {
      const combo = slotAssignments[position];
      if (!combo) continue;
      const comboStints = stints.filter((s) => s.teamId === combo.teamId && s.era === combo.era && s.rating !== null);
      const eligible = filterEligibleForSlot(comboStints, position);
      result[position] = eligible.map((s) => {
        const stint = comboStints.find((cs) => cs.id === s.id)!;
        return { id: stint.id, personKey: stint.personKey, baseRating: Number(stint.rating!.baseRating) };
      });
    }
    return result;
  }

  private async loadUsedPersonKeys(slots: Record<string, string>): Promise<Set<string>> {
    const stintIds = Object.values(slots).filter(Boolean);
    if (stintIds.length === 0) return new Set();
    const stints = await this.prisma.playerStint.findMany({ where: { id: { in: stintIds } }, select: { personKey: true } });
    return new Set(stints.map((s) => s.personKey));
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

  /** Distinct (teamId, era) combos actually seeded, narrowed by the match's spec 4e era/team filters (empty = unrestricted). The single source of "what can a slot draw from" for both initial assignment and respins. */
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

  private computeSlotAssignments(availableCombos: TeamEraCombo[]): SlotAssignments {
    const assignments: SlotAssignments = {};
    for (const position of NBA_POSITIONS) {
      const combo = drawRandomCombo(availableCombos);
      if (!combo) {
        // Should be unreachable — assertFilterIsDraftable is always called
        // before this at match-creation/join time.
        throw new Error('No available team+era combos to draw from.');
      }
      assignments[position] = combo;
    }
    return assignments;
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

  /** Builds the requesting roster's per-slot offered team+era + player pool (spec 4c/4f), including grayout and respin availability. */
  private async buildDraftPool(roster: Roster, match: Match): Promise<Record<string, SlotPoolDto>> {
    const slotAssignments = roster.slotAssignments as unknown as SlotAssignments;
    const slots = roster.slots as Record<string, string>;
    const availableCombos = await this.loadAvailableCombos(match.includedEras, match.includedTeamIds);

    const combos = NBA_POSITIONS.map((pos) => slotAssignments[pos]).filter((c): c is TeamEraCombo => Boolean(c));
    const stints =
      combos.length > 0
        ? await this.prisma.playerStint.findMany({
            where: { sport: 'nba', OR: combos.map((c) => ({ teamId: c.teamId, era: c.era as never })) },
            include: { stats: true, rating: true, team: true },
          })
        : [];

    const personKeyToSlot = buildPersonKeyToSlot(
      NBA_POSITIONS.map((pos) => {
        const stintId = slots[pos];
        const stint = stintId ? stints.find((s) => s.id === stintId) : undefined;
        return stint ? { slotPosition: pos, personKey: stint.personKey } : null;
      }).filter((x): x is { slotPosition: NbaPosition; personKey: string } => Boolean(x)),
    );

    const pool: Record<string, SlotPoolDto> = {};
    for (const position of NBA_POSITIONS) {
      const combo = slotAssignments[position];
      if (!combo) continue;

      const comboStints = stints.filter((s) => s.teamId === combo.teamId && s.era === combo.era && s.rating !== null);
      const eligible = filterEligibleForSlot(comboStints, position).map((e) => comboStints.find((s) => s.id === e.id)!);
      const team = comboStints[0]?.team;

      const players: DraftPoolPlayerDto[] = eligible.map((s) => ({
        id: s.id,
        name: s.name,
        eligiblePositions: s.eligiblePositions,
        personKey: s.personKey,
        stintStartYear: s.stintStartYear,
        stintEndYear: s.stintEndYear,
        isActive: s.isActive,
        skinTone: s.skinTone,
        baseRating: Number(s.rating!.baseRating),
        offenseRating: Number(s.rating!.offenseRating),
        defenseRating: Number(s.rating!.defenseRating),
        clutchModifier: Number(s.rating!.clutchModifier),
        stats: Object.fromEntries(s.stats.map((stat) => [stat.statKey, Number(stat.statValue)])),
        estimatedStats: Object.fromEntries(
          s.stats.filter((stat) => stat.estimateReason !== null).map((stat) => [stat.statKey, stat.estimateReason as 'pre_tracking_era' | 'hypothetical_pre_three_point']),
        ),
        isDuplicate: isDuplicateInSlot(s.personKey, position, personKeyToSlot),
      }));

      pool[position] = {
        teamId: combo.teamId,
        teamName: team?.name ?? '',
        teamColorHex: team?.colorHex ?? '',
        era: combo.era,
        players,
        teamRespinAvailable: !roster.teamRespinUsed && hasTeamRespinAlternative(combo, availableCombos),
        eraRespinAvailable: !roster.eraRespinUsed && hasEraRespinAlternative(combo, availableCombos),
      };
    }
    return pool;
  }
}

function clampDraftTimer(seconds: number | undefined): number {
  if (seconds === undefined || Number.isNaN(seconds)) return DEFAULT_DRAFT_TIMER_SECONDS;
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
