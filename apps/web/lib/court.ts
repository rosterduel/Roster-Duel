import { CourtZone, PlayType } from './types';

export const COURT_WIDTH = 800;
export const COURT_HEIGHT = 400;

export interface Point {
  x: number;
  y: number;
}

/**
 * Where a CourtZone sits in court-space (spec 4a). Always mapped onto the
 * RIGHT half of the diagram — a play's zones are offense-relative
 * (sim-engine's CourtZone doc comment), not court-absolute, so every play
 * is rendered as if attacking the right-hand hoop. That's consistent with
 * the required aerial/top-down camera: there's no "which end" to track.
 */
export const ZONE_POSITIONS: Record<CourtZone, Point> = {
  backcourt: { x: 440, y: 200 },
  mid_range: { x: 620, y: 200 },
  paint: { x: 730, y: 200 },
  free_throw_line: { x: 646, y: 200 },
  three_left: { x: 700, y: 360 },
  three_right: { x: 700, y: 40 },
  three_top: { x: 540, y: 200 },
};

export type SpritePose = 'shoot' | 'steal' | 'block' | 'reach';

/** playType -> which sprite pose performs it (spec 4a). Turnover reuses Steal's crouch — approved, no dedicated pose requested for it. */
export const POSE_BY_PLAY_TYPE: Record<PlayType, SpritePose> = {
  three_pointer_made: 'shoot',
  three_pointer_missed: 'shoot',
  two_pointer_made: 'shoot',
  two_pointer_missed: 'shoot',
  free_throw: 'shoot',
  steal: 'steal',
  turnover: 'steal',
  block: 'block',
  offensive_rebound: 'reach',
};

/** Outcome badge text, timed to pop up when the play resolves (spec 4a). */
export const OUTCOME_BADGE: Record<PlayType, string> = {
  three_pointer_made: '+3',
  two_pointer_made: '+2',
  three_pointer_missed: 'MISS',
  two_pointer_missed: 'MISS',
  free_throw: 'FT',
  steal: 'STL',
  turnover: 'TO',
  block: 'BLOCK',
  offensive_rebound: 'REB',
};

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function quadraticBezier(p0: Point, p1: Point, p2: Point, t: number): Point {
  const x = (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * p1.x + t ** 2 * p2.x;
  const y = (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * p1.y + t ** 2 * p2.y;
  return { x, y };
}

/**
 * A control point bowed off the straight line between start/end. The
 * aerial camera has no vertical dimension to show real shot height, so
 * "arc" here means a curved 2D path rather than a straight line (spec 4a:
 * "the ball should visibly arc"). Bow is capped and distance-scaled so a
 * short hop (a steal's ball-changes-hands motion) doesn't get an
 * exaggerated bow sized for a full-court three.
 */
function arcControlPoint(start: Point, end: Point): Point {
  const mid = lerp(start, end, 0.5);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.hypot(dx, dy) || 1;
  const bow = Math.min(40, dist * 0.35);
  return { x: mid.x - (dy / dist) * bow, y: mid.y + (dx / dist) * bow };
}

/** CSS transform keyframes (with explicit offsets) for a normal play's ball flight — a smooth curved path from start to end, for use with Element.animate(). */
export function buildArcKeyframes(start: Point, end: Point): Keyframe[] {
  const control = arcControlPoint(start, end);
  const steps = 8;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const p = quadraticBezier(start, control, end, t);
    return { transform: `translate(${p.x}px, ${p.y}px)`, offset: t };
  });
}

export interface BlockDeflection {
  /** Where the block happens — roughly 55% of the way from shooter to hoop, not the full distance. This is also where the blocker's sprite is positioned, not at the shooter's original spot. */
  contact: Point;
  /** Where the deflected ball ends up — off to the side and back toward mid-court, never reaching the hoop. Also where the "BLOCK" outcome badge appears. */
  deflectEnd: Point;
  /** Keyframes for the full two-segment motion: normal partial approach, then a sharp deflection. */
  keyframes: Keyframe[];
}

/**
 * Computes a blocked shot's ball path (spec 4a): "the ball should visibly
 * get swatted/deflected off its path at the moment of contact, then
 * bounce away down the court — a real change in trajectory, not a reskin
 * of the scoring arc." Two distinct segments, weighted by `offset` so the
 * deflection reads as sudden rather than gradual: a normal partial
 * approach takes 70% of the animation's duration, the sharp deflection
 * takes the remaining 30%.
 */
export function computeBlockDeflection(start: Point, end: Point): BlockDeflection {
  const control = arcControlPoint(start, end);
  const contact = quadraticBezier(start, control, end, 0.55);

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  // Perpendicular to the approach direction, biased back toward mid-court
  // (subtracting the approach direction rather than continuing forward) —
  // this is what reads as "swatted away," not "a shot that fell short."
  const deflectEnd: Point = {
    x: contact.x - uy * 100 - ux * 60,
    y: contact.y + ux * 100 - uy * 60,
  };

  const approachSteps = 5;
  const approachPoints = Array.from({ length: approachSteps }, (_, i) => {
    const t = (i / (approachSteps - 1)) * 0.55;
    return quadraticBezier(start, control, end, t);
  });
  const deflectPoints = [contact, lerp(contact, deflectEnd, 0.5), deflectEnd];

  const keyframes: Keyframe[] = [
    ...approachPoints.map((p, i) => ({ transform: `translate(${p.x}px, ${p.y}px)`, offset: (i / (approachPoints.length - 1)) * 0.7 })),
    ...deflectPoints.map((p, i) => ({ transform: `translate(${p.x}px, ${p.y}px)`, offset: 0.7 + (i / (deflectPoints.length - 1)) * 0.3 })),
  ];

  return { contact, deflectEnd, keyframes };
}

/**
 * Where the sprite performing the highlighted action actually stands. Not
 * always `startLocation` — the highlighted player differs by playType
 * (spec 4a + the highlights.ts blocker-attribution fix): a shooter
 * releases from `startLocation`, but a blocker meets the ball at the
 * contact point (not where the shooter stood), and a rebounder is at
 * `endLocation` (where rebounds are actually grabbed), not the shooter's
 * original spot.
 */
export function spritePositionForPlay(playType: PlayType, start: Point, end: Point): Point {
  if (playType === 'block') return computeBlockDeflection(start, end).contact;
  if (playType === 'offensive_rebound') return end;
  return start;
}
