import { COURT_HEIGHT, COURT_WIDTH } from '../lib/court';

const FLOOR = '#C9822E';
const CHALK = '#F5EFE0';
const RIM = '#E2451D';

/** One end's markings: key/paint, free-throw circle, restricted arc, three-point arc, backboard, rim, net hint. `dir` is which way the key extends from the baseline (1 = from the left edge, -1 = from the right edge). */
function CourtEnd({ dir, x0 }: { dir: 1 | -1; x0: number }) {
  const keyX = dir === 1 ? x0 : x0 + 150 * dir;
  const hoopX = x0 + 44 * dir;
  const arcCx = x0 + 4 * dir;
  return (
    <g>
      <rect x={keyX} y={130} width={150} height={140} fill="none" stroke={CHALK} strokeWidth={3} />
      <circle cx={x0 + 150 * dir} cy={200} r={44} fill="none" stroke={CHALK} strokeWidth={3} />
      <path d={dir === 1 ? `M ${hoopX} 172 A 28 28 0 0 1 ${hoopX} 228` : `M ${hoopX} 172 A 28 28 0 0 0 ${hoopX} 228`} fill="none" stroke={CHALK} strokeWidth={2.5} />
      <path
        d={
          dir === 1
            ? `M ${arcCx} 18 L ${arcCx + 60} 18 A 240 240 0 0 1 ${arcCx + 60} 382 L ${arcCx} 382`
            : `M ${arcCx} 18 L ${arcCx - 60} 18 A 240 240 0 0 0 ${arcCx - 60} 382 L ${arcCx} 382`
        }
        fill="none"
        stroke={CHALK}
        strokeWidth={2.5}
      />
      <line x1={x0 + 10 * dir} y1={178} x2={x0 + 10 * dir} y2={222} stroke={CHALK} strokeWidth={5} />
      <ellipse cx={x0 + 26 * dir} cy={200} rx={12} ry={6} fill="none" stroke={RIM} strokeWidth={3} />
      <line x1={x0 + 20 * dir} y1={203} x2={x0 + 24 * dir} y2={216} stroke={CHALK} strokeWidth={1.5} />
      <line x1={x0 + 26 * dir} y1={204} x2={x0 + 26 * dir} y2={217} stroke={CHALK} strokeWidth={1.5} />
      <line x1={x0 + 32 * dir} y1={203} x2={x0 + 28 * dir} y2={216} stroke={CHALK} strokeWidth={1.5} />
    </g>
  );
}

/**
 * Full-court aerial diagram (spec 4a) — both hoops, both keys, both
 * three-point arcs, drawn whole and symmetric the way a real court is,
 * even though any single play only ever animates on the attacking
 * (right) half. `children` renders inside the same 0..800 x 0..400
 * coordinate space, so the ball/sprite overlays line up with the
 * markings without a separate positioning system.
 */
/**
 * `viewBox` defaults to the full 800x400 both-hoops court but can be
 * overridden (e.g. MOBILE_COURT_VIEWBOX) to show only a cropped region —
 * markings and `children` both live in the same fixed 0..800 x 0..400
 * coordinate space regardless, so a caller can crop the visible window
 * without recomputing any positions.
 */
export function CourtDiagram({ children, viewBox = `0 0 ${COURT_WIDTH} ${COURT_HEIGHT}` }: { children?: React.ReactNode; viewBox?: string }) {
  return (
    <svg viewBox={viewBox} className="h-full w-full" style={{ backgroundColor: FLOOR }}>
      <rect x={4} y={4} width={792} height={392} fill="none" stroke={CHALK} strokeWidth={3} />
      <line x1={400} y1={4} x2={400} y2={396} stroke={CHALK} strokeWidth={3} />
      <circle cx={400} cy={200} r={44} fill="none" stroke={CHALK} strokeWidth={3} />
      <CourtEnd dir={1} x0={4} />
      <CourtEnd dir={-1} x0={796} />
      {children}
    </svg>
  );
}
