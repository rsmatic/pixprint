import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { publicUser, requireRole } from '../auth.js';
import { HttpError } from '../tickets.js';

const router = Router();
const ROLES = ['admin', 'staff', 'technician'];

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT u.*, (SELECT COUNT(*) FROM tickets t WHERE t.assigned_to = u.id AND t.status NOT IN ('completed','cancelled')) AS open_tickets
       FROM users u ORDER BY u.active DESC, u.name`
    )
    .all();
  res.json(rows.map(publicUser));
});

router.post('/', requireRole('admin'), (req, res) => {
  const { name, email, phone, password, role = 'technician' } = req.body;
  if (!name?.trim() || !email?.trim()) throw new HttpError(400, 'Name and email are required');
  if (!password || password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
  if (!ROLES.includes(role)) throw new HttpError(400, 'Invalid role');
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim())) throw new HttpError(409, 'Email already in use');
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)')
    .run(name.trim(), email.trim(), phone?.trim() || null, bcrypt.hashSync(password, 10), role);
  res.status(201).json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid)));
});

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const isSelf = id === req.user.id;
  const isAdmin = req.user.role === 'admin';
  if (!isSelf && !isAdmin) throw new HttpError(403, 'Not allowed');

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) throw new HttpError(404, 'User not found');
  const b = req.body;
  const fields = {};
  if ('name' in b) {
    if (!b.name?.trim()) throw new HttpError(400, 'Name is required');
    fields.name = b.name.trim();
  }
  if ('phone' in b) fields.phone = b.phone?.trim() || null;
  if ('email' in b) {
    const email = b.email?.trim();
    if (!email) throw new HttpError(400, 'Email is required');
    const other = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, id);
    if (other) throw new HttpError(409, 'Email already in use');
    fields.email = email;
  }
  if (b.password) {
    if (b.password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
    if (isSelf && !isAdmin && !bcrypt.compareSync(b.current_password || '', user.password_hash)) {
      throw new HttpError(400, 'Current password is incorrect');
    }
    fields.password_hash = bcrypt.hashSync(b.password, 10);
  }
  if (isAdmin) {
    if ('role' in b) {
      if (!ROLES.includes(b.role)) throw new HttpError(400, 'Invalid role');
      if (isSelf && b.role !== 'admin') throw new HttpError(400, 'You cannot remove your own admin role');
      fields.role = b.role;
    }
    if ('active' in b) {
      if (isSelf && !b.active) throw new HttpError(400, 'You cannot deactivate your own account');
      fields.active = b.active ? 1 : 0;
    }
  }
  const keys = Object.keys(fields);
  if (keys.length) {
    db.prepare(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => fields[k]), id);
  }
  res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)));
});

export default router;
