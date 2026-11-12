export const QUESTION_SECONDS = 30;
const LIMIT_MS = QUESTION_SECONDS * 1000;
/** Network allowance for the final save request; never extends the visible countdown. */
export const GRACE_MS = 3000;
export type Timing = { started_at: string | null; ended_at: string | null };
export function normalizeTimings(raw: unknown): Timing[] {
  const list = Array.isArray(raw) ? raw : [];
  return [0, 1, 2].map(i => { const t = (list[i] ?? {}) as Partial<Timing>; return { started_at: t.started_at ?? null, ended_at: t.ended_at ?? null }; });
}
export function remainingMs(startedAt: string | null, nowMs: number) {
  if (!startedAt) return LIMIT_MS;
  return Math.min(LIMIT_MS, Math.max(0, Date.parse(startedAt) + LIMIT_MS - nowMs));
}
export function timerTone(ms: number): 'normal' | 'warning' | 'danger' {
  const s = Math.ceil(ms / 1000);
  return s <= 5 ? 'danger' : s <= 10 ? 'warning' : 'normal';
}
export function acceptsAnswer(startedAt: string | null, nowMs: number) {
  return Boolean(startedAt) && nowMs <= Date.parse(startedAt as string) + LIMIT_MS + GRACE_MS;
}
export function canStart(timings: Timing[], step: number) { return step === 0 || Boolean(timings[step - 1]?.ended_at); }
export function endTime(startedAt: string, nowMs: number) { return new Date(Math.min(nowMs, Date.parse(startedAt) + LIMIT_MS)).toISOString(); }
export function durationSeconds(t: Timing | undefined) {
  if (!t?.started_at || !t.ended_at) return null;
  return Math.round((Date.parse(t.ended_at) - Date.parse(t.started_at)) / 100) / 10;
}
export function timingAt(list: Timing[], i: number): Timing { return list[i] ?? { started_at: null, ended_at: null }; }
