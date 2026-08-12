import { CourtZone, PlayType } from './types';

export const COURT_WIDTH = 800;
export const COURT_HEIGHT = 400;

/**
 * Cropped viewBox showing just the attacking (right) half of the court —
 * mobile-portrait legibility fix. Every real play's zones live entirely
 * within x >= 540 (see ZONE_POSITIONS/possession.ts's actual startLocation
 * values: 'mid_range' 620, 'three_top' 540, 'free_throw_line' 646, plus a
 * steal's small deflection nudge off any of those), so a left edge of 380
 * has generous margin and never clips real game action — only the
 * always-empty decorative left hoop (shown purely for full-court symmetry)
 * gets cropped out. At the full COURT_WIDTH x COURT_HEIGHT (800x400, a 2:1
 * aspect), a narrow phone-portrait viewport can only render this ~171px
 * tall even at full device width, while ~80% of vertical screen space
 * below it sits unused — cropping to this near-square region roughly
 * doubles the effective on-screen scale of every sprite/ball/court marking
 * at that width, with zero letterboxing (420x400 exactly matches the
 * `aspect-[21/20]` container class GameCastPlayback applies alongside it).
 */
export const MOBILE_COURT_VIEWBOX = '380 0 420 400';

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

/**
 * The attacking hoop's actual rendered rim center — must match
 * `CourtDiagram.tsx`'s `CourtEnd({ dir: -1, x0: 796 })` rim ellipse
 * (`cx = x0 + 26 * dir = 770`, `cy = 200`) exactly, or the ball's arc
 * visibly lands short of/in front of the hoop instead of at it.
 * Deliberately NOT the same point as `ZONE_POSITIONS.paint` (730,200) —
 * that value is a "standing in the paint" position (also used as a shot's
 * *start* zone for a close-range attempt, and to place a rebounder), and
 * collapsing it onto the exact rim would put a shooter or rebounder
 * sprite visually on top of the hoop graphic. Only where the BALL itself
 * needs to terminate for a shot attempt should snap to this.
 */
export const HOOP_POSITION: Point = { x: 770, y: 200 };

/**
 * Where a shot attempt's ball actually needs to end up. Every make/miss/
 * rebound event's `endLocation` is `'paint'` (sim-engine's possession.ts),
 * which `ZONE_POSITIONS` treats as a general "in the paint" standing spot
 * — snap that specific case to the hoop's real rim center so the arc
 * terminates AT the hoop, not near it. Any other zone (e.g. `backcourt`,
 * for a turnover) passes through unchanged.
 */
export function resolveBallEndPosition(zone: CourtZone): Point {
  return zone === 'paint' ? HOOP_POSITION : ZONE_POSITIONS[zone];
}

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

/**
 * Freeze-frame callout text, shown large and centered over the court for
 * the beat the ball animation is paused at the outcome moment (GameCast
 * pacing fix — "Option D"). Replaces the old small in-SVG "+3"/"MISS" badge
 * that popped up only after the ball had already finished moving; this is
 * deliberately more exclamatory/broadcast-style since it now IS the primary
 * signal a play resolved, not a secondary detail near the ball.
 */
export const OUTCOME_CALLOUT: Record<PlayType, string> = {
  three_pointer_made: 'THREE POINTER!',
  two_pointer_made: 'SCORES!',
  three_pointer_missed: 'MISSED',
  two_pointer_missed: 'MISSED',
  free_throw: 'FREE THROW!',
  steal: 'STOLEN!',
  turnover: 'TURNOVER!',
  block: 'BLOCKED!',
  offensive_rebound: 'REBOUND',
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

export interface StealDeflection {
  /** Where the deflected ball ends up — a small, contained nudge near where the play happened, not a trip across the court. Also where the outcome badge appears. */
  end: Point;
  keyframes: Keyframe[];
}

const STEAL_TRAVEL_DISTANCE = 32;

/**
 * A steal/turnover's ball motion — deliberately much more subdued than
 * both the normal scoring arc and the block's dramatic deflection: a
 * short, contained nudge near where the play happened, not a trip across
 * the court. A turnover/steal event's `endLocation` is always
 * `'backcourt'` (sim-engine's possession.ts) — ~180 units from
 * `mid_range`, roughly a quarter of the court's width — using that
 * distance directly reads as a full-court launch, not a hand-to-hand
 * deflection, so this travels only `STEAL_TRAVEL_DISTANCE` in that same
 * general direction rather than the whole way to `end`.
 */
export function computeStealDeflection(start: Point, end: Point): StealDeflection {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  const shortEnd: Point = { x: start.x + ux * STEAL_TRAVEL_DISTANCE, y: start.y + uy * STEAL_TRAVEL_DISTANCE };

  const control = arcControlPoint(start, shortEnd);
  const steps = 5;
  const keyframes: Keyframe[] = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const p = quadraticBezier(start, control, shortEnd, t);
    return { transform: `translate(${p.x}px, ${p.y}px)`, offset: t };
  });

  return { end: shortEnd, keyframes };
}

