export interface HistorySourceMatch {
  roomCode: string;
  matchType: 'friend_link' | 'random_matchmaking';
  createdAt: Date;
  sideAUserId: string | null;
  sideBUserId: string | null;
  sideAName: string | null;
  sideBName: string | null;
  scoreA: number;
  scoreB: number;
  headline: string | null;
}

export interface MatchHistoryEntry {
  roomCode: string;
  matchType: 'friend_link' | 'random_matchmaking';
  playedAt: string;
  opponentName: string;
  yourScore: number;
  opponentScore: number;
  /** 'self' = both sides were this player (testing against yourself); never counted in a record. */
  result: 'win' | 'loss' | 'self';
  headline: string | null;
}

export interface FriendRecord {
  gamesPlayed: number;
  wins: number;
  losses: number;
}

export interface MatchHistory {
  matches: MatchHistoryEntry[];
  /** Friend-link games only. Ranked (random-opponent) games keep their own record at /stats/me. */
  friendRecord: FriendRecord;
}

export const HISTORY_LIMIT = 50;

/**
 * Every finished match this player was in, newest first, from their side
 * of the scoreboard. Pure, so it's testable without a database: the caller
 * does the Prisma fetch (stats.service.ts#getMatchHistory).
 */
export function buildMatchHistory(userId: string, source: HistorySourceMatch[], limit = HISTORY_LIMIT): MatchHistory {
  const entries: MatchHistoryEntry[] = [];
  const friendRecord: FriendRecord = { gamesPlayed: 0, wins: 0, losses: 0 };

  const sorted = [...source].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  for (const m of sorted) {
    const isA = m.sideAUserId === userId;
    const isB = m.sideBUserId === userId;
    if (!isA && !isB) continue;

    if (isA && isB) {
      entries.push({
        roomCode: m.roomCode,
        matchType: m.matchType,
        playedAt: m.createdAt.toISOString(),
        opponentName: 'Yourself',
        yourScore: m.scoreA,
        opponentScore: m.scoreB,
        result: 'self',
        headline: m.headline,
      });
      continue;
    }

    const yourScore = isA ? m.scoreA : m.scoreB;
    const opponentScore = isA ? m.scoreB : m.scoreA;
    const won = yourScore > opponentScore;
    entries.push({
      roomCode: m.roomCode,
      matchType: m.matchType,
      playedAt: m.createdAt.toISOString(),
      opponentName: (isA ? m.sideBName : m.sideAName) ?? 'Unknown player',
      yourScore,
      opponentScore,
      result: won ? 'win' : 'loss',
      headline: m.headline,
    });

    if (m.matchType === 'friend_link') {
      friendRecord.gamesPlayed++;
      if (won) friendRecord.wins++;
      else friendRecord.losses++;
    }
  }

  return { matches: entries.slice(0, limit), friendRecord };
}
