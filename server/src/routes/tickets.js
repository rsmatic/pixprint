import { Router } from 'express';
import { db } from '../db.js';
import {
  STATUSES,
  OPEN_STATUSES,
  STATUS_LABELS,
  HttpError,
  TICKET_SELECT,
  withTotals,
  getTicketFull,
  addEvent,
  createTicket,
  findScheduleConflicts,
} from '../tickets.js';

const router = Router();

const fmtSchedule = (start, end) => {
  const d = new Date(start);
  const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const time = (s) => new Date(s).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date}, ${time(start)}${end ? ` – ${time(end)}` : ''}`;
};

router.get('/', (req, res) => {
  const { status, q, assigned, type, open } = req.query;
  const where = [];
  const params = [];
  if (status) {
    where.push(`t.status IN (${status.split(',').map(() => '?').join(',')})`);
    params.push(...status.split(','));
  } else if (open === '1') {
    where.push(`t.status IN (${OPEN_STATUSES.map(() => '?').join(',')})`);
    params.push(...OPEN_STATUSES);
  }
  if (assigned === 'me') {
    where.push('t.assigned_to = ?');
    params.push(req.user.id);
  } else if (assigned === 'none') {
    where.push('t.assigned_to IS NULL');
  } else if (assigned) {
    where.push('t.assigned_to = ?');
    params.push(Number(assigned));
  }
  if (type) {
    where.push('t.type = ?');
    params.push(type);
  }
  if (q) {
    const like = `%${q}%`;
    where.push(
      '(t.code LIKE ? OR c.name LIKE ? OR c.company LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR p.serial_number LIKE ? OR p.brand LIKE ? OR p.model LIKE ? OR t.issue LIKE ?)'
    );
    params.push(like, like, like, like, like, like, like, like, like);
  }
  const sql = `${TICKET_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
    t.created_at DESC LIMIT 500`;
  res.json(db.prepare(sql).all(...params).map(withTotals));
});

router.post('/', (req, res) => {
  const id = createTicket(req.body, { userId: req.user.id, source: 'staff' });
  res.status(201).json(getTicketFull(id));
});

router.get('/:id', (req, res) => {
  res.json(getTicketFull(Number(req.params.id)));
});

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const before = getTicketFull(id);
  const b = req.body;
  const fields = {};
  const allowed = {
    type: ['repair', 'maintenance', 'installation', 'inspection'],
    service_mode: ['drop_off', 'on_site', 'pickup'],
    priority: ['low', 'normal', 'high', 'urgent'],
  };
  for (const [k, values] of Object.entries(allowed)) {
    if (k in b) {
      if (!values.includes(b[k])) throw new HttpError(400, `Invalid ${k}`);
      fields[k] = b[k];
    }
  }
  for (const k of ['issue', 'diagnosis', 'accessories', 'scheduled_start', 'scheduled_end']) {
    if (k in b) fields[k] = typeof b[k] === 'string' && b[k].trim() ? b[k].trim() : null;
  }
  for (const k of ['discount', 'tax_rate', 'amount_paid']) {
    if (k in b) {
      const n = Number(b[k]);
      if (!Number.isFinite(n) || n < 0) throw new HttpError(400, `Invalid ${k}`);
      fields[k] = n;
    }
  }
  if ('assigned_to' in b) {
    if (b.assigned_to) {
      const u = db.prepare('SELECT id, active FROM users WHERE id = ?').get(Number(b.assigned_to));
      if (!u || !u.active) throw new HttpError(400, 'Technician not found');
      fields.assigned_to = u.id;
    } else fields.assigned_to = null;
  }
  if ('issue' in fields && !fields.issue) throw new HttpError(400, 'Issue cannot be empty');
  if (fields.scheduled_start && fields.scheduled_end && fields.scheduled_end < fields.scheduled_start) {
    throw new HttpError(400, 'Schedule end must be after start');
  }
  if ('scheduled_start' in fields && !fields.scheduled_start) fields.scheduled_end = null;

  const keys = Object.keys(fields);
  if (!keys.length) return res.json({ ticket: before, conflicts: [] });

  db.transaction(() => {
    db.prepare(`UPDATE tickets SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(
      ...keys.map((k) => fields[k]),
      id
    );
    const uid = req.user.id;
    if ('assigned_to' in fields && fields.assigned_to !== before.assigned_to) {
      const name = fields.assigned_to ? db.prepare('SELECT name FROM users WHERE id = ?').get(fields.assigned_to).name : null;
      addEvent(id, { type: 'assign', message: name ? `Assigned to ${name}` : 'Unassigned', userId: uid });
    }
    const scheduleChanged =
      ('scheduled_start' in fields && fields.scheduled_start !== before.scheduled_start) ||
      ('scheduled_end' in fields && fields.scheduled_end !== before.scheduled_end);
    if (scheduleChanged) {
      const start = fields.scheduled_start !== undefined ? fields.scheduled_start : before.scheduled_start;
      const end = fields.scheduled_end !== undefined ? fields.scheduled_end : before.scheduled_end;
      if (start) {
        addEvent(id, { type: 'schedule', message: `Service scheduled: ${fmtSchedule(start, end)}`, isPublic: true, userId: uid });
        if (before.status === 'new') {
          db.prepare("UPDATE tickets SET status = 'scheduled' WHERE id = ?").run(id);
          addEvent(id, { type: 'status', message: `Status changed to ${STATUS_LABELS.scheduled}`, isPublic: true, userId: uid });
        }
      } else {
        addEvent(id, { type: 'schedule', message: 'Schedule cleared', userId: uid });
      }
    }
    if ('diagnosis' in fields && fields.diagnosis && fields.diagnosis !== before.diagnosis) {
      addEvent(id, { type: 'note', message: `Diagnosis updated`, userId: uid });
    }
    if ('amount_paid' in fields && fields.amount_paid !== before.amount_paid) {
      addEvent(id, { type: 'payment', message: `Amount paid updated to ${fields.amount_paid.toFixed(2)}`, userId: uid });
    }
  })();

  const ticket = getTicketFull(id);
  const conflicts = findScheduleConflicts(id, ticket.assigned_to, ticket.scheduled_start, ticket.scheduled_end);
  res.json({ ticket, conflicts });
});

