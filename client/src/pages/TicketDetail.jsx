import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApi } from '../hooks.js';
import { useAuth } from '../auth.jsx';
import {
  MODES,
  PRIORITIES,
  STATUS,
  STATUSES,
  TIME_SLOTS,
  TYPES,
  fmtDate,
  fmtDateTime,
  fmtSchedule,
  money,
  parseDate,
  toLocalInput,
  trackUrl,
} from '../lib.js';
import { CopyButton, ErrorBox, Field, Loading, Modal, PriorityBadge, StatusBadge, Totals, useShopSettings } from '../components/ui.jsx';

// suggested next step for each status
const NEXT = {
  new: { status: 'received', label: 'Mark unit received' },
  scheduled: { status: 'received', label: 'Mark unit received' },
  received: { status: 'diagnosing', label: 'Start diagnosis' },
  approved: { status: 'in_repair', label: 'Start repair' },
  in_repair: { status: 'ready', label: 'Mark ready for pickup' },
  waiting_parts: { status: 'in_repair', label: 'Parts arrived – resume repair' },
  ready: { status: 'completed', label: 'Complete & release unit' },
};

const DURATIONS = [30, 60, 90, 120, 180, 240, 480];

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const settings = useShopSettings();
  const { data: t, error, loading, setData } = useApi(`/tickets/${id}`);
  const users = useApi('/users').data || [];
  const [statusModal, setStatusModal] = useState(null);
  const [actionError, setActionError] = useState(null);

  if (loading && !t) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  const url = trackUrl(t.token, settings.public_base_url);
  const cur = settings.currency;

  const run = async (fn) => {
    setActionError(null);
    try {
      return await fn();
    } catch (err) {
      setActionError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      throw err;
    }
  };
  const patch = (body) =>
    run(async () => {
      const res = await api(`/tickets/${id}`, { method: 'PATCH', body });
      setData(res.ticket);
      return res;
    });
  const post = (path, body) =>
    run(async () => {
      const res = await api(`/tickets/${id}${path}`, { method: path === '/items' ? 'PUT' : 'POST', body });
      setData(res);
      return res;
    });

  const next = NEXT[t.status];
  const shareMessage = `Hi ${t.customer_name.split(' ')[0]}, you can check the status of your ${t.brand} ${t.model} repair (ticket ${t.code}) here: ${url}`;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="crumbs">
            <Link to="/app/tickets">Tickets</Link> / {t.code}
          </div>
          <h1 className="row gap wrap">
            {t.code} <StatusBadge status={t.status} /> <PriorityBadge priority={t.priority} />
          </h1>
          <p className="muted">
            {TYPES[t.type]} · {MODES[t.service_mode]} · created {fmtDateTime(t.created_at)}
            {t.source === 'customer' && ' via online form'}
          </p>
        </div>
        <div className="row gap wrap">
          <Link className="btn" to={`/app/tickets/${t.id}/print`} target="_blank">
            🖨 Job sheet
          </Link>
          <button className="btn" onClick={() => setStatusModal({ status: t.status })}>
            Change status
          </button>
          {next && (
            <button className="btn btn-primary" onClick={() => setStatusModal({ status: next.status })}>
              {next.label}
            </button>
          )}
          {t.status === 'diagnosing' && t.items.length > 0 && (
            <button className="btn btn-primary" onClick={() => post('/quote').catch(() => {})}>
              Send quote to customer
            </button>
          )}
        </div>
      </div>

      <ErrorBox error={actionError} />

      <div className="detail-grid">
        <div className="col">
          <div className="card">
            <div className="grid-2 info-grid">
              <div>
                <h3 className="card-label">Customer</h3>
                <Link to={`/app/customers/${t.customer_id}`} className="strong-link">
                  {t.customer_name}
                </Link>
                {t.customer_company && <div>{t.customer_company}</div>}
                <div className="muted small">
                  {t.customer_phone && (
                    <a href={`tel:${t.customer_phone}`} className="block">
                      📞 {t.customer_phone}
                    </a>
                  )}
                  {t.customer_email && (
                    <a href={`mailto:${t.customer_email}`} className="block">
                      ✉ {t.customer_email}
                    </a>
                  )}
                  {t.customer_address && <div>📍 {t.customer_address}</div>}
                </div>
              </div>
              <div>
                <h3 className="card-label">Printer</h3>
                <Link to={`/app/printers/${t.printer_id}`} className="strong-link">
                  {t.brand} {t.model}
                </Link>
                <div className="mono">SN {t.serial_number}</div>
                {t.printer_location && <div className="muted small">{t.printer_location}</div>}
                {t.accessories && <div className="small">Accessories: {t.accessories}</div>}
              </div>
            </div>
            <EditableText
              label="Reported issue"
              value={t.issue}
              onSave={(issue) => patch({ issue })}
              required
            />
            <EditableText
              label="Diagnosis / technician findings"
              value={t.diagnosis}
              placeholder="What did you find? This is visible to the customer on their status page."
              onSave={(diagnosis) => patch({ diagnosis })}
            />
            <div className="grid-3 compact">
              <Field label="Type">
                <select value={t.type} onChange={(e) => patch({ type: e.target.value }).catch(() => {})}>
                  {Object.entries(TYPES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Service mode">
                <select value={t.service_mode} onChange={(e) => patch({ service_mode: e.target.value }).catch(() => {})}>
                  {Object.entries(MODES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Priority">
                <select value={t.priority} onChange={(e) => patch({ priority: e.target.value }).catch(() => {})}>
                  {Object.entries(PRIORITIES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          <CostCard t={t} currency={cur} post={post} patch={patch} />
        </div>

        <div className="col">
          <ScheduleCard t={t} users={users} patch={patch} />

          <div className="card">
            <h2>Customer status link</h2>
            <p className="muted small">Share this so the customer can follow progress and approve the quote.</p>
            <div className="link-box">
              <input readOnly value={url} onFocus={(e) => e.target.select()} />
              <CopyButton text={url} className="btn btn-primary" />
            </div>
            <div className="row gap wrap">
              <a className="btn btn-sm" href={url} target="_blank" rel="noreferrer">
                Open
              </a>
              <CopyButton text={shareMessage} label="Copy message" className="btn btn-sm" />
              {t.customer_phone && (
                <a className="btn btn-sm" href={`sms:${t.customer_phone}?body=${encodeURIComponent(shareMessage)}`}>
                  SMS
                </a>
              )}
              {t.customer_email && (
                <a
                  className="btn btn-sm"
                  href={`mailto:${t.customer_email}?subject=${encodeURIComponent(`Your printer service ${t.code}`)}&body=${encodeURIComponent(shareMessage)}`}
                >
                  Email
                </a>
              )}
            </div>
          </div>

          <Timeline t={t} post={post} />

          {user.role === 'admin' && (
            <button
              className="btn btn-danger-ghost btn-sm"
              onClick={async () => {
                if (!window.confirm(`Permanently delete ticket ${t.code}? This cannot be undone.`)) return;
                await run(() => api(`/tickets/${id}`, { method: 'DELETE' }));
                navigate('/app/tickets');
              }}
            >
              Delete ticket
            </button>
          )}
        </div>
      </div>

      {statusModal && (
        <StatusModal
          initial={statusModal.status}
          current={t.status}
          onClose={() => setStatusModal(null)}
          onSave={async (body) => {
            await post('/status', body);
            setStatusModal(null);
          }}
          t={t}
        />
      )}
    </div>
  );
}

function EditableText({ label, value, onSave, placeholder, required }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value || '');
  useEffect(() => setText(value || ''), [value]);
  return (
    <div className="editable">
      <div className="row between">
        <h3 className="card-label">{label}</h3>
        {!editing && (
          <button className="btn-link" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await onSave(text);
              setEditing(false);
            } catch {
              /* shown by parent */
            }
          }}
        >
          <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} autoFocus required={required} />
          <div className="row gap end">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => (setEditing(false), setText(value || ''))}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm">Save</button>
          </div>
        </form>
      ) : value ? (
        <p className="pre">{value}</p>
      ) : (
        <p className="muted small">{placeholder || '—'}</p>
      )}
    </div>
  );
}

