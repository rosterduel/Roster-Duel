'use client';

import { useEffect, useMemo, useState } from 'react';
import { CourtZone, Highlight } from '../lib/types';

// Simplified schematic court positions (percent of container), NOT real
// coordinates — spec section 4a explicitly wants a retro/8-bit-style
// diagram, not realistic rendering. Hoop sits at the right edge; every shot
// resolves at "paint" regardless of make/miss (see sim-engine's PlayType
// doc comment), which is why endLocation is always near the hoop here.
const ZONE_POSITIONS: Record<CourtZone, { x: number; y: number }> = {
  backcourt: { x: 6, y: 50 },
  mid_range: { x: 55, y: 50 },
  paint: { x: 88, y: 50 },
  free_throw_line: { x: 72, y: 50 },
  three_left: { x: 42, y: 85 },
  three_right: { x: 42, y: 15 },
  three_top: { x: 35, y: 50 },
};

const PLAY_DURATION_MS = 900;
const HOLD_DURATION_MS = 1800;

function formatClock(seconds: number): string {
  const clamped = Math.max(0, Math.round(seconds));
  return `${Math.floor(clamped / 60)}:${(clamped % 60).toString().padStart(2, '0')}`;
}

export function GameCastPlayback({
  highlights,
  teamAName,
  teamBName,
  onDone,
}: {
  highlights: Highlight[];
  teamAName: string;
  teamBName: string;
  onDone: () => void;
}) {
  // Spec 4a: play back in chronological order, distinct from the leverage-
  // ranked order the written highlights list (section 5.5) uses elsewhere.
  const chronological = useMemo(() => [...highlights].sort((a, b) => a.possessionIndex - b.possessionIndex), [highlights]);

  const [index, setIndex] = useState(0);
  const [ballAtEnd, setBallAtEnd] = useState(false);

  const current = chronological[index];

  useEffect(() => {
    setBallAtEnd(false);
    const moveTimer = setTimeout(() => setBallAtEnd(true), 50);
    const advanceTimer = setTimeout(() => {
      if (index < chronological.length - 1) {
        setIndex((i) => i + 1);
      } else {
        onDone();
      }
    }, PLAY_DURATION_MS + HOLD_DURATION_MS);
    return () => {
      clearTimeout(moveTimer);
      clearTimeout(advanceTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  if (!current) {
    onDone();
    return null;
  }

  const start = ZONE_POSITIONS[current.startLocation];
  const end = ZONE_POSITIONS[current.endLocation];
  const ballPos = ballAtEnd ? end : start;

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
        <span>
          Play {index + 1} of {chronological.length}
        </span>
        <button type="button" onClick={onDone} className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50">
          Skip to results →
        </button>
      </div>

      {/* Retro/8-bit-style schematic court — simple diagram, not realistic rendering (spec 4a). */}
      <div
        className="relative aspect-[2/1] w-full overflow-hidden rounded-lg border-4 border-gray-800 bg-green-700"
        style={{ imageRendering: 'pixelated' }}
      >
        {/* hoop */}
        <div className="absolute right-[4%] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-yellow-300" />
        {/* half-court arc hint */}
        <div className="absolute left-[30%] top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/40" />

        <div
          className="absolute h-3 w-3 rounded-full bg-orange-400 shadow-[0_0_0_2px_rgba(0,0,0,0.6)] transition-all ease-linear"
          style={{
            left: `${ballPos.x}%`,
            top: `${ballPos.y}%`,
            transform: 'translate(-50%, -50%)',
            transitionDuration: `${PLAY_DURATION_MS}ms`,
          }}
        />
      </div>

      <div className="mt-3 rounded-lg bg-gray-900 p-3 text-white">
        <div className="text-xs text-gray-400">
          {teamAName} {current.scoreAAfter} — {current.scoreBAfter} {teamBName} · Q{Math.min(current.quarter, 4)}
          {current.quarter > 4 ? ` OT${current.quarter - 4 > 1 ? current.quarter - 4 : ''}` : ''} · {formatClock(current.periodSecondsRemaining)}
        </div>
        <div className="mt-1 text-sm">{current.description}</div>
      </div>
    </div>
  );
}
