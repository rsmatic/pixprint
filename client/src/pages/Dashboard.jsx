import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks.js';
import { useAuth } from '../auth.jsx';
import { STATUSES, OPEN_STATUSES, fmtTime, money, timeAgo } from '../lib.js';
import { ErrorBox, Loading, Empty, StatCard, StatusBadge, PriorityBadge, useShopSettings } from '../components/ui.jsx';

export default function Dashboard() {
  const { data, error, loading } = useApi('/dashboard');
  const { user } = useAuth();
  const { currency } = useShopSettings();
  const navigate = useNavigate();

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  const s = data.byStatus;
  const go = (qs) => () => navigate(`/app/tickets?${qs}`);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user.name.split(' ')[0]}</h1>
          <p className="muted">Here's what's happening in the shop today.</p>
        </div>
        <Link to="/app/tickets/new" className="btn btn-primary">
          + New ticket
        </Link>
      </div>

      <div className="stats">
        <StatCard label="Open tickets" value={data.open} onClick={go('open=1')} />
        <StatCard label="New requests" value={s.new || 0} tone={s.new ? 'blue' : ''} sub="Need scheduling" onClick={go('status=new')} />
        <StatCard label="Unassigned" value={data.unassigned} tone={data.unassigned ? 'amber' : ''} onClick={go('assigned=none&open=1')} />
        <StatCard
          label="Awaiting approval"
          value={s.awaiting_approval || 0}
          sub="Quotes sent to customers"
          onClick={go('status=awaiting_approval')}
        />
        <StatCard label="Ready for pickup" value={s.ready || 0} tone={s.ready ? 'green' : ''} onClick={go('status=ready')} />
        <StatCard
          label="Maintenance due"
          value={data.maintenanceDue}
          tone={data.maintenanceDue ? 'rose' : ''}
          sub="Overdue or within 14 days"
          onClick={() => navigate('/app/printers?maintenance=due')}
        />
        <StatCard label="Revenue this month" value={money(data.revenue, currency)} sub={`${data.completedThisMonth} completed jobs`} />
        <StatCard
          label="Unpaid balances"
          value={money(data.outstandingAmount, currency)}
          tone={data.outstandingCount ? 'amber' : ''}
          sub={`${data.outstandingCount} ticket(s)`}
          onClick={go('status=ready,completed')}
        />
      </div>

      <div className="grid-2 dash-grid">
        <div className="card">
          <div className="row between">
            <h2>Today's schedule</h2>
            <Link to="/app/schedule" className="small">
              Open calendar →
            </Link>
          </div>
          {data.todaySchedule.length ? (
            <ul className="list">
              {data.todaySchedule.map((t) => (
                <li key={t.id}>
                  <Link to={`/app/tickets/${t.id}`} className="list-row">
                    <span className="time-pill">{fmtTime(t.scheduled_start)}</span>
                    <span className="grow">
                      <strong>{t.customer_company || t.customer_name}</strong>
                      <small className="muted block">
                        {t.brand} {t.model} · {t.assigned_name || 'Unassigned'}
                      </small>
                    </span>
                    <StatusBadge status={t.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing scheduled today.</Empty>
          )}
        </div>

        <div className="card">
          <div className="row between">
            <h2>New requests</h2>
            <Link to="/app/tickets?status=new" className="small">
              View all →
            </Link>
          </div>
          {data.newRequests.length ? (
            <ul className="list">
              {data.newRequests.map((t) => (
                <li key={t.id}>
                  <Link to={`/app/tickets/${t.id}`} className="list-row">
                    <span className="grow">
                      <strong>
                        {t.code} · {t.customer_company || t.customer_name}
                      </strong>{' '}
                      <PriorityBadge priority={t.priority} />
                      <small className="muted block truncate">
                        {t.brand} {t.model} — {t.issue}
                      </small>
                    </span>
                    <small className="muted">{timeAgo(t.created_at)}</small>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No new requests. 🎉</Empty>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Pipeline</h2>
        <div className="pipeline">
          {STATUSES.filter((x) => OPEN_STATUSES.includes(x.key)).map((x) => (
            <button key={x.key} className={`pipe pipe-${x.color}`} onClick={go(`status=${x.key}`)}>
              <span className="pipe-n">{s[x.key] || 0}</span>
              <span className="pipe-l">{x.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Recently updated</h2>
        <ul className="list">
          {data.recent.map((t) => (
            <li key={t.id}>
              <Link to={`/app/tickets/${t.id}`} className="list-row">
                <span className="code">{t.code}</span>
                <span className="grow truncate">
                  {t.customer_company || t.customer_name} — {t.brand} {t.model}
                </span>
                <StatusBadge status={t.status} />
                <small className="muted nowrap">{timeAgo(t.updated_at)}</small>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
