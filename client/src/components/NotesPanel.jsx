import { useEffect, useState } from 'react';
import apiClient from '../lib/apiClient.js';

function apiErrorMessage(error, fallback) {
  return error.response?.data?.errors?.[0]?.message || error.response?.data?.message || fallback;
}

/**
 * Reusable notes thread for account | requirement | submission | profile.
 * Props: entityType, entityId, readOnly?
 */
export default function NotesPanel({ entityType, entityId, readOnly = false, title = 'Notes' }) {
  const [notes, setNotes] = useState([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadNotes() {
    if (!entityType || !entityId) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get('/comments', {
        params: { entity_type: entityType, entity_id: entityId },
      });
      setNotes(data.data || []);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Failed to load notes'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotes();
  }, [entityType, entityId]);

  async function addNote(event) {
    event.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    setError('');
    try {
      await apiClient.post('/comments', {
        entity_type: entityType,
        entity_id: entityId,
        body: body.trim(),
      });
      setBody('');
      await loadNotes();
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Failed to add note'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded border bg-white">
      <div className="border-b bg-tertiary-50 px-4 py-2">
        <h2 className="text-sm font-semibold text-tertiary-800">{title}</h2>
      </div>

      {error && <div className="border-b bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <div className="max-h-80 space-y-3 overflow-y-auto p-4">
        {loading && <p className="text-sm text-tertiary-400">Loading notes…</p>}
        {!loading && notes.length === 0 && <p className="text-sm text-tertiary-400">No notes yet.</p>}
        {!loading &&
          notes.map((note) => (
            <article key={note.id} className="rounded border bg-tertiary-50 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-tertiary-500">
                <span className="font-medium text-tertiary-800">
                  {note.user?.name || 'Unknown'}
                  {note.user?.role ? ` · ${note.user.role}` : ''}
                </span>
                <time>{new Date(note.created_at).toLocaleString()}</time>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-tertiary-800">{note.body}</p>
            </article>
          ))}
      </div>

      {!readOnly && (
        <form onSubmit={addNote} className="space-y-2 border-t p-4">
          <label className="block text-xs font-medium text-tertiary-600">
            Add a note
            <textarea
              required
              rows={3}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              placeholder="Write a note for the team…"
            />
          </label>
          <div className="flex justify-end">
            <button type="submit" disabled={saving || !body.trim()} className="btn-primary">
              {saving ? 'Saving…' : 'Add note'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
