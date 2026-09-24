import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApi } from '../hooks.js';
import { MODES, STATUS, TIME_SLOTS, TYPES, fmtDate, fmtDateTime, fmtSchedule, money } from '../lib.js';
import { CopyButton, ErrorBox, Field, Loading, Totals } from '../components/ui.jsx';

// the customer-facing progress steps
const STEPS = [
  { label: 'Requested', statuses: ['new', 'scheduled'] },
  { label: 'Checking', statuses: ['received', 'diagnosing', 'awaiting_approval'] },
  { label: 'Repairing', statuses: ['approved', 'in_repair', 'waiting_parts'] },
  { label: 'Ready', statuses: ['ready'] },
  { label: 'Done', statuses: ['completed'] },
];

function Lookup() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [contact, setContact] = useState('');
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const { token } = await api('/public/lookup', { method: 'POST', body: { code, contact }, auth: false });
      navigate(`/track/${token}`);
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <div className="public-page center">
      <form className="card auth-card" onSubmit={submit}>
        <div className="auth-brand">🖨 PixPrint</div>
        <h1>Track your repair</h1>
        <p className="muted">Enter your ticket number and the email or phone you used when requesting service.</p>
        <ErrorBox error={error} />
        <Field label="Ticket number">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="PX-00012" required />
        </Field>
        <Field label="Email or phone">
          <input value={contact} onChange={(e) => setContact(e.target.value)} required />
        </Field>
        <button className="btn btn-primary btn-block">Find my request</button>
        <p className="muted small center-text">
          <Link to="/request">New service request</Link>
        </p>
      </form>
    </div>
  );
}

export default function Track() {
  const { token } = useParams();
  if (!token) return <Lookup />;
  return <TrackView token={token} />;
}

function TrackView({ token }) {
  const { data: t, error, loading, setData } = useApi(`/public/track/${token}`);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState('');

  if (loading && !t) return <Loading />;
  if (error)
    return (
      <div className="public-page center">
        <div className="card auth-card">
          <ErrorBox error={error} />
          <Link to="/track" className="btn">
            Look up by ticket number
          </Link>
        </div>
      </div>
    );

  const cur = t.shop.currency;
  const stepIndex = STEPS.findIndex((s) => s.statuses.includes(t.status));
  const cancelled = t.status === 'cancelled';

  const act = async (path, body) => {
    setBusy(true);
    setActionError(null);
    try {
      setData(await api(`/public/track/${token}/${path}`, { method: 'POST', body, auth: false }));
      return true;
    } catch (err) {
      setActionError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="public-page">
      <div className="public-wrap narrow">
        <header className="public-head">
          <div>
            <div className="auth-brand">🖨 {t.shop.name}</div>
            <h1>
              Service status <span className="code">{t.code}</span>
            </h1>
            <p className="muted">
              Hi {t.customer_name.split(' ')[0]}, here's the latest on your {t.printer.brand} {t.printer.model}.
            </p>
          </div>
          <CopyButton text={window.location.href} label="Copy link" />
        </header>

        <div className="card">
          <div className={`track-status badge-${STATUS[t.status]?.color}`}>{t.status_label}</div>
          {!cancelled && (
            <ol className="steps">
              {STEPS.map((s, i) => (
                <li key={s.label} className={i < stepIndex ? 'done' : i === stepIndex ? 'current' : ''}>
                  <span className="step-dot">{i < stepIndex ? '✓' : i + 1}</span>
                  <span>{s.label}</span>
                </li>
              ))}
            </ol>
          )}
          <dl className="details">
            <div>
              <dt>Printer</dt>
              <dd>
                {t.printer.brand} {t.printer.model}
                <br />
                <small className="muted">SN {t.printer.serial_number}</small>
              </dd>
            </div>
            <div>
              <dt>Service</dt>
              <dd>
                {TYPES[t.type]} · {MODES[t.service_mode]}
              </dd>
            </div>
            <div>
              <dt>Schedule</dt>
              <dd>
                {t.scheduled_start
                  ? fmtSchedule(t.scheduled_start, t.scheduled_end)
                  : t.preferred_date
                    ? `Requested: ${fmtDate(t.preferred_date)}${t.preferred_time && t.preferred_time !== 'any' ? `, ${TIME_SLOTS[t.preferred_time]}` : ''} (to be confirmed)`
                    : 'To be confirmed'}
              </dd>
            </div>
            {t.technician && (
              <div>
                <dt>Technician</dt>
                <dd>{t.technician}</dd>
              </div>
            )}
            <div className="span-2">
              <dt>Reported issue</dt>
              <dd className="pre">{t.issue}</dd>
            </div>
            {t.diagnosis && (
              <div className="span-2">
                <dt>Technician findings</dt>
                <dd className="pre">{t.diagnosis}</dd>
              </div>
            )}
          </dl>
        </div>

        {t.totals && (
          <div className={`card ${t.quote_status === 'pending' ? 'card-highlight' : ''}`}>
            <div className="row between">
              <h2>Repair quote</h2>
              <span className={`badge badge-${{ pending: 'amber', approved: 'green', declined: 'red' }[t.quote_status]}`}>
                {{ pending: 'Awaiting your approval', approved: 'Approved', declined: 'Declined' }[t.quote_status]}
              </span>
            </div>
            <table className="table items-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="num">Qty</th>
                  <th className="num">Price</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {t.items.map((i, idx) => (
                  <tr key={idx}>
                    <td>{i.description}</td>
                    <td className="num">{i.qty}</td>
                    <td className="num">{money(i.unit_price, cur)}</td>
                    <td className="num">{money(i.qty * i.unit_price, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Totals totals={t.totals} currency={cur} />
            {t.quote_status === 'pending' && (
              <div className="quote-actions">
                <ErrorBox error={actionError} />
                <Field label="Comment (optional)">
                  <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Any questions or instructions" />
                </Field>
                <div className="row gap">
                  <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => act('quote', { decision: 'approved', comment })}>
                    ✓ Approve repair
                  </button>
                  <button
                    className="btn btn-danger-ghost btn-lg"
                    disabled={busy}
                    onClick={() => window.confirm('Decline this quote? We will contact you about returning your unit.') && act('quote', { decision: 'declined', comment })}
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="card">
          <h2>Updates</h2>
          <ul className="timeline">
            {t.events.map((e, i) => (
              <li key={i} className={`tl-${e.type}`}>
                <div className="tl-msg">{e.message}</div>
                <div className="tl-meta">{fmtDateTime(e.created_at)}</div>
              </li>
            ))}
          </ul>
          {!['completed', 'cancelled'].includes(t.status) && (
            <form
              className="message-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await act('message', { message })) setMessage('');
              }}
            >
              <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Send a message to the service team…" required />
              <button className="btn" disabled={busy}>
                Send
              </button>
            </form>
          )}
        </div>

        <p className="muted small center-text">
          {t.shop.name}
          {t.shop.phone && <> · {t.shop.phone}</>}
          {t.shop.email && <> · {t.shop.email}</>}
          {t.shop.address && (
            <>
              <br />
              {t.shop.address}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
