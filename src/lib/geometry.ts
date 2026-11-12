export type CaseIndex = 0 | 1 | 2;
export type Vec3 = [number, number, number];
export const cases = [
  { title: 'Một điểm chung', relation: 'Đường thẳng cắt mặt phẳng', formula: 'd ∩ (P) = {A}', count: '1 điểm', answer: 'Đường thẳng d cắt mặt phẳng (P) tại đúng một điểm A.' },
  { title: 'Không có điểm chung', relation: 'Đường thẳng song song mặt phẳng', formula: 'd ∩ (P) = ∅', count: '0 điểm', answer: 'Đường thẳng d song song với mặt phẳng (P), không có điểm chung.' },
  { title: 'Vô số điểm chung', relation: 'Đường thẳng nằm trong mặt phẳng', formula: 'd ⊂ (P)', count: 'Vô số điểm', answer: 'Đường thẳng d nằm hoàn toàn trong mặt phẳng (P), có vô số điểm chung.' },
] as const;
export function lineGeometry(index: CaseIndex, offset = 0): { origin: Vec3; direction: Vec3 } {
  if (index === 0) return { origin: [offset, 0, 0], direction: [0.65, 1, 0.25] };
  return { origin: [0, index === 1 ? 1.1 + offset * 0.2 : 0, offset], direction: [1, 0, 0.3] };
}
export function pointOnLine(index: CaseIndex, t: number, offset = 0): Vec3 {
  const { origin, direction } = lineGeometry(index, offset);
  return [origin[0] + t * direction[0], origin[1] + t * direction[1], origin[2] + t * direction[2]];
}
export const MAX_TEAMS = 10;
export function validateTeamCount(n: number) { return Number.isInteger(n) && n >= 1 && n <= MAX_TEAMS; }
export function canEdit(submittedAt: string | null) { return submittedAt === null; }
export function mayReadOtherAnswers(released: boolean) { return released; }

export const MOTION_SPEEDS = { slow: 0.5, normal: 1, fast: 2 } as const;
export type MotionSpeed = keyof typeof MOTION_SPEEDS;
export function advanceMotion(time: number, delta: number, playing: boolean, speed: MotionSpeed) {
  return time + (playing ? Math.min(Math.max(delta, 0), 0.05) * MOTION_SPEEDS[speed] : 0);
}
export function animatedLine(index: CaseIndex, time: number): { origin: Vec3; direction: Vec3 } {
  const angle = time * 0.55;
  const origin: Vec3 = [0.65 * Math.sin(time * 0.7), index === 1 ? 1.15 + 0.35 * Math.sin(time * 0.6) : 0, 0.45 * Math.sin(time * 0.9)];
  const direction: Vec3 = index === 0
    ? [0.7 * Math.cos(angle), 0.85 + 0.2 * Math.sin(time * 0.8), 0.7 * Math.sin(angle)]
    : [Math.cos(angle), 0, Math.sin(angle)];
  return { origin, direction };
}
export function motionIsValid(index: CaseIndex, origin: Vec3, direction: Vec3) {
  if (index === 0) return origin[1] === 0 && Math.abs(direction[1]) >= 0.65;
  return direction[1] === 0 && (index === 1 ? origin[1] >= 0.8 : origin[1] === 0);
}
export const PLANE_HALF = { x: 3.05, z: 2.25 } as const;
export const LINE_MARGIN = 0.12;
export const LINE_HALF_LENGTH = 2.2;
/** Best initial camera per question: oblique for intersection, low for the parallel gap, high for the contained line. */
export const CAMERA_VIEWS: Record<CaseIndex, Vec3> = { 0: [6.5, 3.4, 7], 1: [7.5, 1.6, 6.5], 2: [4.5, 7.5, 6] };
const at = (o: Vec3, u: Vec3, t: number): Vec3 => [o[0] + u[0] * t, o[1] + u[1] * t, o[2] + u[2] * t];
/** Half-length used to draw question 3's line: short enough that the whole segment always stays inside the illustrated (P). */
export const CONTAINED_HALF_LENGTH = 1.6;
/** Drawn segment of d. Question 3 is never clipped at the illustration edge: the segment is short and moves freely inside (P). */
export function lineSegment(index: CaseIndex, origin: Vec3, direction: Vec3): [Vec3, Vec3] {
  const len = Math.hypot(...direction);
  const u: Vec3 = [direction[0] / len, direction[1] / len, direction[2] / len];
  const half = index === 2 ? CONTAINED_HALF_LENGTH : LINE_HALF_LENGTH;
  return [at(origin, u, -half), at(origin, u, half)];
}
/** Every point of the segment lies in (P): y = 0, and both endpoints stay inside the illustrated rectangle with margin. */
export function segmentInsidePlane([a, b]: [Vec3, Vec3]) {
  const inside = (p: Vec3) => p[1] === 0 && Math.abs(p[0]) <= PLANE_HALF.x - LINE_MARGIN && Math.abs(p[2]) <= PLANE_HALF.z - LINE_MARGIN;
  return inside(a) && inside(b);
}
/** A point is hidden when the sight ray from the camera crosses the plane rectangle first. Points on the plane are never hidden. */
export function isHidden(p: Vec3, camera: Vec3) {
  const cy = camera[1], py = p[1];
  if (Math.abs(py) < 1e-9 || Math.abs(cy) < 1e-9 || Math.sign(cy) === Math.sign(py)) return false;
  const k = cy / (cy - py);
  return Math.abs(camera[0] + (p[0] - camera[0]) * k) <= PLANE_HALF.x && Math.abs(camera[2] + (p[2] - camera[2]) * k) <= PLANE_HALF.z;
}
export type Segment = [Vec3, Vec3];
export function splitByVisibility(a: Vec3, b: Vec3, camera: Vec3, samples = 96): { visible: Segment[]; hidden: Segment[] } {
  const p = (t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const visible: Segment[] = [], hidden: Segment[] = [];
  let start = 0, state = isHidden(p(0), camera);
  const push = (s: number, e: number, h: boolean) => { if (e - s > 1e-6) (h ? hidden : visible).push([p(s), p(e)]); };
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    if (isHidden(p(t), camera) !== state) {
      let lo = (i - 1) / samples, hi = t;
      for (let k = 0; k < 24; k++) { const mid = (lo + hi) / 2; if (isHidden(p(mid), camera) === state) lo = mid; else hi = mid; }
      push(start, hi, state); start = hi; state = !state;
    }
  }
  push(start, 1, state);
  return { visible, hidden };
}
