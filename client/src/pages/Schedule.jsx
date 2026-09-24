import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks.js';
import { MODES, TIME_SLOTS, fmtDate, fmtTime, toLocalDate } from '../lib.js';
import { ErrorBox, StatusBadge, PriorityBadge } from '../components/ui.jsx';

const TECH_COLORS = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#db2777', '#0891b2', '#dc2626', '#4f46e5'];

function startOfWeek(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  return x;
}
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export default function Schedule() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [tech, setTech] = useState('');
  const days = useMemo(() => [...Array(7)].map((_, i) => addDays(weekStart, i)), [weekStart]);
  const from = toLocalDate(days[0]);
  const to = toLocalDate(addDays(days[6], 1));
  const { data, error } = useApi(`/schedule?from=${from}&to=${to}${tech ? `&technician=${tech}` : ''}`);
  const users = (useApi('/users').data || []).filter((u) => u.active);
  const colorOf = (uid) => (uid ? TECH_COLORS[users.findIndex((u) => u.id === uid) % TECH_COLORS.length] : '#94a3b8');
  const today = toLocalDate(new Date());

  const byDay = useMemo(() => {
    const map = {};
    for (const t of data?.scheduled || []) (map[t.scheduled_start.slice(0, 10)] ||= []).push(t);
    return map;
  }, [data]);

  const label = `${days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;

  return (
    <div className="page wide">
      <div className="page-head">
        <h1>Schedule</h1>
        <div className="row gap wrap">
          <select value={tech} onChange={(e) => setTech(e.target.value)}>
            <option value="">All technicians</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <div className="seg">
            <button onClick={() => setWeekStart(addDays(weekStart, -7))}>‹</button>
            <button onClick={() => setWeekStart(startOfWeek(new Date()))}>This week</button>
            <button onClick={() => setWeekStart(addDays(weekStart, 7))}>›</button>
          </div>
        </div>
      </div>
      <ErrorBox error={error} />
      <div className="schedule-layout">
        <div>
          <div className="week-label">{label}</div>
          <div className="week">
            {days.map((d) => {
              const key = toLocalDate(d);
              const items = byDay[key] || [];
              return (
                <div key={key} className={`day ${key === today ? 'today' : ''} ${key < today ? 'past' : ''}`}>
                  <div className="day-head">
                    <span>{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                    <strong>{d.getDate()}</strong>
                  </div>
                  <div className="day-body">
                    {items.map((t) => (
                      <Link key={t.id} to={`/app/tickets/${t.id}`} className="appt" style={{ borderLeftColor: colorOf(t.assigned_to) }}>
                        <div className="appt-time">
                          {fmtTime(t.scheduled_start)}
                          {t.scheduled_end && `–${fmtTime(t.scheduled_end)}`}
                        </div>
                        <div className="appt-title">{t.customer_company || t.customer_name}</div>
                        <div className="appt-sub">
                          {t.brand} {t.model}
                        </div>
                        <div className="appt-sub">
                          {t.service_mode === 'on_site' ? '📍 On-site' : MODES[t.service_mode]} · {t.assigned_name || 'Unassigned'}
                        </div>
                        <StatusBadge status={t.status} />
                      </Link>
                    ))}
                    {!items.length && <div className="day-empty">—</div>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="legend">
            {users.map((u) => (
              <span key={u.id}>
                <i style={{ background: colorOf(u.id) }} /> {u.name}
              </span>
            ))}
            <span>
              <i style={{ background: colorOf(null) }} /> Unassigned
            </span>
          </div>
        </div>

        <aside className="card queue">
          <h2>Needs scheduling</h2>
          <p className="muted small">Open tickets without a schedule. Open one to assign a technician and time.</p>
          <ul className="list">
            {(data?.unscheduled || []).map((t) => {
              const overdue = t.preferred_date && t.preferred_date < today;
              return (
                <li key={t.id}>
                  <Link to={`/app/tickets/${t.id}`} className="list-row col-row">
                    <span className="row between">
                      <strong>{t.code}</strong>
                      <PriorityBadge priority={t.priority} />
                    </span>
                    <span>{t.customer_company || t.customer_name}</span>
                    <small className="muted">
                      {t.brand} {t.model} · {MODES[t.service_mode]}
                    </small>
                    {t.preferred_date && (
                      <small className={overdue ? 'text-red' : 'text-blue'}>
                        Prefers {fmtDate(t.preferred_date)}
                        {t.preferred_time && t.preferred_time !== 'any' && ` (${TIME_SLOTS[t.preferred_time].split(' ')[0]})`}
                      </small>
                    )}
                  </Link>
                </li>
              );
            })}
            {data && !data.unscheduled.length && <li className="muted small">All caught up.</li>}
          </ul>
        </aside>
      </div>
    </div>
  );
}

