import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';
import { canCreateSubmission, computeMarginPreview } from '../../lib/submissionStages.js';

const RATE_TYPES = ['monthly', 'hourly', 'annual'];
const CURRENCIES = ['INR', 'USD', 'AED', 'SAR'];

function toOptionalNumber(value) {
  if (value === '' || value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export default function SubmissionCreatePage({
  asPanel = false,
  onDone,
  onCancel,
  initialRequirementId = '',
  accountId = '',
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [seats, setSeats] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [benchOnly, setBenchOnly] = useState(false);

  const [form, setForm] = useState({
    profile_id: '',
    requirement_id: initialRequirementId || '',
    requirement_seat_id: '',
    proposed_rate: '',
    proposed_rate_type: 'monthly',
    proposed_rate_currency: 'INR',
    vendor_rate: '',
    vendor_rate_type: 'monthly',
    vendor_rate_currency: 'INR',
    relevancy_score: '',
    submission_notes: '',
  });

  const selectedProfile = profiles.find((p) => p.id === form.profile_id);
  const vendorRequired = selectedProfile?.source === 'vendor';
  const requirementLocked = Boolean(initialRequirementId);
  const visibleProfiles = benchOnly ? profiles.filter((p) => p.source === 'direct' && p.on_bench) : profiles;

  const liveMargin = useMemo(
    () =>
      computeMarginPreview(
        toOptionalNumber(form.proposed_rate),
        form.proposed_rate_currency,
        toOptionalNumber(form.vendor_rate),
        form.vendor_rate_currency
      ),
    [form.proposed_rate, form.proposed_rate_currency, form.vendor_rate, form.vendor_rate_currency]
  );

  useEffect(() => {
    if (!canCreateSubmission(user)) {
      setError('Only recruiters or admins can put a candidate forward.');
      return;
    }
    const reqParams = { limit: 100 };
    if (accountId) reqParams.account_id = accountId;
    Promise.all([
      apiClient.get('/profiles', { params: { is_active: 'true', limit: 100 } }),
      apiClient.get('/requirements', { params: reqParams }),
    ])
      .then(([profilesRes, reqsRes]) => {
        setProfiles(profilesRes.data.data || []);
        setRequirements(reqsRes.data.data || []);
        if (initialRequirementId) {
          setForm((prev) => ({ ...prev, requirement_id: initialRequirementId }));
        }
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load candidates or jobs'));
  }, [user, accountId, initialRequirementId]);

  useEffect(() => {
    if (!form.requirement_id) {
      setSeats([]);
      setForm((prev) => ({ ...prev, requirement_seat_id: '' }));
      return;
    }
    setLoadingSeats(true);
    apiClient
      .get(`/requirements/${form.requirement_id}/seats`)
      .then(({ data }) => {
        const openSeats = (data.data || []).filter((s) => !s.is_locked && !['closed', 'dropped'].includes(s.seat_status));
        setSeats(openSeats);
        setForm((prev) => ({
          ...prev,
          requirement_seat_id: openSeats.some((s) => s.id === prev.requirement_seat_id) ? prev.requirement_seat_id : '',
        }));
      })
      .catch(() => {
        setSeats([]);
        setError('Failed to load seats for this requirement');
      })
      .finally(() => setLoadingSeats(false));
  }, [form.requirement_id]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        requirement_seat_id: form.requirement_seat_id,
        profile_id: form.profile_id,
        proposed_rate: toOptionalNumber(form.proposed_rate),
        proposed_rate_type: form.proposed_rate_type || undefined,
        proposed_rate_currency: form.proposed_rate_currency || undefined,
        vendor_rate: toOptionalNumber(form.vendor_rate),
        vendor_rate_type: form.vendor_rate_type || undefined,
        vendor_rate_currency: form.vendor_rate_currency || undefined,
        relevancy_score: toOptionalNumber(form.relevancy_score),
        submission_notes: form.submission_notes.trim() || undefined,
      };
      const { data } = await apiClient.post('/submissions', payload);
      if (asPanel && onDone) onDone(data.data.id);
      else navigate(`/submissions/${data.data.id}`);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.errors?.[0]?.message ||
          'Failed to create submission'
      );
    } finally {
      setSaving(false);
    }
  }

  if (!canCreateSubmission(user)) {
    return (
      <div className="space-y-2">
        <div className="rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error || 'Not allowed'}</div>
        {!asPanel && (
          <Link to="/submissions" className="text-sm text-primary-600 hover:underline">
            ← Back to submissions
          </Link>
        )}
      </div>
    );
  }

  function handleCancel() {
    if (asPanel && onCancel) onCancel();
    else navigate('/submissions');
  }

  return (
    <div className={asPanel ? 'space-y-4' : 'mx-auto max-w-3xl space-y-4'}>
      {!asPanel && (
        <div>
          <Link to="/submissions" className="text-xs text-primary-600 hover:underline">
            ← Submissions
          </Link>
          <h1 className="mt-1 font-heading text-xl font-semibold text-tertiary-900">Put a candidate forward</h1>
          <p className="mt-1 text-sm text-tertiary-500">Pick a candidate and open seat, enter rates, then submit.</p>
        </div>
      )}

      {error && <div className="rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div>}

      <form onSubmit={handleSubmit} className={`space-y-4 ${asPanel ? '' : 'rounded-2xl border bg-white p-4 shadow-soft'}`}>
        <div className={asPanel ? 'space-y-3' : 'grid grid-cols-1 gap-3 sm:grid-cols-2'}>
          <div className={asPanel ? '' : 'sm:col-span-2'}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="block text-xs font-medium text-tertiary-500">Candidate *</label>
              <label className="flex items-center gap-1.5 text-xs text-tertiary-600">
                <input type="checkbox" checked={benchOnly} onChange={(e) => setBenchOnly(e.target.checked)} />
                On bench only
              </label>
            </div>
            <select
              required
              value={form.profile_id}
              onChange={(e) => updateField('profile_id', e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            >
              <option value="">Select candidate…</option>
              {visibleProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.current_company ? ` — ${p.current_company}` : ''}
                  {p.source ? ` (${p.source}${p.on_bench ? ', on bench' : ''})` : ''}
                </option>
              ))}
            </select>
            {vendorRequired && (
              <p className="mt-1 text-xs text-warning-700">Vendor candidate — vendor rate is required.</p>
            )}
          </div>

          <div className={asPanel ? '' : 'sm:col-span-2'}>
            <label className="mb-1 block text-xs font-medium text-tertiary-500">Job requirement *</label>
            <select
              required
              value={form.requirement_id}
              disabled={requirementLocked}
              onChange={(e) => updateField('requirement_id', e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm disabled:bg-tertiary-50"
            >
              <option value="">Select job…</option>
              {requirements.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                  {r.account?.name ? ` — ${r.account.name}` : ''} ({r.status})
                </option>
              ))}
            </select>
            {requirementLocked && (
              <p className="mt-1 text-xs text-tertiary-500">Locked to this requirement row.</p>
            )}
          </div>

          <div className={asPanel ? '' : 'sm:col-span-2'}>
            <label className="mb-1 block text-xs font-medium text-tertiary-500">Seat *</label>
            <select
              required
              disabled={!form.requirement_id || loadingSeats}
              value={form.requirement_seat_id}
              onChange={(e) => updateField('requirement_seat_id', e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            >
              <option value="">{loadingSeats ? 'Loading seats…' : 'Select open seat…'}</option>
              {seats.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.seat_label || s.id.slice(0, 8)} — {s.seat_status}
                  {s.active_submissions_count ? ` (${s.active_submissions_count} active)` : ''}
                </option>
              ))}
            </select>
            {form.requirement_id && !loadingSeats && seats.length === 0 && (
              <p className="mt-1 text-xs text-warning-700">No open seats on this requirement.</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-tertiary-500">Proposed rate</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.proposed_rate}
              onChange={(e) => updateField('proposed_rate', e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-tertiary-500">Proposed type / currency</label>
            <div className="flex gap-2">
              <select
                value={form.proposed_rate_type}
                onChange={(e) => updateField('proposed_rate_type', e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              >
                {RATE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                value={form.proposed_rate_currency}
                onChange={(e) => updateField('proposed_rate_currency', e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-tertiary-500">
              Vendor rate {vendorRequired ? '*' : ''}
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              required={vendorRequired}
              value={form.vendor_rate}
              onChange={(e) => updateField('vendor_rate', e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-tertiary-500">Vendor type / currency</label>
            <div className="flex gap-2">
              <select
                value={form.vendor_rate_type}
                onChange={(e) => updateField('vendor_rate_type', e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              >
                {RATE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                value={form.vendor_rate_currency}
                onChange={(e) => updateField('vendor_rate_currency', e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={`${asPanel ? '' : 'sm:col-span-2 '}rounded-xl border border-primary-100 bg-primary-50 px-3 py-3 text-sm`}>
            <p className="font-medium text-primary-900">Live margin</p>
            {liveMargin.margin == null ? (
              <p className="mt-1 text-primary-700">Enter matching proposed + vendor rates (same currency) to preview.</p>
            ) : (
              <p className="mt-1 text-primary-800">
                Margin: <span className="font-semibold">{liveMargin.margin}</span> ({liveMargin.margin_percentage}%)
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-tertiary-500">Relevancy (1–10)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={form.relevancy_score}
              onChange={(e) => updateField('relevancy_score', e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
          </div>
          <div className={asPanel ? '' : 'sm:col-span-2'}>
            <label className="mb-1 block text-xs font-medium text-tertiary-500">Notes</label>
            <textarea
              rows={3}
              value={form.submission_notes}
              onChange={(e) => updateField('submission_notes', e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Submitting…' : 'Create submission'}
          </button>
          <button type="button" className="btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
