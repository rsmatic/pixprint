import { Router } from 'express';
import { db } from '../db.js';
import { HttpError, TICKET_SELECT, withTotals } from '../tickets.js';

const router = Router();
const clean = (v) => (typeof v === 'string' ? v.trim() : v) || null;

router.get('/', (req, res) => {
  const q = req.query.q ? `%${req.query.q}%` : null;
  const rows = db
    .prepare(
      `SELECT c.*,
        (SELECT COUNT(*) FROM printers p WHERE p.customer_id = c.id) AS printer_count,
        (SELECT COUNT(*) FROM tickets t WHERE t.customer_id = c.id) AS ticket_count,
        (SELECT COUNT(*) FROM tickets t WHERE t.customer_id = c.id AND t.status NOT IN ('completed','cancelled')) AS open_count
       FROM customers c
       ${q ? 'WHERE c.name LIKE ? OR c.company LIKE ? OR c.email LIKE ? OR c.phone LIKE ?' : ''}
       ORDER BY c.name LIMIT 500`
    )
    .all(...(q ? [q, q, q, q] : []));
  res.json(rows);
});

router.post('/', (req, res) => {
  const b = req.body;
  if (!clean(b.name)) throw new HttpError(400, 'Name is required');
  const { lastInsertRowid } = db
    .prepare('INSERT INTO customers (name, email, phone, company, address, notes) VALUES (?, ?, ?, ?, ?, ?)')
    .run(clean(b.name), clean(b.email), clean(b.phone), clean(b.company), clean(b.address), clean(b.notes));
  res.status(201).json(db.prepare('SELECT * FROM customers WHERE id = ?').get(lastInsertRowid));
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!customer) throw new HttpError(404, 'Customer not found');
  customer.printers = db.prepare('SELECT * FROM printers WHERE customer_id = ? ORDER BY brand, model').all(id);
  customer.tickets = db.prepare(`${TICKET_SELECT} WHERE t.customer_id = ? ORDER BY t.created_at DESC`).all(id).map(withTotals);
  res.json(customer);
});

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const keys = ['name', 'email', 'phone', 'company', 'address', 'notes'].filter((k) => k in req.body);
  if ('name' in req.body && !clean(req.body.name)) throw new HttpError(400, 'Name is required');
  if (keys.length) {
    db.prepare(`UPDATE customers SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(
      ...keys.map((k) => clean(req.body[k])),
      id
    );
  }
  const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!c) throw new HttpError(404, 'Customer not found');
  res.json(c);
});

export default router;
