'use client';

import { useState } from 'react';
import { ApiError, api } from '../lib/api';
import { GameResult } from '../lib/types';

type Phase = 'folded' | 'loading' | 'open';

function LoadingShimmer() {
  return (
    <div className="animate-pulse space-y-2 py-2">
      <p className="mb-3 text-center font-serif text-xs italic text-gray-500">Wiring the story to print…</p>
      <div className="h-3 w-11/12 rounded bg-gray-300/70" />
      <div className="h-3 w-full rounded bg-gray-300/70" />
      <div className="h-3 w-4/5 rounded bg-gray-300/70" />
      <div className="h-3 w-full rounded bg-gray-300/70" />
      <div className="h-3 w-3/5 rounded bg-gray-300/70" />
    </div>
  );
}

/**
 * Spec section 4b: a prominent newspaper masthead element, not a plain
 * text box — both before and after a recap exists. The unfold animation
 * (a collapsing/expanding "fold" region below the always-visible masthead,
 * driven by max-height rather than scaling text) plays immediately on
 * "Generate recap" and doubles as the loading state while the AI call is
 * in flight; real content swaps in once it resolves. If a recap already
 * exists (e.g. auto-generated right after simulation), the headline is
 * visible on the folded face and a tap unfolds it instantly — no loading
 * needed since the data's already there.
 */
export function NewspaperRecap({ roomCode, gameResult, onRecapUpdated }: { roomCode: string; gameResult: GameResult; onRecapUpdated: (gr: GameResult) => void }) {
  const [phase, setPhase] = useState<Phase>('folded');
  const [error, setError] = useState<string | null>(null);
  const hasRecap = Boolean(gameResult.recapHeadline);

  async function generateRecap() {
    setError(null);
    setPhase('loading');
    try {
      const updated = await api.regenerateRecap(roomCode);
      onRecapUpdated(updated);
      setPhase('open');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate the recap.');
      setPhase('folded');
    }
  }

  function handleFaceClick() {
    if (hasRecap && phase === 'folded') setPhase('open');
  }

  return (
    <div className="mx-auto max-w-lg overflow-hidden rounded border-2 border-gray-800 bg-[#f4ecd8] shadow-md">
      {/* Masthead — always visible in every phase. */}
      <div className="border-b-2 border-double border-gray-800 px-6 pt-4 pb-1.5 text-center">
        <div className="font-serif text-sm font-bold tracking-[0.2em] text-gray-900">THE ROSTERDUEL TIMES</div>
        <div className="mt-0.5 font-serif text-[10px] italic tracking-wide text-gray-500">Late Edition — Box Score Enclosed</div>
      </div>

      {/* Headline / fold face. */}
      <button
        type="button"
        onClick={handleFaceClick}
        disabled={!hasRecap || phase !== 'folded'}
        className={`w-full px-6 pt-4 pb-2 text-center ${hasRecap && phase === 'folded' ? 'cursor-pointer hover:bg-black/[0.02]' : 'cursor-default'}`}
      >
        {hasRecap ? (
          <>
            <div className="font-serif text-xl font-bold leading-snug text-gray-900">{gameResult.recapHeadline}</div>
            {phase === 'folded' && <div className="mt-2 text-xs text-gray-500">Tap to unfold the full story</div>}
          </>
        ) : (
          <div className="font-serif text-lg italic leading-snug text-gray-400">— Headline pending —</div>
        )}
      </button>

      {!hasRecap && phase === 'folded' && (
        <div className="px-6 pb-4 text-center">
          {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
          <button
            type="button"
            onClick={generateRecap}
            className="rounded bg-gray-800 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white hover:bg-gray-900"
          >
            Generate recap
          </button>
        </div>
      )}

      {/* Collapsing "fold" region — max-height driven so text never gets squashed, only revealed. */}
      <div
        className="overflow-hidden px-6 transition-[max-height] duration-700 ease-in-out"
        style={{ maxHeight: phase === 'folded' ? 0 : 2000 }}
      >
        <div className="border-t border-gray-400/60 pt-3 pb-6">
          {phase === 'loading' && <LoadingShimmer />}
          {phase === 'open' && (
            <>
              <div className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-gray-800 [column-gap:1.5rem] sm:columns-2">
                {gameResult.recapArticle}
              </div>
              <button type="button" onClick={() => setPhase('folded')} className="mt-4 text-xs text-gray-500 underline">
                Fold back up
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
