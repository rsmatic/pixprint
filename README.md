# pixprint

Printer repair & maintenance management — customer service requests, scheduling, quotes, repair tracking and a shareable status page for customers.

**Stack:** React (Vite) frontend · Node.js/Express API · SQLite (via sql.js, no native build needed)

## Quick start

```bash
npm run setup        # install root, server and client dependencies
npm run seed:demo    # optional: sample technicians, customers & tickets
npm run dev          # API on :5050, web app on http://localhost:5173
```

Sign in at <http://localhost:5173/login> with **admin@pixprint.local / admin123**. Change this password under *My profile* right away.
Demo staff accounts (after `seed:demo`): `mark@`, `ana@`, `joy@pixprint.local`, password `demo123`.

### Production

```bash
npm run build        # builds client/dist
npm start            # Express serves the API and the built app on :5050
```

Environment variables (all optional):

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5050` | HTTP port (the dev proxy follows it too) |
| `DATA_DIR` | `server/data` | Where `pixprint.db` is stored. Back this folder up. |
| `JWT_SECRET` | auto-generated, stored in DB | Signing key for staff sessions |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@pixprint.local` / `admin123` | First admin, created only when no users exist |

Set **Settings → Public site URL** to your public domain so copied customer links point to the right place (not `localhost`).

### Live deployment

- **Frontend:** <https://rsmatic.github.io/pixprint/> — GitHub Pages, deployed by `.github/workflows/pages.yml` on every push to `main` that touches `client/`.
- **API:** <https://pixprint.54-227-48-13.sslip.io> — Docker container `pixprint-api` on the EC2 host (`ec2-user@54.227.48.13`).
  It sits behind orderko's Caddy container (which owns ports 80/443), on the `orderko_default` network.
  The site block is `~/eaglemark/caddy/pixprint.caddy`, imported from `~/eaglemark/caddy/Caddyfile`.
- **Secrets:** `~/pixprint/.env` on the server (admin password, JWT secret). **Data:** Docker volume `deploy_pixprint-data`.

Update the API after pushing changes:

```bash
ssh -i ~/rsmatic.pem ec2-user@54.227.48.13
cd ~/pixprint/app && git pull && sudo docker compose -f deploy/docker-compose.yml up -d --build
```

## Features

**Customer side (no login)**
- `/` — marketing home page with an animated printer-matrix hero, services, how-it-works steps and "Request service" calls to action.
- `/request` — service request form: contact details, printer brand / model / serial number, issue (with quick-pick common issues), service type, drop-off / on-site / pickup, preferred date & time. Gives the customer a ticket number and tracking link.
- `/track/:token` — live status page: progress steps, schedule, technician, findings, itemized quote with **Approve / Decline**, update timeline, and messaging to the shop.
- `/track` — look up a request by ticket number + email/phone if the link was lost.

**Staff side (`/app`)**
- **Dashboard** — open tickets, new requests, unassigned, awaiting approval, ready for pickup, maintenance due, revenue this month, unpaid balances, today's schedule, pipeline by status.
- **Tickets** — search by ticket #, customer, serial, model or issue, and filter by status, technician or type. Status workflow:
  `New → Scheduled → Unit received → Diagnosing → Awaiting approval → Approved → In repair ⇄ Waiting parts → Ready → Completed` (or Cancelled), with a one-click "next step" button.
- **Ticket detail** — assign a technician, schedule start and duration (warns on technician double-booking), diagnosis notes, parts / labor / other cost lines, discount and tax, send quote, record phone approval, record payments, internal or customer-visible notes, full activity log.
- **Copy customer link** — copy the status URL or a ready-made message, or open SMS / email with it prefilled.
- **Job sheet / service invoice** — printable, with a QR code to the status page, signature lines and a cut-out unit tag.
- **Schedule** — weekly calendar color-coded by technician, plus a queue of jobs that still need a schedule (showing each customer's preferred date).
- **Customers** — contact info, registered printers, full service history, lifetime value and outstanding balance.
- **Printers** — asset registry by serial number with service history; preventive-maintenance interval with overdue / due-soon tracking and one-click PM tickets. Completing a maintenance ticket updates the last maintenance date.
- **Team** (admin) — add users as Admin, Front desk, or Technician; disable accounts.
- **Settings** (admin) — shop name / contact (shown to customers and on printouts), currency, default tax, default maintenance interval, public URL.

## Project layout

```
server/src/
  index.js          Express app, auth endpoints, static hosting
  db.js             SQLite schema, persistence, seed admin, settings
  tickets.js        ticket service: create, totals, events, conflicts
  routes/           public, tickets, customers, printers, users, misc (dashboard/schedule/settings)
  seed-demo.js      sample data
client/src/
  pages/            one file per screen
  components/       layout + shared UI
  lib.js            statuses, labels, formatting helpers
```

## Original requirements

1. create a printer management repair and maintenance
2. has scheduling system, users, can request and fillup by customer/client (printer brand, model, SN, issue)
3. can set repair cost, can copy url for unit status to customer
4. any thing that will help the process
5. react, backend any
