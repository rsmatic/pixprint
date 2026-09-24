import { createContext, useContext, useEffect, useState } from 'react';
import { STATUS, PRIORITIES, copyText, money } from '../lib.js';

export const SettingsContext = createContext({ currency: 'PHP' });
export const useShopSettings = () => useContext(SettingsContext);

export function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, color: 'gray' };
  return <span className={`badge badge-${s.color}`}>{s.label}</span>;
}

export function PriorityBadge({ priority }) {
  if (!priority || priority === 'normal') return null;
  const color = { low: 'slate', high: 'orange', urgent: 'red' }[priority];
  return <span className={`badge badge-${color}`}>{PRIORITIES[priority]}</span>;
}

export function CopyButton({ text, label = 'Copy link', className = 'btn' }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }
      }}
    >
      {copied ? '✓ Copied' : label}
    </button>
  );
}

export function Modal({ title, onClose, children, width = 520 }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export const ErrorBox = ({ error }) => (error ? <div className="alert alert-error">{error}</div> : null);

export const Loading = () => <div className="loading">Loading…</div>;

export const Empty = ({ children }) => <div className="empty">{children}</div>;

export function StatCard({ label, value, sub, tone, to, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`stat ${tone ? `stat-${tone}` : ''}`} onClick={onClick}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </Tag>
  );
}

export function Totals({ totals, currency }) {
  return (
    <dl className="totals">
      <div>
        <dt>Subtotal</dt>
        <dd>{money(totals.subtotal, currency)}</dd>
      </div>
      {totals.discount > 0 && (
        <div>
          <dt>Discount</dt>
          <dd>−{money(totals.discount, currency)}</dd>
        </div>
      )}
      {totals.tax > 0 && (
        <div>
          <dt>Tax</dt>
          <dd>{money(totals.tax, currency)}</dd>
        </div>
      )}
      <div className="grand">
        <dt>Total</dt>
        <dd>{money(totals.total, currency)}</dd>
      </div>
      {totals.paid > 0 && (
        <>
          <div>
            <dt>Paid</dt>
            <dd>{money(totals.paid, currency)}</dd>
          </div>
          <div className="grand">
            <dt>Balance</dt>
            <dd>{money(totals.balance, currency)}</dd>
          </div>
        </>
      )}
    </dl>
  );
}
