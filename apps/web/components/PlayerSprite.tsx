import { SpritePose } from '../lib/court';

// Deliberately NOT a skin tone (no light/medium/dark palette, no attempt
// to depict any real player's actual appearance/race, positive or
// negative) — one flat, stylized, clearly-artificial color for every
// player's body, applied uniformly. The jersey is what varies per player
// now, using each player's real drafted-from team color instead (passed
// in as `jerseyColor`) — real team colors, not a race-adjacent attribute.
const BODY_FILL = '#9B9591';
const SHORTS = '#241F38';

/**
 * Blocky 8-bit humanoid (spec 4a) — personalized by jersey color (the
 * player's real drafted-from team), not skin tone. Each pose is a distinct
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
  jerseyColor,
  x,
  y,
  scale = 1,
  className,
}: {
  pose: SpritePose;
  jerseyColor: string;
  x: number;
  y: number;
  scale?: number;
  className?: string;
}) {
  const body = BODY_FILL;

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
          <rect x={-4} y={-20} width={8} height={8} fill={body} />
          <rect x={-6} y={-11} width={12} height={11} fill={jerseyColor} />
          <rect x={-6} y={0} width={12} height={7} fill={SHORTS} />
          <rect x={-9} y={7} width={5} height={9} fill={body} />
          <rect x={4} y={7} width={5} height={13} fill={body} />
          <rect x={-13} y={-21} width={5} height={11} fill={body} />
          <rect x={9} y={-27} width={5} height={15} fill={body} />
        </g>
      )}
      {pose === 'steal' && (
        <>
          <rect x={-4} y={-13} width={8} height={8} fill={body} />
          <rect x={-6} y={-5} width={12} height={8} fill={jerseyColor} />
          <rect x={-6} y={3} width={12} height={6} fill={SHORTS} />
          <rect x={-15} y={8} width={8} height={7} fill={body} />
          <rect x={8} y={8} width={8} height={7} fill={body} />
          <rect x={-25} y={-8} width={12} height={5} fill={body} />
          <rect x={7} y={-6} width={6} height={6} fill={body} />
        </>
      )}
      {pose === 'block' && (
        <>
          <rect x={-4} y={-19} width={8} height={8} fill={body} />
          <rect x={-5} y={-11} width={10} height={11} fill={jerseyColor} />
          <rect x={-5} y={0} width={10} height={6} fill={SHORTS} />
          <rect x={-5} y={6} width={4} height={11} fill={body} />
          <rect x={1} y={6} width={4} height={11} fill={body} />
          <rect x={5} y={-33} width={4} height={16} fill={body} />
          <rect x={-9} y={-9} width={4} height={9} fill={body} />
        </>
      )}
      {pose === 'reach' && (
        <>
          <rect x={-4} y={-19} width={8} height={8} fill={body} />
          <rect x={-5} y={-11} width={10} height={11} fill={jerseyColor} />
          <rect x={-5} y={0} width={10} height={6} fill={SHORTS} />
          <rect x={-5} y={6} width={4} height={11} fill={body} />
          <rect x={1} y={6} width={4} height={11} fill={body} />
          <rect x={-9} y={-33} width={4} height={16} fill={body} />
          <rect x={5} y={-33} width={4} height={16} fill={body} />
        </>
      )}
    </g>
  );
}
