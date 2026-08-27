import { useState } from 'react';
import apiClient from '../lib/apiClient.js';
import { useAlerts } from '../lib/alerts/alertContext.jsx';
import Modal from './ui/Modal.jsx';

export default function ChangePasswordModal({ open, onClose }) {
  const { pushError, pushSuccess } = useAlerts();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function submit(event) {
    event.preventDefault();

    if (newPassword.length < 8) {
      pushError('New password must be at least 8 characters', 'Validation');
      return;
    }
    if (newPassword !== confirmPassword) {
      pushError('New password and confirmation do not match', 'Validation');
      return;
    }

    setSaving(true);
    try {
      await apiClient.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      pushSuccess('Password updated');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      pushError(err.response?.data?.message || 'Could not change password', 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Change password"
      onClose={handleClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={handleClose}>
            Close
          </button>
          <button type="submit" form="change-password-form" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Update password'}
          </button>
        </>
      }
    >
      <form id="change-password-form" className="space-y-3" onSubmit={submit}>
        <div>
          <label className="mb-1 block text-xs font-medium text-tertiary-500">Current password</label>
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-tertiary-500">New password</label>
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
            minLength={8}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-tertiary-500">Confirm new password</label>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
            minLength={8}
            required
          />
        </div>
      </form>
    </Modal>
  );
}
