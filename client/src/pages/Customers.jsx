import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApi } from '../hooks.js';
import { ErrorBox, Empty, Field, Loading, Modal } from '../components/ui.jsx';

export function CustomerForm({ initial = {}, onSubmit, onCancel, submitLabel = 'Save' }) {
  const [f, setF] = useState({ name: '', company: '', email: '', phone: '', address: '', notes: '', ...initial });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value ?? '' }));
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await onSubmit(f);
        } catch (err) {
          setError(err.message);
        }
      }}
    >
      <ErrorBox error={error} />
      <div className="grid-2">
        <Field label="Name *">
          <input value={f.name || ''} onChange={set('name')} required autoFocus />
        </Field>
        <Field label="Company">
          <input value={f.company || ''} onChange={set('company')} />
        </Field>
        <Field label="Email">
          <input type="email" value={f.email || ''} onChange={set('email')} />
        </Field>
        <Field label="Phone">
          <input value={f.phone || ''} onChange={set('phone')} />
        </Field>
        <Field label="Address" className="span-2">
          <input value={f.address || ''} onChange={set('address')} />
        </Field>
        <Field label="Internal notes" className="span-2">
          <textarea rows={2} value={f.notes || ''} onChange={set('notes')} />
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

export default function Customers() {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const navigate = useNavigate();
  const { data, error, loading } = useApi(`/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Customers</h1>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          + Add customer
        </button>
      </div>
      <div className="filters card">
        <input className="search" placeholder="Search name, company, email, phone…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ErrorBox error={error} />
      {loading && !data ? (
        <Loading />
      ) : !data?.length ? (
        <Empty>No customers yet. They're added automatically when a service request comes in.</Empty>
      ) : (
        <div className="card table-card">
          <table className="table hover">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Contact</th>
                <th className="num">Printers</th>
                <th className="num">Tickets</th>
                <th className="num">Open</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id} onClick={() => navigate(`/app/customers/${c.id}`)}>
                  <td>
                    <strong>{c.name}</strong>
                  </td>
                  <td>{c.company || <span className="muted">—</span>}</td>
                  <td>
                    {c.phone}
                    {c.email && <small className="muted block">{c.email}</small>}
                  </td>
                  <td className="num">{c.printer_count}</td>
                  <td className="num">{c.ticket_count}</td>
                  <td className="num">{c.open_count ? <span className="badge badge-blue">{c.open_count}</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {adding && (
        <Modal title="Add customer" onClose={() => setAdding(false)}>
          <CustomerForm
            submitLabel="Add customer"
            onCancel={() => setAdding(false)}
            onSubmit={async (f) => {
              const c = await api('/customers', { method: 'POST', body: f });
              navigate(`/app/customers/${c.id}`);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
