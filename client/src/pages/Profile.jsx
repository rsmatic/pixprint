import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ROLES } from '../lib.js';
import { ErrorBox, Field } from '../components/ui.jsx';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [f, setF] = useState({ name: user.name, email: user.email, phone: user.phone || '' });
  const [pw, setPw] = useState({ current_password: '', password: '', confirm: '' });
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  const save = async (body, after) => {
    setError(null);
    setMsg(null);
    try {
      setUser(await api(`/users/${user.id}`, { method: 'PATCH', body }));
      after?.();
      setMsg('Saved.');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page narrow-page">
      <div className="page-head">
        <h1>My profile</h1>
        <span className="badge badge-blue">{ROLES[user.role]}</span>
      </div>
      <ErrorBox error={error} />
      {msg && <div className="alert alert-ok">{msg}</div>}
      <form
        className="card form-card"
        onSubmit={(e) => {
          e.preventDefault();
          save(f);
        }}
      >
        <h2 className="section-title">Details</h2>
        <div className="grid-2">
          <Field label="Name">
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
          </Field>
          <Field label="Phone">
            <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </Field>
          <Field label="Email (login)" className="span-2">
            <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
          </Field>
        </div>
        <div className="row end">
          <button className="btn btn-primary">Save</button>
        </div>
      </form>
      <form
        className="card form-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (pw.password !== pw.confirm) return setError('New passwords do not match');
          save({ current_password: pw.current_password, password: pw.password }, () => setPw({ current_password: '', password: '', confirm: '' }));
        }}
      >
        <h2 className="section-title">Change password</h2>
        <div className="grid-3">
          <Field label="Current password">
            <input type="password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} required={user.role !== 'admin'} autoComplete="current-password" />
          </Field>
          <Field label="New password">
            <input type="password" minLength={6} value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} required autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password">
            <input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required autoComplete="new-password" />
          </Field>
        </div>
        <div className="row end">
          <button className="btn btn-primary">Change password</button>
        </div>
      </form>
    </div>
  );
}
