'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiError, api } from '../../lib/api';
import { clearSessionToken, setSessionToken } from '../../lib/session';
import { MatchHistory, PublicUser, UserRecord } from '../../lib/types';

export default function ProfilePage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [record, setRecord] = useState<UserRecord | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<MatchHistory | null>(null);

  function loadProfile() {
    api.getMe().then((u) => {
      setUser(u);
      setNameInput(u.displayName);
    });
    api.getMyRecord().then(setRecord);
    api.getMyHistory().then(setHistory);
  }

  useEffect(loadProfile, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const updated = await api.changeDisplayName(nameInput);
      setUser(updated);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update display name.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Profile</h1>
        <Link href="/" className="text-sm text-orange-600 underline">
          Home
        </Link>
      </div>

      <AccountSection user={user} onChange={loadProfile} />

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-600">Display name</h2>
        <form onSubmit={handleSave} className="mt-2 flex gap-2">
          <input
            value={nameInput}
            onChange={(e) => {
              setNameInput(e.target.value);
              setSuccess(false);
            }}
            maxLength={24}
            className="flex-1 rounded border border-gray-300 p-2 text-sm"
          />
          <button
            type="submit"
            disabled={saving || !user}
            className="rounded bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {success && <p className="mt-2 text-sm text-green-600">Display name updated.</p>}
        <p className="mt-2 text-xs text-gray-400">2-24 characters. Moderated — inappropriate names will be rejected.</p>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-600">Ranked record</h2>
        {!record ? (
          <p className="mt-2 text-sm text-gray-400">Loading…</p>
        ) : record.gamesPlayed === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            No ranked games yet — only random-opponent matches count toward your record. Friend matches are just for fun and
            don&apos;t affect this.
          </p>
        ) : (
          <div className="mt-2 space-y-1 text-sm">
            <p>
              Overall:{' '}
              <span className="font-semibold">
                {record.overallWins}-{record.overallLosses}
              </span>
            </p>
            <p>
              Last 10:{' '}
              <span className="font-semibold">
                {record.last10Wins}-{record.last10Losses}
              </span>
            </p>
          </div>
        )}
      </section>

      <HistorySection history={history} />
    </main>
  );
}

function AccountSection({ user, onChange }: { user: PublicUser | null; onChange: () => void }) {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  if (user.email) {
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-600">Account</h2>
        <p className="mt-2 text-sm">
          Signed in as <span className="font-semibold">{user.email}</span>
        </p>
        {notice && <p className="mt-2 text-sm text-green-600">{notice}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await api.logOut().catch(() => undefined);
            clearSessionToken();
            setNotice(null);
            setBusy(false);
            onChange();
          }}
          className="mt-3 rounded border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          {busy ? 'Logging out…' : 'Log out'}
        </button>
      </section>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = mode === 'signup' ? await api.signUp(email, password) : await api.logIn(email, password);
      setSessionToken(result.token);
      setPassword('');
      if (mode === 'signup') {
        setNotice('Account created. Your record and past matches are saved to it.');
      } else if (result.movedGames) {
        setNotice(`Logged in. ${result.movedGames === 1 ? '1 game' : `${result.movedGames} games`} from this browser moved to your account.`);
      } else {
        setNotice('Logged in.');
      }
      onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-600">{mode === 'signup' ? 'Create an account' : 'Log in'}</h2>
      <p className="mt-1 text-xs text-gray-500">
        {mode === 'signup'
          ? 'Keep your record and past matchups, even if this tab closes or you switch devices. Games you played in this browser come with you.'
          : 'Games you played in this browser as a guest move to your account.'}
      </p>
      <form onSubmit={handleSubmit} className="mt-3 space-y-2">
        <input
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-gray-300 p-2 text-sm"
          required
        />
        <input
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          placeholder={mode === 'signup' ? 'Password (8+ characters)' : 'Password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={mode === 'signup' ? 8 : undefined}
          className="w-full rounded border border-gray-300 p-2 text-sm"
          required
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {busy ? 'One sec…' : mode === 'signup' ? 'Create account' : 'Log in'}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {notice && <p className="mt-2 text-sm text-green-600">{notice}</p>}
      <button
        type="button"
        onClick={() => {
          setMode(mode === 'signup' ? 'login' : 'signup');
          setError(null);
        }}
        className="mt-3 text-sm text-orange-600 underline"
      >
        {mode === 'signup' ? 'Already have an account? Log in' : 'New here? Create an account'}
      </button>
    </section>
  );
}

function HistorySection({ history }: { history: MatchHistory | null }) {
  const friend = history?.friendRecord;
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-600">Past matches</h2>
      {!history ? (
        <p className="mt-2 text-sm text-gray-400">Loading…</p>
      ) : history.matches.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">No finished matches yet. They&apos;ll show up here with their recaps.</p>
      ) : (
        <>
          {friend && friend.gamesPlayed > 0 && (
            <p className="mt-2 text-sm">
              Friend games:{' '}
              <span className="font-semibold">
                {friend.wins}-{friend.losses}
              </span>
            </p>
          )}
          <ul className="mt-3 divide-y divide-gray-100">
            {history.matches.map((m) => (
              <li key={m.roomCode} className="py-2">
                <Link href={`/match/${m.roomCode}`} className="block hover:bg-gray-50">
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      <span
                        className={
                          m.result === 'win' ? 'font-bold text-green-600' : m.result === 'loss' ? 'font-bold text-red-600' : 'font-bold text-gray-500'
                        }
                      >
                        {m.result === 'win' ? 'W' : m.result === 'loss' ? 'L' : 'Self'}
                      </span>{' '}
                      {m.yourScore}-{m.opponentScore} vs {m.opponentName}
                    </span>
                    <span className="text-xs text-gray-400">{new Date(m.playedAt).toLocaleDateString()}</span>
                  </div>
                  {m.headline && <p className="mt-0.5 truncate text-xs text-gray-500">{m.headline}</p>}
                  <p className="mt-0.5 text-xs text-gray-400">{m.matchType === 'random_matchmaking' ? 'Ranked' : 'Friend match'} · View recap</p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
