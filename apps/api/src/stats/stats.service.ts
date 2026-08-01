import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildLeaderboard, computeRecord, LeaderboardEntry, RecordEntry, UserRecord } from './recordStats';

const DEFAULT_LEADERBOARD_LIMIT = 20;

/**
 * Spec section 9a: only random-matchmaking games count toward a user's
 * record or the leaderboard — friend-link matches are trivially
 * self-matchable (send the link to yourself/an alt) and would make any
 * ranking untrustworthy. Both queries below filter on
 * matchType: 'random_matchmaking'. Since that queue isn't built yet
 * (deferred scope — see README), these are correctly empty until it lands;
 * callers must handle zero results gracefully, not treat it as an error.
 */
@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserRecord(userId: string): Promise<UserRecord> {
    const matches = await this.prisma.match.findMany({
      where: {
        status: 'complete',
        matchType: 'random_matchmaking',
        OR: [{ rosterA: { userId } }, { rosterB: { userId } }],
      },
      select: {
        createdAt: true,
        rosterA: { select: { userId: true } },
        rosterB: { select: { userId: true } },
        gameResults: { select: { scoreA: true, scoreB: true }, orderBy: { gameNumber: 'desc' }, take: 1 },
      },
    });

    const entries: RecordEntry[] = [];
    for (const match of matches) {
      if (!match.rosterA || !match.rosterB || match.gameResults.length === 0) continue;
      const [result] = match.gameResults;
      const isSideA = match.rosterA.userId === userId;
      const won = isSideA ? result.scoreA > result.scoreB : result.scoreB > result.scoreA;
      entries.push({ createdAt: match.createdAt, won });
    }

    return computeRecord(entries);
  }

  async getLeaderboard(limit = DEFAULT_LEADERBOARD_LIMIT): Promise<LeaderboardEntry[]> {
    const matches = await this.prisma.match.findMany({
      where: { status: 'complete', matchType: 'random_matchmaking' },
      select: {
        rosterA: { select: { userId: true } },
        rosterB: { select: { userId: true } },
        gameResults: { select: { scoreA: true, scoreB: true }, orderBy: { gameNumber: 'desc' }, take: 1 },
      },
    });

    const results: { userId: string; won: boolean }[] = [];
    for (const match of matches) {
      if (!match.rosterA || !match.rosterB || match.gameResults.length === 0) continue;
      const [result] = match.gameResults;
      const aWon = result.scoreA > result.scoreB;
      results.push({ userId: match.rosterA.userId, won: aWon });
      results.push({ userId: match.rosterB.userId, won: !aWon });
    }

    const userIds = [...new Set(results.map((r) => r.userId))];
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, displayName: true } });
    const displayNameById = new Map(users.map((u) => [u.id, u.displayName]));

    return buildLeaderboard(results, displayNameById, limit);
  }
}
