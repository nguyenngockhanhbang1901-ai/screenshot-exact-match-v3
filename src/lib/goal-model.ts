export type Point3 = readonly [number, number, number];

export const GOAL_DIMENSIONS = {
  width: 7.32,
  height: 2.44,
  depth: 2.2,
  rearHeight: 2.05,
  steelRadius: 0.055,
  netRadius: 0.008,
} as const;

export type SteelMember = {
  name: string;
  start: Point3;
  end: Point3;
  radius: number;
};

export function getGoalSteelMembers(): SteelMember[] {
  const { width, height, depth, rearHeight, steelRadius } = GOAL_DIMENSIONS;
  const halfWidth = width / 2 - steelRadius;
  const front = depth / 2 - steelRadius;
  const back = -depth / 2 + steelRadius;
  const base = steelRadius;
  const frontTop = height - steelRadius;
  const rearTop = rearHeight - steelRadius;

  return [
    { name: 'Cột trái', start: [-halfWidth, base, front], end: [-halfWidth, frontTop, front], radius: steelRadius },
    { name: 'Cột phải', start: [halfWidth, base, front], end: [halfWidth, frontTop, front], radius: steelRadius },
    { name: 'Xà ngang', start: [-halfWidth, frontTop, front], end: [halfWidth, frontTop, front], radius: steelRadius },
    { name: 'Thanh nối trên trái', start: [-halfWidth, frontTop, front], end: [-halfWidth, rearTop, back], radius: steelRadius * 0.82 },
    { name: 'Thanh nối trên phải', start: [halfWidth, frontTop, front], end: [halfWidth, rearTop, back], radius: steelRadius * 0.82 },
    { name: 'Thanh đáy trái', start: [-halfWidth, base, front], end: [-halfWidth, base, back], radius: steelRadius * 0.72 },
    { name: 'Thanh đáy phải', start: [halfWidth, base, front], end: [halfWidth, base, back], radius: steelRadius * 0.72 },
    { name: 'Trụ sau trái', start: [-halfWidth, base, back], end: [-halfWidth, rearTop, back], radius: steelRadius * 0.82 },
    { name: 'Trụ sau phải', start: [halfWidth, base, back], end: [halfWidth, rearTop, back], radius: steelRadius * 0.82 },
    { name: 'Thanh nối sau', start: [-halfWidth, rearTop, back], end: [halfWidth, rearTop, back], radius: steelRadius * 0.82 },
  ];
}