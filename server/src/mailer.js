import nodemailer from 'nodemailer';
import { db, getSettings } from './db.js';
import { TICKET_SELECT } from './tickets.js';

// SMTP settings come from the environment (secrets stay out of the database):
//   SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, SMTP_SECURE (true for port 465), MAIL_FROM
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, MAIL_FROM } = process.env;

const transport = SMTP_HOST
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: SMTP_SECURE === 'true' || Number(SMTP_PORT) === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    })
  : null;

if (!transport) console.log('Email disabled: set SMTP_HOST (and SMTP_USER / SMTP_PASS / MAIL_FROM) to enable it.');

export function emailStatus() {
  return { configured: !!transport, from: transport ? MAIL_FROM || SMTP_USER : null };
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function fromAddress(shopName) {
  const addr = MAIL_FROM || SMTP_USER;
  // "Name <addr>" unless MAIL_FROM already includes a display name
  return /</.test(addr) ? addr : `"${shopName.replace(/"/g, '')}" <${addr}>`;
}

export async function sendMail({ to, subject, html, text, replyTo }) {
  if (!transport) throw new Error('Email is not configured on the server (SMTP_HOST is not set)');
  const shop = getSettings();
  return transport.sendMail({ from: fromAddress(shop.shop_name || 'PixPrint'), to, subject, html, text, replyTo });
}

function layout(shop, bodyHtml) {
  const contact = [shop.shop_phone, shop.shop_email, shop.shop_address].filter(Boolean).map(esc).join(' · ');
  return `<!doctype html><html><body style="margin:0;background:#f4f6fa;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    <div style="font-weight:700;color:#2563eb;font-size:16px;margin-bottom:12px">🖨 ${esc(shop.shop_name)}</div>
    <div style="background:#fff;border:1px solid #e3e8ef;border-radius:10px;padding:24px">${bodyHtml}</div>
    ${contact ? `<p style="color:#64748b;font-size:12px;text-align:center;margin-top:16px">${contact}</p>` : ''}
  </div></body></html>`;
}

const button = (href, label) =>
  `<a href="${esc(href)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;padding:11px 20px;border-radius:8px">${esc(label)}</a>`;

const row = (label, value) =>
  value
    ? `<tr><td style="padding:6px 12px 6px 0;color:#64748b;vertical-align:top;white-space:nowrap">${esc(label)}</td><td style="padding:6px 0;white-space:pre-wrap">${esc(value)}</td></tr>`
    : '';

const TYPES = { repair: 'Repair', maintenance: 'Maintenance', installation: 'Installation', inspection: 'Inspection' };
const MODES = { drop_off: 'Drop-off at shop', on_site: 'On-site service', pickup: 'Pickup & return' };
const SLOTS = { morning: 'morning', afternoon: 'afternoon', any: 'any time' };

// Called after a customer submits the public request form. Never throws: a mail
// failure must not fail the customer's request.
export async function notifyNewRequest(ticketId) {
  if (!transport) return;
  const shop = getSettings();
  const t = db.prepare(`${TICKET_SELECT} WHERE t.id = ?`).get(ticketId);
  if (!t) return;
  const base = (shop.public_base_url || '').replace(/\/$/, '');
  const trackUrl = `${base}/track/${t.token}`;
  const staffUrl = `${base}/app/tickets/${t.id}`;
  const preferred = t.preferred_date ? `${t.preferred_date}${t.preferred_time ? `, ${SLOTS[t.preferred_time] || t.preferred_time}` : ''}` : null;
  const jobs = [];

  const staffTo = (shop.notify_emails || '').split(/[,;\s]+/).filter(Boolean);
  if (shop.email_staff_new_request !== '0' && staffTo.length) {
    const details = `<table style="border-collapse:collapse;font-size:14px;margin:12px 0 20px">
      ${row('Customer', t.customer_name)}${row('Company', t.customer_company)}${row('Phone', t.customer_phone)}${row('Email', t.customer_email)}
      ${row('Address', t.customer_address)}${row('Printer', `${t.brand} ${t.model}`)}${row('Serial no.', t.serial_number)}
      ${row('Service', `${TYPES[t.type]} · ${MODES[t.service_mode]}`)}${row('Preferred', preferred)}${row('Accessories', t.accessories)}${row('Issue', t.issue)}
    </table>`;
    jobs.push(
      sendMail({
        to: staffTo.join(', '),
        replyTo: t.customer_email || undefined,
        subject: `New service request ${t.code}: ${t.brand} ${t.model} — ${t.customer_company || t.customer_name}`,
        html: layout(shop, `<h2 style="margin:0 0 4px;font-size:18px">New service request ${esc(t.code)}</h2>
          <p style="margin:0;color:#64748b">Submitted online and waiting to be scheduled.</p>${details}${base ? button(staffUrl, 'Open ticket') : ''}`),
        text: `New service request ${t.code}\n\nCustomer: ${t.customer_name}${t.customer_company ? ` (${t.customer_company})` : ''}\nPhone: ${t.customer_phone || '-'}\nEmail: ${t.customer_email || '-'}\nPrinter: ${t.brand} ${t.model}, SN ${t.serial_number}\nService: ${TYPES[t.type]}, ${MODES[t.service_mode]}\nPreferred: ${preferred || '-'}\nIssue: ${t.issue}\n${base ? `\nOpen ticket: ${staffUrl}\n` : ''}`,
      })
    );
  }

  if (shop.email_customer_confirmation !== '0' && t.customer_email) {
    const first = t.customer_name.split(' ')[0];
    jobs.push(
      sendMail({
        to: t.customer_email,
        replyTo: shop.shop_email || undefined,
        subject: `We received your service request ${t.code}`,
        html: layout(shop, `<h2 style="margin:0 0 8px;font-size:18px">Thanks, ${esc(first)}! We received your request.</h2>
          <p style="margin:0 0 4px">Your ticket number is <strong>${esc(t.code)}</strong> for your <strong>${esc(t.brand)} ${esc(t.model)}</strong> (SN ${esc(t.serial_number)}).</p>
          <p style="margin:0 0 20px;color:#475569">We'll contact you to confirm the schedule. You can follow the repair, see the quote and approve it online at any time:</p>
          ${base ? button(trackUrl, 'Track my repair') : ''}
          <p style="margin:20px 0 0;color:#64748b;font-size:13px">Issue reported: ${esc(t.issue)}</p>`),
        text: `Thanks, ${first}! We received your service request.\n\nTicket number: ${t.code}\nPrinter: ${t.brand} ${t.model} (SN ${t.serial_number})\n\nWe'll contact you to confirm the schedule.${base ? `\nTrack your repair: ${trackUrl}` : ''}\n\n${shop.shop_name}${shop.shop_phone ? `\n${shop.shop_phone}` : ''}`,
      })
    );
  }

  const results = await Promise.allSettled(jobs);
  for (const r of results) if (r.status === 'rejected') console.error(`Email for ${t.code} failed:`, r.reason?.message);
}
