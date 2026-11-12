import { describe, expect, it } from 'vitest';
import { classroomCodeSchema, classroomJoinSchema, codeJoinKey } from './classroom-access';

describe('Code-only classroom entry', () => {
  it('accepts a classroom code without an account or team access code', () => {
    expect(classroomCodeSchema.parse({ code: ' abc123 ' })).toEqual({ code: 'ABC123' });
  });
  it('allows a team selection without a team access code', () => {
    expect(classroomJoinSchema.parse({ code: 'ABC123', number: 2 })).toEqual({ code: 'ABC123', number: 2 });
  });
  it('keeps team capabilities distinct and stable on rejoin', async () => {
    const key = await codeJoinKey('room1', 'secret-team1');
    expect(key).toHaveLength(24);
    expect(await codeJoinKey('room1', 'secret-team1')).toBe(key);
    expect(await codeJoinKey('room1', 'secret-team2')).not.toBe(key);
    expect(await codeJoinKey('room2', 'secret-team1')).not.toBe(key);
  });
});