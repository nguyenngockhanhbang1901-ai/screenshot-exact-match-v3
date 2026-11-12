import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Box, BookOpen, Users, GraduationCap, ArrowRight, ChevronLeft, Check, LockKeyhole, Plus, Copy, Eye, EyeOff, LogOut, CircleHelp, Play, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { cases, type CaseIndex } from '@/lib/geometry';
import { createClassroom, findClassroom, joinClassroom, studentRoom, saveStudent, startQuestion, beginAssignment } from '@/lib/classroom.functions';
import { canStart, normalizeTimings, remainingMs, timerTone, timingAt } from '@/lib/timer';
import { assignmentStarted } from '@/lib/assignment';
import { useClassroomAuth } from '@/hooks/use-classroom-auth';
import { AnswerResults, QUESTION_TEXT } from './AnswerResults';
const GeometryView = lazy(() => import('./GeometryView'));
type Access = { code: string; number: number; key: string };
type StudentData = Awaited<ReturnType<typeof studentRoom>>;
type Room = Tables<'classrooms'>;
type Team = Tables<'classroom_teams'>;
export default function Classroom() {
  const [entered, setEntered] = useState(false);
  const [joinInfo, setJoinInfo] = useState<{ title: string; numbers: number[] } | null>(null);
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [index, setIndex] = useState<CaseIndex>(0);
  const [answers, setAnswers] = useState(['','','']);
  const [dialog, setDialog] = useState<'join' | 'create' | null>(null);
  const [code, setCode] = useState(''); const [number, setNumber] = useState(1); const [key, setKey] = useState('');
  const [title, setTitle] = useState('Đường thẳng và mặt phẳng'); const [teamCount, setTeamCount] = useState(4);
  const [access, setAccess] = useState<Access | null>(null); const [student, setStudent] = useState<StudentData | null>(null);
  const [room, setRoom] = useState<Room | null>(null); const [rooms, setRooms] = useState<Room[]>([]); const [teams, setTeams] = useState<Team[]>([]);
  const [invitations, setInvitations] = useState<{ number: number; key: string }[]>([]);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [saved, setSaved] = useState(false); const [help, setHelp] = useState(false);
  const user = useClassroomAuth(); const navigate = useNavigate(); const queryClient = useQueryClient();
  const create = useServerFn(createClassroom); const fetchStudent = useServerFn(studentRoom); const save = useServerFn(saveStudent); const start = useServerFn(startQuestion);
  const begin = useServerFn(beginAssignment);
  const find = useServerFn(findClassroom); const joinByCode = useServerFn(joinClassroom);
  const [now, setNow] = useState(() => Date.now()); const [offset, setOffset] = useState(0); const expiring = useRef(false);
  useEffect(() => { const p = new URLSearchParams(window.location.search); if (p.get('code')) { setCode(p.get('code') ?? ''); setKey(p.get('key') ?? ''); setNumber(Number(p.get('team') ?? '1')); } }, []);
  const refreshTeacher = useCallback(async () => {
    if (!user) return;
    const { data: all } = await supabase.from('classrooms').select().order('created_at', { ascending: false }); setRooms(all ?? []);
    if (room) {
      const { data: updated } = await supabase.from('classrooms').select().eq('id', room.id).single(); if (updated) setRoom(updated);
      const { data: rows } = await supabase.from('classroom_teams').select().eq('classroom_id', room.id).order('number'); setTeams(rows ?? []);
    }
  }, [user, room?.id]);
  useEffect(() => { void refreshTeacher(); }, [refreshTeacher]);
  useEffect(() => {
    if (!room || !user) return;
    const onChange = () => { void refreshTeacher().catch(() => {}); };
    const channel = supabase.channel(`teacher-${room.id}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classroom_teams', filter: `classroom_id=eq.${room.id}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classrooms', filter: `id=eq.${room.id}` }, onChange).subscribe();
    const poll = window.setInterval(onChange, 2000);
    window.addEventListener('focus', onChange);
    return () => { window.clearInterval(poll); window.removeEventListener('focus', onChange); void supabase.removeChannel(channel); };
  }, [room?.id, user, refreshTeacher]);
  useEffect(() => {
    if (!access) return;
    // Capability-only students cannot subscribe to private table rows; fetch sanitized state periodically.
    const timer = window.setInterval(() => { void refresh(access).catch(() => {}); }, 1000);
    return () => window.clearInterval(timer);
  }, [access, fetchStudent]);
  useEffect(() => { if (!access) return; const t = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(t); }, [access]);
  async function refresh(a: Access) { const d = await fetchStudent({ data: a }); setOffset(d.serverNow - Date.now()); setStudent(d); return d; }
  async function ensureStarted(a: Access, d: StudentData, step: number) {
    if (!assignmentStarted(d.room.started_at, d.serverNow) || d.team.submitted_at || d.room.closed || timingAt(d.team.timings, step).started_at || !canStart(d.team.timings, step)) return d;
    await start({ data: { ...a, step } }); return refresh(a);
  }
  const timings = student?.team.timings ?? normalizeTimings([]);
  const currentStep = student?.team.step ?? 0;
  const currentTiming = timingAt(timings, currentStep);
  const serverNow = now + offset;
  const currentRemaining = remainingMs(currentTiming.started_at, serverNow);
  const released = assignmentStarted(student?.room.started_at, serverNow);
  const waiting = role === 'student' && Boolean(access) && !released;
  const running = Boolean(released && access && currentTiming.started_at && !currentTiming.ended_at && !student?.team.submitted_at && !student?.room.closed);
  const editable = running && index === currentStep && currentRemaining > 0;
  useEffect(() => {
    // Time is up: lock input and persist (empty = unanswered). Server caps the end time at the deadline.
    if (!access || !running || currentRemaining > 0 || expiring.current) return;
    expiring.current = true;
    void save({ data: { ...access, step: currentStep, answer: answers[currentStep] ?? '', submit: currentStep === 2 } }).catch(() => {}).then(() => refresh(access)).catch(() => {}).finally(() => { expiring.current = false; });
  }, [access, running, currentRemaining, currentStep]);
  async function action(fn: () => Promise<void>) { setBusy(true); setError(''); try { await fn(); } catch(e) { setError(e instanceof Error ? e.message : 'Có lỗi xảy ra'); } finally { setBusy(false); } }
  async function lookup() { await action(async () => { const info = await find({ data: { code } }); setJoinInfo(info); if (!info.numbers.includes(number)) setNumber(info.numbers[0] ?? 1); }); }
  async function join() { await action(async () => { const a = key ? { code: code.toUpperCase().trim(), number, key: key.trim() } : await joinByCode({ data: { code, number } }); let data = await refresh(a); setAccess(a); setAnswers([0,1,2].map(i => data.team.answers[i] ?? '')); setIndex(data.team.step as CaseIndex); setRole('student'); setDialog(null); setEntered(true); data = await ensureStarted(a, data, data.team.step); }); }
  async function releaseAssignment() { if (!room) return; await action(async () => { const result = await begin({ data: { roomId: room.id } }); setRoom({ ...room, started_at: result.startedAt }); await refreshTeacher(); }); }
  async function makeRoom() { await action(async () => { const result = await create({ data: { title, teamCount } }); setRoom(result.classroom); setInvitations(result.invitations); setDialog(null); }); }
  async function updateRoom(patch: Partial<Room>) { if (!room) return; await action(async () => { const { error: err } = await supabase.from('classrooms').update(patch).eq('id', room.id); if (err) throw err; setRoom({ ...room, ...patch }); }); }
  async function next() {
    if (!access) { setDialog('join'); return; }
    if (!released) return;
    await action(async () => { if (index === currentStep && running) await save({ data: { ...access, step: index, answer: answers[index] ?? '', submit: index === 2 } }); let data = await refresh(access); if (index < 2) { data = await ensureStarted(access, data, index + 1); setIndex((index + 1) as CaseIndex); } setSaved(true); });
  }
  async function copyInvitation(n: number) { await action(async () => { const url = new URL(window.location.origin); url.searchParams.set('code', room?.code ?? ''); url.searchParams.set('team', String(n)); await navigator.clipboard.writeText(url.toString()); setSaved(true); }); }
  const results = role === 'teacher' ? Boolean(room?.answers_visible) : Boolean(student?.room.answers_visible);
  const locked = Boolean(student?.team.submitted_at || student?.room.closed);
  if (!entered) return <>
    <header className="app-header"><div className="brand"><span className="brand-symbol"><Box size={24} /></span><div>Hình học 3D<small>Lớp học hình học không gian</small></div></div></header>
    <main className="entry-workspace">
      <div className="entry-heading"><p className="eyebrow">Toán học 11</p><h1>Hình học 3D</h1><p>Đường thẳng và mặt phẳng</p></div>
      <div className="entry-columns">
        <section className="entry-section"><GraduationCap className="text-primary" size={32} /><h2>Giáo viên</h2><Button className="w-full" onClick={() => { if (user) { setRole('teacher'); setEntered(true); } else void navigate({ to: '/auth' }); }}>{user ? 'Vào lớp học của tôi' : 'Đăng nhập giáo viên'}<ArrowRight /></Button></section>
        <section className="entry-section"><Users className="text-success" size={32} /><h2>Học sinh</h2><form className="form-stack" onSubmit={e => { e.preventDefault(); if (joinInfo) void join(); else void lookup(); }}>
          <label>Mã lớp<Input required minLength={4} maxLength={12} autoComplete="off" placeholder="Nhập mã lớp" value={code} onChange={e => { setCode(e.target.value); setKey(''); setJoinInfo(null); setError(''); }} /></label>
          {joinInfo && <><p>{joinInfo.title}</p><label>Chọn tổ<select aria-label="Chọn tổ" className="entry-select" value={number} onChange={e => setNumber(Number(e.target.value))}>{joinInfo.numbers.map(n => <option key={n} value={n}>Tổ {n}</option>)}</select></label></>}
          {error && <p className="error-note" role="alert">{error}</p>}
          <Button disabled={busy} type="submit" variant="outline">{busy ? 'Đang xử lý…' : joinInfo ? 'Vào lớp học' : 'Tham gia lớp học'}<ArrowRight /></Button>
        </form></section>
      </div>
    </main>
  </>;
  return <>
    <header className="app-header"><div className="brand"><span className="brand-symbol"><Box size={24} strokeWidth={1.7} /></span><div>Hình học 3D<small>Không gian khám phá · Kết nối tri thức</small></div></div>
      <div className="flex items-center gap-2"><Button variant="ghost" size="sm" onClick={() => { setEntered(false); setJoinInfo(null); setError(''); }}><ChevronLeft />Trang chủ</Button><Button variant="ghost" size="icon" title="Trợ giúp" aria-label="Trợ giúp" onClick={() => setHelp(true)}><CircleHelp /></Button>{user ? <Button variant="ghost" size="sm" onClick={() => { void action(async () => { await queryClient.cancelQueries(); queryClient.clear(); await supabase.auth.signOut(); await navigate({ to: '/auth', replace: true }); }); }}><LogOut />Đăng xuất</Button> : <Button variant="outline" size="sm" onClick={() => { void navigate({ to: '/auth' }); }}><GraduationCap />Đăng nhập</Button>}</div>
    </header>
    <main className="workspace"><div className="eyebrow flex items-center gap-2"><BookOpen size={13} />Toán học 11 <span className="text-muted-foreground">/</span> Hình học không gian</div>
      <div className="lesson-heading"><div><h1>Đường thẳng và mặt phẳng</h1><p>Khám phá vị trí tương đối trong không gian</p></div>{user && <div className="role-switch"><Button variant="ghost" className={role === 'student' ? 'active' : ''} onClick={() => setRole('student')}><Users />Học sinh</Button><Button variant="ghost" className={role === 'teacher' ? 'active' : ''} onClick={() => setRole('teacher')}><GraduationCap />Giáo viên</Button></div>}</div>
      {role === 'teacher' ? <div className="teacher-strip"><strong>{room ? `${room.title} · Mã lớp ${room.code}` : 'Lớp học của bạn'}</strong>{!user ? <Button onClick={() => { void navigate({ to: '/auth' }); }}>Đăng nhập để tạo lớp<ArrowRight /></Button> : <><select aria-label="Chọn lớp" className="bg-background border border-input rounded-md p-2 text-xs" value={room?.id ?? ''} onChange={e => { setRoom(rooms.find(r => r.id === e.target.value) ?? null); setInvitations([]); }}><option value="">Chọn lớp học</option>{rooms.map(r => <option key={r.id} value={r.id}>{r.title} · {r.code}</option>)}</select><Button onClick={() => setDialog('create')} size="sm"><Plus />Tạo lớp</Button>{room && <><Button size="sm" disabled={busy || room.closed || Boolean(room.started_at)} onClick={() => { void releaseAssignment(); }}><Play />{room.started_at ? 'Đã bắt đầu giao bài' : 'Bắt đầu giao bài'}</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => { void updateRoom({ answers_visible: !room.answers_visible }); }}>{room.answers_visible ? <EyeOff /> : <Eye />}{room.answers_visible ? 'Ẩn bài làm' : 'SHOW ANSWER'}</Button><Button size="sm" variant="outline" onClick={() => { void updateRoom({ correct_visible: !room.correct_visible }); }}>{room.correct_visible ? 'Ẩn đáp án' : 'Hiện đáp án đúng'}</Button><Button size="sm" variant="outline" onClick={() => { void updateRoom({ closed: !room.closed }); }}>{room.closed ? 'Mở lại lớp' : 'Đóng lớp'}</Button></>}</>}</div> : <div className="flex justify-end mb-4"><Button variant="outline" size="sm" onClick={() => setDialog('join')}><Users />{student ? `${student.room.code} · Tổ ${student.team.number}` : 'Tham gia lớp học'}<ArrowRight /></Button></div>}
      {error && <p role="alert" className="error-note mb-4">{error}</p>}
      {waiting ? <section className="py-16 text-center border-y border-border"><Clock size={36} className="mx-auto mb-4 text-primary" /><h2 className="text-2xl font-semibold">{student?.room.closed ? 'Lớp học đã đóng' : 'Chờ giáo viên bắt đầu giao bài'}</h2><p className="mt-3 text-muted-foreground">{student?.room.title} · Tổ {student?.team.number}</p></section> : results ? <><div className="model-heading"><h2>Câu trả lời của các tổ</h2><span className="badge">Đã công bố</span></div><AnswerResults teams={role === 'teacher' ? teams.map(t => ({ ...t, answers: t.answers as string[], timings: normalizeTimings(t.timings) })) : student?.released ?? []} correct={role === 'teacher' ? Boolean(room?.correct_visible) : Boolean(student?.room.correct_visible)} /></> : <div className="lesson-layout">
        <aside className="sidebar"><p className="side-label">NỘI DUNG BÀI HỌC</p><nav className="case-navigation">{cases.map((c,i) => <Button key={c.title} variant="ghost" className={`case-button ${index === i ? 'selected' : ''}`} disabled={role === 'student' && Boolean(access) && i > currentStep} onClick={() => { setIndex(i as CaseIndex); setSaved(false); if (role === 'teacher' && room) void updateRoom({ current_step: i }); }}><span className="case-number">{i + 1}</span><span><strong>Câu {i + 1}</strong></span></Button>)}</nav><div className="side-note"><BookOpen size={19} className="text-primary" /><h3>Góc kiến thức</h3><p>Một đường thẳng và một mặt phẳng có thể có một, không có hoặc vô số điểm chung.</p></div>
        {role === 'teacher' && room && <div className="team-list"><p className="side-label">CÁC TỔ · {teams.filter(t => t.submitted_at).length}/{room.team_count} ĐÃ NỘP</p>{teams.map(t => <div className="team-row" key={t.id}><span>Tổ {t.number}</span><span className={`status ${t.submitted_at ? 'success' : ''}`}>{t.submitted_at ? <><Check size={12} />Đã nộp</> : room.started_at ? 'Đang làm' : 'Chờ giao bài'}</span><Button variant="ghost" size="icon" title={`Sao chép link Tổ ${t.number}`} aria-label={`Sao chép link Tổ ${t.number}`} onClick={() => { void copyInvitation(t.number); }}><Copy /></Button></div>)}</div>}</aside>
        <section><div className="model-heading"><h2>Câu {index + 1}</h2>{role === 'student' && access ? (timingAt(timings, index).ended_at || student?.team.submitted_at && !timingAt(timings, index).started_at ? <span className="question-timer ended">Đã kết thúc</span> : timingAt(timings, index).started_at ? (() => { const ms = index === currentStep ? currentRemaining : 0; return <span role="timer" aria-label="Thời gian còn lại" className={`question-timer ${timerTone(ms)}`}>00:{String(Math.ceil(ms / 1000)).padStart(2, '0')}</span>; })() : <span className="question-timer ended">00:30</span>) : <span className="badge">Mô hình 3D</span>}</div><Suspense fallback={<div className="geometry-view" />}><GeometryView index={index} /></Suspense>
          <div className="question-section"><p className="eyebrow">QUAN SÁT & SUY LUẬN</p><h3>{QUESTION_TEXT}</h3>
          {role === 'student' ? <Textarea aria-label="Câu trả lời của tổ" className="answer-field" placeholder="Nhập câu trả lời của tổ em…" value={answers[index]} disabled={Boolean(access) ? !editable || busy : busy} onChange={e => { const next = [...answers]; if (access && !editable) return; next[index] = e.target.value; setAnswers(next); setSaved(false); }} /> : <div className="correct-answer">{cases[index].formula}<br />{cases[index].answer}</div>}
          {role === 'student' && student?.room.correct_visible && <div className="correct-answer">{cases[index].answer}</div>}
          <div className="action-row"><span className={`status ${saved || student?.team.submitted_at ? 'success' : ''}`}>{locked ? <><LockKeyhole size={13} />{student?.team.submitted_at ? 'Đã nộp bài · Không thể sửa' : 'Lớp học đã đóng'}</> : access && timingAt(timings, index).ended_at ? <><LockKeyhole size={13} />{(student?.team.answers[index] ?? '').trim() ? 'Đã lưu câu trả lời' : 'Hết giờ · Chưa trả lời'}</> : saved ? <><Check size={13} />Đã lưu</> : <><LockKeyhole size={13} />{access ? 'Bài được lưu khi bấm NEXT' : 'Chưa tham gia lớp học'}</>}</span><div className="flex gap-2">{index > 0 && <Button variant="outline" onClick={() => setIndex((index - 1) as CaseIndex)}><ChevronLeft />Quay lại</Button>}{role === 'student' ? <Button disabled={busy || Boolean(student?.room.closed) || (index === 2 && (locked || Boolean(timingAt(timings, 2).ended_at))) || (editable && !(answers[index] ?? '').trim())} onClick={() => { void next(); }}>{busy ? 'Đang lưu…' : index === 2 ? 'Nộp bài' : 'NEXT · Câu tiếp theo'}<ArrowRight /></Button> : <Button disabled={index === 2 || busy} onClick={() => { setIndex((index + 1) as CaseIndex); if (room) void updateRoom({ current_step: index + 1 }); }}>Tiếp theo<ArrowRight /></Button>}</div></div></div>
        </section></div>}
      {role === 'teacher' && room && !results && <section className="mt-8 border-t border-border pt-6"><div className="model-heading"><h2>Bài làm của các tổ</h2><span className="badge">{teams.filter(t => t.submitted_at).length}/{room.team_count} đã nộp</span></div><AnswerResults teams={teams.map(t => ({ ...t, answers: t.answers as string[], timings: normalizeTimings(t.timings) }))} correct={Boolean(room.correct_visible)} /></section>}
      <footer className="app-footer"><span>HÌNH HỌC 3D <span>·</span> Lớp học tương tác</span><span>Đường thẳng & mặt phẳng <span>·</span> 3 câu</span></footer>
    </main>
    <Dialog open={dialog !== null} onOpenChange={open => { if (!open) { setDialog(null); setError(''); } }}><DialogContent><DialogTitle>{dialog === 'join' ? 'Tham gia lớp học' : 'Tạo lớp học mới'}</DialogTitle><DialogDescription>{dialog === 'join' ? 'Mã lớp do giáo viên cung cấp.' : 'Tạo buổi học cho các tổ.'}</DialogDescription><form className="form-stack" onSubmit={e => { e.preventDefault(); if (dialog === 'join') { if (joinInfo) void join(); else void lookup(); } else void makeRoom(); }}>{dialog === 'join' ? <><label>Mã lớp<Input value={code} onChange={e => { setCode(e.target.value); setKey(''); setJoinInfo(null); }} required minLength={4} maxLength={12} placeholder="Nhập mã lớp" /></label>{joinInfo && <label>Chọn tổ<select aria-label="Chọn tổ" className="entry-select" value={number} onChange={e => setNumber(Number(e.target.value))}>{joinInfo.numbers.map(n => <option key={n} value={n}>Tổ {n}</option>)}</select></label>}</> : <><label>Tên lớp / buổi học<Input value={title} onChange={e => setTitle(e.target.value)} required /></label><label>Số tổ (tối đa 10)<Input type="number" min={1} max={10} value={teamCount} onChange={e => setTeamCount(Number(e.target.value))} required /></label></>}{error && <p className="error-note" role="alert">{error}</p>}<Button disabled={busy} type="submit">{busy ? 'Đang xử lý…' : dialog === 'join' ? joinInfo ? 'Vào lớp học' : 'Tham gia lớp học' : 'Tạo lớp học'}<ArrowRight /></Button></form></DialogContent></Dialog>
    <Dialog open={help} onOpenChange={setHelp}><DialogContent><DialogTitle>Thông tin lớp học</DialogTitle><DialogDescription>Giáo viên cung cấp mã lớp. Học sinh nhập mã và chọn tổ, không cần tài khoản hay mã truy cập tổ. Các tổ nộp bài trước khi giáo viên công bố kết quả.</DialogDescription></DialogContent></Dialog>
  </>;
}