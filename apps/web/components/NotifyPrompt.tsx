'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiError, api } from '../lib/api';
import { PublicUser } from '../lib/types';

/**
 * Shown while a player waits on their opponent: offers to email them when
 * the result is ready, so closing the tab doesn't mean missing it.
 */
export function NotifyPrompt({ rosterId }: { rosterId: string | null }) {
  const [me, setMe] = useState<PublicUser | null>(null);
  const [email, setEmail] = useState('');
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getMe().then(setMe).catch(() => undefined);
  }, []);

  if (!me) return null;

  if (me.email) {
    if (!me.resultEmails) {
      return (
        <p className="mt-4 text-xs text-gray-500">
          Result emails are off.{' '}
          <button
            type="button"
            className="text-orange-600 underline"
            onClick={() =>
              api
                .setResultEmails(true)
                .then(setMe)
                .catch(() => undefined)
            }
          >
            Email me when it&apos;s ready
          </button>
        </p>
      );
    }
    return <p className="mt-4 text-sm text-gray-600">We&apos;ll email {me.email} when the result is ready, so you can close this tab.</p>;
  }

  if (!rosterId) return null;

  if (savedEmail) {
    return <p className="mt-4 text-sm text-gray-600">We&apos;ll email {savedEmail} when the result is ready, so you can close this tab.</p>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rosterId) return;
    setError(null);
    setBusy(true);
    try {
      const result = await api.setNotifyEmail(rosterId, email);
      setSavedEmail(result.notifyEmail);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3 text-left">
      <p className="text-sm font-medium">Get an email when the result is ready</p>
      <form onSubmit={handleSubmit} className="mt-2 flex gap-2">
        <input
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-w-0 flex-1 rounded border border-gray-300 p-2 text-sm"
          required
        />
        <button type="submit" disabled={busy} className="shrink-0 rounded bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50">
          {busy ? 'Saving…' : 'Notify me'}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <p className="mt-2 text-xs text-gray-400">
        Used only for this match.{' '}
        <Link href="/profile" className="text-orange-600 underline">
          Create an account
        </Link>{' '}
        to keep your record and past matches.
      </p>
    </div>
  );
}