function ScheduleCard({ t, users, patch }) {
  const initDuration = () => {
    if (t.scheduled_start && t.scheduled_end) {
      return Math.max(15, Math.round((parseDate(t.scheduled_end) - parseDate(t.scheduled_start)) / 60000));
    }
    return t.service_mode === 'on_site' ? 120 : 60;
  };
  const defaultStart = () => {
    if (t.preferred_date) return `${t.preferred_date}T${t.preferred_time === 'afternoon' ? '13:00' : '09:00'}`;
    return '';
  };
  const [assigned, setAssigned] = useState(t.assigned_to || '');
  const [start, setStart] = useState(t.scheduled_start || '');
  const [duration, setDuration] = useState(initDuration);
  const [conflicts, setConflicts] = useState([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setAssigned(t.assigned_to || '');
    setStart(t.scheduled_start || '');
    setDuration(initDuration());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.assigned_to, t.scheduled_start, t.scheduled_end]);

  const dirty = String(assigned) !== String(t.assigned_to || '') || start !== (t.scheduled_start || '') || duration !== initDuration();

  const save = async (e) => {
    e.preventDefault();
    let end = null;
    if (start) end = toLocalInput(new Date(parseDate(start).getTime() + duration * 60000));
    try {
      const res = await patch({ assigned_to: assigned || null, scheduled_start: start || null, scheduled_end: end });
      setConflicts(res.conflicts || []);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      /* shown by parent */
    }
  };

  const active = users.filter((u) => u.active || u.id === t.assigned_to);

  return (
    <form className="card" onSubmit={save}>
      <h2>Assignment & schedule</h2>
      {t.preferred_date && (
        <p className="small muted">
          Customer prefers: <strong>{fmtDate(t.preferred_date)}</strong>
          {t.preferred_time && `, ${TIME_SLOTS[t.preferred_time]}`}
          {!start && (
            <>
              {' '}
              ·{' '}
              <button type="button" className="btn-link" onClick={() => setStart(defaultStart())}>
                use this
              </button>
            </>
          )}
        </p>
      )}
      <Field label="Technician">
        <select value={assigned} onChange={(e) => setAssigned(e.target.value)}>
          <option value="">Unassigned</option>
          {active.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.open_tickets} open)
            </option>
          ))}
        </select>
      </Field>
      <div className="grid-2 compact">
        <Field label="Start">
          <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} step={900} />
        </Field>
        <Field label="Duration">
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {[...new Set([...DURATIONS, duration])]
              .sort((a, b) => a - b)
              .map((d) => (
                <option key={d} value={d}>
                  {d < 60 ? `${d} min` : `${d / 60} hr${d > 60 ? 's' : ''}`}
                </option>
              ))}
          </select>
        </Field>
      </div>
      {conflicts.length > 0 && (
        <div className="alert alert-warn">
          ⚠ Schedule conflict for this technician with{' '}
          {conflicts.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ', '}
              <Link to={`/app/tickets/${c.id}`}>{c.code}</Link> ({fmtSchedule(c.scheduled_start, c.scheduled_end)})
            </span>
          ))}
        </div>
      )}
      <div className="row gap end">
        {t.scheduled_start && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => patch({ scheduled_start: null }).catch(() => {})}>
            Clear schedule
          </button>
        )}
        <button className="btn btn-primary btn-sm" disabled={!dirty}>
          {saved ? '✓ Saved' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function CostCard({ t, currency, post, patch }) {
  const [items, setItems] = useState(t.items);
  const [discount, setDiscount] = useState(t.discount);
  const [taxRate, setTaxRate] = useState(t.tax_rate);
  const [paid, setPaid] = useState(t.amount_paid);

  useEffect(() => {
    setItems(t.items);
    setDiscount(t.discount);
    setTaxRate(t.tax_rate);
    setPaid(t.amount_paid);
    // only reset local edits when the saved cost data changes, not on unrelated updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(t.items), t.discount, t.tax_rate, t.amount_paid]);

  const itemsDirty = JSON.stringify(items.map(({ kind, description, qty, unit_price }) => [kind, description, +qty, +unit_price])) !==
    JSON.stringify(t.items.map(({ kind, description, qty, unit_price }) => [kind, description, qty, unit_price]));
  const dirty = itemsDirty || +discount !== t.discount || +taxRate !== t.tax_rate;

  const subtotal = items.reduce((s, i) => s + (+i.qty || 0) * (+i.unit_price || 0), 0);
  const d = Math.min(+discount || 0, subtotal);
  const tax = ((subtotal - d) * (+taxRate || 0)) / 100;
  const preview = { subtotal, discount: d, tax, total: subtotal - d + tax, paid: t.amount_paid, balance: subtotal - d + tax - t.amount_paid };

  const setItem = (idx, k) => (e) => setItems((list) => list.map((it, i) => (i === idx ? { ...it, [k]: e.target.value } : it)));
  const addItem = (kind) => setItems((list) => [...list, { kind, description: kind === 'labor' ? 'Labor / service fee' : '', qty: 1, unit_price: 0 }]);

  const save = async () => {
    await post('/items', { items });
    if (+discount !== t.discount || +taxRate !== t.tax_rate) await patch({ discount: +discount || 0, tax_rate: +taxRate || 0 });
  };

  const quoteBadge = { pending: ['amber', 'Quote awaiting approval'], approved: ['green', 'Quote approved'], declined: ['red', 'Quote declined'] }[t.quote_status];

  return (
    <div className="card">
      <div className="row between">
        <h2>Repair cost</h2>
        {quoteBadge && <span className={`badge badge-${quoteBadge[0]}`}>{quoteBadge[1]}</span>}
      </div>
      <table className="table items-edit">
        <thead>
          <tr>
            <th style={{ width: 90 }}>Type</th>
            <th>Description</th>
            <th className="num" style={{ width: 70 }}>
              Qty
            </th>
            <th className="num" style={{ width: 110 }}>
              Unit price
            </th>
            <th className="num" style={{ width: 110 }}>
              Amount
            </th>
            <th style={{ width: 30 }} />
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={idx}>
              <td>
                <select value={it.kind} onChange={setItem(idx, 'kind')}>
                  <option value="part">Part</option>
                  <option value="labor">Labor</option>
                  <option value="other">Other</option>
                </select>
              </td>
              <td>
                <input value={it.description} onChange={setItem(idx, 'description')} placeholder="e.g. Fuser assembly" />
              </td>
              <td>
                <input type="number" min="0" step="any" className="num" value={it.qty} onChange={setItem(idx, 'qty')} />
              </td>
              <td>
                <input type="number" min="0" step="0.01" className="num" value={it.unit_price} onChange={setItem(idx, 'unit_price')} />
              </td>
              <td className="num">{money((+it.qty || 0) * (+it.unit_price || 0), currency)}</td>
              <td>
                <button className="btn-icon" onClick={() => setItems((l) => l.filter((_, i) => i !== idx))} aria-label="Remove">
                  ×
                </button>
              </td>
            </tr>
          ))}
          {!items.length && (
            <tr>
              <td colSpan={6} className="muted center-text">
                No cost items yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="row gap wrap">
        <button className="btn btn-sm" onClick={() => addItem('part')}>
          + Part
        </button>
        <button className="btn btn-sm" onClick={() => addItem('labor')}>
          + Labor
        </button>
        <button className="btn btn-sm" onClick={() => addItem('other')}>
          + Other
        </button>
      </div>

      <div className="cost-foot">
        <div className="grid-2 compact adjust">
          <Field label="Discount">
            <input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </Field>
          <Field label="Tax %">
            <input type="number" min="0" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
          </Field>
        </div>
        <Totals totals={preview} currency={currency} />
      </div>

      <div className="row gap wrap end">
        {dirty && (
          <button className="btn btn-primary" onClick={() => save().catch(() => {})}>
            Save costs
          </button>
        )}
        {!dirty && t.items.length > 0 && t.quote_status !== 'approved' && (
          <button className="btn" onClick={() => post('/quote').catch(() => {})}>
            {t.quote_status === 'pending' ? 'Re-send quote' : 'Send quote for approval'}
          </button>
        )}
        {!dirty && t.quote_status === 'approved' && t.items.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => post('/quote').catch(() => {})}>
            Revise & re-send quote
          </button>
        )}
        {t.quote_status === 'pending' && (
          <>
            <button className="btn btn-sm" onClick={() => post('/quote/override', { decision: 'approved' }).catch(() => {})}>
              Customer approved (phone/in person)
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => post('/quote/override', { decision: 'declined' }).catch(() => {})}>
              Customer declined
            </button>
          </>
        )}
      </div>
      {dirty && t.quote_status === 'approved' && (
        <div className="alert alert-warn small">Costs changed after the customer approved. Consider re-sending the quote.</div>
      )}

      <div className="payment">
        <h3 className="card-label">Payment</h3>
        <form
          className="row gap wrap"
          onSubmit={(e) => {
            e.preventDefault();
            patch({ amount_paid: +paid || 0 }).catch(() => {});
          }}
        >
          <input type="number" min="0" step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} className="pay-input" />
          <button className="btn btn-sm" disabled={+paid === t.amount_paid}>
            Record payment
          </button>
          {t.totals.balance > 0.005 && (
            <button type="button" className="btn btn-sm" onClick={() => patch({ amount_paid: t.totals.total }).catch(() => {})}>
              Mark fully paid ({money(t.totals.total, currency)})
            </button>
          )}
          <span className={`badge ${t.totals.total === 0 ? 'badge-gray' : t.totals.balance > 0.005 ? 'badge-amber' : 'badge-green'}`}>
            {t.totals.total === 0 ? 'No charges' : t.totals.balance > 0.005 ? `Balance ${money(t.totals.balance, currency)}` : 'Paid in full'}
          </span>
        </form>
      </div>
    </div>
  );
}

