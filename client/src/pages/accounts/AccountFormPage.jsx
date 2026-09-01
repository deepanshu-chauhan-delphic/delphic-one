import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';
import { useAlerts } from '../../lib/alerts/alertContext.jsx';
import { runValidations, fieldErrorClass } from '../../lib/alerts/formValidation.js';
import { accountKey, apiErrorMessage, canCreateAccount, canMutateAccount } from './accountUtils.js';
import SearchableSelect from '../../components/ui/SearchableSelect.jsx';

const EMPTY_CONTACT = { name: '', email: '', phone: '', designation: '', role_label: '' };
const EMPTY_FORM = {
  type: '',
  name: '',
  owner_id: '',
  industry: '',
  company_size: '',
  website: '',
  location_city: '',
  location_country: '',
  gst_or_tax_id: '',
  lead_generated_date: '',
  location: '',
  linkedin_url: '',
  poc_name: '',
  poc_email: '',
  poc_phone: '',
  poc_designation: '',
  additional_contacts: [{ ...EMPTY_CONTACT }],
  source: '',
  vendor_specializations: '',
  vendor_rate_min: '',
  vendor_rate_max: '',
  vendor_rate_currency: 'INR',
  vendor_payment_terms: '',
  vendor_agreement_url: '',
  client_billing_currency: 'INR',
  client_payment_terms: '',
  client_agreement_url: '',
};

const INPUT_CLASS = 'w-full rounded border border-tertiary-200 bg-white px-2 py-1.5 text-sm text-tertiary-900';

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

function formFromAccount(account) {
  const contacts = Array.isArray(account.additional_contacts) ? account.additional_contacts : [];
  const rateRange = account.vendor_rate_range || {};
  return {
    ...EMPTY_FORM,
    ...account,
    type: account.type || '',
    owner_id: account.owner?.id || '',
    lead_generated_date: account.lead_generated_date ? account.lead_generated_date.slice(0, 10) : '',
    location: account.location || '',
    linkedin_url: account.linkedin_url || '',
    additional_contacts: contacts.length ? contacts.map((contact) => ({ ...EMPTY_CONTACT, ...contact })) : [{ ...EMPTY_CONTACT }],
    vendor_specializations: (account.vendor_specializations || []).join(', '),
    vendor_rate_min: rateRange.min ?? '',
    vendor_rate_max: rateRange.max ?? '',
    vendor_rate_currency: rateRange.currency || 'INR',
    vendor_agreement_url: account.vendor_agreement_url || '',
    client_billing_currency: account.client_billing_currency || 'INR',
    client_agreement_url: account.client_agreement_url || '',
  };
}

function optionalEnum(value) {
  return value || undefined;
}

function buildAccountBody(form, isEditing, canEditType) {
  const body = {
    name: form.name.trim(),
    industry: form.industry.trim(),
    company_size: optionalEnum(form.company_size),
    website: form.website.trim(),
    location_city: form.location_city.trim(),
    location_country: form.location_country.trim(),
    gst_or_tax_id: form.gst_or_tax_id.trim(),
    lead_generated_date: form.lead_generated_date || undefined,
    location: form.location.trim(),
    linkedin_url: form.linkedin_url.trim(),
    poc_name: form.poc_name.trim(),
    poc_email: form.poc_email.trim(),
    poc_phone: form.poc_phone.trim(),
    poc_designation: form.poc_designation.trim(),
    additional_contacts: form.additional_contacts
      .map((contact) => Object.fromEntries(Object.entries(contact).map(([key, value]) => [key, value.trim()])))
      .filter((contact) => contact.name),
    source: form.source.trim(),
  };

  if (form.type && (!isEditing || canEditType)) body.type = form.type;
  if (isEditing && form.owner_id) body.owner_id = form.owner_id;

  if (form.type === 'vendor') {
    body.vendor_specializations = form.vendor_specializations.split(',').map((value) => value.trim()).filter(Boolean);
    body.vendor_payment_terms = form.vendor_payment_terms.trim();
    body.vendor_agreement_url = form.vendor_agreement_url.trim();
    if (form.vendor_rate_min !== '' && form.vendor_rate_max !== '') {
      body.vendor_rate_range = {
        min: Number(form.vendor_rate_min),
        max: Number(form.vendor_rate_max),
        currency: form.vendor_rate_currency,
      };
    }
  } else {
    body.client_billing_currency = form.client_billing_currency;
    body.client_payment_terms = form.client_payment_terms.trim();
    body.client_agreement_url = form.client_agreement_url.trim();
  }

  return body;
}

