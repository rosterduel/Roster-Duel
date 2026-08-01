'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, api } from '../lib/api';

const TIMER_OPTIONS = [
  { label: '2 minutes', seconds: 120 },
  { label: '5 minutes', seconds: 300 },
  { label: '10 minutes', seconds: 600 },
];

export default function HomePage() {
  const router = useRouter();
  const [draftTimerSeconds, setDraftTimerSeconds] = useState(300);
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createMatch() {
    setCreating(true);
    setError(null);
    try {
      const match = await api.createMatch(draftTimerSeconds);
      router.push(`/match/${match.roomCode}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create a match.');
      setCreating(false);
    }
  }

  function goToMatch(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code) router.push(`/match/${code}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 p-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">RosterDuel</h1>
        <p className="mt-1 text-gray-500">Draft blind. Simulate the matchup. See who built the better roster.</p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-semibold">Start a friend match</h2>
        <p className="mt-1 text-sm text-gray-500">You&apos;ll get a shareable link — send it to whoever you&apos;re playing.</p>

        <label className="mt-4 block text-sm text-gray-600">
          Draft timer
          <select
            value={draftTimerSeconds}
            onChange={(e) => setDraftTimerSeconds(Number(e.target.value))}
            className="mt-1 w-full rounded border border-gray-300 p-2"
          >
            {TIMER_OPTIONS.map((opt) => (
              <option key={opt.seconds} value={opt.seconds}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={createMatch}
          disabled={creating}
          className="mt-4 w-full rounded bg-orange-600 py-2 font-medium text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Create match'}
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-semibold">Have a room code?</h2>
        <form onSubmit={goToMatch} className="mt-3 flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="e.g. ABC123"
            className="flex-1 rounded border border-gray-300 p-2 uppercase"
            maxLength={6}
          />
          <button type="submit" className="rounded bg-gray-800 px-4 py-2 font-medium text-white hover:bg-gray-900">
            Join
          </button>
        </form>
      </section>
    </main>
  );
}
