import { z } from 'zod';

export const classroomCodeSchema = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,12}$/, 'Mã lớp không hợp lệ') });
export const classroomJoinSchema = classroomCodeSchema.extend({ number: z.number().int().min(1).max(10) });

// The stored capability hash is secret; derive a stable capability without exposing it.
export async function codeJoinKey(roomId: string, accessHash: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`classroom-code-join:${roomId}:${accessHash}`));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
}