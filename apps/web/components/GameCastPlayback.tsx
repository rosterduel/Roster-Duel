'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Basketball } from './Basketball';
import { CourtDiagram } from './CourtDiagram';
import { PlayerSprite } from './PlayerSprite';
import {
  buildArcKeyframes,
  computeBlockDeflection,
  computeStealDeflection,
  MOBILE_COURT_VIEWBOX,
  OUTCOME_CALLOUT,
  POSE_BY_PLAY_TYPE,
  resolveBallEndPosition,
  ZONE_POSITIONS,
} from '../lib/court';
import { Highlight } from '../lib/types';

// Total duration of the ball's flight if it played uninterrupted, start to
// finish — unchanged from before the pacing fix, so the visible motion
// itself (before/after the freeze) still moves at its original speed; only
// a pause is inserted mid-flight, not a slowdown.
const BALL_FLIGHT_MS = 1000;
// How long the animation holds at the outcome moment while the big callout
// is up (spec: "freeze the animation for a beat (~800ms-1.2s, tune to what
// reads well)") — mid-range default, see report for why.
const FREEZE_MS = 1000;
// Brief settle beat after the ball finishes its path, before cutting to the
// next play — replaces the old fixed post-badge hold.
const POST_COMPLETION_HOLD_MS = 400;
// Fraction of the ball's flight (in animation-time, not raw distance —
// `ease-in-out` means these aren't quite the same) at which each play type's
// outcome is considered to happen, i.e. where the freeze is inserted.
// Block reuses the EXACT split computeBlockDeflection's own keyframes
// already use for "approach" vs. "deflection" (see that function's doc
// comment: contact is where the sharp deflection begins, at offset 0.7) —
// not a separately-guessed number. Every other play type (shot, steal,
// rebound) doesn't have that kind of two-segment split in its keyframes, so
// 0.85 is a judgment call: "near arrival at the hoop/stealer's hands," not
// derived from existing geometry the way the block number is.
const OUTCOME_OFFSET_BLOCK = 0.7;
const OUTCOME_OFFSET_DEFAULT = 0.85;
const DEFAULT_JERSEY_COLOR = '#3B3355';

type PlayPhase = 'buildup' | 'frozen' | 'completing' | 'settling';

