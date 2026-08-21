import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';
import { accountKey, apiErrorMessage, canCreateAccount, canMutateAccount } from './accountUtils.js';

const EMPTY_CONTACT = { name: '', email: '', phone: '', designation: '', role_label: '' };
const EMPTY_FORM = {
  type: 'client',
  name: '',
  industry: '',
  company_size: '',
  website: '',
  location_city: '',
  location_country: '',
  gst_or_tax_id: '',
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
  client_billing_currency: 'INR',
  client_payment_terms: '',
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
    additional_contacts: contacts.length ? contacts.map((contact) => ({ ...EMPTY_CONTACT, ...contact })) : [{ ...EMPTY_CONTACT }],
    vendor_specializations: (account.vendor_specializations || []).join(', '),
    vendor_rate_min: rateRange.min ?? '',
    vendor_rate_max: rateRange.max ?? '',
    vendor_rate_currency: rateRange.currency || 'INR',
    client_billing_currency: account.client_billing_currency || 'INR',
  };
}

function optionalEnum(value) {
  return value || undefined;
}

function buildAccountBody(form, isEditing) {
  const body = {
    name: form.name.trim(),
    industry: form.industry.trim(),
    company_size: optionalEnum(form.company_size),
    website: form.website.trim(),
    location_city: form.location_city.trim(),
    location_country: form.location_country.trim(),
    gst_or_tax_id: form.gst_or_tax_id.trim(),
    poc_name: form.poc_name.trim(),
    poc_email: form.poc_email.trim(),
    poc_phone: form.poc_phone.trim(),
    poc_designation: form.poc_designation.trim(),
    additional_contacts: form.additional_contacts
      .map((contact) => Object.fromEntries(Object.entries(contact).map(([key, value]) => [key, value.trim()])))
      .filter((contact) => contact.name),
    source: form.source.trim(),
  };

  if (!isEditing) body.type = form.type;

  if (form.type === 'vendor') {
    body.vendor_specializations = form.vendor_specializations.split(',').map((value) => value.trim()).filter(Boolean);
    body.vendor_payment_terms = form.vendor_payment_terms.trim();
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
  }

  return body;
}

export default function AccountFormPage({ asPanel = false, onDone, onCancel }) {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const [account, setAccount] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEditing) return;
    apiClient
      .get(`/accounts/${id}`)
      .then(({ data }) => {
        setAccount(data.data);
        setForm(formFromAccount(data.data));
      })
      .catch((requestError) => setError(apiErrorMessage(requestError, 'Failed to load account')))
      .finally(() => setLoading(false));
  }, [id, isEditing]);

  if (!asPanel && !isEditing && !canCreateAccount(user)) return <Navigate to="/accounts" replace />;

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
    setError('');
    if (form.type === 'vendor' && (form.vendor_rate_min === '') !== (form.vendor_rate_max === '')) {
      setError('Enter both minimum and maximum vendor rates, or leave both blank.');
      return;
    }

    setSaving(true);
    try {
      const body = buildAccountBody(form, isEditing);
      const { data } = isEditing ? await apiClient.patch(`/accounts/${id}`, body) : await apiClient.post('/accounts', body);
      if (asPanel && onDone) onDone(data.data.id);
      else navigate(`/accounts/${data.data.id}`, { replace: true });
    } catch (requestError) {
      setError(apiErrorMessage(requestError, `Failed to ${isEditing ? 'update' : 'create'} account`));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-tertiary-500">Loading account…</div>;
  if (isEditing && (!account || error)) {
    return (
      <div className="space-y-3">
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error || 'Account not found'}
        </div>
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

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <form onSubmit={saveAccount} className="space-y-4">
        <section className="rounded border bg-white">
          <h2 className="border-b bg-tertiary-50 px-4 py-2 text-sm font-semibold text-tertiary-800">Company</h2>
          <div className={`grid gap-3 p-4 ${asPanel ? '' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
            <Field label="Account type" required>
              <select
                value={form.type}
                onChange={(event) => updateField('type', event.target.value)}
                disabled={isEditing}
                className={INPUT_CLASS}
              >
                <option value="client">Client</option>
                <option value="vendor">Vendor</option>
              </select>
            </Field>
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

        <section className="rounded border bg-white">
          <h2 className="border-b bg-tertiary-50 px-4 py-2 text-sm font-semibold capitalize text-tertiary-800">
            {form.type} commercial details
          </h2>
          {form.type === 'client' ? (
            <div className={`grid gap-3 p-4 ${asPanel ? '' : 'sm:grid-cols-2'}`}>
              <Field label="Billing currency">
                <select
                  value={form.client_billing_currency}
                  onChange={(event) => updateField('client_billing_currency', event.target.value)}
                  className={INPUT_CLASS}
                >
                  {['INR', 'USD', 'AED', 'SAR', 'EUR', 'GBP'].map((currency) => <option key={currency}>{currency}</option>)}
                </select>
              </Field>
              <Field label="Payment terms">
                <input
                  value={form.client_payment_terms}
                  onChange={(event) => updateField('client_payment_terms', event.target.value)}
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
                  className={INPUT_CLASS}
                />
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
                <select
                  value={form.vendor_rate_currency}
                  onChange={(event) => updateField('vendor_rate_currency', event.target.value)}
                  className={INPUT_CLASS}
                >
                  {['INR', 'USD', 'AED', 'SAR', 'EUR', 'GBP'].map((currency) => <option key={currency}>{currency}</option>)}
                </select>
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
            </div>
          )}
        </section>

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
