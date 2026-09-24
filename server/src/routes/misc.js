import { Router } from 'express';
import { db, getSettings } from '../db.js';
import { requireRole } from '../auth.js';
import { OPEN_STATUSES, TICKET_SELECT, withTotals } from '../tickets.js';
import { withMaintenance } from './printers.js';

const router = Router();

const localDate = (d = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

router.get('/dashboard', (req, res) => {
  const today = localDate();
  const tomorrow = localDate(new Date(Date.now() + 86400000));
  const monthStart = today.slice(0, 8) + '01';

  const byStatus = Object.fromEntries(
    db.prepare('SELECT status, COUNT(*) AS n FROM tickets GROUP BY status').all().map((r) => [r.status, r.n])
  );
  const open = OPEN_STATUSES.reduce((s, k) => s + (byStatus[k] || 0), 0);
  const unassigned = db
    .prepare(`SELECT COUNT(*) AS n FROM tickets WHERE assigned_to IS NULL AND status IN (${OPEN_STATUSES.map(() => '?').join(',')})`)
    .get(...OPEN_STATUSES).n;

  const todaySchedule = db
    .prepare(`${TICKET_SELECT} WHERE t.scheduled_start >= ? AND t.scheduled_start < ? AND t.status != 'cancelled' ORDER BY t.scheduled_start`)
    .all(today, tomorrow)
    .map(withTotals);

  const recent = db.prepare(`${TICKET_SELECT} ORDER BY t.updated_at DESC LIMIT 8`).all().map(withTotals);

  const completedThisMonth = db
    .prepare(`${TICKET_SELECT} WHERE t.status = 'completed' AND t.completed_at >= ?`)
    .all(monthStart)
    .map(withTotals);
  const revenue = completedThisMonth.reduce((s, t) => s + t.totals.total, 0);

  const outstanding = db
    .prepare(`${TICKET_SELECT} WHERE t.status IN ('ready','completed')`)
    .all()
    .map(withTotals)
    .filter((t) => t.totals.balance > 0.005);

  const maintenanceDue = db
    .prepare('SELECT * FROM printers WHERE maintenance_interval_days IS NOT NULL')
    .all()
    .map(withMaintenance)
    .filter((p) => p.maintenance_state === 'overdue' || p.maintenance_state === 'due_soon').length;

  const newRequests = db.prepare(`${TICKET_SELECT} WHERE t.status = 'new' ORDER BY t.created_at DESC LIMIT 10`).all().map(withTotals);

  res.json({
    byStatus,
    open,
    unassigned,
    completedThisMonth: completedThisMonth.length,
    revenue,
    outstandingCount: outstanding.length,
    outstandingAmount: outstanding.reduce((s, t) => s + t.totals.balance, 0),
    maintenanceDue,
    todaySchedule,
    recent,
    newRequests,
  });
});

router.get('/schedule', (req, res) => {
  const { from, to, technician } = req.query;
  const params = [from || '0000', to || '9999'];
  let extra = '';
  if (technician) {
    extra = ' AND t.assigned_to = ?';
    params.push(Number(technician));
  }
  const scheduled = db
    .prepare(
      `${TICKET_SELECT} WHERE t.scheduled_start >= ? AND t.scheduled_start < ? AND t.status != 'cancelled'${extra}
       ORDER BY t.scheduled_start`
    )
    .all(...params)
    .map(withTotals);
  const unscheduled = db
    .prepare(
      `${TICKET_SELECT} WHERE t.scheduled_start IS NULL AND t.status IN ('new','received','diagnosing','approved','in_repair','waiting_parts')
       ORDER BY t.preferred_date IS NULL, t.preferred_date, t.created_at LIMIT 100`
    )
    .all()
    .map(withTotals);
  res.json({ scheduled, unscheduled });
});

router.get('/settings', (req, res) => res.json(getSettings()));

router.put('/settings', requireRole('admin'), (req, res) => {
  const allowed = ['shop_name', 'shop_phone', 'shop_email', 'shop_address', 'currency', 'tax_rate', 'default_maintenance_days', 'public_base_url'];
  const upd = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  db.transaction(() => {
    for (const k of allowed) if (k in req.body) upd.run(k, String(req.body[k] ?? '').trim());
  })();
  res.json(getSettings());
});

export default router;
