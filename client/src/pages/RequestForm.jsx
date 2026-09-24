import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useSettings } from '../hooks.js';
import { COMMON_ISSUES, MODES, PRINTER_BRANDS, TIME_SLOTS, TYPES, toLocalDate, trackUrl } from '../lib.js';
import { CopyButton, ErrorBox, Field } from '../components/ui.jsx';

const EMPTY = {
  name: '',
  company: '',
  email: '',
  phone: '',
  address: '',
  brand: '',
  model: '',
  serial_number: '',
  type: 'repair',
  service_mode: 'drop_off',
  issue: '',
  accessories: '',
  preferred_date: '',
  preferred_time: 'any',
  website: '',
};

export default function RequestForm() {
  const shop = useSettings().data;
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const addIssue = (text) =>
    setForm((f) => ({ ...f, issue: f.issue ? (f.issue.includes(text) ? f.issue : `${f.issue.trim()}, ${text}`) : text }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email && !form.phone) return setError('Please give us an email or phone number so we can reach you.');
    setBusy(true);
    setError(null);
    try {
      setDone(await api('/public/requests', { method: 'POST', body: form, auth: false }));
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    const url = trackUrl(done.token);
    return (
      <div className="public-page">
        <div className="public-wrap narrow">
          <div className="card success-card">
            <div className="success-icon">✓</div>
            <h1>Request received!</h1>
            <p>
              Your ticket number is <strong className="code">{done.code}</strong>. We'll contact you to confirm the schedule.
            </p>
            <p className="muted">Save this link to check your printer's repair status anytime:</p>
            <div className="link-box">
              <input readOnly value={url} onFocus={(e) => e.target.select()} />
              <CopyButton text={url} className="btn btn-primary" />
            </div>
            <div className="row gap center-row">
              <Link className="btn" to={`/track/${done.token}`}>
                View status
              </Link>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setDone(null);
                  setForm(EMPTY);
                }}
              >
                Submit another request
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="public-page">
      <div className="public-wrap">
        <header className="public-head">
          <div>
            <div className="auth-brand">🖨 {shop?.name || 'PixPrint'}</div>
            <h1>Printer service request</h1>
            <p className="muted">Tell us about your printer and the problem. We'll schedule a technician and send you a tracking link.</p>
          </div>
          <Link to="/track" className="btn btn-ghost">
            Track existing request
          </Link>
        </header>

        <form className="card form-card" onSubmit={submit}>
          <ErrorBox error={error} />

          <section>
            <h2 className="section-title">1. Your details</h2>
            <div className="grid-2">
              <Field label="Full name *">
                <input value={form.name} onChange={set('name')} required autoComplete="name" />
              </Field>
              <Field label="Company / organization">
                <input value={form.company} onChange={set('company')} autoComplete="organization" />
              </Field>
              <Field label="Email">
                <input type="email" value={form.email} onChange={set('email')} autoComplete="email" />
              </Field>
              <Field label="Mobile / phone">
                <input type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" />
              </Field>
              <Field label="Address" hint="Needed for on-site service or pickup" className="span-2">
                <input value={form.address} onChange={set('address')} autoComplete="street-address" />
              </Field>
            </div>
          </section>

          <section>
            <h2 className="section-title">2. Printer</h2>
            <div className="grid-3">
              <Field label="Brand *">
                <input value={form.brand} onChange={set('brand')} list="brands" required placeholder="e.g. Epson" />
                <datalist id="brands">
                  {PRINTER_BRANDS.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </Field>
              <Field label="Model *">
                <input value={form.model} onChange={set('model')} required placeholder="e.g. L3210" />
              </Field>
              <Field label="Serial number (SN) *" hint="Usually on a sticker at the back or bottom">
                <input value={form.serial_number} onChange={set('serial_number')} required />
              </Field>
            </div>
          </section>

          <section>
            <h2 className="section-title">3. What's the problem?</h2>
            <div className="grid-2">
              <Field label="Service needed">
                <select value={form.type} onChange={set('type')}>
                  {Object.entries(TYPES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="How should we service it?">
                <select value={form.service_mode} onChange={set('service_mode')}>
                  {Object.entries(MODES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="chips">
              {COMMON_ISSUES.map((i) => (
                <button type="button" key={i} className="chip" onClick={() => addIssue(i)}>
                  + {i}
                </button>
              ))}
            </div>
            <Field label="Describe the issue *" hint="Include any error codes or messages shown on the printer">
              <textarea rows={4} value={form.issue} onChange={set('issue')} required />
            </Field>
            <Field label="Accessories included" hint="e.g. power cable, USB cable, cartridges (for drop-off)">
              <input value={form.accessories} onChange={set('accessories')} />
            </Field>
          </section>

          <section>
            <h2 className="section-title">4. Preferred schedule</h2>
            <div className="grid-2">
              <Field label="Preferred date">
                <input type="date" value={form.preferred_date} min={toLocalDate(new Date())} onChange={set('preferred_date')} />
              </Field>
              <Field label="Preferred time">
                <select value={form.preferred_time} onChange={set('preferred_time')}>
                  {Object.entries(TIME_SLOTS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          {/* honeypot for bots */}
          <input className="hp" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} aria-hidden="true" />

          <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit request'}
          </button>
        </form>
        <p className="muted small center-text">
          {shop?.phone && <>Call us: {shop.phone} · </>}
          <Link to="/login">Staff sign in</Link>
        </p>
      </div>
    </div>
  );
}
