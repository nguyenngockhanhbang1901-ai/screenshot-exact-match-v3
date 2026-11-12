import { describe, expect, it } from 'vitest';
import { assignmentStarted } from './assignment';
import { normalizeTimings, remainingMs } from './timer';

describe('teacher assignment release', () => {
  const sharedStart = '2026-11-12T23:45:02.000Z';
  const now = Date.parse(sharedStart);
  it('students cannot start before the teacher releases the assignment', () => {
    expect(assignmentStarted(null, now)).toBe(false);
    expect(assignmentStarted(sharedStart, now - 1)).toBe(false);
    expect(assignmentStarted(sharedStart, now)).toBe(true);
  });
  it('all teams use the same first-question clock, including late joiners', () => {
    const teams = [1, 2, 3, 4].map(() => normalizeTimings([{ started_at: sharedStart, ended_at: null }]));
    expect(teams.map(t => remainingMs(t[0]?.started_at ?? null, now))).toEqual([30000, 30000, 30000, 30000]);
    expect(remainingMs(teams[3]?.[0]?.started_at ?? null, now + 10000)).toBe(20000);
  });
});