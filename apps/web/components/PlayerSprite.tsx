import { SpritePose } from '../lib/court';
import { SkinTone } from '../lib/types';

const SKIN_FILL: Record<SkinTone, string> = {
  light: '#E8B98A',
  medium: '#B97A56',
  dark: '#6B4226',
};
const JERSEY = '#3B3355';
const SHORTS = '#241F38';

/**
 * Blocky 8-bit humanoid (spec 4a) — the ONLY personalization is skin
 * tone, no facial detail or jersey/team accuracy. Each pose is a distinct
 * full silhouette, not shared limbs bolted onto one identical core, since
 * proportions/overall shape are what read at this scale:
 * - shoot: asymmetric Y-arms above the head, one leg kicked back.
 * - steal: low wide crouch, one arm swiping out to the side. Grounded.
 * - block: vertical jump, ONE arm raised to contest. Legs tucked (airborne).
 * - reach (rebound): vertical jump, BOTH arms raised, symmetric — the
 *   one-arm-vs-two-arm difference from block is deliberately the entire
 *   visual distinction between them (design-approved).
 */
export function PlayerSprite({
  pose,
  tone,
  x,
  y,
  scale = 1,
  className,
}: {
  pose: SpritePose;
  tone: SkinTone;
  x: number;
  y: number;
  scale?: number;
  className?: string;
}) {
  const skin = SKIN_FILL[tone];

  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`} className={className}>
      {pose === 'shoot' && (
        // Inner group carries the release hop (spec 4a polish: "a small
        // visible hop/jump on release, synced with the ball leaving the
        // hand") — nested separately from the outer positioning group
        // because a CSS animation on `transform` would otherwise replace
        // that outer group's SVG `transform` ATTRIBUTE outright rather
        // than combining with it (same pattern as the outcome badge).
        <g className="animate-shot-hop">
          <rect x={-4} y={-20} width={8} height={8} fill={skin} />
          <rect x={-6} y={-11} width={12} height={11} fill={JERSEY} />
          <rect x={-6} y={0} width={12} height={7} fill={SHORTS} />
          <rect x={-9} y={7} width={5} height={9} fill={skin} />
          <rect x={4} y={7} width={5} height={13} fill={skin} />
          <rect x={-13} y={-21} width={5} height={11} fill={skin} />
          <rect x={9} y={-27} width={5} height={15} fill={skin} />
        </g>
      )}
      {pose === 'steal' && (
        <>
          <rect x={-4} y={-13} width={8} height={8} fill={skin} />
          <rect x={-6} y={-5} width={12} height={8} fill={JERSEY} />
          <rect x={-6} y={3} width={12} height={6} fill={SHORTS} />
          <rect x={-15} y={8} width={8} height={7} fill={skin} />
          <rect x={8} y={8} width={8} height={7} fill={skin} />
          <rect x={-25} y={-8} width={12} height={5} fill={skin} />
          <rect x={7} y={-6} width={6} height={6} fill={skin} />
        </>
      )}
      {pose === 'block' && (
        <>
          <rect x={-4} y={-19} width={8} height={8} fill={skin} />
          <rect x={-5} y={-11} width={10} height={11} fill={JERSEY} />
          <rect x={-5} y={0} width={10} height={6} fill={SHORTS} />
          <rect x={-5} y={6} width={4} height={11} fill={skin} />
          <rect x={1} y={6} width={4} height={11} fill={skin} />
          <rect x={5} y={-33} width={4} height={16} fill={skin} />
          <rect x={-9} y={-9} width={4} height={9} fill={skin} />
        </>
      )}
      {pose === 'reach' && (
        <>
          <rect x={-4} y={-19} width={8} height={8} fill={skin} />
          <rect x={-5} y={-11} width={10} height={11} fill={JERSEY} />
          <rect x={-5} y={0} width={10} height={6} fill={SHORTS} />
          <rect x={-5} y={6} width={4} height={11} fill={skin} />
          <rect x={1} y={6} width={4} height={11} fill={skin} />
          <rect x={-9} y={-33} width={4} height={16} fill={skin} />
          <rect x={5} y={-33} width={4} height={16} fill={skin} />
        </>
      )}
    </g>
  );
}
