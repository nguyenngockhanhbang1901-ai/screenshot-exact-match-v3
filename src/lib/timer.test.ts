import { describe, it, expect } from 'vitest';
import { remainingMs, timerTone, acceptsAnswer, canStart, endTime, durationSeconds, normalizeTimings } from './timer';
const start = '2026-11-12T10:00:00.000Z', t0 = Date.parse(start);
describe('question timer', () => {
  it('each question lasts at most 30 seconds', () => { expect(remainingMs(start, t0)).toBe(30000); expect(remainingMs(start, t0 + 31000)).toBe(0); });
  it('reload never grants new time: remaining is from the stored start', () => { expect(remainingMs(start, t0 + 20000)).toBe(10000); });
  it('orange at 10 seconds, red at 5 seconds', () => { expect(timerTone(11000)).toBe('normal'); expect(timerTone(10000)).toBe('warning'); expect(timerTone(6000)).toBe('warning'); expect(timerTone(5000)).toBe('danger'); });
  it('answers after deadline plus grace are rejected', () => { expect(acceptsAnswer(start, t0 + 29000)).toBe(true); expect(acceptsAnswer(start, t0 + 34000)).toBe(false); expect(acceptsAnswer(null, t0)).toBe(false); });
  it('next question starts only after previous ends', () => { const t = normalizeTimings([{ started_at: start, ended_at: null }]); expect(canStart(t, 0)).toBe(true); expect(canStart(t, 1)).toBe(false); });
  it('end time is capped at the deadline', () => { expect(endTime(start, t0 + 90000)).toBe('2026-11-12T10:00:30.000Z'); expect(durationSeconds({ started_at: start, ended_at: endTime(start, t0 + 12300) })).toBe(12.3); });
});
