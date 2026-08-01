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
  gamesPlayed: number;
  winPct: number;
}

export interface LeaderboardOptions {
  limit: number;
  /** Spec 9a: games below this count are excluded from ranking entirely (still visible on the player's own profile). */
  minGames: number;
}

/**
 * Spec section 9a's ranking methodology: sort by win percentage (not raw
 * wins) among the results given, minimum games played to qualify, total
 * wins as the tiebreaker for equal win%. The rolling-recent-window
 * requirement ("last 60 days") is enforced by the *caller* filtering which
 * matches it fetches before building `results` — see
 * stats.service.ts#getLeaderboard — not by this function, which only sees
 * whatever games it's handed. That split keeps this function pure and
 * trivially testable, and keeps the "recent window" behavior a plain date
 * filter on the query rather than a decay algorithm, per spec.
 *
 * Nothing here hard-codes win% as the only possible ranking signal at the
 * data layer — wins/losses/games are derived from raw match outcomes at
 * read time, not persisted as a ranking score. A future Elo-style system
 * would be a new computation path (and, unlike this one, would need
 * persisted game-order-dependent state), not a rework of this schema —
 * exactly the extensibility the spec asks for without building Elo now.
 */
export function buildLeaderboard(
  results: { userId: string; won: boolean }[],
  displayNameById: Map<string, string>,
  options: LeaderboardOptions,
): LeaderboardEntry[] {
  const tally = new Map<string, { wins: number; losses: number }>();
  for (const { userId, won } of results) {
    const rec = tally.get(userId) ?? { wins: 0, losses: 0 };
    if (won) rec.wins++;
    else rec.losses++;
    tally.set(userId, rec);
  }

  return [...tally.entries()]
    .map(([userId, rec]) => {
      const gamesPlayed = rec.wins + rec.losses;
      return {
        userId,
        displayName: displayNameById.get(userId) ?? 'Unknown',
        wins: rec.wins,
        losses: rec.losses,
        gamesPlayed,
        winPct: gamesPlayed > 0 ? rec.wins / gamesPlayed : 0,
      };
    })
    .filter((e) => e.gamesPlayed >= options.minGames)
    .sort((a, b) => b.winPct - a.winPct || b.wins - a.wins)
    .slice(0, options.limit);
}
