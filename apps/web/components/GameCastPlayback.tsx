'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Basketball } from './Basketball';
import { CourtDiagram } from './CourtDiagram';
import { PlayerSprite } from './PlayerSprite';
import { buildArcKeyframes, computeBlockDeflection, computeStealDeflection, OUTCOME_BADGE, POSE_BY_PLAY_TYPE, resolveBallEndPosition, ZONE_POSITIONS } from '../lib/court';
import { Highlight } from '../lib/types';

const BALL_FLIGHT_MS = 1000;
const HOLD_MS = 1600;
const DEFAULT_JERSEY_COLOR = '#3B3355';

function formatClock(seconds: number): string {
  const clamped = Math.max(0, Math.round(seconds));
  return `${Math.floor(clamped / 60)}:${(clamped % 60).toString().padStart(2, '0')}`;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export function GameCastPlayback({
  highlights,
  teamAName,
  teamBName,
  playerJerseyColors,
  onDone,
}: {
  highlights: Highlight[];
  teamAName: string;
  teamBName: string;
  /**
   * playerId (a PlayerStint id) -> team colorHex, for sprite
   * personalization (spec 4a) — players are differentiated by their
   * drafted-from team's real color, not any skin-tone-like attribute.
   */
  playerJerseyColors: Record<string, string>;
  onDone: () => void;
}) {
  // Spec 4a: play back in chronological order, distinct from the leverage-
  // ranked order the written highlights list (section 5.5) uses elsewhere.
  const chronological = useMemo(() => [...highlights].sort((a, b) => a.possessionIndex - b.possessionIndex), [highlights]);

  const [index, setIndex] = useState(0);
  const [showBadge, setShowBadge] = useState(false);
  const ballRef = useRef<SVGGElement>(null);

  const current = chronological[index];
  const start = current ? ZONE_POSITIONS[current.startLocation] : undefined;
  // `end` is the raw "standing" zone position (used for sprite placement,
  // e.g. a rebounder at 'paint') — `hoopEnd` snaps that same zone to the
  // hoop's actual rendered rim center for the BALL's flight, so a made/
  // missed shot's arc terminates at the hoop instead of stopping short of
  // it (a coordinate mismatch between this zone table and CourtDiagram's
  // real rim position, fixed after visual review).
  const end = current ? ZONE_POSITIONS[current.endLocation] : undefined;
  const hoopEnd = current ? resolveBallEndPosition(current.endLocation) : undefined;
  const isBlock = current?.playType === 'block';
  const isStealLike = current?.playType === 'steal' || current?.playType === 'turnover';
  // Block gets a genuinely different ball path (spec 4a) — computed once
  // per highlight, not a reskin of the normal arc. Steal/turnover gets a
  // much more contained deflection than the generic arc would produce
  // (that arc's raw endLocation is 'backcourt', ~180 units away — reading
  // as a full-court launch rather than a hand-to-hand change of
  // possession, fixed after visual review).
  const blockDeflection = current && isBlock && start && hoopEnd ? computeBlockDeflection(start, hoopEnd) : null;
  const stealDeflection = current && isStealLike && start && end ? computeStealDeflection(start, end) : null;
  const pose = current ? POSE_BY_PLAY_TYPE[current.playType] : 'shoot';
  const jerseyColor = (current && playerJerseyColors[current.playerId]) || DEFAULT_JERSEY_COLOR;
  // Sprite standing position — not always `start`: a blocker meets the
  // ball at the contact point (reusing the SAME computed deflection the
  // ball itself follows, not a separately-recomputed one, so the two
  // never drift out of sync), and a rebounder stands at `end` (where
  // rebounds are actually grabbed), not the shooter's original spot.
  const spritePos = !current || !start ? { x: 0, y: 0 } : blockDeflection ? blockDeflection.contact : current.playType === 'offensive_rebound' ? (end ?? start) : start;
  const badgePos = blockDeflection ? blockDeflection.deflectEnd : stealDeflection ? stealDeflection.end : hoopEnd;
  const ballInitialStyle = start ? { transform: `translate(${start.x}px, ${start.y}px)` } : undefined;

  // Ball motion — runs before paint (useLayoutEffect) so there's no
  // one-frame flash at the origin before the animation takes over.
  useLayoutEffect(() => {
    const ballEl = ballRef.current;
    if (!ballEl || !current || !start || !hoopEnd) return undefined;

    const finalKeyframes = blockDeflection ? blockDeflection.keyframes : stealDeflection ? stealDeflection.keyframes : buildArcKeyframes(start, hoopEnd);
    const finalPos = blockDeflection ? blockDeflection.deflectEnd : stealDeflection ? stealDeflection.end : hoopEnd;

    if (prefersReducedMotion()) {
      ballEl.style.transform = `translate(${finalPos.x}px, ${finalPos.y}px)`;
      return undefined;
    }

    const anim = ballEl.animate(finalKeyframes, { duration: BALL_FLIGHT_MS, easing: 'ease-in-out', fill: 'forwards' });
    return () => anim.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Outcome badge + advance-to-next-highlight timing.
  useEffect(() => {
    setShowBadge(false);
    if (!current) return undefined;
    const badgeTimer = setTimeout(() => setShowBadge(true), BALL_FLIGHT_MS);
    const advanceTimer = setTimeout(() => {
      if (index < chronological.length - 1) {
        setIndex((i) => i + 1);
      } else {
        onDone();
      }
    }, BALL_FLIGHT_MS + HOLD_MS);
    return () => {
      clearTimeout(badgeTimer);
      clearTimeout(advanceTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  if (!current) {
    onDone();
    return null;
  }

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

      {/* Retro/8-bit-style schematic court — real markings, not an abstract rectangle (spec 4a). Aerial/top-down camera angle unchanged. */}
      <div className="overflow-hidden rounded-lg border-4 border-[#8F5A1D]" style={{ imageRendering: 'pixelated' }}>
        <div className="aspect-[2/1] w-full">
          <CourtDiagram>
            <PlayerSprite key={index} pose={pose} jerseyColor={jerseyColor} x={spritePos.x} y={spritePos.y} scale={1.7} className="animate-sprite-fade-in" />
            <Basketball ref={ballRef} style={ballInitialStyle} />
            {showBadge && badgePos && (
              <g transform={`translate(${badgePos.x}, ${badgePos.y})`}>
                <g key={`badge-${index}`} className="animate-badge-pop">
                  <rect x={-30} y={-40} width={60} height={26} rx={4} fill="#FFD23F" stroke="#241B12" strokeWidth={1} />
                  <text x={0} y={-27} textAnchor="middle" dominantBaseline="middle" fontFamily="ui-monospace, monospace" fontWeight={800} fontSize={15} fill="#241B12">
                    {OUTCOME_BADGE[current.playType]}
                  </text>
                </g>
              </g>
            )}
          </CourtDiagram>
        </div>
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
