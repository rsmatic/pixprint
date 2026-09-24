import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApi } from '../hooks.js';
import { STATUSES, TYPES, fmtDate, fmtSchedule, money, timeAgo } from '../lib.js';
import { ErrorBox, Loading, Empty, StatusBadge, PriorityBadge, useShopSettings } from '../components/ui.jsx';

export default function Tickets() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { currency } = useShopSettings();
  const [q, setQ] = useState(params.get('q') || '');
  const users = useApi('/users').data || [];

  // debounce search input into the URL
  useEffect(() => {
    const id = setTimeout(() => {
      const next = new URLSearchParams(params);
      q ? next.set('q', q) : next.delete('q');
      if (next.toString() !== params.toString()) setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    v ? next.set(k, v) : next.delete(k);
    if (k === 'status') next.delete('open');
    setParams(next);
  };

  const status = params.get('status') || (params.get('open') === '1' ? 'open' : '');
  const qs = new URLSearchParams(params);
  if (status === 'open') {
    qs.delete('status');
    qs.set('open', '1');
  }
  const { data, error, loading } = useApi(`/tickets?${qs.toString()}`);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Service tickets</h1>
        <Link to="/app/tickets/new" className="btn btn-primary">
          + New ticket
        </Link>
      </div>

      <div className="filters card">
        <input className="search" placeholder="Search ticket #, customer, serial number, model, issue…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select
          value={status}
          onChange={(e) => {
            const v = e.target.value;
            const next = new URLSearchParams(params);
            next.delete('status');
            next.delete('open');
            if (v === 'open') next.set('open', '1');
            else if (v) next.set('status', v);
            setParams(next);
          }}
        >
          <option value="">All statuses</option>
          <option value="open">All open</option>
          {STATUSES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
          {status && status.includes(',') && <option value={status}>Custom filter</option>}
        </select>
        <select value={params.get('assigned') || ''} onChange={(e) => setParam('assigned', e.target.value)}>
          <option value="">Any technician</option>
          <option value="me">Assigned to me</option>
          <option value="none">Unassigned</option>
          {users
            .filter((u) => u.active)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
        </select>
        <select value={params.get('type') || ''} onChange={(e) => setParam('type', e.target.value)}>
          <option value="">All types</option>
          {Object.entries(TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <ErrorBox error={error} />
      {loading && !data ? (
        <Loading />
      ) : !data?.length ? (
        <Empty>No tickets match these filters.</Empty>
      ) : (
        <div className="card table-card">
          <table className="table hover">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Customer</th>
                <th>Printer</th>
                <th>Status</th>
                <th>Technician</th>
                <th>Schedule</th>
                <th className="num">Total</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.id} onClick={() => navigate(`/app/tickets/${t.id}`)}>
                  <td>
                    <span className="code">{t.code}</span> <PriorityBadge priority={t.priority} />
                    <small className="muted block">{TYPES[t.type]}</small>
                  </td>
                  <td>
                    {t.customer_name}
                    {t.customer_company && <small className="muted block">{t.customer_company}</small>}
                  </td>
                  <td>
                    {t.brand} {t.model}
                    <small className="muted block">SN {t.serial_number}</small>
                  </td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                  <td>{t.assigned_name || <span className="muted">—</span>}</td>
                  <td className="nowrap">
                    {t.scheduled_start ? (
                      fmtSchedule(t.scheduled_start)
                    ) : t.preferred_date ? (
                      <span className="muted">Pref. {fmtDate(t.preferred_date)}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="num">
                    {t.totals.total ? money(t.totals.total, currency) : <span className="muted">—</span>}
                    {t.totals.balance > 0.005 && t.totals.paid > 0 && <small className="muted block">bal {money(t.totals.balance, currency)}</small>}
                  </td>
                  <td className="nowrap muted">{timeAgo(t.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
