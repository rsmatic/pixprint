import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { money } from '../lib.js';
import { ErrorBox, Field, useShopSettings } from '../components/ui.jsx';

const FIELDS = ['shop_name', 'shop_phone', 'shop_email', 'shop_address', 'currency', 'tax_rate', 'default_maintenance_days', 'public_base_url'];

export default function Settings() {
  const settings = useShopSettings();
  const [f, setF] = useState({});
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setF(Object.fromEntries(FIELDS.map((k) => [k, settings[k] ?? ''])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.shop_name, settings.currency, settings.public_base_url]);

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  let currencyOk = true;
  try {
    new Intl.NumberFormat(undefined, { style: 'currency', currency: f.currency || 'X' });
  } catch {
    currencyOk = false;
  }

  return (
    <div className="page narrow-page">
      <div className="page-head">
        <h1>Settings</h1>
      </div>
      <form
        className="card form-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            await api('/settings', { method: 'PUT', body: { ...f, currency: f.currency.toUpperCase() } });
            await settings.reload();
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          } catch (err) {
            setError(err.message);
          }
        }}
      >
        <ErrorBox error={error} />
        <section>
          <h2 className="section-title">Shop details</h2>
          <p className="muted small">Shown on the customer request form, status page and printed job sheets.</p>
          <div className="grid-2">
            <Field label="Shop name" className="span-2">
              <input value={f.shop_name || ''} onChange={set('shop_name')} required />
            </Field>
            <Field label="Phone">
              <input value={f.shop_phone || ''} onChange={set('shop_phone')} />
            </Field>
            <Field label="Email">
              <input type="email" value={f.shop_email || ''} onChange={set('shop_email')} />
            </Field>
            <Field label="Address" className="span-2">
              <input value={f.shop_address || ''} onChange={set('shop_address')} />
            </Field>
          </div>
        </section>
        <section>
          <h2 className="section-title">Billing</h2>
          <div className="grid-2">
            <Field label="Currency code" hint={currencyOk ? `e.g. ${money(1234.5, f.currency)}` : 'Use a 3-letter ISO code like PHP, USD, EUR'}>
              <input value={f.currency || ''} onChange={set('currency')} maxLength={3} required />
            </Field>
            <Field label="Default tax rate (%)" hint="Applied to new tickets; can be changed per ticket">
              <input type="number" min="0" step="0.01" value={f.tax_rate || ''} onChange={set('tax_rate')} />
            </Field>
          </div>
        </section>
        <section>
          <h2 className="section-title">Operations</h2>
          <div className="grid-2">
            <Field label="Default maintenance interval (days)" hint="Pre-filled when registering a printer">
              <input type="number" min="1" value={f.default_maintenance_days || ''} onChange={set('default_maintenance_days')} />
            </Field>
            <Field
              label="Public site URL"
              hint={`Used when copying customer status links. Leave blank to use ${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}`}
            >
              <input value={f.public_base_url || ''} onChange={set('public_base_url')} placeholder="https://repairs.example.com" />
            </Field>
          </div>
        </section>
        <div className="row gap end">
          <Link to="/request" target="_blank" rel="noreferrer" className="btn btn-ghost">
            Preview request form ↗
          </Link>
          <button className="btn btn-primary" disabled={!currencyOk}>
            {saved ? '✓ Saved' : 'Save settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
