import { useSearchParams } from 'react-router-dom';
import { CalendarCheck, CalendarClock, Timer } from 'lucide-react';
import AttendancePage from '../attendance/AttendancePage.jsx';
import LeavePage from '../leave/LeavePage.jsx';
import TimesheetsPage from './TimesheetsPage.jsx';

const TABS = [
  { key: 'attendance', label: 'Attendance', icon: CalendarClock },
  { key: 'leave', label: 'Leave', icon: CalendarCheck },
  { key: 'timesheets', label: 'Timesheets', icon: Timer },
];

/** Time & Attendance hub: Attendance + Leave + Timesheets under one sidebar entry. */
export default function TimeAttendanceHubPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('section') || 'attendance';
  const section = TABS.some((t) => t.key === requested) ? requested : 'attendance';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-tertiary-200">
        {TABS.map(({ key, label, icon: Icon }) => (
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
      {section === 'attendance' && <AttendancePage />}
      {section === 'leave' && <LeavePage />}
      {section === 'timesheets' && <TimesheetsPage />}
    </div>
  );
}
