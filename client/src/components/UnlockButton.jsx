import { useState } from 'react';
import apiClient from '../lib/apiClient.js';
import Drawer from './ui/Drawer.jsx';
import Tooltip from './ui/Tooltip.jsx';

function apiErrorMessage(error, fallback) {
  return error.response?.data?.errors?.[0]?.message || error.response?.data?.message || fallback;
}

/**
 * Admin-only unlock for account | requirement | seat | submission.
 * POST /admin/:entity_type/:entity_id/unlock { reason }
 */
export default function UnlockButton({ entityType, entityId, onUnlocked, label = 'Unlock' }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (!reason.trim()) return;
    setSaving(true);
    setError('');
    try {
      await apiClient.post(`/admin/${entityType}/${entityId}/unlock`, { reason: reason.trim() });
      setOpen(false);
      setReason('');
      onUnlocked?.();
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Failed to unlock'));
    } finally {
      setSaving(false);
    }
  }

  function close() {
    if (saving) return;
    setOpen(false);
    setError('');
  }

  return (
    <>
      <Tooltip label="Admin only — reopens this locked record for editing (reason required)">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-secondary border-amber-300 text-amber-800 hover:bg-amber-50"
        >
          {label}
        </button>
      </Tooltip>

      <Drawer
        open={open}
        title="Unlock record"
        tone="edit"
        size="sm"
        onClose={close}
        footer={
          <>
            <button type="button" onClick={close} className="btn-secondary" disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="unlock-form" className="btn-primary" disabled={saving || !reason.trim()}>
              {saving ? 'Unlocking…' : 'Unlock'}
            </button>
          </>
        }
      >
        <form id="unlock-form" onSubmit={submit} className="space-y-3">
          <p className="text-xs text-tertiary-500">Admin only. Reason is required and written to stage history.</p>
          {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <label className="block text-xs font-medium text-tertiary-600">
            Reason
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              placeholder="Why is this record being unlocked?"
            />
          </label>
        </form>
      </Drawer>
    </>
  );
}
