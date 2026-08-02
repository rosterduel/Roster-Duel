import { forwardRef } from 'react';

const BALL = '#E8752C';
const SEAM = '#3B2510';

/**
 * A real basketball sprite (spec 4a: "round, orange/brown, not a generic
 * yellow dot") — seam lines, not a plain circle. Rendered centered at
 * local (0,0); the caller positions/animates it by driving this outer
 * `<g>`'s CSS `transform` (via the forwarded ref + Web Animations API),
 * not by changing cx/cy — WAAPI animates CSS properties, not SVG
 * presentation attributes, so the ball's own geometry stays static and
 * all motion lives in the wrapping transform.
 */
export const Basketball = forwardRef<SVGGElement, { r?: number; style?: React.CSSProperties }>(function Basketball({ r = 9, style }, ref) {
  return (
    <g ref={ref} style={style}>
      <ellipse cx={0} cy={r * 1.6} rx={r * 0.9} ry={r * 0.32} fill="rgba(20,12,4,0.28)" />
      <circle cx={0} cy={0} r={r} fill={BALL} stroke={SEAM} strokeWidth={2} />
      <path d={`M ${-r} 0 A ${r} ${r} 0 0 1 ${r} 0`} fill="none" stroke={SEAM} strokeWidth={1.2} />
      <line x1={0} y1={-r} x2={0} y2={r} stroke={SEAM} strokeWidth={1.2} />
      <path d={`M ${-r * 0.7} ${-r * 0.7} Q 0 0 ${-r * 0.7} ${r * 0.7}`} fill="none" stroke={SEAM} strokeWidth={1.2} />
    </g>
  );
});
