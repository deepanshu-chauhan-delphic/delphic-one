import { useState } from 'react';
import apiClient from '../../lib/apiClient.js';
import Drawer from '../../components/ui/Drawer.jsx';
import { canManageInterviewRound, roundTypeLabel } from '../../lib/submissionStages.js';

const ROUND_TYPES = [
  { value: 'internal_r1', label: 'Internal Round 1', color: 'bg-sky-50 text-sky-800 border-sky-200' },
  { value: 'internal_r2', label: 'Internal Round 2', color: 'bg-cyan-50 text-cyan-800 border-cyan-200' },
  { value: 'client_r1', label: 'Client Round 1', color: 'bg-violet-50 text-violet-800 border-violet-200' },
  { value: 'client_r2', label: 'Client Round 2', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  { value: 'client_r3', label: 'Client Round 3', color: 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200' },
  { value: 'hr_cto_ceo', label: 'HR, CTO & CEO Round', color: 'bg-amber-50 text-amber-900 border-amber-200' },
];

const RESULT_COLORS = {
  pending: 'bg-tertiary-100 text-tertiary-700',
  pass: 'bg-success-50 text-success-700',
  fail: 'bg-danger-50 text-danger-700',
  no_show: 'bg-warning-50 text-warning-800',
  rescheduled: 'bg-sky-50 text-sky-800',
};

const RESULTS = ['pending', 'pass', 'fail', 'no_show', 'rescheduled'];

const emptyForm = {
  round_type: 'internal_r1',
  round_name: '',
  scheduled_at: '',
  duration_minutes: '60',
  interviewer_name: '',
  interviewer_email: '',
  meeting_link: '',
  result: 'pending',
  feedback: '',
  rating: '',
};

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value) {
  if (!value) return undefined;
  return new Date(value).toISOString();
}

function hydrate(round) {
  return {
    round_type: round.round_type || 'internal_r1',
    round_name: round.round_name || '',
    scheduled_at: toLocalInput(round.scheduled_at),
    duration_minutes: round.duration_minutes != null ? String(round.duration_minutes) : '',
    interviewer_name: round.interviewer_name || '',
    interviewer_email: round.interviewer_email || '',
    meeting_link: round.meeting_link || '',
    result: round.result || 'pending',
    feedback: round.feedback || '',
    rating: round.rating != null ? String(round.rating) : '',
  };
}

function buildPayload(form) {
  return {
    round_type: form.round_type,
    round_name: form.round_name.trim() || undefined,
    scheduled_at: fromLocalInput(form.scheduled_at),
    duration_minutes: form.duration_minutes === '' ? undefined : Number(form.duration_minutes),
    interviewer_name: form.interviewer_name.trim() || undefined,
    interviewer_email: form.interviewer_email.trim() || '',
    meeting_link: form.meeting_link.trim() || undefined,
    result: form.result || 'pending',
    feedback: form.feedback.trim() || undefined,
    rating: form.rating === '' ? undefined : Number(form.rating),
  };
}

function roundTypeMeta(type) {
  return ROUND_TYPES.find((t) => t.value === type) || ROUND_TYPES[0];
}

export default function InterviewRoundsPanel({ submissionId, submission, rounds, user, missingMandatoryRounds, onChanged }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const locked = !!submission?.is_locked;
  const allowedRoundTypes = locked
    ? []
    : ROUND_TYPES.filter((t) => canManageInterviewRound(submission, t.value, user)).map((t) => t.value);
  const canAddAnyRound = allowedRoundTypes.length > 0;

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, round_type: allowedRoundTypes[0] || emptyForm.round_type });
    setError('');
    setOpen(true);
  }

  function openEdit(round) {
    setEditingId(round.id);
    setForm(hydrate(round));
    setError('');
    setOpen(true);
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (!form.scheduled_at) {
      setError('Interview date & time is required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = buildPayload(form);
      if (editingId) {
        const { round_type, ...patch } = payload;
        await apiClient.patch(`/interview-rounds/${editingId}`, patch);
      } else {
        await apiClient.post(`/submissions/${submissionId}/interview-rounds`, payload);
      }
      setOpen(false);
      await onChanged();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save interview round');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-sky-100 bg-sky-50/40 p-4 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-sm font-semibold text-sky-900">Interview rounds</h2>
          <p className="mt-0.5 text-xs text-sky-700/80">Each round needs an interview date when opened.</p>
        </div>
        {canAddAnyRound && (
          <button type="button" className="btn-primary text-xs" onClick={openCreate}>
            + Add round
          </button>
        )}
      </div>

      {(missingMandatoryRounds || []).length > 0 && (
        <div className="mt-3 rounded-xl border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-800">
          Missing mandatory round{missingMandatoryRounds.length > 1 ? 's' : ''}:{' '}
          {missingMandatoryRounds.map(roundTypeLabel).join(', ')}
        </div>
      )}

      {(rounds || []).length === 0 ? (
        <p className="mt-3 text-sm text-tertiary-500">No rounds yet. Add an internal screen or client round with a date.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rounds.map((r) => {
            const meta = roundTypeMeta(r.round_type);
            return (
              <li
                key={r.id}
                className={`rounded-xl border bg-white px-3 py-3 shadow-soft ${meta.color.split(' ').find((c) => c.startsWith('border-')) || 'border-tertiary-100'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-tertiary-900">
                      #{r.round_number}{' '}
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${meta.color}`}>
                        {meta.label}
                      </span>
                      {r.round_name ? ` — ${r.round_name}` : ''}
                    </p>
                    <p className="mt-1.5 text-xs text-tertiary-600">
                      <span className="font-medium text-sky-800">Interview:</span>{' '}
                      {r.scheduled_at ? new Date(r.scheduled_at).toLocaleString() : 'Date not set'}
                      {r.duration_minutes ? ` · ${r.duration_minutes} min` : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-tertiary-500">
                      {r.interviewer_name || 'No interviewer'}
                      {r.meeting_link ? (
                        <>
                          {' · '}
                          <a href={r.meeting_link} target="_blank" rel="noreferrer" className="text-primary-700 hover:underline">
                            Meeting link
                          </a>
                        </>
                      ) : null}
                    </p>
                    {r.feedback && <p className="mt-1 text-sm text-tertiary-600">{r.feedback}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RESULT_COLORS[r.result] || RESULT_COLORS.pending}`}>
                      {(r.result || 'pending').replace(/_/g, ' ')}
                    </span>
                    {r.rating != null && <span className="text-xs text-amber-700">★ {r.rating}</span>}
                    {!locked && canManageInterviewRound(submission, r.round_type, user) && (
                      <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => openEdit(r)}>
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Drawer
        open={open}
        size="md"
        tone={editingId ? 'edit' : 'create'}
        title={editingId ? 'Edit interview round' : 'Add interview round'}
        onClose={() => !busy && setOpen(false)}
        footer={
          <>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={busy} onClick={save}>
              {busy ? 'Saving…' : 'Save round'}
            </button>
          </>
        }
      >
        {error && (
          <div className="mb-3 rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-xs text-danger-700">{error}</div>
        )}
        <div className="space-y-3">
          {!editingId && (
            <label className="block text-xs font-medium text-tertiary-600">
              Round type *
              <select
                value={form.round_type}
                onChange={(e) => updateField('round_type', e.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              >
                {ROUND_TYPES.filter((t) => allowedRoundTypes.includes(t.value)).map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block text-xs font-medium text-tertiary-600">
            Round name
            <input
              value={form.round_name}
              onChange={(e) => updateField('round_name', e.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              placeholder="e.g. Tech screen"
            />
          </label>

          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
            <label className="block text-xs font-semibold text-sky-900">
              Interview date & time *
              <input
                required
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) => updateField('scheduled_at', e.target.value)}
                className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <p className="mt-1.5 text-[11px] text-sky-700">When this round is open for the candidate.</p>
          </div>

          <label className="block text-xs font-medium text-tertiary-600">
            Duration (minutes)
            <input
              type="number"
              min={1}
              value={form.duration_minutes}
              onChange={(e) => updateField('duration_minutes', e.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-xs font-medium text-tertiary-600">
            Interviewer
            <input
              value={form.interviewer_name}
              onChange={(e) => updateField('interviewer_name', e.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-xs font-medium text-tertiary-600">
            Interviewer email
            <input
              type="email"
              value={form.interviewer_email}
              onChange={(e) => updateField('interviewer_email', e.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-xs font-medium text-tertiary-600">
            Meeting link
            <input
              value={form.meeting_link}
              onChange={(e) => updateField('meeting_link', e.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-xs font-medium text-tertiary-600">
            Result
            <select
              value={form.result}
              onChange={(e) => updateField('result', e.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            >
              {RESULTS.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-tertiary-600">
            Rating (1–10)
            <input
              type="number"
              min={1}
              max={10}
              value={form.rating}
              onChange={(e) => updateField('rating', e.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-xs font-medium text-tertiary-600">
            Feedback
            <textarea
              rows={3}
              value={form.feedback}
              onChange={(e) => updateField('feedback', e.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>
        </div>
      </Drawer>
    </section>
  );
}
