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
      <p className="text-xs text-gray-400">Random-opponent matches only — friend matches aren&apos;t ranked.</p>

      {!entries ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
          No ranked games have been played yet. The leaderboard fills in once random-opponent matchmaking is available.
        </div>
      ) : (
        <ol className="space-y-1">
          {entries.map((e, i) => (
            <li key={e.userId} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
              <span>
                <span className="mr-2 text-gray-400">#{i + 1}</span>
                {e.displayName}
              </span>
              <span className="font-mono text-gray-600">
                {e.wins}-{e.losses}
              </span>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
