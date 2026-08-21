import { useState } from 'react';
import apiClient from '../../lib/apiClient.js';
import Badge from '../../components/ui/Badge.jsx';
import Modal from '../../components/ui/Modal.jsx';

const ROUND_TYPES = [
  { value: 'internal', label: 'Internal (recruiter)' },
  { value: 'client_l1', label: 'Client L1' },
  { value: 'client_l2', label: 'Client L2' },
  { value: 'client_hr', label: 'Client HR' },
  { value: 'client_final', label: 'Client final' },
];

const RESULTS = ['pending', 'pass', 'fail', 'no_show', 'rescheduled'];

const emptyForm = {
  round_type: 'internal',
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
    round_type: round.round_type || 'internal',
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
  const payload = {
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
  return payload;
}

export default function InterviewRoundsPanel({ submissionId, rounds, canEdit, onChanged }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
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
    <section className="rounded-lg border bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-tertiary-800">Interview rounds</h2>
        {canEdit && (
          <button type="button" className="btn-primary text-xs" onClick={openCreate}>
            + Add round
          </button>
        )}
      </div>

      {(rounds || []).length === 0 ? (
        <p className="mt-2 text-sm text-tertiary-400">No rounds yet. Add an internal screen or client round.</p>
      ) : (
        <ul className="mt-3 divide-y text-sm">
          {rounds.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
              <div>
                <p className="font-medium text-tertiary-900">
                  #{r.round_number} {r.round_type?.replace(/_/g, ' ')}
                  {r.round_name ? ` — ${r.round_name}` : ''}
                </p>
                <p className="mt-0.5 text-xs text-tertiary-500">
                  {r.interviewer_name || 'No interviewer'}
                  {r.scheduled_at ? ` · ${new Date(r.scheduled_at).toLocaleString()}` : ''}
                </p>
                {r.feedback && <p className="mt-1 text-tertiary-600">{r.feedback}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge value={r.result || 'pending'} />
                {r.rating != null && <span className="text-xs text-tertiary-500">★ {r.rating}</span>}
                {canEdit && (
                  <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => openEdit(r)}>
                    Edit
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        wide
        title={editingId ? 'Edit interview round' : 'Add interview round'}
        onClose={() => !busy && setOpen(false)}
        footer={
          <>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={busy} onClick={save}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {!editingId && (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-tertiary-500">Round type *</label>
              <select
                value={form.round_type}
                onChange={(e) => updateField('round_type', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                {ROUND_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-tertiary-500">Round name</label>
            <input
              value={form.round_name}
              onChange={(e) => updateField('round_name', e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="e.g. Tech screen"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-tertiary-500">Scheduled at</label>
            <input
              type="datetime-local"
              value={form.scheduled_at}
              onChange={(e) => updateField('scheduled_at', e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-tertiary-500">Duration (minutes)</label>
            <input
              type="number"
              min={1}
              value={form.duration_minutes}
              onChange={(e) => updateField('duration_minutes', e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-tertiary-500">Interviewer</label>
            <input
              value={form.interviewer_name}
              onChange={(e) => updateField('interviewer_name', e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-tertiary-500">Interviewer email</label>
            <input
              type="email"
              value={form.interviewer_email}
              onChange={(e) => updateField('interviewer_email', e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-tertiary-500">Meeting link</label>
            <input
              value={form.meeting_link}
              onChange={(e) => updateField('meeting_link', e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-tertiary-500">Result</label>
            <select
              value={form.result}
              onChange={(e) => updateField('result', e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              {RESULTS.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-tertiary-500">Rating (1–10)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={form.rating}
              onChange={(e) => updateField('rating', e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-tertiary-500">Feedback</label>
            <textarea
              rows={3}
              value={form.feedback}
              onChange={(e) => updateField('feedback', e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>
      </Modal>
    </section>
  );
}
