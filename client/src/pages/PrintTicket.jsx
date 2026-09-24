import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { useApi } from '../hooks.js';
import { MODES, STATUS, TYPES, fmtDate, fmtDateTime, fmtSchedule, money, trackUrl } from '../lib.js';
import { ErrorBox, Loading, Totals } from '../components/ui.jsx';

export default function PrintTicket() {
  const { id } = useParams();
  const { data: t, error } = useApi(`/tickets/${id}`);
  const settings = useApi('/settings').data;
  const [qr, setQr] = useState(null);
  const [doc, setDoc] = useState('job'); // job | invoice

  const url = t && settings ? trackUrl(t.token, settings.public_base_url) : null;
  useEffect(() => {
    if (url) QRCode.toDataURL(url, { margin: 1, width: 200 }).then(setQr);
  }, [url]);

  if (error) return <ErrorBox error={error} />;
  if (!t || !settings) return <Loading />;
  const cur = settings.currency;

  return (
    <div className="print-page">
      <div className="print-toolbar no-print">
        <div className="seg">
          <button className={doc === 'job' ? 'on' : ''} onClick={() => setDoc('job')}>
            Job sheet
          </button>
          <button className={doc === 'invoice' ? 'on' : ''} onClick={() => setDoc('invoice')}>
            Service invoice
          </button>
        </div>
        <button className="btn btn-primary" onClick={() => window.print()}>
          🖨 Print
        </button>
      </div>

      <div className="sheet">
        <header className="sheet-head">
          <div>
            <h1>{settings.shop_name}</h1>
            <div className="small">
              {[settings.shop_address, settings.shop_phone, settings.shop_email].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div className="sheet-title">
            <div className="sheet-doc">{doc === 'job' ? 'SERVICE JOB SHEET' : 'SERVICE INVOICE'}</div>
            <div className="sheet-code">{t.code}</div>
            <div className="small">Date: {fmtDate(t.created_at)}</div>
            <div className="small">Status: {STATUS[t.status]?.label}</div>
          </div>
        </header>

        <div className="sheet-grid">
          <section>
            <h3>Customer</h3>
            <div>
              <strong>{t.customer_name}</strong>
            </div>
            {t.customer_company && <div>{t.customer_company}</div>}
            {t.customer_phone && <div>{t.customer_phone}</div>}
            {t.customer_email && <div>{t.customer_email}</div>}
            {t.customer_address && <div>{t.customer_address}</div>}
          </section>
          <section>
            <h3>Unit</h3>
            <div>
              <strong>
                {t.brand} {t.model}
              </strong>
            </div>
            <div>SN: {t.serial_number}</div>
            {t.accessories && <div>Accessories: {t.accessories}</div>}
            <div>
              {TYPES[t.type]} · {MODES[t.service_mode]}
            </div>
          </section>
          <section>
            <h3>Service</h3>
            <div>Technician: {t.assigned_name || '________________'}</div>
            <div>Schedule: {t.scheduled_start ? fmtSchedule(t.scheduled_start, t.scheduled_end) : '________________'}</div>
            {t.completed_at && <div>Completed: {fmtDateTime(t.completed_at)}</div>}
          </section>
        </div>

        <section className="sheet-block">
          <h3>Reported issue</h3>
          <p className="pre">{t.issue}</p>
        </section>
        <section className="sheet-block">
          <h3>Diagnosis / work done</h3>
          {t.diagnosis ? <p className="pre">{t.diagnosis}</p> : <div className="lines" />}
        </section>

        <section className="sheet-block">
          <h3>Charges</h3>
          <table className="table sheet-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Type</th>
                <th className="num">Qty</th>
                <th className="num">Unit price</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {t.items.map((i) => (
                <tr key={i.id}>
                  <td>{i.description}</td>
                  <td>{i.kind}</td>
                  <td className="num">{i.qty}</td>
                  <td className="num">{money(i.unit_price, cur)}</td>
                  <td className="num">{money(i.qty * i.unit_price, cur)}</td>
                </tr>
              ))}
              {!t.items.length &&
                [0, 1, 2].map((i) => (
                  <tr key={i}>
                    <td colSpan={5}>&nbsp;</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <Totals totals={t.totals} currency={cur} />
        </section>

        <footer className="sheet-foot">
          <div className="qr-block">
            {qr && <img src={qr} alt="Status QR code" />}
            <div className="small">
              Scan to track your repair
              <br />
              <span className="mono">{url}</span>
            </div>
          </div>
          <div className="signatures">
            <div>
              <div className="sig-line" />
              {doc === 'job' ? 'Received by (shop)' : 'Released by'}
            </div>
            <div>
              <div className="sig-line" />
              Customer signature
            </div>
          </div>
        </footer>
        {doc === 'job' && (
          <p className="tiny">
            Units unclaimed 30 days after notice of completion may incur storage fees. The shop is not responsible for data stored in the
            device. Please present this sheet when claiming your unit.
          </p>
        )}

        {doc === 'job' && (
          <div className="unit-tag">
            <div className="tag-cut">✂ - - - - - - - - unit tag - - - - - - - -</div>
            <div className="tag-body">
              {qr && <img src={qr} alt="" />}
              <div>
                <div className="sheet-code">{t.code}</div>
                <div>
                  <strong>{t.customer_name}</strong> {t.customer_phone}
                </div>
                <div>
                  {t.brand} {t.model} · SN {t.serial_number}
                </div>
                <div className="small">In: {fmtDate(t.created_at)}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
