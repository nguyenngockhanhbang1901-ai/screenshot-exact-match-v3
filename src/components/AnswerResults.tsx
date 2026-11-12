import { lazy, Suspense } from 'react';
import { cases, type CaseIndex } from '@/lib/geometry';
import { durationSeconds, type Timing } from '@/lib/timer';
const GeometryView = lazy(() => import('./GeometryView'));
export const QUESTION_TEXT = 'Quan sát và em hãy cho biết đường thẳng d và mặt phẳng (P) có bao nhiêu điểm chung?';
const clock = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleTimeString('vi-VN') : '—';
export function AnswerResults({ teams, correct }: { teams: { number: number; answers: string[]; submitted_at: string | null; timings: Timing[] }[]; correct: boolean }) {
  return <div className="results-grid">{cases.map((item, i) => <section key={item.formula}>
    <p className="eyebrow">Câu {i + 1}</p>
    <Suspense fallback={<div className="geometry-view compact" />}><GeometryView index={i as CaseIndex} compact /></Suspense>
    <h3>{QUESTION_TEXT}</h3>
    {correct && <div className="correct-answer">{item.formula}<br />{item.answer}</div>}
    {[...teams].sort((a,b) => a.number - b.number).map(t => { const tm = t.timings[i]; const d = durationSeconds(tm); return <div className="result-answer" key={t.number}><strong>Tổ {t.number} <span className="status">{t.submitted_at ? 'Đã nộp' : 'Chưa nộp'}</span></strong>{t.answers[i]?.trim() || (tm?.ended_at ? 'Chưa trả lời' : 'Chưa có câu trả lời')}<span className="status">{d === null ? 'Chưa có thời gian' : `Thời gian trả lời: ${d}s · ${clock(tm?.started_at)} → ${clock(tm?.ended_at)}`}</span></div>; })}
  </section>)}</div>;
}
