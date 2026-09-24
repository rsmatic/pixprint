import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApi } from '../hooks.js';
import { TYPES, fmtDate, money } from '../lib.js';
import { ErrorBox, Empty, Loading, Modal, StatusBadge, useShopSettings } from '../components/ui.jsx';
import { CustomerForm } from './Customers.jsx';
import { PrinterForm, MaintenanceBadge } from './Printers.jsx';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currency } = useShopSettings();
  const { data: c, error, loading, reload } = useApi(`/customers/${id}`);
  const [editing, setEditing] = useState(false);
  const [addingPrinter, setAddingPrinter] = useState(false);

  if (loading && !c) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  const lifetime = c.tickets.filter((t) => t.status === 'completed').reduce((s, t) => s + t.totals.total, 0);
  const balance = c.tickets.filter((t) => t.status !== 'cancelled').reduce((s, t) => s + Math.max(0, t.totals.balance), 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="crumbs">
            <Link to="/app/customers">Customers</Link> / {c.name}
          </div>
          <h1>{c.name}</h1>
          {c.company && <p className="muted">{c.company}</p>}
        </div>
        <div className="row gap">
          <button className="btn" onClick={() => setEditing(true)}>
            Edit
          </button>
          <Link className="btn btn-primary" to={`/app/tickets/new?customer=${c.id}`}>
            + New ticket
          </Link>
        </div>
      </div>

      <div className="detail-grid">
        <div className="col">
          <div className="card">
            <div className="row between">
              <h2>Printers ({c.printers.length})</h2>
              <button className="btn btn-sm" onClick={() => setAddingPrinter(true)}>
                + Add printer
              </button>
            </div>
            {c.printers.length ? (
              <table className="table hover">
                <thead>
                  <tr>
                    <th>Printer</th>
                    <th>Serial</th>
                    <th>Location</th>
                    <th>Maintenance</th>
                  </tr>
                </thead>
                <tbody>
                  {c.printers.map((p) => (
                    <tr key={p.id} onClick={() => navigate(`/app/printers/${p.id}`)}>
                      <td>
                        {p.brand} {p.model}
                      </td>
                      <td className="mono">{p.serial_number}</td>
                      <td>{p.location || '—'}</td>
                      <td>
                        <MaintenanceBadge p={p} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty>No printers registered.</Empty>
            )}
          </div>

          <div className="card">
            <h2>Service history ({c.tickets.length})</h2>
            {c.tickets.length ? (
              <table className="table hover">
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Printer</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {c.tickets.map((t) => (
                    <tr key={t.id} onClick={() => navigate(`/app/tickets/${t.id}`)}>
                      <td>
                        <span className="code">{t.code}</span>
                        <small className="muted block">{TYPES[t.type]}</small>
                      </td>
                      <td>
                        {t.brand} {t.model}
                      </td>
                      <td>
                        <StatusBadge status={t.status} />
                      </td>
                      <td>{fmtDate(t.created_at)}</td>
                      <td className="num">{t.totals.total ? money(t.totals.total, currency) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty>No service history.</Empty>
            )}
          </div>
        </div>

        <div className="col">
          <div className="card">
            <h2>Contact</h2>
            <dl className="details single">
              <div>
                <dt>Phone</dt>
                <dd>{c.phone ? <a href={`tel:${c.phone}`}>{c.phone}</a> : '—'}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : '—'}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{c.address || '—'}</dd>
              </div>
              {c.notes && (
                <div>
                  <dt>Notes</dt>
                  <dd className="pre">{c.notes}</dd>
                </div>
              )}
              <div>
                <dt>Customer since</dt>
                <dd>{fmtDate(c.created_at)}</dd>
              </div>
            </dl>
          </div>
          <div className="card">
            <h2>Account</h2>
            <dl className="details single">
              <div>
                <dt>Completed jobs value</dt>
                <dd>{money(lifetime, currency)}</dd>
              </div>
              <div>
                <dt>Outstanding balance</dt>
                <dd className={balance > 0.005 ? 'text-red' : ''}>{money(balance, currency)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {editing && (
        <Modal title="Edit customer" onClose={() => setEditing(false)}>
          <CustomerForm
            initial={c}
            onCancel={() => setEditing(false)}
            onSubmit={async (f) => {
              const { name, company, email, phone, address, notes } = f;
              await api(`/customers/${id}`, { method: 'PATCH', body: { name, company, email, phone, address, notes } });
              await reload();
              setEditing(false);
            }}
          />
        </Modal>
      )}
      {addingPrinter && (
        <Modal title="Add printer" onClose={() => setAddingPrinter(false)}>
          <PrinterForm
            onCancel={() => setAddingPrinter(false)}
            onSubmit={async (f) => {
              await api('/printers', { method: 'POST', body: { ...f, customer_id: c.id } });
              await reload();
              setAddingPrinter(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
