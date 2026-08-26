import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';
import SkillPicker from '../../components/ui/SkillPicker.jsx';
import { emptyProfileForm, formToProfileBody, profileToForm } from './profileForm.js';
import { apiErrorMessage, canCreateProfile, canEditProfile, profileKey } from './profileUtils.js';

const INPUT_CLASS = 'w-full rounded border border-tertiary-200 bg-white px-2 py-1.5 text-sm text-tertiary-900';
const CURRENCIES = ['INR', 'USD', 'AED', 'SAR'];

function Field({ label, children, required = false }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-tertiary-600">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
    </label>
  );
}

export default function ProfileFormPage({ asPanel = false, onDone, onCancel }) {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const [form, setForm] = useState(emptyProfileForm());
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [resumeFile, setResumeFile] = useState(null);

  useEffect(() => {
    apiClient
      .get('/accounts', { params: { type: 'vendor', stage: 'active', limit: 100 } })
      .then(({ data }) => setVendors(data.data || []))
      .catch(() => setVendors([]));
  }, []);

  useEffect(() => {
    if (!isEditing) return;
    apiClient
      .get(`/profiles/${id}`)
      .then(({ data }) => setForm(profileToForm(data.data)))
      .catch((requestError) => setError(apiErrorMessage(requestError, 'Failed to load candidate')))
      .finally(() => setLoading(false));
  }, [id, isEditing]);

  if (!asPanel && !isEditing && !canCreateProfile(user)) return <Navigate to="/profiles" replace />;
  if (!asPanel && isEditing && !canEditProfile(user)) return <Navigate to={`/profiles/${id}`} replace />;
  if (asPanel && !isEditing && !canCreateProfile(user)) {
    return (
      <div className="rounded-lg border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">
        Only recruiters or admins can create candidate profiles.
      </div>
    );
  }

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function uploadResume(profileId) {
    if (!resumeFile) return;
    const body = new FormData();
    body.append('entity_type', 'profile');
    body.append('entity_id', profileId);
    body.append('label', 'Resume');
    body.append('file', resumeFile);
    await apiClient.post('/documents', body, { headers: { 'Content-Type': 'multipart/form-data' } });
  }

  async function saveProfile(event) {
    event.preventDefault();
    setError('');
    if (!form.name.trim() || form.total_experience_years === '' || form.primary_skills.length === 0) {
      setError('Name, experience years, and primary skills are required.');
      return;
    }
    if (form.source === 'vendor' && !form.vendor_account_id) {
      setError('Select a vendor account when source is vendor.');
      return;
    }

    setSaving(true);
    try {
      const body = formToProfileBody(form);
      const { data } = isEditing
        ? await apiClient.patch(`/profiles/${id}`, body)
        : await apiClient.post('/profiles', body);
      const profileId = data.data.id;
      if (resumeFile) await uploadResume(profileId);
      if (asPanel && onDone) onDone(profileId);
      else navigate(`/profiles/${profileId}`, { replace: true });
    } catch (requestError) {
      setError(apiErrorMessage(requestError, `Failed to ${isEditing ? 'update' : 'create'} candidate`));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-tertiary-500">Loading candidate…</div>;

  const backPath = isEditing ? `/profiles/${id}` : '/profiles';

  function handleCancel() {
    if (asPanel && onCancel) onCancel();
    else navigate(backPath);
  }

  return (
    <div className={asPanel ? 'space-y-4' : 'mx-auto max-w-5xl space-y-4'}>
      {!asPanel && (
        <div className="flex items-start justify-between gap-4 border-b pb-3">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs text-tertiary-500">
              <Link to="/profiles" className="text-primary-700 hover:underline">Profiles</Link>
              <span>/</span>
              <span>{isEditing ? profileKey(id) : 'Create'}</span>
            </div>
            <h1 className="font-heading text-xl font-semibold text-tertiary-900">
              {isEditing ? 'Edit candidate' : 'Add candidate'}
            </h1>
          </div>
          <button type="button" className="btn-secondary" onClick={handleCancel}>Cancel</button>
        </div>
      )}

      {error && <div className="rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div>}

      <form onSubmit={saveProfile} className="space-y-4">
        <section className={`rounded-2xl border shadow-soft ${asPanel ? 'border-sky-100 bg-sky-50/30' : 'bg-white'}`}>
          <h2 className={`border-b px-4 py-2.5 font-heading text-sm font-semibold ${asPanel ? 'border-sky-100 text-sky-900' : 'text-tertiary-800'}`}>
            Personal
          </h2>
          <div className={`grid gap-3 p-4 ${asPanel ? '' : 'sm:grid-cols-2'}`}>
            <Field label="Full name" required>
              <input required value={form.name} onChange={(e) => updateField('name', e.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label="Phone">
              <input value={form.phone} onChange={(e) => updateField('phone', e.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label="Current location">
              <input value={form.current_location} onChange={(e) => updateField('current_location', e.target.value)} className={INPUT_CLASS} />
            </Field>
          </div>
        </section>

        <section className={`rounded-2xl border shadow-soft ${asPanel ? 'border-violet-100 bg-violet-50/30' : 'bg-white'}`}>
          <h2 className={`border-b px-4 py-2.5 font-heading text-sm font-semibold ${asPanel ? 'border-violet-100 text-violet-900' : 'text-tertiary-800'}`}>
            Professional
          </h2>
          <div className={`grid gap-3 p-4 ${asPanel ? '' : 'sm:grid-cols-2'}`}>
            <Field label="Current company">
              <input value={form.current_company} onChange={(e) => updateField('current_company', e.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label="Current designation">
              <input value={form.current_designation} onChange={(e) => updateField('current_designation', e.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label="Total experience (years)" required>
              <input required type="number" min="0" step="0.1" value={form.total_experience_years} onChange={(e) => updateField('total_experience_years', e.target.value)} className={INPUT_CLASS} />
            </Field>
            <div className={asPanel ? '' : 'sm:col-span-2'}>
              <Field label="Primary skills" required>
                <SkillPicker value={form.primary_skills} onChange={(next) => updateField('primary_skills', next)} />
              </Field>
            </div>
            <div className={asPanel ? '' : 'sm:col-span-2'}>
              <Field label="Secondary skills">
                <SkillPicker value={form.secondary_skills} onChange={(next) => updateField('secondary_skills', next)} />
              </Field>
            </div>
            <Field label="Expected CTC">
              <input type="number" min="0" value={form.expected_ctc} onChange={(e) => updateField('expected_ctc', e.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label="Expected CTC currency">
              <select value={form.expected_ctc_currency} onChange={(e) => updateField('expected_ctc_currency', e.target.value)} className={INPUT_CLASS}>
                {CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}
              </select>
            </Field>
          </div>
        </section>

        <section className={`rounded-2xl border shadow-soft ${asPanel ? 'border-teal-100 bg-teal-50/30' : 'bg-white'}`}>
          <h2 className={`border-b px-4 py-2.5 font-heading text-sm font-semibold ${asPanel ? 'border-teal-100 text-teal-900' : 'text-tertiary-800'}`}>
            Sourcing
          </h2>
          <div className={`grid gap-3 p-4 ${asPanel ? '' : 'sm:grid-cols-2'}`}>
            <Field label="Source" required>
              <select required value={form.source} onChange={(e) => updateField('source', e.target.value)} className={INPUT_CLASS}>
                <option value="internal">Internal</option>
                <option value="vendor">Vendor</option>
                <option value="linkedin">LinkedIn</option>
              </select>
            </Field>
            {form.source === 'vendor' && (
              <Field label="Vendor account" required>
                <select required value={form.vendor_account_id} onChange={(e) => updateField('vendor_account_id', e.target.value)} className={INPUT_CLASS}>
                  <option value="">Select vendor</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Resume file">
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                className="w-full text-sm"
              />
            </Field>
            <div className={asPanel ? '' : 'sm:col-span-2'}>
              <Field label="Recruiter notes">
                <textarea rows={3} value={form.recruiter_notes} onChange={(e) => updateField('recruiter_notes', e.target.value)} className={INPUT_CLASS} />
              </Field>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-2 border-t pt-4">
          <button type="button" className="btn-secondary" onClick={handleCancel}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Create candidate'}
          </button>
        </div>
      </form>
    </div>
  );
}
