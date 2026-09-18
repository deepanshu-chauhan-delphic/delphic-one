import { useSearchParams } from 'react-router-dom';
import { Landmark, Receipt, ShieldCheck, Tags, Truck, Users2 } from 'lucide-react';
import { useAuth } from '../../lib/authContext.jsx';
import ExpensesTab from './ExpensesTab.jsx';
import VendorPaymentsTab from './VendorPaymentsTab.jsx';
import BillingRatesTab from './BillingRatesTab.jsx';
import AccountingTab from './AccountingTab.jsx';
import GroupChargesTab from './GroupChargesTab.jsx';
import ExternalAccessTab from './ExternalAccessTab.jsx';

const BASE_TABS = [{ key: 'expenses', label: 'Expenses', icon: Receipt }];
const ADMIN_TABS = [
  { key: 'vendor-payments', label: 'Vendor Payments', icon: Truck },
  { key: 'billing-rates', label: 'Billing Rates', icon: Tags },
  { key: 'accounting', label: 'Accounting', icon: Landmark },
  { key: 'group-charges', label: 'Group Charges', icon: Users2 },
  { key: 'external-access', label: 'External Access', icon: ShieldCheck },
];

/**
 * Finance hub: expenses, vendor payments, billing rates, accounting (ledger/
 * journal/reports/tax/invoicing), intra-group charges, and CA/Legal external
 * access grants under one sidebar entry. Expense claims are self-serve for
 * every role; the rest is admin-only, matching the backend's own gating.
 */
export default function FinanceHubPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const tabs = isAdmin ? [...BASE_TABS, ...ADMIN_TABS] : BASE_TABS;
  const [params, setParams] = useSearchParams();
  const requested = params.get('section') || 'expenses';
  const section = tabs.some((t) => t.key === requested) ? requested : 'expenses';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-tertiary-200">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={section === key}
            className={`inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium ${
              section === key ? 'border-primary-600 text-primary-700' : 'border-transparent text-tertiary-500'
            }`}
            onClick={() => setParams({ section: key })}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
      {section === 'expenses' && <ExpensesTab />}
      {section === 'vendor-payments' && isAdmin && <VendorPaymentsTab />}
      {section === 'billing-rates' && isAdmin && <BillingRatesTab />}
      {section === 'accounting' && isAdmin && <AccountingTab />}
      {section === 'group-charges' && isAdmin && <GroupChargesTab />}
      {section === 'external-access' && isAdmin && <ExternalAccessTab />}
    </div>
  );
}