function Timeline({ t, post }) {
  const [note, setNote] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  return (
    <div className="card">
      <h2>Activity</h2>
      <form
        className="note-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await post('/notes', { message: note, public: isPublic });
            setNote('');
          } catch {
            /* shown by parent */
          }
        }}
      >
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" required />
        <div className="row between">
          <label className="check">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> Visible to customer
          </label>
          <button className="btn btn-sm">Add note</button>
        </div>
      </form>
      <ul className="timeline">
        {t.events.map((e) => (
          <li key={e.id} className={`tl-${e.type}`}>
            <div className="tl-msg pre">{e.message}</div>
            <div className="tl-meta">
              {fmtDateTime(e.created_at)}
              {e.user_name && ` · ${e.user_name}`}
              {e.type === 'customer_message' && ' · from customer'}
              {e.public ? <span className="tag">customer can see</span> : <span className="tag tag-private">internal</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusModal({ initial, current, onClose, onSave, t }) {
  const [status, setStatus] = useState(initial);
  const [note, setNote] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const warnUnpaid = status === 'completed' && t.totals.balance > 0.005;
  return (
    <Modal title="Update status" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onSave({ status, note, public: isPublic });
          } catch {
            setBusy(false);
          }
        }}
      >
        <div className="status-grid">
          {STATUSES.map((s) => (
            <button
              type="button"
              key={s.key}
              className={`status-opt ${status === s.key ? 'on' : ''} badge-${s.color}`}
              onClick={() => setStatus(s.key)}
            >
              {s.label}
              {s.key === current && <small> (current)</small>}
            </button>
          ))}
        </div>
        {warnUnpaid && <div className="alert alert-warn">This ticket still has an unpaid balance.</div>}
        <Field label="Note (optional)">
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={`e.g. ${STATUS[status]?.label} — details for the customer`} />
        </Field>
        <label className="check">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> Show note to customer
        </label>
        <div className="row gap end">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy || (status === current && !note.trim())}>
            Update
          </button>
        </div>
      </form>
    </Modal>
  );
}
