import { useEffect, useState } from 'react';
import Drawer from '../../components/ui/Drawer.jsx';
import { ACCOUNT_TRANSITIONS, formatAccountValue } from './accountUtils.js';

const INPUT_CLASS =
  'mt-1 w-full rounded-md border border-tertiary-200 px-2.5 py-1.5 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100';

/**
 * RHS drawer to advance an account through allowed lead stages.
 *
 * Args:
 *   account: Account with at least id and stage.
 *   open: Whether the drawer is visible.
 *   error: Optional API error message.
 *   saving: Disable controls while the stage POST is in flight.
 *   onClose: Close handler.
 *   onMove: Called with the stage-change body ({ to_stage, reason?, meeting_*? }).
 */
export default function AccountStageMoveDrawer({
  account,
  open,
  error,
  saving,
  onClose,
  onMove,
  preferredToStage = '',
}) {
  const stages = ACCOUNT_TRANSITIONS[account?.stage] || [];
  const [toStage, setToStage] = useState(stages[0] || '');
  const [reason, setReason] = useState('');
  const [meetingMode, setMeetingMode] = useState('online');
  const [meetingDate, setMeetingDate] = useState('');

  useEffect(() => {
    if (!open) return;
    const preferred = preferredToStage && stages.includes(preferredToStage) ? preferredToStage : stages[0] || '';
    setToStage(preferred);
    setReason('');
    setMeetingMode('online');
    setMeetingDate('');
  }, [open, account?.stage, preferredToStage]); // eslint-disable-line react-hooks/exhaustive-deps

  function submit(event) {
    event.preventDefault();
    const body = { to_stage: toStage };
    if (toStage === 'dropped') body.reason = reason.trim();
    if (toStage === 'meeting_scheduled') {
      body.meeting_mode = meetingMode;
      body.meeting_date = new Date(meetingDate).toISOString();
    }
    onMove(body);
  }

  if (!account) return null;

  return (
    <Drawer
      open={open}
      title="Move account stage"
      onClose={() => !saving && onClose()}
      size="sm"
      tone="edit"
      footer={
        <>
          <button type="button" form="account-stage-form" onClick={onClose} disabled={saving} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" form="account-stage-form" disabled={saving || !toStage} className="btn-primary">
            {saving ? 'Moving…' : 'Move stage'}
          </button>
        </>
      }
    >
      <form id="account-stage-form" onSubmit={submit} className="space-y-3">
        <p className="text-xs text-tertiary-500">Current stage: {formatAccountValue(account.stage)}</p>
        {error && (
          <div className="rounded-lg border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div>
        )}
        <label className="block text-xs font-medium text-tertiary-600">
          Next stage
          <select
            required
            value={toStage}
            onChange={(event) => setToStage(event.target.value)}
            className={`${INPUT_CLASS} capitalize`}
          >
            {stages.map((stage) => (
              <option key={stage} value={stage}>
                {formatAccountValue(stage)}
              </option>
            ))}
          </select>
        </label>
        {toStage === 'meeting_scheduled' && (
          <>
            <label className="block text-xs font-medium text-tertiary-600">
              Meeting mode
              <select
                required
                value={meetingMode}
                onChange={(event) => setMeetingMode(event.target.value)}
                className={INPUT_CLASS}
              >
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-tertiary-600">
              Meeting date and time
              <input
                required
                type="datetime-local"
                value={meetingDate}
                onChange={(event) => setMeetingDate(event.target.value)}
                className={INPUT_CLASS}
              />
            </label>
          </>
        )}
        {toStage === 'dropped' && (
          <label className="block text-xs font-medium text-tertiary-600">
            Reason
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={INPUT_CLASS}
            />
          </label>
        )}
      </form>
    </Drawer>
  );
}
