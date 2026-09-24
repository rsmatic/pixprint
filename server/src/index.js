import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { requireAuth, signToken, publicUser } from './auth.js';
import { HttpError } from './tickets.js';
import publicRoutes from './routes/public.js';
import ticketRoutes from './routes/tickets.js';
import customerRoutes from './routes/customers.js';
import printerRoutes from './routes/printers.js';
import userRoutes from './routes/users.js';
import miscRoutes from './routes/misc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 'loopback');
// CORS_ORIGIN: comma-separated list of allowed frontend origins (e.g. https://rsmatic.github.io); unset = allow all
const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors(corsOrigins?.length ? { origin: corsOrigins } : undefined));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = email && db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim());
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) {
    throw new HttpError(401, 'Invalid email or password');
  }
  if (!user.active) throw new HttpError(403, 'This account has been disabled');
  res.json({ token: signToken(user), user: publicUser(user) });
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json(req.user));

app.use('/api/public', publicRoutes);
app.use('/api/tickets', requireAuth, ticketRoutes);
app.use('/api/customers', requireAuth, customerRoutes);
app.use('/api/printers', requireAuth, printerRoutes);
app.use('/api/users', requireAuth, userRoutes);
app.use('/api', requireAuth, miscRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// serve the built React app in production
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('/{*splat}', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

const port = Number(process.env.PORT) || 5050;
app.listen(port, (err) => {
  if (err) {
    console.error(`Could not start server on port ${port}: ${err.message}`);
    process.exit(1);
  }
  console.log(`PixPrint API listening on http://localhost:${port}`);
});
