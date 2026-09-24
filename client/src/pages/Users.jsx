import { useState } from 'react';
import { api } from '../api.js';
import { useApi } from '../hooks.js';
import { useAuth } from '../auth.jsx';
import { ROLES, fmtDate } from '../lib.js';
import { ErrorBox, Field, Loading, Modal } from '../components/ui.jsx';

function UserForm({ initial, onSubmit, onCancel }) {
  const isNew = !initial?.id;
  const [f, setF] = useState({ name: '', email: '', phone: '', role: 'technician', password: '', ...initial });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const body = { name: f.name, email: f.email, phone: f.phone, role: f.role };
          if (f.password) body.password = f.password;
          await onSubmit(body);
        } catch (err) {
          setError(err.message);
        }
      }}
    >
      <ErrorBox error={error} />
      <div className="grid-2">
        <Field label="Name *">
          <input value={f.name} onChange={set('name')} required autoFocus />
        </Field>
        <Field label="Email (login) *">
          <input type="email" value={f.email} onChange={set('email')} required />
        </Field>
        <Field label="Phone">
          <input value={f.phone || ''} onChange={set('phone')} />
        </Field>
        <Field label="Role" hint="Admins manage team & settings; front desk and technicians handle tickets">
          <select value={f.role} onChange={set('role')}>
            {Object.entries(ROLES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label={isNew ? 'Password *' : 'New password'} hint={isNew ? 'At least 6 characters' : 'Leave blank to keep current'} className="span-2">
          <input type="password" value={f.password} onChange={set('password')} required={isNew} minLength={6} autoComplete="new-password" />
        </Field>
      </div>
      <div className="row gap end">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary">{isNew ? 'Add member' : 'Save'}</button>
      </div>
    </form>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const { data, error, loading, reload } = useApi('/users');
  const [editing, setEditing] = useState(null);
  const [actionError, setActionError] = useState(null);

  if (loading && !data) return <Loading />;

  const toggle = async (u) => {
    setActionError(null);
    try {
      await api(`/users/${u.id}`, { method: 'PATCH', body: { active: !u.active } });
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Team</h1>
        <button className="btn btn-primary" onClick={() => setEditing({})}>
          + Add member
        </button>
      </div>
      <ErrorBox error={error || actionError} />
      <div className="card table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th className="num">Open tickets</th>
              <th>Since</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.map((u) => (
              <tr key={u.id} className={u.active ? '' : 'dim'}>
                <td>
                  <strong>{u.name}</strong>
                  {u.phone && <small className="muted block">{u.phone}</small>}
                </td>
                <td>{u.email}</td>
                <td>{ROLES[u.role]}</td>
                <td className="num">{u.open_tickets}</td>
                <td>{fmtDate(u.created_at)}</td>
                <td>{u.active ? <span className="badge badge-green">Active</span> : <span className="badge badge-gray">Disabled</span>}</td>
                <td className="nowrap">
                  <button className="btn btn-sm btn-ghost" onClick={() => setEditing(u)}>
                    Edit
                  </button>
                  {u.id !== me.id && (
                    <button className="btn btn-sm btn-ghost" onClick={() => toggle(u)}>
                      {u.active ? 'Disable' : 'Enable'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <Modal title={editing.id ? `Edit ${editing.name}` : 'Add team member'} onClose={() => setEditing(null)}>
          <UserForm
            initial={editing.id ? { ...editing, password: '' } : undefined}
            onCancel={() => setEditing(null)}
            onSubmit={async (body) => {
              await api(editing.id ? `/users/${editing.id}` : '/users', { method: editing.id ? 'PATCH' : 'POST', body });
              await reload();
              setEditing(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