function formatClock(seconds: number): string {
  const clamped = Math.max(0, Math.round(seconds));
  return `${Math.floor(clamped / 60)}:${(clamped % 60).toString().padStart(2, '0')}`;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/**
 * True at mobile-portrait widths (Tailwind's `sm` breakpoint, 640px) —
 * gates the cropped-court mobile layout (see MOBILE_COURT_VIEWBOX's doc
 * comment). Starts false (matching server-rendered HTML) and updates after
 * mount to avoid a hydration mismatch; this means the very first paint on a
 * mobile device briefly shows the full-court layout before flipping to the
 * cropped one, an accepted tradeoff for not needing server-side UA sniffing.
 */
function useIsNarrowViewport(): boolean {
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    setIsNarrow(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isNarrow;
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
  const [phase, setPhase] = useState<PlayPhase>('buildup');
  const ballRef = useRef<SVGGElement>(null);
  const animRef = useRef<Animation | null>(null);
  const isNarrow = useIsNarrowViewport();

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
  const ballInitialStyle = start ? { transform: `translate(${start.x}px, ${start.y}px)` } : undefined;
  const outcomeOffset = isBlock ? OUTCOME_OFFSET_BLOCK : OUTCOME_OFFSET_DEFAULT;

  // Ball motion — runs before paint (useLayoutEffect) so there's no
  // one-frame flash at the origin before the animation takes over. Only
  // responsible for STARTING the animation; pausing/resuming it at the
  // freeze point is driven by the phase-timing effect below, via animRef.
  useLayoutEffect(() => {
    const ballEl = ballRef.current;
    animRef.current = null;
    if (!ballEl || !current || !start || !hoopEnd) return undefined;

    const finalKeyframes = blockDeflection ? blockDeflection.keyframes : stealDeflection ? stealDeflection.keyframes : buildArcKeyframes(start, hoopEnd);
    const finalPos = blockDeflection ? blockDeflection.deflectEnd : stealDeflection ? stealDeflection.end : hoopEnd;

    if (prefersReducedMotion()) {
      ballEl.style.transform = `translate(${finalPos.x}px, ${finalPos.y}px)`;
      return undefined;
    }

    const anim = ballEl.animate(finalKeyframes, { duration: BALL_FLIGHT_MS, easing: 'ease-in-out', fill: 'forwards' });
    animRef.current = anim;
    return () => anim.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Freeze-frame phase choreography: buildup -> pause at the outcome
  // moment (frozen, callout up) -> resume the remaining flight (completing)
  // -> a brief settle beat -> advance. Under reduced motion the ball has
  // already snapped straight to its final position (see effect above), so
  // pause()/play() on animRef are no-ops there — the phases (and the
  // callout) still progress on the same schedule, just without motion.
  useEffect(() => {
    setPhase('buildup');
    if (!current) return undefined;

    const buildupMs = outcomeOffset * BALL_FLIGHT_MS;
    const completionMs = BALL_FLIGHT_MS - buildupMs;

    const freezeTimer = setTimeout(() => {
      animRef.current?.pause();
      setPhase('frozen');
    }, buildupMs);

    const resumeTimer = setTimeout(() => {
      setPhase('completing');
      animRef.current?.play();
    }, buildupMs + FREEZE_MS);

    const settleTimer = setTimeout(() => {
      setPhase('settling');
    }, buildupMs + FREEZE_MS + completionMs);

    const advanceTimer = setTimeout(
      () => {
        if (index < chronological.length - 1) {
          setIndex((i) => i + 1);
        } else {
          onDone();
        }
      },
      buildupMs + FREEZE_MS + completionMs + POST_COMPLETION_HOLD_MS,
    );

    return () => {
      clearTimeout(freezeTimer);
      clearTimeout(resumeTimer);
      clearTimeout(settleTimer);
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

      {/* Retro/8-bit-style schematic court — real markings, not an abstract rectangle (spec 4a). Aerial/top-down camera angle unchanged.
          Mobile-portrait (<=640px) shows just the attacking half, cropped via viewBox — see MOBILE_COURT_VIEWBOX's doc comment for why. */}
      <div className="relative overflow-hidden rounded-lg border-4 border-[#8F5A1D]" style={{ imageRendering: 'pixelated' }}>
        <div className={isNarrow ? 'aspect-[21/20] w-full' : 'aspect-[2/1] w-full'}>
          <CourtDiagram viewBox={isNarrow ? MOBILE_COURT_VIEWBOX : undefined}>
            <PlayerSprite
              key={index}
              pose={pose}
              jerseyColor={jerseyColor}
              x={spritePos.x}
              y={spritePos.y}
              scale={1.7}
              className={`animate-sprite-fade-in transition-opacity duration-300 ${phase === 'settling' ? 'opacity-50' : 'opacity-100'}`}
            />
            <Basketball ref={ballRef} style={ballInitialStyle} />
          </CourtDiagram>
        </div>

        {/* Large, centered outcome callout — up for the full freeze, not buried near the ball in a corner (spec: "positioned so it's readable at a glance"). */}
        {phase === 'frozen' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
            <div key={`callout-${index}`} className="animate-callout-pop rounded-xl border-4 border-[#241B12] bg-[#FFD23F] px-4 py-2 text-center shadow-xl sm:px-6 sm:py-3">
              <span className="block text-xl font-extrabold tracking-tight text-[#241B12] sm:text-4xl">{OUTCOME_CALLOUT[current.playType]}</span>
            </div>
          </div>
        )}
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
