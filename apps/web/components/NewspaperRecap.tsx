'use client';

import { useState } from 'react';
import { ApiError, api } from '../lib/api';
import { GameResult } from '../lib/types';

/**
 * Spec section 4b: a folded newspaper element with a generated headline,
 * unfolds on click into the full article. Handles the case where no
 * recap exists yet (ANTHROPIC_API_KEY not configured server-side, or the
 * automatic post-game generation failed) with a manual retry button — see
 * apps/api/src/recap/ for why this can legitimately be empty in Phase 1.
 */
export function NewspaperRecap({ roomCode, gameResult, onRecapUpdated }: { roomCode: string; gameResult: GameResult; onRecapUpdated: (gr: GameResult) => void }) {
  const [unfolded, setUnfolded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateRecap() {
    setLoading(true);
    setError(null);
    try {
      const updated = await api.regenerateRecap(roomCode);
      onRecapUpdated(updated);
      setUnfolded(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate the recap.');
    } finally {
      setLoading(false);
    }
  }

  if (!gameResult.recapHeadline) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm">
        <p className="text-gray-600">No recap article yet.</p>
        {error && <p className="mt-1 text-red-600">{error}</p>}
        <button
          type="button"
          onClick={generateRecap}
          disabled={loading}
          className="mt-2 rounded bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-900 disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Generate recap'}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      {!unfolded ? (
        <button
          type="button"
          onClick={() => setUnfolded(true)}
          className="w-full rounded border-2 border-gray-800 bg-[#f4ecd8] p-6 text-left shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div className="border-b-2 border-gray-800 pb-1 text-center font-serif text-xs tracking-widest text-gray-500">
            THE ROSTERDUEL TIMES
          </div>
          <div className="mt-3 text-center font-serif text-xl font-bold leading-snug text-gray-900">{gameResult.recapHeadline}</div>
          <div className="mt-3 text-center text-xs text-gray-500">Tap to unfold the full story</div>
        </button>
      ) : (
        <div className="rounded border-2 border-gray-800 bg-[#f4ecd8] p-6 shadow-md">
          <div className="border-b-2 border-gray-800 pb-1 text-center font-serif text-xs tracking-widest text-gray-500">
            THE ROSTERDUEL TIMES
          </div>
          <div className="mt-3 font-serif text-2xl font-bold leading-snug text-gray-900">{gameResult.recapHeadline}</div>
          <div className="mt-3 whitespace-pre-wrap font-serif text-sm leading-relaxed text-gray-800 [column-gap:1.5rem] sm:columns-2">
            {gameResult.recapArticle}
          </div>
          <button type="button" onClick={() => setUnfolded(false)} className="mt-4 text-xs text-gray-500 underline">
            Fold back up
          </button>
        </div>
      )}
    </div>
  );
}
