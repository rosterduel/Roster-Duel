'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiError, api } from '../../lib/api';
import { PublicUser, UserRecord } from '../../lib/types';

export default function ProfilePage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [record, setRecord] = useState<UserRecord | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getMe().then((u) => {
      setUser(u);
      setNameInput(u.displayName);
    });
    api.getMyRecord().then(setRecord);
  }, []);

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
    </main>
  );
}
