import { Router } from 'express';
import { db } from '../db.js';
import { HttpError, TICKET_SELECT, withTotals, createTicket } from '../tickets.js';

const router = Router();
const clean = (v) => (typeof v === 'string' ? v.trim() : v) || null;

// next maintenance date = last maintenance (or registration) + interval
export function withMaintenance(p) {
  if (!p) return p;
  const interval = p.maintenance_interval_days;
  let next_maintenance = null;
  let maintenance_state = 'none';
  if (interval) {
    const base = new Date((p.last_maintenance_at || p.created_at).slice(0, 10) + 'T00:00:00');
    base.setDate(base.getDate() + interval);
    next_maintenance = base.toISOString().slice(0, 10);
    const days = Math.round((base - new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00')) / 86400000);
    maintenance_state = days < 0 ? 'overdue' : days <= 14 ? 'due_soon' : 'ok';
  }
  return { ...p, next_maintenance, maintenance_state };
}

const PRINTER_SELECT = `
  SELECT p.*, c.name AS customer_name, c.company AS customer_company,
    (SELECT COUNT(*) FROM tickets t WHERE t.printer_id = p.id) AS ticket_count,
    (SELECT t.id FROM tickets t WHERE t.printer_id = p.id AND t.status NOT IN ('completed','cancelled')
      ORDER BY t.created_at DESC LIMIT 1) AS open_ticket_id
  FROM printers p JOIN customers c ON c.id = p.customer_id`;

router.get('/', (req, res) => {
  const q = req.query.q ? `%${req.query.q}%` : null;
  let rows = db
    .prepare(
      `${PRINTER_SELECT}
       ${q ? 'WHERE p.serial_number LIKE ? OR p.brand LIKE ? OR p.model LIKE ? OR c.name LIKE ? OR c.company LIKE ?' : ''}
       ORDER BY p.brand, p.model LIMIT 1000`
    )
    .all(...(q ? [q, q, q, q, q] : []))
    .map(withMaintenance);
  if (req.query.maintenance === 'due') rows = rows.filter((p) => ['overdue', 'due_soon'].includes(p.maintenance_state));
  res.json(rows);
});

router.post('/', (req, res) => {
  const b = req.body;
  if (!b.customer_id || !db.prepare('SELECT id FROM customers WHERE id = ?').get(b.customer_id)) {
    throw new HttpError(400, 'Customer is required');
  }
  if (!clean(b.brand) || !clean(b.model) || !clean(b.serial_number)) {
    throw new HttpError(400, 'Brand, model and serial number are required');
  }
  const interval = b.maintenance_interval_days === '' || b.maintenance_interval_days == null ? null : Number(b.maintenance_interval_days);
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO printers (customer_id, brand, model, serial_number, location, notes, maintenance_interval_days, last_maintenance_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(b.customer_id, clean(b.brand), clean(b.model), clean(b.serial_number), clean(b.location), clean(b.notes), interval, clean(b.last_maintenance_at));
  res.status(201).json(withMaintenance(db.prepare(`${PRINTER_SELECT} WHERE p.id = ?`).get(lastInsertRowid)));
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const printer = withMaintenance(db.prepare(`${PRINTER_SELECT} WHERE p.id = ?`).get(id));
  if (!printer) throw new HttpError(404, 'Printer not found');
  printer.tickets = db.prepare(`${TICKET_SELECT} WHERE t.printer_id = ? ORDER BY t.created_at DESC`).all(id).map(withTotals);
  res.json(printer);
});

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const b = req.body;
  const fields = {};
  for (const k of ['brand', 'model', 'serial_number', 'location', 'notes', 'last_maintenance_at']) {
    if (k in b) fields[k] = clean(b[k]);
  }
  for (const k of ['brand', 'model', 'serial_number']) {
    if (k in fields && !fields[k]) throw new HttpError(400, `${k.replace('_', ' ')} is required`);
  }
  if ('maintenance_interval_days' in b) {
    const v = b.maintenance_interval_days;
    fields.maintenance_interval_days = v === '' || v == null ? null : Math.max(1, Math.round(Number(v)) || 0) || null;
  }
  if ('customer_id' in b) {
    if (!db.prepare('SELECT id FROM customers WHERE id = ?').get(b.customer_id)) throw new HttpError(400, 'Customer not found');
    fields.customer_id = b.customer_id;
  }
  const keys = Object.keys(fields);
  if (keys.length) {
    db.prepare(`UPDATE printers SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => fields[k]), id);
  }
  const p = withMaintenance(db.prepare(`${PRINTER_SELECT} WHERE p.id = ?`).get(id));
  if (!p) throw new HttpError(404, 'Printer not found');
  res.json(p);
});

router.post('/:id/maintenance-ticket', (req, res) => {
  const p = db.prepare('SELECT * FROM printers WHERE id = ?').get(Number(req.params.id));
  if (!p) throw new HttpError(404, 'Printer not found');
  const ticketId = createTicket(
    {
      customer: { id: p.customer_id },
      printer: { id: p.id },
      type: 'maintenance',
      service_mode: 'on_site',
      issue: req.body.issue || 'Scheduled preventive maintenance (cleaning, inspection, consumables check)',
    },
    { userId: req.user.id }
  );
  res.status(201).json({ id: ticketId });
});

export default router;
