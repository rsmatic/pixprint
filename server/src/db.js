import initSqlJs from 'sql.js';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const dbFile = path.join(dataDir, 'pixprint.db');
fs.mkdirSync(dataDir, { recursive: true });

const SQL = await initSqlJs();
const raw = fs.existsSync(dbFile) ? new SQL.Database(fs.readFileSync(dbFile)) : new SQL.Database();

// --- persistence: sql.js is in-memory, so flush to disk after writes ---
let saveTimer = null;
let inTransaction = false;

function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  const tmp = dbFile + '.tmp';
  fs.writeFileSync(tmp, Buffer.from(raw.export()));
  fs.renameSync(tmp, dbFile);
}

function scheduleSave() {
  if (inTransaction || saveTimer) return;
  saveTimer = setTimeout(saveNow, 150);
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (saveTimer) saveNow();
    process.exit(0);
  });
}
process.on('exit', () => {
  if (saveTimer) saveNow();
});

function normalize(params) {
  return params.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));
}

// A small better-sqlite3-style API over sql.js.
export const db = {
  prepare(sql) {
    return {
      get(...params) {
        const stmt = raw.prepare(sql);
        try {
          stmt.bind(normalize(params));
          return stmt.step() ? stmt.getAsObject() : undefined;
        } finally {
          stmt.free();
        }
      },
      all(...params) {
        const stmt = raw.prepare(sql);
        const rows = [];
        try {
          stmt.bind(normalize(params));
          while (stmt.step()) rows.push(stmt.getAsObject());
        } finally {
          stmt.free();
        }
        return rows;
      },
      run(...params) {
        raw.run(sql, normalize(params));
        const changes = raw.getRowsModified();
        const lastInsertRowid = raw.exec('SELECT last_insert_rowid()')[0].values[0][0];
        scheduleSave();
        return { changes, lastInsertRowid };
      },
    };
  },
  exec(sql) {
    raw.exec(sql);
    scheduleSave();
  },
  transaction(fn) {
    return (...args) => {
      raw.run('BEGIN');
      inTransaction = true;
      try {
        const result = fn(...args);
        raw.run('COMMIT');
        return result;
      } catch (err) {
        raw.run('ROLLBACK');
        throw err;
      } finally {
        inTransaction = false;
        scheduleSave();
      }
    };
  },
};

raw.run('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'technician' CHECK (role IN ('admin','staff','technician')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT COLLATE NOCASE,
  phone TEXT,
  company TEXT,
  address TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS printers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  serial_number TEXT NOT NULL COLLATE NOCASE,
  location TEXT,
  notes TEXT,
  maintenance_interval_days INTEGER,
  last_maintenance_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_printers_serial ON printers(serial_number);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,
  token TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  printer_id INTEGER NOT NULL REFERENCES printers(id),
  type TEXT NOT NULL DEFAULT 'repair' CHECK (type IN ('repair','maintenance','installation','inspection')),
  service_mode TEXT NOT NULL DEFAULT 'drop_off' CHECK (service_mode IN ('drop_off','on_site','pickup')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status TEXT NOT NULL DEFAULT 'new',
  issue TEXT NOT NULL,
  diagnosis TEXT,
  accessories TEXT,
  preferred_date TEXT,
  preferred_time TEXT,
  assigned_to INTEGER REFERENCES users(id),
  scheduled_start TEXT,
  scheduled_end TEXT,
  quote_status TEXT NOT NULL DEFAULT 'none' CHECK (quote_status IN ('none','pending','approved','declined')),
  discount REAL NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0,
  amount_paid REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'staff',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_schedule ON tickets(scheduled_start);

CREATE TABLE IF NOT EXISTS ticket_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'part' CHECK (kind IN ('part','labor','other')),
  description TEXT NOT NULL,
  qty REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ticket_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  public INTEGER NOT NULL DEFAULT 0,
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_ticket ON ticket_events(ticket_id);
`);

// --- defaults & seed ---
const DEFAULT_SETTINGS = {
  shop_name: 'PixPrint Repair Center',
  shop_phone: '',
  shop_email: '',
  shop_address: '',
  currency: 'PHP',
  tax_rate: '0',
  default_maintenance_days: '90',
  public_base_url: '',
  notify_emails: '',
  email_staff_new_request: '1',
  email_customer_confirmation: '1',
  jwt_secret: crypto.randomBytes(32).toString('hex'),
};
for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

if (!db.prepare('SELECT id FROM users LIMIT 1').get()) {
  const email = process.env.ADMIN_EMAIL || 'admin@pixprint.local';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(
    'Administrator',
    email,
    bcrypt.hashSync(password, 10),
    'admin'
  );
  console.log(`Seeded admin user: ${email} / ${password}  (change this password!)`);
}

export function getSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? null;
}

export function getSettings() {
  const out = {};
  for (const row of db.prepare("SELECT key, value FROM settings WHERE key != 'jwt_secret'").all()) {
    out[row.key] = row.value;
  }
  return out;
}

export function flush() {
  saveNow();
}
