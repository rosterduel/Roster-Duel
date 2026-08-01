export interface RecordEntry {
  createdAt: Date;
  won: boolean;
}

export interface UserRecord {
  gamesPlayed: number;
  overallWins: number;
  overallLosses: number;
  last10Wins: number;
  last10Losses: number;
}

/**
 * Spec section 9a: overall record + last-10 form, computed only from
 * random-matchmaking games (friend-link matches never reach this function
 * — the caller filters by matchType before building these entries, see
 * stats.service.ts). Pure and synchronous so it's testable without a DB;
 * the caller does the Prisma fetch and win/loss resolution, this just
 * aggregates.
 */
export function computeRecord(entries: RecordEntry[]): UserRecord {
  const sorted = [...entries].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const overallWins = sorted.filter((e) => e.won).length;
  const last10 = sorted.slice(0, 10);
  const last10Wins = last10.filter((e) => e.won).length;

  return {
    gamesPlayed: sorted.length,
    overallWins,
    overallLosses: sorted.length - overallWins,
    last10Wins,
    last10Losses: last10.length - last10Wins,
  };
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  wins: number;
  losses: number;
}

/**
 * Tally wins/losses per user from a flat list of decided games, sorted by
 * most wins (ties broken by fewer losses). Pure — the caller resolves
 * which side each user was on and whether they won.
 */
export function buildLeaderboard(
  results: { userId: string; won: boolean }[],
  displayNameById: Map<string, string>,
  limit: number,
): LeaderboardEntry[] {
  const tally = new Map<string, { wins: number; losses: number }>();
  for (const { userId, won } of results) {
    const rec = tally.get(userId) ?? { wins: 0, losses: 0 };
    if (won) rec.wins++;
    else rec.losses++;
    tally.set(userId, rec);
  }

  return [...tally.entries()]
    .map(([userId, rec]) => ({ userId, displayName: displayNameById.get(userId) ?? 'Unknown', ...rec }))
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
    .slice(0, limit);
}
