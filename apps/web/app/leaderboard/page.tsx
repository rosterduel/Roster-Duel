'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { LeaderboardEntry } from '../../lib/types';

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    api.getLeaderboard().then(setEntries);
  }, []);

  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Leaderboard</h1>
        <Link href="/" className="text-sm text-orange-600 underline">
          Home
        </Link>
      </div>
      <p className="text-xs text-gray-400">
        Ranked by win % among random-opponent matches from the last 60 days — friend matches aren&apos;t ranked, and at least
        20 games are required to qualify.
      </p>

      {!entries ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
          No one has qualified yet — the leaderboard fills in once random-opponent matchmaking is available and players
          reach 20 games in the last 60 days.
        </div>
      ) : (
        <ol className="space-y-1">
          {entries.map((e, i) => (
            <li key={e.userId} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
              <span>
                <span className="mr-2 text-gray-400">#{i + 1}</span>
                {e.displayName}
              </span>
              <span className="text-right">
                <span className="font-mono text-gray-600">
                  {e.wins}-{e.losses}
                </span>
                <span className="ml-2 text-xs text-gray-400">{Math.round(e.winPct * 100)}%</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