export default function AccountFormPage({ asPanel = false, onDone, onCancel, accountId: accountIdProp }) {
  const { id: paramId } = useParams();
  const id = accountIdProp || paramId;
  const { user } = useAuth();
  const { pushError } = useAlerts();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const [account, setAccount] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loadFailed, setLoadFailed] = useState(false);
  const [ownerOptions, setOwnerOptions] = useState([]);
  // Anyone who can edit the account can also reassign its owner/POC to any active user.
  const canEditOwner = isEditing && canMutateAccount(account, user);
  const canEditType = isEditing && user?.role === 'admin';

  useEffect(() => {
    if (!canEditOwner) return;
    apiClient
      .get('/users', { params: { active: 'true', limit: 100 } })
      .then(({ data }) => setOwnerOptions([...(data.data || [])].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setOwnerOptions([]));
  }, [canEditOwner]);

  useEffect(() => {
    if (!isEditing) return;
    setLoading(true);
    setLoadFailed(false);
    apiClient
      .get(`/accounts/${id}`)
      .then(({ data }) => {
        setAccount(data.data);
        setForm(formFromAccount(data.data));
      })
      .catch((requestError) => {
        setLoadFailed(true);
        pushError(apiErrorMessage(requestError, 'Failed to load account'), 'Something went wrong');
      })
      .finally(() => setLoading(false));
  }, [id, isEditing]);

  if (!asPanel && !isEditing && !canCreateAccount(user)) return <Navigate to="/accounts" replace />;
  if (asPanel && !isEditing && !canCreateAccount(user)) {
    return (
      <div className="rounded-lg border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">
        Only BDA or admin can create accounts.
      </div>
    );
  }

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateContact(index, name, value) {
    setForm((current) => ({
      ...current,
      additional_contacts: current.additional_contacts.map((contact, contactIndex) =>
        contactIndex === index ? { ...contact, [name]: value } : contact
      ),
    }));
  }

  function addContact() {
    setForm((current) => ({ ...current, additional_contacts: [...current.additional_contacts, { ...EMPTY_CONTACT }] }));
  }

  function removeContact(index) {
    setForm((current) => ({
      ...current,
      additional_contacts: current.additional_contacts.filter((contact, contactIndex) => contactIndex !== index),
    }));
  }

  async function saveAccount(event) {
    event.preventDefault();
    const vendorRatesMismatch =
      form.type === 'vendor' && (form.vendor_rate_min === '') !== (form.vendor_rate_max === '');
    const validation = runValidations([
      ['vendor_rate_min', vendorRatesMismatch ? 'Enter both minimum and maximum vendor rates, or leave both blank.' : null],
    ]);
    if (!validation.valid) {
      setFieldErrors(validation.fieldErrors);
      pushError(validation.messages.join(' '), 'Please fix the form');
      return;
    }

    setSaving(true);
    setFieldErrors({});
    try {
      const body = buildAccountBody(form, isEditing, canEditType);
      const { data } = isEditing ? await apiClient.patch(`/accounts/${id}`, body) : await apiClient.post('/accounts', body);
      if (asPanel && onDone) onDone(data.data.id);
      else navigate(`/accounts/${data.data.id}`, { replace: true });
    } catch (requestError) {
      pushError(apiErrorMessage(requestError, `Failed to ${isEditing ? 'update' : 'create'} account`), 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-tertiary-500">Loading account…</div>;
  if (isEditing && (!account || loadFailed)) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-tertiary-600">Account not found or could not be loaded.</p>
        {!asPanel && <Link to="/accounts" className="text-sm text-primary-700 hover:underline">Back to accounts</Link>}
      </div>
    );
  }
  if (!asPanel && isEditing && account && (!canMutateAccount(account, user) || account.is_locked)) {
    return <Navigate to={`/accounts/${id}`} replace />;
  }

  const backPath = isEditing ? `/accounts/${id}` : '/accounts';

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
              <Link to="/accounts" className="text-primary-700 hover:underline">Accounts</Link>
              <span>/</span>
              <span>{isEditing ? accountKey(id) : 'Create'}</span>
            </div>
            <h1 className="font-heading text-xl font-semibold text-tertiary-900">
              {isEditing ? `Edit ${account?.name || 'account'}` : 'Create client or vendor'}
            </h1>
          </div>
          <button type="button" className="btn-secondary" onClick={handleCancel}>Cancel</button>
        </div>
      )}

      <form onSubmit={saveAccount} className="space-y-4">
        <section className="rounded border bg-white">
          <h2 className="border-b bg-tertiary-50 px-4 py-2 text-sm font-semibold text-tertiary-800">Company</h2>
          <div className={`grid gap-3 p-4 ${asPanel ? '' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
            <Field label="Account type">
              <select
                value={form.type}
                onChange={(event) => updateField('type', event.target.value)}
                disabled={isEditing && !canEditType}
                className={INPUT_CLASS}
              >
                <option value="">Undecided (lead)</option>
                <option value="client">Client</option>
                <option value="vendor">Vendor</option>
              </select>
              {canEditType && (
                <span className="mt-1 block text-xs text-tertiary-500">
                  Admin only · changing the type re-classifies the account
                </span>
              )}
            </Field>
            {canEditOwner && (
              <Field label="Owner (POC from our end)" required>
                <SearchableSelect
                  required
                  value={form.owner_id}
                  onChange={(v) => updateField('owner_id', v)}
                  placeholder="Select owner…"
                  searchPlaceholder="Search users…"
                  options={[
                    ...ownerOptions.map((u) => ({ value: u.id, label: `${u.name} · ${u.role}` })),
                    ...(account?.owner && !ownerOptions.some((u) => u.id === account.owner.id)
                      ? [{ value: account.owner.id, label: `${account.owner.name} (current)` }]
                      : []),
                  ]}
                />
              </Field>
            )}
            <Field label="Company name" required>
              <input required value={form.name} onChange={(event) => updateField('name', event.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label="Industry">
              <input value={form.industry} onChange={(event) => updateField('industry', event.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label="Company size">
              <select value={form.company_size} onChange={(event) => updateField('company_size', event.target.value)} className={INPUT_CLASS}>
                <option value="">Not specified</option>
                <option value="startup">Startup</option>
                <option value="small">Small</option>
                <option value="mid">Mid</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </Field>
            <Field label="Website">
              <input type="url" value={form.website} onChange={(event) => updateField('website', event.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label="Lead source">
              <input value={form.source} onChange={(event) => updateField('source', event.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label="Lead generated date">
              <input
                type="date"
                value={form.lead_generated_date}
                onChange={(event) => updateField('lead_generated_date', event.target.value)}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Location">
              <input value={form.location} onChange={(event) => updateField('location', event.target.value)} className={INPUT_CLASS} placeholder="e.g. Pune, India" />
            </Field>
            <Field label="LinkedIn URL">
              <input type="url" value={form.linkedin_url} onChange={(event) => updateField('linkedin_url', event.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label="City">
              <input value={form.location_city} onChange={(event) => updateField('location_city', event.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label="Country">
              <input value={form.location_country} onChange={(event) => updateField('location_country', event.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label="GST / Tax ID">
              <input value={form.gst_or_tax_id} onChange={(event) => updateField('gst_or_tax_id', event.target.value)} className={INPUT_CLASS} />
            </Field>
          </div>
        </section>

        <section className="rounded border bg-white">
          <h2 className="border-b bg-tertiary-50 px-4 py-2 text-sm font-semibold text-tertiary-800">Primary contact</h2>
          <div className={`grid gap-3 p-4 ${asPanel ? '' : 'sm:grid-cols-2'}`}>
            <Field label="Name">
              <input value={form.poc_name} onChange={(event) => updateField('poc_name', event.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label="Designation">
              <input value={form.poc_designation} onChange={(event) => updateField('poc_designation', event.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label="Email">
              <input type="email" value={form.poc_email} onChange={(event) => updateField('poc_email', event.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label="Phone">
              <input value={form.poc_phone} onChange={(event) => updateField('poc_phone', event.target.value)} className={INPUT_CLASS} />
            </Field>
          </div>
        </section>

        <section className="rounded border bg-white">
          <div className="flex items-center justify-between border-b bg-tertiary-50 px-4 py-2">
            <h2 className="text-sm font-semibold text-tertiary-800">Additional contacts</h2>
            <button type="button" onClick={addContact} className="text-xs font-medium text-primary-700 hover:underline">+ Add contact</button>
          </div>
          <div className="space-y-3 p-4">
            {form.additional_contacts.map((contact, index) => (
              <div key={index} className={`grid gap-2 rounded border bg-tertiary-50 p-3 ${asPanel ? '' : 'sm:grid-cols-2 lg:grid-cols-5'}`}>
                {Object.keys(EMPTY_CONTACT).map((name) => (
                  <Field key={name} label={name.replace(/_/g, ' ')}>
                    <input
                      type={name === 'email' ? 'email' : 'text'}
                      value={contact[name]}
                      onChange={(event) => updateContact(index, name, event.target.value)}
                      className={INPUT_CLASS}
                    />
                  </Field>
                ))}
                {form.additional_contacts.length > 1 && (
                  <button type="button" onClick={() => removeContact(index)} className="text-left text-xs text-red-700 hover:underline">
                    Remove contact
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {form.type ? (
        <section className="rounded border bg-white">
          <h2 className="border-b bg-tertiary-50 px-4 py-2 text-sm font-semibold capitalize text-tertiary-800">
            {form.type} commercial details
          </h2>
          {form.type === 'client' ? (
            <div className={`grid gap-3 p-4 ${asPanel ? '' : 'sm:grid-cols-2'}`}>
              <Field label="Billing currency">
                <SearchableSelect
                  value={form.client_billing_currency}
                  onChange={(v) => updateField('client_billing_currency', v)}
                  options={['INR', 'USD', 'AED', 'SAR', 'EUR', 'GBP'].map((currency) => ({ value: currency, label: currency }))}
                />
              </Field>
              <Field label="Payment terms">
                <input
                  value={form.client_payment_terms}
                  onChange={(event) => updateField('client_payment_terms', event.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Agreement URL">
                <input
                  type="url"
                  value={form.client_agreement_url}
                  onChange={(event) => updateField('client_agreement_url', event.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
          ) : (
            <div className={`grid gap-3 p-4 ${asPanel ? '' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
              <div className={asPanel ? '' : 'sm:col-span-2'}>
                <Field label="Specializations (comma separated)">
                  <input
                    value={form.vendor_specializations}
                    onChange={(event) => updateField('vendor_specializations', event.target.value)}
                    className={INPUT_CLASS}
                  />
                </Field>
              </div>
              <Field label="Minimum rate">
                <input
                  type="number"
                  min="0"
                  value={form.vendor_rate_min}
                  onChange={(event) => updateField('vendor_rate_min', event.target.value)}
                  className={fieldErrorClass(fieldErrors, 'vendor_rate_min', INPUT_CLASS)}
                />
                {fieldErrors.vendor_rate_min && (
                  <p className="text-xs text-danger-600 mt-1">{fieldErrors.vendor_rate_min}</p>
                )}
              </Field>
              <Field label="Maximum rate">
                <input
                  type="number"
                  min="0"
                  value={form.vendor_rate_max}
                  onChange={(event) => updateField('vendor_rate_max', event.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Rate currency">
                <SearchableSelect
                  value={form.vendor_rate_currency}
                  onChange={(v) => updateField('vendor_rate_currency', v)}
                  options={['INR', 'USD', 'AED', 'SAR', 'EUR', 'GBP'].map((currency) => ({ value: currency, label: currency }))}
                />
              </Field>
              <div className={asPanel ? '' : 'sm:col-span-2'}>
                <Field label="Payment terms">
                  <input
                    value={form.vendor_payment_terms}
                    onChange={(event) => updateField('vendor_payment_terms', event.target.value)}
                    className={INPUT_CLASS}
                  />
                </Field>
              </div>
              <div className={asPanel ? '' : 'sm:col-span-2'}>
                <Field label="Agreement URL">
                  <input
                    type="url"
                    value={form.vendor_agreement_url}
                    onChange={(event) => updateField('vendor_agreement_url', event.target.value)}
                    className={INPUT_CLASS}
                  />
                </Field>
              </div>
            </div>
          )}
        </section>
        ) : null}

        <div className="flex justify-end gap-2 border-t pt-4">
          <button type="button" className="btn-secondary" onClick={handleCancel}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Create account'}
          </button>
        </div>
      </form>
    </div>
  );
}
