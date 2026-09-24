import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApi } from '../hooks.js';
import { TYPES, fmtDate, money } from '../lib.js';
import { ErrorBox, Empty, Loading, Modal, StatusBadge, useShopSettings } from '../components/ui.jsx';
import { MaintenanceBadge, PrinterForm } from './Printers.jsx';

export default function PrinterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currency } = useShopSettings();
  const { data: p, error, loading, reload } = useApi(`/printers/${id}`);
  const [editing, setEditing] = useState(false);
  const [actionError, setActionError] = useState(null);

  if (loading && !p) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  const spent = p.tickets.filter((t) => t.status === 'completed').reduce((s, t) => s + t.totals.total, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="crumbs">
            <Link to="/app/printers">Printers</Link> / {p.serial_number}
          </div>
          <h1>
            {p.brand} {p.model}
          </h1>
          <p className="muted mono">SN {p.serial_number}</p>
        </div>
        <div className="row gap wrap">
          <button className="btn" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button
            className="btn"
            onClick={async () => {
              try {
                const { id: tid } = await api(`/printers/${p.id}/maintenance-ticket`, { method: 'POST', body: {} });
                navigate(`/app/tickets/${tid}`);
              } catch (err) {
                setActionError(err.message);
              }
            }}
          >
            + Maintenance ticket
          </button>
          <Link className="btn btn-primary" to={`/app/tickets/new?customer=${p.customer_id}&printer=${p.id}`}>
            + Repair ticket
          </Link>
        </div>
      </div>
      <ErrorBox error={actionError} />
      <div className="detail-grid">
        <div className="col">
          <div className="card">
            <h2>Service history ({p.tickets.length})</h2>
            {p.tickets.length ? (
              <ul className="history">
                {p.tickets.map((t) => (
                  <li key={t.id}>
                    <Link to={`/app/tickets/${t.id}`}>
                      <div className="row between">
                        <span>
                          <span className="code">{t.code}</span> · {TYPES[t.type]} · {fmtDate(t.created_at)}
                        </span>
                        <StatusBadge status={t.status} />
                      </div>
                      <div className="small">{t.issue}</div>
                      {t.diagnosis && <div className="small muted">Findings: {t.diagnosis}</div>}
                      <div className="small muted">
                        {t.assigned_name || 'Unassigned'}
                        {t.totals.total > 0 && ` · ${money(t.totals.total, currency)}`}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No service history yet.</Empty>
            )}
          </div>
        </div>
        <div className="col">
          <div className="card">
            <h2>Details</h2>
            <dl className="details single">
              <div>
                <dt>Owner</dt>
                <dd>
                  <Link to={`/app/customers/${p.customer_id}`}>{p.customer_name}</Link>
                  {p.customer_company && <small className="muted block">{p.customer_company}</small>}
                </dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{p.location || '—'}</dd>
              </div>
              <div>
                <dt>Registered</dt>
                <dd>{fmtDate(p.created_at)}</dd>
              </div>
              <div>
                <dt>Total spent on completed jobs</dt>
                <dd>{money(spent, currency)}</dd>
              </div>
              {p.notes && (
                <div>
                  <dt>Notes</dt>
                  <dd className="pre">{p.notes}</dd>
                </div>
              )}
            </dl>
          </div>
          <div className="card">
            <h2>Preventive maintenance</h2>
            <dl className="details single">
              <div>
                <dt>Interval</dt>
                <dd>{p.maintenance_interval_days ? `Every ${p.maintenance_interval_days} days` : 'Not tracked'}</dd>
              </div>
              <div>
                <dt>Last maintenance</dt>
                <dd>{fmtDate(p.last_maintenance_at)}</dd>
              </div>
              <div>
                <dt>Next due</dt>
                <dd>
                  <MaintenanceBadge p={p} />
                </dd>
              </div>
            </dl>
            <p className="muted small">Completing a maintenance ticket updates the last maintenance date automatically.</p>
          </div>
        </div>
      </div>
      {editing && (
        <Modal title="Edit printer" onClose={() => setEditing(false)}>
          <PrinterForm
            initial={p}
            onCancel={() => setEditing(false)}
            onSubmit={async (f) => {
              await api(`/printers/${id}`, { method: 'PATCH', body: f });
              await reload();
              setEditing(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
