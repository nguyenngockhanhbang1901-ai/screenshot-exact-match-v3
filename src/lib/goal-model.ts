export type Point3 = readonly [number, number, number];

export const GOAL_DIMENSIONS = {
  width: 7.32,
  height: 2.44,
  depth: 2.2,
  topDepth: 0.8,
  steelRadius: 0.055,
  netRadius: 0.008,
} as const;

export type SteelMember = {
  name: string;
  start: Point3;
  end: Point3;
  radius: number;
};

/** Height of the goal outline (top bar, then sloping back stay) at depth z. */
export function goalProfileTop(z: number, inset = 0): number {
  const { height, depth, topDepth } = GOAL_DIMENSIONS;
  const front = depth / 2;
  const bendZ = front - topDepth;
  const back = -depth / 2;
  const top = height - inset;
  if (z >= bendZ) return top;
  const t = (bendZ - z) / (bendZ - back);
  return top + (inset - top) * Math.min(1, t);
}

// Matches the reference photo: posts + crossbar, short horizontal top bars running back,
// diagonal stays dropping to the ground, and a ground frame (sides + back). No rear posts.
export function getGoalSteelMembers(): SteelMember[] {
  const { width, height, depth, topDepth, steelRadius } = GOAL_DIMENSIONS;
  const halfWidth = width / 2 - steelRadius;
  const front = depth / 2 - steelRadius;
  const back = -depth / 2 + steelRadius;
  const base = steelRadius;
  const frontTop = height - steelRadius;
  const bend = depth / 2 - topDepth;
  const r = steelRadius * 0.8;
  const members: SteelMember[] = [
    { name: 'Cột trái', start: [-halfWidth, base, front], end: [-halfWidth, frontTop, front], radius: steelRadius },
    { name: 'Cột phải', start: [halfWidth, base, front], end: [halfWidth, frontTop, front], radius: steelRadius },
    { name: 'Xà ngang', start: [-halfWidth, frontTop, front], end: [halfWidth, frontTop, front], radius: steelRadius },
  ];
  for (const [side, label] of [[-1, 'trái'], [1, 'phải']] as const) {
    const x = side * halfWidth;
    members.push(
      { name: `Thanh nối trên ${label}`, start: [x, frontTop, front], end: [x, frontTop, bend], radius: r },
      { name: `Thanh chéo ${label}`, start: [x, frontTop, bend], end: [x, base, back], radius: r },
      { name: `Thanh đáy ${label}`, start: [x, base, front], end: [x, base, back], radius: r * 0.9 },
    );
  }
  members.push({ name: 'Thanh đáy sau', start: [-halfWidth, base, back], end: [halfWidth, base, back], radius: r * 0.9 });
  return members;
}
