import { describe, expect, it } from 'vitest';
import { getGoalSteelMembers, GOAL_DIMENSIONS } from './goal-model';

describe('football goal model', () => {
  it('uses full-size 11-a-side goal proportions', () => {
    expect(GOAL_DIMENSIONS.width).toBe(7.32);
    expect(GOAL_DIMENSIONS.height).toBe(2.44);
    expect(GOAL_DIMENSIONS.depth).toBe(2.2);
  });

  it('keeps the posts and crossbar as independent steel members', () => {
    const members = getGoalSteelMembers();
    expect(members.filter(({ name }) => name === 'Cột trái' || name === 'Cột phải')).toHaveLength(2);
    expect(members.filter(({ name }) => name === 'Xà ngang')).toHaveLength(1);
    expect(members.filter(({ name }) => name.startsWith('Thanh nối'))).toHaveLength(2);
    const stays = members.filter(({ name }) => name.startsWith('Thanh chéo'));
    expect(stays).toHaveLength(2);
    expect(stays.every(({ start, end }) => start[1] > 2 && end[1] < 0.1)).toBe(true);
    expect(members.some(({ name }) => name.startsWith('Trụ sau'))).toBe(false);
    expect(members.every(({ start, end }) => start.some((value, axis) => value !== end[axis]))).toBe(true);
  });
});