import { Router } from 'express';
import { db, getSettings } from '../db.js';
import { HttpError, STATUS_LABELS, TICKET_SELECT, withTotals, addEvent, createTicket } from '../tickets.js';
import { notifyNewRequest } from '../mailer.js';

const router = Router();

// very small in-memory rate limiter for the unauthenticated endpoints
const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.baseUrl}${req.route?.path}`;
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) return res.status(429).json({ error: 'Too many requests, please try again later' });
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}

function shopInfo() {
  const s = getSettings();
  return { name: s.shop_name, phone: s.shop_phone, email: s.shop_email, address: s.shop_address, currency: s.currency };
}

function ticketByToken(token) {
  const t = db.prepare(`${TICKET_SELECT} WHERE t.token = ?`).get(token);
  if (!t) throw new HttpError(404, 'We could not find that service request. Please check your link.');
  return withTotals(t);
}

function publicView(t) {
  const showQuote = t.quote_status !== 'none';
  return {
    code: t.code,
    status: t.status,
    status_label: STATUS_LABELS[t.status],
    type: t.type,
    service_mode: t.service_mode,
    issue: t.issue,
    diagnosis: t.diagnosis,
    customer_name: t.customer_name,
    printer: { brand: t.brand, model: t.model, serial_number: t.serial_number },
    technician: t.assigned_name,
    scheduled_start: t.scheduled_start,
    scheduled_end: t.scheduled_end,
    preferred_date: t.preferred_date,
    preferred_time: t.preferred_time,
    created_at: t.created_at,
    updated_at: t.updated_at,
    completed_at: t.completed_at,
    quote_status: t.quote_status,
    items: showQuote
      ? db.prepare('SELECT kind, description, qty, unit_price FROM ticket_items WHERE ticket_id = ? ORDER BY id').all(t.id)
      : [],
    totals: showQuote ? t.totals : null,
    events: db
      .prepare('SELECT type, message, created_at FROM ticket_events WHERE ticket_id = ? AND public = 1 ORDER BY created_at DESC, id DESC')
      .all(t.id),
    shop: shopInfo(),
  };
}

router.get('/shop', (req, res) => res.json(shopInfo()));

router.post('/requests', rateLimit(10, 60 * 60 * 1000), (req, res) => {
  const b = req.body || {};
  if (b.website) throw new HttpError(400, 'Invalid request'); // honeypot
  const id = createTicket(
    {
      customer: { name: b.name, email: b.email, phone: b.phone, company: b.company, address: b.address },
      printer: { brand: b.brand, model: b.model, serial_number: b.serial_number, location: b.location },
      issue: b.issue,
      type: b.type,
      service_mode: b.service_mode,
      accessories: b.accessories,
      preferred_date: b.preferred_date,
      preferred_time: b.preferred_time,
    },
    { source: 'customer' }
  );
  const t = db.prepare('SELECT code, token FROM tickets WHERE id = ?').get(id);
  res.status(201).json(t);
  // send after responding so a slow mail server never delays the customer
  notifyNewRequest(id).catch((err) => console.error('notifyNewRequest failed:', err));
});

router.get('/track/:token', (req, res) => {
  res.json(publicView(ticketByToken(req.params.token)));
});

// look up by ticket code + phone/email, for customers who lost their link
router.post('/lookup', rateLimit(20, 15 * 60 * 1000), (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const contact = String(req.body.contact || '').trim().toLowerCase();
  const row = db
    .prepare(
      `SELECT t.token FROM tickets t JOIN customers c ON c.id = t.customer_id
       WHERE t.code = ? AND (lower(c.email) = ? OR c.phone = ?)`
    )
    .get(code, contact, contact);
  if (!row) throw new HttpError(404, 'No request matches that ticket number and contact detail');
  res.json({ token: row.token });
});

router.post('/track/:token/quote', rateLimit(20, 15 * 60 * 1000), (req, res) => {
  const t = ticketByToken(req.params.token);
  const decision = req.body.decision;
  if (!['approved', 'declined'].includes(decision)) throw new HttpError(400, 'Invalid decision');
  if (t.quote_status !== 'pending') throw new HttpError(409, 'This quote is no longer awaiting a decision');
  db.transaction(() => {
    db.prepare(
      `UPDATE tickets SET quote_status = ?, status = CASE WHEN ? = 'approved' THEN 'approved' ELSE status END,
       updated_at = datetime('now') WHERE id = ?`
    ).run(decision, decision, t.id);
    const comment = String(req.body.comment || '').trim().slice(0, 1000);
    addEvent(t.id, {
      type: 'quote',
      message: `Customer ${decision} the quote${comment ? `: "${comment}"` : ''}`,
      isPublic: true,
    });
  })();
  res.json(publicView(ticketByToken(req.params.token)));
});

router.post('/track/:token/message', rateLimit(10, 15 * 60 * 1000), (req, res) => {
  const t = ticketByToken(req.params.token);
  const message = String(req.body.message || '').trim().slice(0, 1000);
  if (!message) throw new HttpError(400, 'Message is empty');
  addEvent(t.id, { type: 'customer_message', message: `Customer: ${message}`, isPublic: true });
  res.json(publicView(ticketByToken(req.params.token)));
});

export default router;
