export function assignmentStarted(startedAt: string | null | undefined, now: number) {
  return Boolean(startedAt && Date.parse(startedAt) <= now);
}