import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarX, ChevronLeft, ChevronRight, Columns3, List } from 'lucide-react';
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';
import { useAlerts } from '../../lib/alerts/alertContext.jsx';
import { apiErrorMessage } from '../../lib/alerts/apiErrorMessage.js';
import Skeleton from '../../components/ui/Skeleton.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { ROUND_GROUP_LEGEND } from '../../lib/interviewRounds.js';
import { addMonths, firstOfMonth, monthLabel } from './monthGrid.js';
import CalendarMonthView from './CalendarMonthView.jsx';
import CalendarAgendaView from './CalendarAgendaView.jsx';
import EventDetailDrawer from './EventDetailDrawer.jsx';
import FeedbackDrawer from './FeedbackDrawer.jsx';

const VIEW_KEY = 'delphic_calendar_view';
const STATUSES = ['all', 'scheduled', 'completed', 'cancelled'];

export default function CalendarPage() {
  const { user } = useAuth();
  const { pushError } = useAlerts();

  const [view, setView] = useState(() => localStorage.getItem(VIEW_KEY) || 'month');
  const [anchor, setAnchor] = useState(() => firstOfMonth(new Date()));
  const [scope, setScope] = useState(user?.role === 'recruiter' ? 'mine' : 'all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [detailEvent, setDetailEvent] = useState(null);
  const [feedbackEvent, setFeedbackEvent] = useState(null);

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  const range = useMemo(() => {
    if (view === 'agenda') {
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from.getTime() + 60 * 86400000);
      return { from, to };
    }
    const from = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    from.setDate(from.getDate() - 7);
    const to = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    to.setDate(to.getDate() + 14);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }, [view, anchor]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = { from: range.from.toISOString(), to: range.to.toISOString() };
      if (scope === 'mine') params.mine = '1';
      if (statusFilter !== 'all') params.status = statusFilter;
      const { data } = await apiClient.get('/interviews', { params });
      setEvents(data.data || []);
    } catch (err) {
      setError(true);
      pushError(apiErrorMessage(err, 'Failed to load the calendar'));
    } finally {
      setLoading(false);
    }
  }, [range, scope, statusFilter, pushError]);

  useEffect(() => {
    load();
  }, [load]);

  function openDetail(ev) {
    setDetailEvent(ev);
  }
  function openFeedback(ev) {
    setDetailEvent(null);
    setFeedbackEvent(ev);
  }

  return (
    <div className="space-y-4 py-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-tertiary-100 bg-white px-3 py-2 shadow-card">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg p-1.5 text-tertiary-500 hover:bg-tertiary-50"
            aria-label="Previous month"
            onClick={() => setAnchor((a) => addMonths(a, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="btn-ghost px-2 py-1 text-xs"
            onClick={() => setAnchor(firstOfMonth(new Date()))}
          >
            Today
          </button>
          <button
            type="button"
            className="rounded-lg p-1.5 text-tertiary-500 hover:bg-tertiary-50"
            aria-label="Next month"
            onClick={() => setAnchor((a) => addMonths(a, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <h2 className="ml-1 font-heading text-sm font-semibold text-tertiary-900">
            {view === 'agenda' ? 'Next 60 days' : monthLabel(anchor)}
          </h2>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-tertiary-200 p-0.5">
            <button
              type="button"
              onClick={() => setView('month')}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${view === 'month' ? 'bg-primary-600 text-white' : 'text-tertiary-600'}`}
            >
              <Columns3 className="h-3.5 w-3.5" /> Month
            </button>
            <button
              type="button"
              onClick={() => setView('agenda')}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${view === 'agenda' ? 'bg-primary-600 text-white' : 'text-tertiary-600'}`}
            >
              <List className="h-3.5 w-3.5" /> Agenda
            </button>
          </div>

          <div className="inline-flex rounded-lg border border-tertiary-200 p-0.5">
            <button
              type="button"
              onClick={() => setScope('mine')}
              className={`rounded px-2 py-1 text-xs ${scope === 'mine' ? 'bg-primary-600 text-white' : 'text-tertiary-600'}`}
            >
              My interviews
            </button>
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`rounded px-2 py-1 text-xs ${scope === 'all' ? 'bg-primary-600 text-white' : 'text-tertiary-600'}`}
            >
              All
            </button>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-tertiary-200 px-2 py-1 text-xs capitalize"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex w-full items-center gap-3 border-t border-tertiary-100 pt-2 text-[11px] text-tertiary-500">
          {ROUND_GROUP_LEGEND.map((l) => (
            <span key={l.key} className="flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${l.dot}`} /> {l.label}
            </span>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={CalendarX}
          title="Couldn’t load the calendar"
          description="Something went wrong fetching your interviews."
          action={
            <button type="button" className="btn-primary text-xs" onClick={load}>
              Retry
            </button>
          }
        />
      ) : view === 'month' ? (
        <>
          <div className="md:hidden">
            <CalendarAgendaView
              events={events}
              onOpenDetail={openDetail}
              onFeedback={openFeedback}
              onCancel={openDetail}
            />
          </div>
          <div className="hidden md:block">
            <CalendarMonthView anchor={anchor} events={events} onSelectEvent={openDetail} />
          </div>
        </>
      ) : (
        <CalendarAgendaView
          events={events}
          onOpenDetail={openDetail}
          onFeedback={openFeedback}
          onCancel={openDetail}
        />
      )}

      <EventDetailDrawer
        event={detailEvent}
        open={Boolean(detailEvent)}
        onClose={() => setDetailEvent(null)}
        onFeedback={openFeedback}
        onChanged={load}
      />
      <FeedbackDrawer
        event={feedbackEvent}
        open={Boolean(feedbackEvent)}
        onClose={() => setFeedbackEvent(null)}
        onSaved={load}
      />
    </div>
  );
}
