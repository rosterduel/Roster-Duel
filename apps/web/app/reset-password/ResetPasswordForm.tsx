'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ApiError, api } from '../../lib/api';
import { setSessionToken } from '../../lib/session';

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await api.resetPassword(token, password);
      setSessionToken(result.token);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <h1 className="text-xl font-bold">Choose a new password</h1>
      {!token ? (
        <p className="text-sm text-red-600">This reset link is missing its code. Open the link from your email again, or ask for a new one on your profile.</p>
      ) : done ? (
        <div className="space-y-2 text-sm">
          <p className="text-green-600">Password updated. You&apos;re signed in here, and signed out everywhere else.</p>
          <Link href="/profile" className="text-orange-600 underline">
            Go to your profile
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
          <input
            type="password"
            autoComplete="new-password"
            placeholder="New password (8+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            className="w-full rounded border border-gray-300 p-2 text-sm"
            required
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save new password'}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </main>
  );
}
