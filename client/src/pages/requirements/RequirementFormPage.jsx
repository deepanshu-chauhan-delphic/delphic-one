import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';
import SkillPicker from '../../components/ui/SkillPicker.jsx';
import { canCreateRequirement, canMutateRequirement } from '../../lib/requirementStages.js';

const emptyForm = {
  account_id: '',
  title: '',
  req_type: 'developer',
  seats_total: 1,
  description: '',
  designation: '',
  department: '',
  primary_tech_stack: [],
  secondary_tech_stack: [],
  domain_experience: '',
  experience_min: '',
  experience_max: '',
  work_mode: '',
  work_location: '',
  engagement_type: '',
  priority: 'medium',
  budget_min: '',
  budget_max: '',
  budget_currency: 'INR',
  budget_type: '',
  sla_days: '',
  start_date_target: '',
};

function toOptionalNumber(value) {
  if (value === '' || value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function buildPayload(form, { isCreate }) {
  const payload = {
    title: form.title.trim(),
    req_type: form.req_type,
    description: form.description.trim() || undefined,
    designation: form.designation.trim() || undefined,
    department: form.department.trim() || undefined,
    primary_tech_stack: form.primary_tech_stack,
    secondary_tech_stack: form.secondary_tech_stack,
    domain_experience: form.domain_experience.trim() || undefined,
    experience_min: toOptionalNumber(form.experience_min),
    experience_max: toOptionalNumber(form.experience_max),
    work_mode: form.work_mode || undefined,
    work_location: form.work_location.trim() || undefined,
    engagement_type: form.engagement_type || undefined,
    priority: form.priority || undefined,
    budget_min: toOptionalNumber(form.budget_min),
    budget_max: toOptionalNumber(form.budget_max),
    budget_currency: form.budget_currency || undefined,
    budget_type: form.budget_type || undefined,
    sla_days: toOptionalNumber(form.sla_days),
    start_date_target: form.start_date_target || undefined,
  };

  if (isCreate) {
    payload.account_id = form.account_id;
    payload.seats_total = Number(form.seats_total) || 1;
  }

  return payload;
}

function hydrateForm(req) {
  return {
    ...emptyForm,
    account_id: req.account?.id || '',
    title: req.title || '',
    req_type: req.req_type || 'developer',
    seats_total: req.seats_total || 1,
    description: req.description || '',
    designation: req.designation || '',
    department: req.department || '',
    primary_tech_stack: req.primary_tech_stack || [],
    secondary_tech_stack: req.secondary_tech_stack || [],
    domain_experience: req.domain_experience || '',
    experience_min: req.experience_min ?? '',
    experience_max: req.experience_max ?? '',
    work_mode: req.work_mode || '',
    work_location: req.work_location || '',
    engagement_type: req.engagement_type || '',
    priority: req.priority || 'medium',
    budget_min: req.budget_min ?? '',
    budget_max: req.budget_max ?? '',
    budget_currency: req.budget_currency || 'INR',
    budget_type: req.budget_type || '',
    sla_days: req.sla_days ?? '',
    start_date_target: req.start_date_target ? String(req.start_date_target).slice(0, 10) : '',
  };
}

export default function RequirementFormPage({ asPanel = false, onDone, onCancel }) {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState(null);

  useEffect(() => {
    if (!canCreateRequirement(user) && !isEdit) {
      setError('Only sales or admin can create requirements.');
      return;
    }

    apiClient
      .get('/accounts', { params: { type: 'client', stage: 'active', limit: 100 } })
      .then(({ data }) => setAccounts(data.data || []))
      .catch(() => setAccounts([]));

    if (!isEdit) return;

    setLoading(true);
    apiClient
      .get(`/requirements/${id}`)
      .then(({ data }) => {
        const req = data.data;
        setExisting(req);
        setForm(hydrateForm(req));
        if (!canMutateRequirement(req, user)) {
          setError('You do not own this requirement.');
        }
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load requirement'))
      .finally(() => setLoading(false));
  }, [id, isEdit, user]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = buildPayload(form, { isCreate: !isEdit });
      if (isEdit) {
        await apiClient.patch(`/requirements/${id}`, payload);
        if (asPanel && onDone) onDone(id);
        else navigate(`/requirements/${id}`);
      } else {
        const { data } = await apiClient.post('/requirements', payload);
        if (asPanel && onDone) onDone(data.data.id);
        else navigate(`/requirements/${data.data.id}`);
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.message ||
        'Failed to save requirement';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-tertiary-500">Loading…</div>;
  }

  const blocked = isEdit && existing && !canMutateRequirement(existing, user);

  function handleCancel() {
    if (asPanel && onCancel) onCancel();
    else navigate(isEdit ? `/requirements/${id}` : '/requirements');
  }

  return (
    <div className={asPanel ? 'space-y-4' : 'mx-auto max-w-3xl space-y-4'}>
      {!asPanel && (
        <div className="flex items-center justify-between gap-3">
          <div>
            <Link to={isEdit ? `/requirements/${id}` : '/requirements'} className="text-xs text-primary-600 hover:underline">
              ← Back
            </Link>
            <h1 className="mt-1 font-heading text-xl font-semibold text-tertiary-900">
              {isEdit ? 'Edit requirement' : 'Add job requirement'}
            </h1>
          </div>
        </div>
      )}

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <form onSubmit={handleSubmit} className={asPanel ? 'space-y-4' : 'space-y-4 rounded-lg border bg-white p-4'}>
        <fieldset disabled={blocked || saving} className="space-y-4">
          <div className={`grid grid-cols-1 gap-3 ${asPanel ? '' : 'sm:grid-cols-2'}`}>
            {!isEdit && (
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-tertiary-500">Client account *</label>
                <select
                  required
                  value={form.account_id}
                  onChange={(e) => updateField('account_id', e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">Select active client…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                {accounts.length === 0 && (
                  <p className="mt-1 text-xs text-amber-700">No active client accounts found. Activate a client first.</p>
                )}
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-tertiary-500">Title *</label>
              <input
                required
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-tertiary-500">Type *</label>
              <select
                value={form.req_type}
                onChange={(e) => updateField('req_type', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="developer">Developer</option>
                <option value="project">Project</option>
              </select>
            </div>

            {!isEdit && (
              <div>
                <label className="mb-1 block text-xs font-medium text-tertiary-500">Seats *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={form.seats_total}
                  onChange={(e) => updateField('seats_total', e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-tertiary-500">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => updateField('priority', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-tertiary-500">Designation</label>
              <input
                value={form.designation}
                onChange={(e) => updateField('designation', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-tertiary-500">Department</label>
              <input
                value={form.department}
                onChange={(e) => updateField('department', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-tertiary-500">Description</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>

            <div className={asPanel ? '' : 'sm:col-span-2'}>
              <label className="mb-1 block text-xs font-medium text-tertiary-500">Primary tech stack</label>
              <SkillPicker
                value={form.primary_tech_stack}
                onChange={(next) => updateField('primary_tech_stack', next)}
                placeholder="Search or type a technology…"
              />
            </div>

            <div className={asPanel ? '' : 'sm:col-span-2'}>
              <label className="mb-1 block text-xs font-medium text-tertiary-500">Secondary tech stack</label>
              <SkillPicker
                value={form.secondary_tech_stack}
                onChange={(next) => updateField('secondary_tech_stack', next)}
                placeholder="Search or type a technology…"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-tertiary-500">Experience min (years)</label>
              <input
                type="number"
                min={0}
                value={form.experience_min}
                onChange={(e) => updateField('experience_min', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-tertiary-500">Experience max (years)</label>
              <input
                type="number"
                min={0}
                value={form.experience_max}
                onChange={(e) => updateField('experience_max', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-tertiary-500">Work mode</label>
              <select
                value={form.work_mode}
                onChange={(e) => updateField('work_mode', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="">—</option>
                <option value="remote">Remote</option>
                <option value="onsite">Onsite</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-tertiary-500">Work location</label>
              <input
                value={form.work_location}
                onChange={(e) => updateField('work_location', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-tertiary-500">Engagement</label>
              <select
                value={form.engagement_type}
                onChange={(e) => updateField('engagement_type', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="">—</option>
                <option value="full_time">Full time</option>
                <option value="part_time">Part time</option>
                <option value="contract">Contract</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-tertiary-500">Start date target</label>
              <input
                type="date"
                value={form.start_date_target}
                onChange={(e) => updateField('start_date_target', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-tertiary-500">Budget min</label>
              <input
                type="number"
                min={0}
                value={form.budget_min}
                onChange={(e) => updateField('budget_min', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-tertiary-500">Budget max</label>
              <input
                type="number"
                min={0}
                value={form.budget_max}
                onChange={(e) => updateField('budget_max', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-tertiary-500">Currency</label>
              <select
                value={form.budget_currency}
                onChange={(e) => updateField('budget_currency', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                {['INR', 'USD', 'AED', 'SAR', 'EUR', 'GBP'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-tertiary-500">Budget type</label>
              <select
                value={form.budget_type}
                onChange={(e) => updateField('budget_type', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="">—</option>
                <option value="monthly">Monthly</option>
                <option value="hourly">Hourly</option>
                <option value="annual">Annual</option>
                <option value="fixed_project">Fixed project</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-tertiary-500">SLA days</label>
              <input
                type="number"
                min={0}
                value={form.sla_days}
                onChange={(e) => updateField('sla_days', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-tertiary-500">Domain experience</label>
              <input
                value={form.domain_experience}
                onChange={(e) => updateField('domain_experience', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>
        </fieldset>

        <div className="flex gap-2">
          <button type="submit" disabled={blocked || saving} className="btn-primary">
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create requirement'}
          </button>
          <button type="button" className="btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
