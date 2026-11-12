import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { canEdit, mayReadOtherAnswers, validateTeamCount } from './geometry';
import { acceptsAnswer, canStart, endTime, normalizeTimings, timingAt, type Timing } from './timer';
import { classroomCodeSchema, classroomJoinSchema, codeJoinKey } from './classroom-access';
import { assignmentStarted } from './assignment';

async function hash(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
const accessSchema = z.object({ code: z.string().min(4).max(12), number: z.number().int().min(1).max(10), key: z.string().length(24) });
export const findClassroom = createServerFn({ method: 'POST' }).inputValidator(classroomCodeSchema).handler(async ({ data }) => {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: room } = await supabaseAdmin.from('classrooms').select('id,title,closed').eq('code', data.code).maybeSingle();
  if (!room) throw new Error('Mã lớp không đúng');
  if (room.closed) throw new Error('Lớp học đã đóng');
  const { data: teams, error } = await supabaseAdmin.from('classroom_teams').select('number').eq('classroom_id', room.id).order('number');
  if (error || !teams?.length) throw new Error('Lớp học chưa có tổ');
  return { title: room.title, numbers: teams.map(t => t.number) };
});
export const joinClassroom = createServerFn({ method: 'POST' }).inputValidator(classroomJoinSchema).handler(async ({ data }) => {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: room } = await supabaseAdmin.from('classrooms').select('id,closed').eq('code', data.code).maybeSingle();
  if (!room || room.closed) throw new Error('Mã lớp không đúng hoặc lớp đã đóng');
  const { data: team } = await supabaseAdmin.from('classroom_teams').select('access_hash').eq('classroom_id', room.id).eq('number', data.number).maybeSingle();
  if (!team) throw new Error('Tổ không có trong lớp');
  return { code: data.code, number: data.number, key: await codeJoinKey(room.id, team.access_hash) };
});
export const createClassroom = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ title: z.string().trim().min(1).max(100), teamCount: z.number().int().min(1).max(10) }))
  .handler(async ({ data, context }) => {
    if (!validateTeamCount(data.teamCount)) throw new Error('Tối đa 10 tổ');
    const code = crypto.randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase();
    const { data: classroom, error } = await context.supabase.from('classrooms').insert({ owner_id: context.userId, title: data.title, team_count: data.teamCount, code }).select().single();
    if (error || !classroom) throw new Error('Không tạo được lớp học');
    // Verified owner just created this room; privileged insert generates secret team capabilities.
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const invitations = await Promise.all(Array.from({ length: data.teamCount }, async (_, i) => {
      const key = crypto.randomUUID().replaceAll('-', '').slice(0, 24);
      return { number: i + 1, key, access_hash: await hash(key) };
    }));
    const { error: teamError } = await supabaseAdmin.from('classroom_teams').insert(invitations.map(i => ({ classroom_id: classroom.id, number: i.number, access_hash: i.access_hash })));
    if (teamError) throw new Error('Không tạo được tổ');
    return { classroom, invitations: invitations.map(({ number, key }) => ({ number, key })) };
  });
export const beginAssignment = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ roomId: z.string().uuid() })).handler(async ({ data, context }) => {
    const { data: startedAt, error } = await context.supabase.rpc('begin_classroom_assignment', { room_id: data.roomId });
    if (error || !startedAt) throw new Error('Không bắt đầu được bài làm');
    return { startedAt };
  });