router.post('/:id/status', (req, res) => {
  const id = Number(req.params.id);
  const { status, note, public: isPublic = true } = req.body;
  if (!STATUSES.includes(status)) throw new HttpError(400, 'Invalid status');
  const before = getTicketFull(id);
  if (before.status === status && !note) return res.json(before);

  db.transaction(() => {
    if (before.status !== status) {
      db.prepare(
        `UPDATE tickets SET status = ?, updated_at = datetime('now'),
         completed_at = CASE WHEN ? = 'completed' THEN datetime('now') ELSE NULL END WHERE id = ?`
      ).run(status, status, id);
      addEvent(id, { type: 'status', message: `Status changed to ${STATUS_LABELS[status]}`, isPublic: true, userId: req.user.id });
      if (status === 'completed' && before.type === 'maintenance') {
        db.prepare("UPDATE printers SET last_maintenance_at = date('now') WHERE id = ?").run(before.printer_id);
      }
    }
    if (note?.trim()) addEvent(id, { type: 'note', message: note.trim(), isPublic: !!isPublic, userId: req.user.id });
  })();
  res.json(getTicketFull(id));
});

router.post('/:id/notes', (req, res) => {
  const id = Number(req.params.id);
  getTicketFull(id);
  const message = req.body.message?.trim();
  if (!message) throw new HttpError(400, 'Note is empty');
  addEvent(id, { type: 'note', message, isPublic: !!req.body.public, userId: req.user.id });
  res.json(getTicketFull(id));
});

router.put('/:id/items', (req, res) => {
  const id = Number(req.params.id);
  getTicketFull(id);
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const clean = items
    .filter((i) => i.description?.trim())
    .map((i) => {
      const qty = Number(i.qty);
      const unit_price = Number(i.unit_price);
      if (!Number.isFinite(qty) || qty <= 0) throw new HttpError(400, `Invalid quantity for "${i.description}"`);
      if (!Number.isFinite(unit_price) || unit_price < 0) throw new HttpError(400, `Invalid price for "${i.description}"`);
      return { kind: ['part', 'labor', 'other'].includes(i.kind) ? i.kind : 'part', description: i.description.trim(), qty, unit_price };
    });
  db.transaction(() => {
    db.prepare('DELETE FROM ticket_items WHERE ticket_id = ?').run(id);
    const ins = db.prepare('INSERT INTO ticket_items (ticket_id, kind, description, qty, unit_price) VALUES (?, ?, ?, ?, ?)');
    for (const i of clean) ins.run(id, i.kind, i.description, i.qty, i.unit_price);
    db.prepare("UPDATE tickets SET updated_at = datetime('now') WHERE id = ?").run(id);
  })();
  res.json(getTicketFull(id));
});

router.post('/:id/quote', (req, res) => {
  const id = Number(req.params.id);
  const t = getTicketFull(id);
  if (!t.items.length) throw new HttpError(400, 'Add at least one cost item before sending a quote');
  db.transaction(() => {
    db.prepare("UPDATE tickets SET quote_status = 'pending', status = 'awaiting_approval', updated_at = datetime('now') WHERE id = ?").run(id);
    addEvent(id, {
      type: 'quote',
      message: `Repair quote sent for your approval (total ${t.totals.total.toFixed(2)})`,
      isPublic: true,
      userId: req.user.id,
    });
  })();
  res.json(getTicketFull(id));
});

router.post('/:id/quote/override', (req, res) => {
  // record a decision the customer gave by phone / in person
  const id = Number(req.params.id);
  const decision = req.body.decision;
  if (!['approved', 'declined'].includes(decision)) throw new HttpError(400, 'Invalid decision');
  getTicketFull(id);
  db.transaction(() => {
    db.prepare(
      `UPDATE tickets SET quote_status = ?, status = CASE WHEN ? = 'approved' THEN 'approved' ELSE status END,
       updated_at = datetime('now') WHERE id = ?`
    ).run(decision, decision, id);
    addEvent(id, { type: 'quote', message: `Quote ${decision} (recorded by staff)`, isPublic: true, userId: req.user.id });
  })();
  res.json(getTicketFull(id));
});

router.delete('/:id', (req, res) => {
  if (req.user.role !== 'admin') throw new HttpError(403, 'Only admins can delete tickets');
  db.prepare('DELETE FROM tickets WHERE id = ?').run(Number(req.params.id));
  res.status(204).end();
});

export default router;
