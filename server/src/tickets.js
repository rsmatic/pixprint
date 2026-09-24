import crypto from 'node:crypto';
import { db, getSetting } from './db.js';

export const STATUSES = [
  'new',
  'scheduled',
  'received',
  'diagnosing',
  'awaiting_approval',
  'approved',
  'in_repair',
  'waiting_parts',
  'ready',
  'completed',
  'cancelled',
];
export const OPEN_STATUSES = STATUSES.filter((s) => !['completed', 'cancelled'].includes(s));

export const STATUS_LABELS = {
  new: 'Request received',
  scheduled: 'Scheduled',
  received: 'Unit received',
  diagnosing: 'Diagnosing',
  awaiting_approval: 'Awaiting your approval',
  approved: 'Quote approved',
  in_repair: 'Repair in progress',
  waiting_parts: 'Waiting for parts',
  ready: 'Ready for pickup / delivery',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function computeTotals(ticket, subtotal) {
  subtotal = round2(subtotal);
  const discount = round2(Math.min(Math.max(ticket.discount || 0, 0), subtotal));
  const taxable = subtotal - discount;
  const tax = round2((taxable * (ticket.tax_rate || 0)) / 100);
  const total = round2(taxable + tax);
  const paid = round2(ticket.amount_paid || 0);
  return { subtotal, discount, tax, total, paid, balance: round2(total - paid) };
}

export const TICKET_SELECT = `
  SELECT t.*,
    c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
    c.company AS customer_company, c.address AS customer_address,
    p.brand, p.model, p.serial_number, p.location AS printer_location,
    u.name AS assigned_name,
    (SELECT COALESCE(SUM(qty * unit_price), 0) FROM ticket_items i WHERE i.ticket_id = t.id) AS items_subtotal
  FROM tickets t
  JOIN customers c ON c.id = t.customer_id
  JOIN printers p ON p.id = t.printer_id
  LEFT JOIN users u ON u.id = t.assigned_to
`;

export function withTotals(t) {
  return t && { ...t, totals: computeTotals(t, t.items_subtotal) };
}

export function getTicket(id) {
  const t = db.prepare(`${TICKET_SELECT} WHERE t.id = ?`).get(id);
  if (!t) throw new HttpError(404, 'Ticket not found');
  return withTotals(t);
}

export function getTicketFull(id) {
  const ticket = getTicket(id);
  ticket.items = db.prepare('SELECT * FROM ticket_items WHERE ticket_id = ? ORDER BY id').all(id);
  ticket.events = db
    .prepare(
      `SELECT e.*, u.name AS user_name FROM ticket_events e
       LEFT JOIN users u ON u.id = e.user_id
       WHERE e.ticket_id = ? ORDER BY e.created_at DESC, e.id DESC`
    )
    .all(id)
    .map((e) => ({ ...e, public: !!e.public }));
  return ticket;
}

export function addEvent(ticketId, { type, message, isPublic = false, userId = null }) {
  db.prepare('INSERT INTO ticket_events (ticket_id, type, message, public, user_id) VALUES (?, ?, ?, ?, ?)').run(
    ticketId,
    type,
    message,
    isPublic,
    userId
  );
  db.prepare("UPDATE tickets SET updated_at = datetime('now') WHERE id = ?").run(ticketId);
}

const clean = (v) => (typeof v === 'string' ? v.trim() : v) || null;

export function findOrCreateCustomer({ id, name, email, phone, company, address }) {
  if (id) {
    const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!c) throw new HttpError(400, 'Customer not found');
    return c;
  }
  name = clean(name);
  email = clean(email);
  phone = clean(phone);
  if (!name) throw new HttpError(400, 'Customer name is required');
  if (!email && !phone) throw new HttpError(400, 'Email or phone is required');

  let existing = email && db.prepare('SELECT * FROM customers WHERE email = ?').get(email);
  if (!existing && phone) existing = db.prepare('SELECT * FROM customers WHERE phone = ?').get(phone);
  if (existing) {
    // fill in any details we didn't have before
    db.prepare(
      `UPDATE customers SET phone = COALESCE(phone, ?), email = COALESCE(email, ?),
       company = COALESCE(company, ?), address = COALESCE(address, ?) WHERE id = ?`
    ).run(phone, email, clean(company), clean(address), existing.id);
    return db.prepare('SELECT * FROM customers WHERE id = ?').get(existing.id);
  }
  const { lastInsertRowid } = db
    .prepare('INSERT INTO customers (name, email, phone, company, address) VALUES (?, ?, ?, ?, ?)')
    .run(name, email, phone, clean(company), clean(address));
  return db.prepare('SELECT * FROM customers WHERE id = ?').get(lastInsertRowid);
}

export function findOrCreatePrinter(customerId, { id, brand, model, serial_number, location }) {
  if (id) {
    const p = db.prepare('SELECT * FROM printers WHERE id = ?').get(id);
    if (!p) throw new HttpError(400, 'Printer not found');
    return p;
  }
  brand = clean(brand);
  model = clean(model);
  serial_number = clean(serial_number);
  if (!brand || !model || !serial_number) throw new HttpError(400, 'Printer brand, model and serial number are required');

  const existing = db
    .prepare('SELECT * FROM printers WHERE serial_number = ? AND customer_id = ?')
    .get(serial_number, customerId);
  if (existing) return existing;
  const { lastInsertRowid } = db
    .prepare('INSERT INTO printers (customer_id, brand, model, serial_number, location) VALUES (?, ?, ?, ?, ?)')
    .run(customerId, brand, model, serial_number, clean(location));
  return db.prepare('SELECT * FROM printers WHERE id = ?').get(lastInsertRowid);
}

export const createTicket = db.transaction((input, { userId = null, source = 'staff' } = {}) => {
  const issue = clean(input.issue);
  if (!issue) throw new HttpError(400, 'Please describe the issue');

  const customer = findOrCreateCustomer(input.customer || {});
  const printer = findOrCreatePrinter(customer.id, input.printer || {});
  const token = crypto.randomBytes(12).toString('base64url');
  const pick = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);

  const { lastInsertRowid: id } = db
    .prepare(
      `INSERT INTO tickets (token, customer_id, printer_id, type, service_mode, priority, issue, accessories,
        preferred_date, preferred_time, tax_rate, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      token,
      customer.id,
      printer.id,
      pick(input.type, ['repair', 'maintenance', 'installation', 'inspection'], 'repair'),
      pick(input.service_mode, ['drop_off', 'on_site', 'pickup'], 'drop_off'),
      pick(input.priority, ['low', 'normal', 'high', 'urgent'], 'normal'),
      issue,
      clean(input.accessories),
      clean(input.preferred_date),
      clean(input.preferred_time),
      Number(getSetting('tax_rate')) || 0,
      source
    );
  db.prepare('UPDATE tickets SET code = ? WHERE id = ?').run(`PX-${String(id).padStart(5, '0')}`, id);
  addEvent(id, {
    type: 'created',
    message: source === 'customer' ? 'Service request submitted online' : 'Service request created',
    isPublic: true,
    userId,
  });
  return id;
});

export function findScheduleConflicts(ticketId, userId, start, end) {
  if (!userId || !start) return [];
  end = end || start;
  return db
    .prepare(
      `SELECT t.id, t.code, t.scheduled_start, t.scheduled_end FROM tickets t
       WHERE t.assigned_to = ? AND t.id != ? AND t.scheduled_start IS NOT NULL
         AND t.status NOT IN ('completed','cancelled')
         AND t.scheduled_start < ? AND COALESCE(t.scheduled_end, t.scheduled_start) > ?`
    )
    .all(userId, ticketId, end, start);
}
