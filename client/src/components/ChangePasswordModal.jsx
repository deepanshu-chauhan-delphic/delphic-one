import { useState } from 'react';
import apiClient from '../lib/apiClient.js';
import Modal from './ui/Modal.jsx';

export default function ChangePasswordModal({ open, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }

    setSaving(true);
    try {
      await apiClient.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setSuccess('Password updated');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change password');
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
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-700">{success}</p>}
      </form>
    </Modal>
  );
}
