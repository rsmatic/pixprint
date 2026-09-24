import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApi } from '../hooks.js';
import { COMMON_ISSUES, MODES, PRINTER_BRANDS, PRIORITIES, TYPES } from '../lib.js';
import { ErrorBox, Field } from '../components/ui.jsx';

export default function NewTicket() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [customerQuery, setCustomerQuery] = useState('');
  const [customer, setCustomer] = useState(null); // existing customer record
  const [newCustomer, setNewCustomer] = useState({ name: '', company: '', email: '', phone: '', address: '' });
  const [printerId, setPrinterId] = useState('');
  const [newPrinter, setNewPrinter] = useState({ brand: '', model: '', serial_number: '', location: '' });
  const [form, setForm] = useState({ type: 'repair', service_mode: 'drop_off', priority: 'normal', issue: '', accessories: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const matches = useApi(customerQuery.length >= 2 && !customer ? `/customers?q=${encodeURIComponent(customerQuery)}` : null).data;
  const customerDetail = useApi(customer ? `/customers/${customer.id}` : null).data;

  useEffect(() => {
    const cid = params.get('customer');
    if (cid) api(`/customers/${cid}`).then(setCustomer).catch(() => {});
  }, [params]);

  useEffect(() => {
    const pid = params.get('printer');
    if (pid && customerDetail?.printers.some((p) => String(p.id) === pid)) setPrinterId(pid);
  }, [customerDetail, params]);

  const upd = (setter) => (k) => (e) => setter((s) => ({ ...s, [k]: e.target.value }));
  const setF = upd(setForm);
  const setNC = upd(setNewCustomer);
  const setNP = upd(setNewPrinter);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        ...form,
        customer: customer ? { id: customer.id } : newCustomer,
        printer: printerId ? { id: Number(printerId) } : newPrinter,
      };
      const t = await api('/tickets', { method: 'POST', body });
      navigate(`/app/tickets/${t.id}`);
    } catch (err) {
      setError(err.message);
      window.scrollTo(0, 0);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page narrow-page">
      <div className="page-head">
        <h1>New service ticket</h1>
      </div>
      <form className="card form-card" onSubmit={submit}>
        <ErrorBox error={error} />
        <section>
          <h2 className="section-title">Customer</h2>
          {customer ? (
            <div className="selected-box">
              <div>
                <strong>{customer.name}</strong>
                {customer.company && <> · {customer.company}</>}
                <small className="muted block">{[customer.email, customer.phone].filter(Boolean).join(' · ')}</small>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setCustomer(null);
                  setPrinterId('');
                }}
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <Field label="Find existing customer">
                <input value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} placeholder="Search by name, company, phone or email" />
              </Field>
              {matches?.length > 0 && (
                <ul className="picker">
                  {matches.slice(0, 8).map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => setCustomer(c)}>
                        <strong>{c.name}</strong> {c.company && <span className="muted">· {c.company}</span>}
                        <small className="muted block">{[c.email, c.phone].filter(Boolean).join(' · ')}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="muted small">…or enter a new customer:</p>
              <div className="grid-2">
                <Field label="Name *">
                  <input value={newCustomer.name} onChange={setNC('name')} />
                </Field>
                <Field label="Company">
                  <input value={newCustomer.company} onChange={setNC('company')} />
                </Field>
                <Field label="Email">
                  <input type="email" value={newCustomer.email} onChange={setNC('email')} />
                </Field>
                <Field label="Phone">
                  <input value={newCustomer.phone} onChange={setNC('phone')} />
                </Field>
                <Field label="Address" className="span-2">
                  <input value={newCustomer.address} onChange={setNC('address')} />
                </Field>
              </div>
            </>
          )}
        </section>

        <section>
          <h2 className="section-title">Printer</h2>
          {customerDetail?.printers.length > 0 && (
            <Field label="Customer's registered printers">
              <select value={printerId} onChange={(e) => setPrinterId(e.target.value)}>
                <option value="">+ Add a new printer</option>
                {customerDetail.printers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.brand} {p.model} — SN {p.serial_number}
                    {p.location ? ` (${p.location})` : ''}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {!printerId && (
            <div className="grid-2">
              <Field label="Brand *">
                <input value={newPrinter.brand} onChange={setNP('brand')} list="brands" />
                <datalist id="brands">
                  {PRINTER_BRANDS.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </Field>
              <Field label="Model *">
                <input value={newPrinter.model} onChange={setNP('model')} />
              </Field>
              <Field label="Serial number *">
                <input value={newPrinter.serial_number} onChange={setNP('serial_number')} />
              </Field>
              <Field label="Location" hint="e.g. 2nd floor accounting">
                <input value={newPrinter.location} onChange={setNP('location')} />
              </Field>
            </div>
          )}
        </section>

        <section>
          <h2 className="section-title">Job</h2>
          <div className="grid-3">
            <Field label="Type">
              <select value={form.type} onChange={setF('type')}>
                {Object.entries(TYPES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Service mode">
              <select value={form.service_mode} onChange={setF('service_mode')}>
                {Object.entries(MODES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select value={form.priority} onChange={setF('priority')}>
                {Object.entries(PRIORITIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="chips">
            {COMMON_ISSUES.map((i) => (
              <button
                type="button"
                key={i}
                className="chip"
                onClick={() => setForm((f) => ({ ...f, issue: f.issue ? `${f.issue.trim()}, ${i}` : i }))}
              >
                + {i}
              </button>
            ))}
          </div>
          <Field label="Issue *">
            <textarea rows={4} value={form.issue} onChange={setF('issue')} required />
          </Field>
          <Field label="Accessories received with unit">
            <input value={form.accessories} onChange={setF('accessories')} placeholder="Power cable, USB cable…" />
          </Field>
        </section>

        <div className="row gap end">
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create ticket'}
          </button>
        </div>
      </form>
    </div>
  );
}