export const studentRoom = createServerFn({ method: 'POST' }).inputValidator(accessSchema).handler(async ({ data }) => {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: room } = await supabaseAdmin.from('classrooms').select().eq('code', data.code.toUpperCase()).maybeSingle();
  if (!room) throw new Error('Mã lớp không đúng');
  const { data: team } = await supabaseAdmin.from('classroom_teams').select().eq('classroom_id', room.id).eq('number', data.number).maybeSingle();
  if (!team || (team.access_hash !== await hash(data.key) && data.key !== await codeJoinKey(room.id, team.access_hash))) throw new Error('Thông tin tham gia không hợp lệ');
  let released: { number: number; answers: string[]; submitted_at: string | null; timings: Timing[] }[] = [];
  if (mayReadOtherAnswers(room.answers_visible)) {
    const { data: rows } = await supabaseAdmin.from('classroom_teams').select('number,answers,submitted_at,timings').eq('classroom_id', room.id).order('number');
    released = (rows ?? []).map(r => ({ ...r, answers: r.answers as string[], timings: normalizeTimings(r.timings) }));
  }
  return { room: { id: room.id, code: room.code, title: room.title, started_at: room.started_at, current_step: room.current_step, closed: room.closed, answers_visible: room.answers_visible, correct_visible: room.correct_visible }, team: { number: team.number, answers: team.answers as string[], step: team.step, submitted_at: team.submitted_at, timings: normalizeTimings(team.timings) }, released, serverNow: Date.now() };
});
async function verifiedTeam(data: z.infer<typeof accessSchema>) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: room } = await supabaseAdmin.from('classrooms').select('id,closed,started_at').eq('code', data.code.toUpperCase()).maybeSingle();
  if (!room || room.closed) throw new Error('Lớp học đã đóng');
  if (!assignmentStarted(room.started_at, Date.now())) throw new Error('Chờ giáo viên bắt đầu giao bài');
  const { data: team } = await supabaseAdmin.from('classroom_teams').select().eq('classroom_id', room.id).eq('number', data.number).maybeSingle();
  if (!team || (team.access_hash !== await hash(data.key) && data.key !== await codeJoinKey(room.id, team.access_hash)) || !canEdit(team.submitted_at)) throw new Error('Bài đã nộp hoặc thông tin tham gia không đúng');
  return { supabaseAdmin, team, room };
}
/** Starts a question's 30s clock once; repeated calls (reload, reconnect) keep the original server timestamp. */
export const startQuestion = createServerFn({ method: 'POST' }).inputValidator(accessSchema.extend({ step: z.number().int().min(0).max(2) })).handler(async ({ data }) => {
  const { supabaseAdmin, team, room } = await verifiedTeam(data);
  const timings = normalizeTimings(team.timings);
  if (!canStart(timings, data.step)) throw new Error('Hãy hoàn thành câu trước');
  if (!timingAt(timings, data.step).started_at) {
    timingAt(timings, data.step).started_at = data.step === 0 ? room.started_at : new Date().toISOString();
    const { error } = await supabaseAdmin.from('classroom_teams').update({ timings, step: data.step }).eq('id', team.id).is('submitted_at', null);
    if (error) throw new Error('Không bắt đầu được câu hỏi');
  }
  return { timings };
});
export const saveStudent = createServerFn({ method: 'POST' }).inputValidator(accessSchema.extend({ step: z.number().int().min(0).max(2), answer: z.string().max(4000), submit: z.boolean() })).handler(async ({ data }) => {
  const { supabaseAdmin, team } = await verifiedTeam(data);
  const timings = normalizeTimings(team.timings);
  const timing = timingAt(timings, data.step);
  if (!timing.started_at) throw new Error('Câu hỏi chưa bắt đầu');
  if (timing.ended_at) throw new Error('Câu hỏi đã kết thúc');
  const now = Date.now();
  const answers = [0, 1, 2].map(i => ((team.answers as string[])[i] ?? ''));
  // Late answers (past deadline + network grace) are discarded; an empty answer is stored as unanswered.
  if (acceptsAnswer(timing.started_at, now)) answers[data.step] = data.answer.trim();
  timing.ended_at = endTime(timing.started_at, now);
  const { error } = await supabaseAdmin.from('classroom_teams').update({ answers, timings, step: Math.min(data.step + 1, 2), submitted_at: data.submit ? new Date(now).toISOString() : null }).eq('id', team.id).is('submitted_at', null);
  if (error) throw new Error('Không lưu được bài');
  return { success: true };
});
