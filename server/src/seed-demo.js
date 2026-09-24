// Populates the database with sample technicians, customers, printers and tickets.
// Usage: npm run seed:demo   (from the repo root)
import bcrypt from 'bcryptjs';
import { db, flush } from './db.js';
import { createTicket, addEvent, STATUS_LABELS } from './tickets.js';

if (db.prepare('SELECT COUNT(*) AS n FROM tickets').get().n > 0 && !process.argv.includes('--force')) {
  console.log('Database already has tickets; skipping demo seed. Pass --force to add demo data anyway.');
  process.exit(0);
}

const techs = [
  ['Mark Reyes', 'mark@pixprint.local', 'technician'],
  ['Ana Santos', 'ana@pixprint.local', 'technician'],
  ['Joy Dela Cruz', 'joy@pixprint.local', 'staff'],
].map(([name, email, role]) => {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return existing.id;
  return db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(name, email, bcrypt.hashSync('demo123', 10), role)
    .lastInsertRowid;
});

const pad = (n) => String(n).padStart(2, '0');
const at = (dayOffset, hour, min = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:${pad(min)}`;
};

const samples = [
  {
    customer: { name: 'Liza Mendoza', email: 'liza@acmelogistics.ph', phone: '09171234567', company: 'Acme Logistics', address: 'Ortigas Center, Pasig' },
    printer: { brand: 'Epson', model: 'L3210', serial_number: 'X8H5012345' },
    issue: 'Paper jam every few pages, grinding noise when feeding.',
    status: 'new',
    preferred: [1, 'morning'],
  },
  {
    customer: { name: 'Robert Tan', email: 'rtan@tanlaw.com', phone: '09181112222', company: 'Tan & Associates Law', address: 'Makati CBD' },
    printer: { brand: 'HP', model: 'LaserJet Pro M404dn', serial_number: 'PHBQK12345' },
    issue: 'Faded print on the right side, toner replaced already.',
    status: 'diagnosing',
    tech: 0,
    schedule: [0, 10],
    diagnosis: 'Drum unit worn out; transfer roller dirty.',
    items: [
      ['part', 'Imaging drum unit', 1, 3200],
      ['labor', 'Labor / service fee', 1, 800],
    ],
  },
  {
    customer: { name: 'Grace Lim', email: 'grace@stmarys.edu.ph', phone: '09223334444', company: "St. Mary's Academy" },
    printer: { brand: 'Canon', model: 'imageRUNNER 2625i', serial_number: 'CNR2625A77', location: 'Registrar office' },
    issue: 'Error E000007-0000 on display, cannot print or copy.',
    status: 'awaiting_approval',
    service_mode: 'on_site',
    tech: 1,
    schedule: [1, 13],
    diagnosis: 'Fixing assembly thermistor failure.',
    items: [
      ['part', 'Fixing assembly', 1, 9800],
      ['labor', 'On-site repair labor', 1, 1500],
      ['other', 'Transportation fee', 1, 500],
    ],
    quote: 'pending',
  },
  {
    customer: { name: 'Carlo Villanueva', phone: '09995556666' },
    printer: { brand: 'Brother', model: 'DCP-T720DW', serial_number: 'E81234K9N' },
    issue: 'Wi-Fi keeps disconnecting; black ink not printing.',
    status: 'in_repair',
    tech: 0,
    schedule: [-1, 14],
    diagnosis: 'Clogged print head (black). Firmware outdated.',
    items: [
      ['labor', 'Print head deep cleaning', 1, 650],
      ['labor', 'Firmware update & network setup', 1, 350],
    ],
    quote: 'approved',
  },
  {
    customer: { name: 'Liza Mendoza', email: 'liza@acmelogistics.ph' },
    printer: { brand: 'Kyocera', model: 'ECOSYS M2540dn', serial_number: 'VKX9876543', location: 'Warehouse office' },
    issue: 'Quarterly preventive maintenance',
    type: 'maintenance',
    service_mode: 'on_site',
    status: 'scheduled',
    tech: 1,
    schedule: [3, 9],
  },
  {
    customer: { name: 'Nina Robles', email: 'nina.robles@gmail.com', phone: '09175550000' },
    printer: { brand: 'Epson', model: 'L121', serial_number: 'X5E9001122' },
    issue: 'Printer lights blinking alternately, not printing.',
    status: 'ready',
    tech: 0,
    diagnosis: 'Waste ink pad counter reached limit. Counter reset and ink pad replaced.',
    items: [
      ['part', 'Waste ink pad', 1, 250],
      ['labor', 'Counter reset & service', 1, 400],
    ],
    quote: 'approved',
    paid: 0,
  },
  {
    customer: { name: 'Robert Tan', email: 'rtan@tanlaw.com' },
    printer: { brand: 'HP', model: 'LaserJet Pro M404dn', serial_number: 'PHBQK99887', location: 'Reception' },
    issue: 'Printer not detected on the network.',
    status: 'completed',
    tech: 1,
    diagnosis: 'Reconfigured static IP after router replacement.',
    items: [['labor', 'Network configuration', 1, 500]],
    quote: 'approved',
    paid: 500,
  },
];

for (const s of samples) {
  const id = createTicket(
    { ...s, customer: s.customer, printer: s.printer, preferred_date: s.preferred && at(s.preferred[0], 0).slice(0, 10), preferred_time: s.preferred?.[1] },
    { source: s.status === 'new' ? 'customer' : 'staff' }
  );
  const tech = s.tech !== undefined ? techs[s.tech] : null;
  const start = s.schedule ? at(s.schedule[0], s.schedule[1]) : null;
  const end = s.schedule ? at(s.schedule[0], s.schedule[1] + (s.service_mode === 'on_site' ? 2 : 1)) : null;
  db.prepare(
    `UPDATE tickets SET status = ?, assigned_to = ?, scheduled_start = ?, scheduled_end = ?, diagnosis = ?,
     quote_status = ?, amount_paid = ?, completed_at = CASE WHEN ? = 'completed' THEN datetime('now') END WHERE id = ?`
  ).run(s.status, tech, start, end, s.diagnosis || null, s.quote || 'none', s.paid || 0, s.status, id);
  for (const [kind, description, qty, price] of s.items || []) {
    db.prepare('INSERT INTO ticket_items (ticket_id, kind, description, qty, unit_price) VALUES (?, ?, ?, ?, ?)').run(id, kind, description, qty, price);
  }
  if (s.status !== 'new') addEvent(id, { type: 'status', message: `Status changed to ${STATUS_LABELS[s.status]}`, isPublic: true });
}

// maintenance tracking on a couple of units
db.prepare("UPDATE printers SET maintenance_interval_days = 90, last_maintenance_at = date('now', '-95 days') WHERE serial_number = 'CNR2625A77'").run();
db.prepare("UPDATE printers SET maintenance_interval_days = 90, last_maintenance_at = date('now', '-80 days') WHERE serial_number = 'VKX9876543'").run();
db.prepare("UPDATE printers SET maintenance_interval_days = 180, last_maintenance_at = date('now', '-30 days') WHERE serial_number = 'PHBQK12345'").run();

flush();
console.log(`Demo data added: ${samples.length} tickets. Demo staff logins use password "demo123" (mark@, ana@, joy@pixprint.local).`);
process.exit(0);
