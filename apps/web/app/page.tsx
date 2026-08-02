'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError, api } from '../lib/api';
import { ALL_ERAS, ERA_LABELS, Era, RolesMode, Team } from '../lib/types';

const TIMER_OPTIONS = [
  { label: '2 minutes', seconds: 120 },
  { label: '5 minutes', seconds: 300 },
  { label: '10 minutes', seconds: 600 },
];

export default function HomePage() {
  const router = useRouter();
  // Spec section 4's default: an untimed draft. The creator can opt into a
  // timer and pick a duration — draftTimerSeconds is only sent when timerEnabled is true.
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [draftTimerSeconds, setDraftTimerSeconds] = useState(300);
  const [rolesMode, setRolesMode] = useState<RolesMode>('independent_roles');
  const [teams, setTeams] = useState<Team[]>([]);
  const [includedEras, setIncludedEras] = useState<Era[]>([]);
  const [includedTeamIds, setIncludedTeamIds] = useState<string[]>([]);
  const [showNarrowing, setShowNarrowing] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getTeams().then(setTeams).catch(() => {
      // Non-fatal — the narrowing picker just won't have team checkboxes if this fails.
    });
  }, []);

  function toggleEra(era: Era) {
    setIncludedEras((prev) => (prev.includes(era) ? prev.filter((e) => e !== era) : [...prev, era]));
  }

  function toggleTeam(teamId: string) {
    setIncludedTeamIds((prev) => (prev.includes(teamId) ? prev.filter((t) => t !== teamId) : [...prev, teamId]));
  }

  async function createMatch() {
    setCreating(true);
    setError(null);
    try {
      const match = await api.createMatch({
        draftTimerSeconds: timerEnabled ? draftTimerSeconds : undefined,
        rolesMode,
        includedEras: includedEras.length > 0 ? includedEras : undefined,
        includedTeamIds: includedTeamIds.length > 0 ? includedTeamIds : undefined,
      });
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
        <div className="mt-3 flex justify-center gap-4 text-sm">
          <Link href="/profile" className="text-orange-600 underline">
            Profile
          </Link>
          <Link href="/leaderboard" className="text-orange-600 underline">
            Leaderboard
          </Link>
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-semibold">Start a friend match</h2>
        <p className="mt-1 text-sm text-gray-500">You&apos;ll get a shareable link — send it to whoever you&apos;re playing.</p>

        <div className="mt-4">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={timerEnabled} onChange={(e) => setTimerEnabled(e.target.checked)} />
            Add a draft timer
          </label>
          <p className="mt-0.5 text-xs text-gray-400">Off by default — an untimed draft is the default experience.</p>
          {timerEnabled && (
            <select
              value={draftTimerSeconds}
              onChange={(e) => setDraftTimerSeconds(Number(e.target.value))}
              className="mt-2 w-full rounded border border-gray-300 p-2"
            >
              {TIMER_OPTIONS.map((opt) => (
                <option key={opt.seconds} value={opt.seconds}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm text-gray-600">Roles for both players</legend>
          <div className="mt-1 space-y-2">
            <label className="flex items-start gap-2 rounded border border-gray-200 p-2 text-sm has-[:checked]:border-orange-400 has-[:checked]:bg-orange-50">
              <input
                type="radio"
                name="rolesMode"
                checked={rolesMode === 'independent_roles'}
                onChange={() => setRolesMode('independent_roles')}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Independent random roles</span>
                <span className="block text-xs text-gray-500">Each player gets their own random team+era sequence — more variance, more replayable.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded border border-gray-200 p-2 text-sm has-[:checked]:border-orange-400 has-[:checked]:bg-orange-50">
              <input type="radio" name="rolesMode" checked={rolesMode === 'same_roles'} onChange={() => setRolesMode('same_roles')} className="mt-0.5" />
              <span>
                <span className="font-medium">Same roles for both players</span>
                <span className="block text-xs text-gray-500">Both players get the identical random sequence per slot — a fairer, apples-to-apples comparison.</span>
              </span>
            </label>
          </div>
        </fieldset>

        <button
          type="button"
          onClick={() => setShowNarrowing((v) => !v)}
          className="mt-4 text-sm text-orange-600 underline"
        >
          {showNarrowing ? 'Hide' : 'Narrow'} eligible eras/teams {includedEras.length + includedTeamIds.length > 0 ? `(${includedEras.length + includedTeamIds.length} selected)` : '(optional)'}
        </button>

        {showNarrowing && (
          <div className="mt-3 space-y-3 rounded border border-gray-200 p-3">
            <p className="text-xs text-gray-500">Leave everything unchecked to draw from the full pool. Checking any box restricts BOTH players to that selection.</p>
            <div>
              <div className="text-xs font-semibold text-gray-600">Eras</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {ALL_ERAS.map((era) => (
                  <button
                    key={era}
                    type="button"
                    onClick={() => toggleEra(era)}
                    className={`rounded-full border px-2.5 py-1 text-xs ${
                      includedEras.includes(era) ? 'border-orange-500 bg-orange-500 text-white' : 'border-gray-300 text-gray-600'
                    }`}
                  >
                    {ERA_LABELS[era]}
                  </button>
                ))}
              </div>
            </div>
            {teams.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-600">Teams</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {teams.map((team) => (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => toggleTeam(team.id)}
                      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
                        includedTeamIds.includes(team.id) ? 'border-orange-500 bg-orange-50 font-medium text-orange-700' : 'border-gray-300 text-gray-600'
                      }`}
                    >
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: team.colorHex }} />
                      {team.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

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
