import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApi } from '../hooks.js';
import { PRINTER_BRANDS, fmtDate } from '../lib.js';
import { ErrorBox, Empty, Field, Loading, useShopSettings } from '../components/ui.jsx';

export function MaintenanceBadge({ p }) {
  if (!p.maintenance_interval_days) return <span className="muted small">Not tracked</span>;
  const map = {
    overdue: ['red', `Overdue · ${fmtDate(p.next_maintenance)}`],
    due_soon: ['amber', `Due ${fmtDate(p.next_maintenance)}`],
    ok: ['green', `Next ${fmtDate(p.next_maintenance)}`],
  };
  const [color, text] = map[p.maintenance_state] || ['gray', '—'];
  return <span className={`badge badge-${color}`}>{text}</span>;
}

export function PrinterForm({ initial = {}, onSubmit, onCancel, submitLabel = 'Save' }) {
  const settings = useShopSettings();
  const [f, setF] = useState({
    brand: '',
    model: '',
    serial_number: '',
    location: '',
    notes: '',
    maintenance_interval_days: initial.id ? '' : settings.default_maintenance_days || '',
    last_maintenance_at: '',
    ...initial,
  });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const { brand, model, serial_number, location, notes, maintenance_interval_days, last_maintenance_at } = f;
          await onSubmit({ brand, model, serial_number, location, notes, maintenance_interval_days, last_maintenance_at });
        } catch (err) {
          setError(err.message);
        }
      }}
    >
      <ErrorBox error={error} />
      <div className="grid-2">
        <Field label="Brand *">
          <input value={f.brand || ''} onChange={set('brand')} list="brands" required autoFocus />
          <datalist id="brands">
            {PRINTER_BRANDS.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </Field>
        <Field label="Model *">
          <input value={f.model || ''} onChange={set('model')} required />
        </Field>
        <Field label="Serial number *">
          <input value={f.serial_number || ''} onChange={set('serial_number')} required />
        </Field>
        <Field label="Location">
          <input value={f.location || ''} onChange={set('location')} placeholder="e.g. HR office, 3F" />
        </Field>
        <Field label="Preventive maintenance every (days)" hint="Leave blank to not track maintenance">
          <input type="number" min="1" value={f.maintenance_interval_days ?? ''} onChange={set('maintenance_interval_days')} />
        </Field>
        <Field label="Last maintenance">
          <input type="date" value={f.last_maintenance_at || ''} onChange={set('last_maintenance_at')} />
        </Field>
        <Field label="Notes" className="span-2">
          <textarea rows={2} value={f.notes || ''} onChange={set('notes')} placeholder="Contract, toner type, network settings…" />
        </Field>
      </div>
      <div className="row gap end">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary">{submitLabel}</button>
      </div>
    </form>
  );
}

export default function Printers() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const due = params.get('maintenance') === 'due';
  const qs = new URLSearchParams();
  if (q) qs.set('q', q);
  if (due) qs.set('maintenance', 'due');
  const { data, error, loading, reload } = useApi(`/printers?${qs}`);
  const [busyId, setBusyId] = useState(null);

  const createMaintenance = async (p, e) => {
    e.stopPropagation();
    setBusyId(p.id);
    try {
      const { id } = await api(`/printers/${p.id}/maintenance-ticket`, { method: 'POST', body: {} });
      navigate(`/app/tickets/${id}`);
    } catch (err) {
      alert(err.message);
      setBusyId(null);
      reload();
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Printers</h1>
        <div className="seg">
          <button className={!due ? 'on' : ''} onClick={() => setParams({})}>
            All units
          </button>
          <button className={due ? 'on' : ''} onClick={() => setParams({ maintenance: 'due' })}>
            Maintenance due
          </button>
        </div>
      </div>
      <div className="filters card">
        <input className="search" placeholder="Search serial number, brand, model, customer…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ErrorBox error={error} />
      {loading && !data ? (
        <Loading />
      ) : !data?.length ? (
        <Empty>{due ? 'No printers are due for maintenance.' : 'No printers found.'}</Empty>
      ) : (
        <div className="card table-card">
          <table className="table hover">
            <thead>
              <tr>
                <th>Printer</th>
                <th>Serial number</th>
                <th>Owner</th>
                <th>Location</th>
                <th className="num">Jobs</th>
                <th>Maintenance</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} onClick={() => navigate(`/app/printers/${p.id}`)}>
                  <td>
                    <strong>{p.brand}</strong> {p.model}
                  </td>
                  <td className="mono">{p.serial_number}</td>
                  <td>
                    {p.customer_name}
                    {p.customer_company && <small className="muted block">{p.customer_company}</small>}
                  </td>
                  <td>{p.location || '—'}</td>
                  <td className="num">{p.ticket_count}</td>
                  <td>
                    <MaintenanceBadge p={p} />
                  </td>
                  <td className="nowrap">
                    {p.open_ticket_id ? (
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/app/tickets/${p.open_ticket_id}`);
                        }}
                      >
                        Open ticket →
                      </button>
                    ) : (
                      ['overdue', 'due_soon'].includes(p.maintenance_state) && (
                        <button className="btn btn-sm" disabled={busyId === p.id} onClick={(e) => createMaintenance(p, e)}>
                          Create PM ticket
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
