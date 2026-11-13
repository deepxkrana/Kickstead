# Kickstead

A sneaker store built on the PERN stack (PostgreSQL, Express, React, Node.js). Customers browse products, add them to a cart saved in the database, check out with a simulated payment and track their orders. Admins manage the catalogue, stock and orders, with a dashboard and an audit log.

The focus is on correctness rather than feature count:
- Prices and totals are calculated by the server.
- Stock can never go negative.
- Repeating a checkout request never creates a second order.
- Every permission check runs on the server.

> **Status: in progress.** Setup and the database are done (Phase 2 of 9). The Shop, Cart, Checkout, Orders and Admin pages are placeholders until their phases are built. See [Project status](#project-status).

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, TypeScript, Tailwind CSS 4, React Router 7, TanStack Query 5 |
| Backend | Node.js, Express 5, TypeScript, zod, Helmet |
| Database | PostgreSQL on Supabase, Prisma 6 (ORM and migrations) |
| Auth | Supabase Auth: Google sign-in, plus email/password for the demo accounts *(Phase 3)* |
| Tests | Vitest, Supertest |
| Deployment | Backend in Docker on AWS EC2, frontend on Vercel, deployed by GitHub Actions *(final phase)* |

## Repository layout

```text
kickstead/
├── database/            Prisma schema, SQL migrations, seed script
│   └── prisma/
│       ├── schema.prisma
│       ├── migrations/
│       └── seed.ts
├── backend/             Express REST API
│   ├── src/
│   │   ├── config/      Environment settings and pricing rules
│   │   ├── db/          Prisma client
│   │   ├── middleware/  Error handler, 404, request validation
│   │   ├── modules/     Feature modules (health, auth, catalog, cart, checkout, orders, …)
│   │   └── shared/      Errors, money calculations, order status rules
│   └── tests/
├── frontend/            React app
│   └── src/
│       ├── api/         Shared API client
│       ├── layouts/     Store and admin layouts
│       ├── pages/
│       ├── routes/
│       └── styles/      Tailwind theme built from DESIGN.md
└── package.json         npm workspaces root
```

---

## Getting started

### Prerequisites

- Node.js 20 or later (developed on Node 24) and npm 10 or later
- A [Supabase](https://supabase.com) project (the free tier is enough)

### 1. Install dependencies

```bash
npm install
```

One install at the root covers all three packages (npm workspaces).

### 2. Configure environment variables

Copy each example file and fill in the values:

```bash
cp database/.env.example database/.env
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env   # optional; the defaults work locally
```

To find the connection strings, open your Supabase project, click **Connect**, then choose **ORMs → Prisma**.

| File | Variable | Description |
|---|---|---|
| `database/.env` | `DATABASE_URL` | Transaction pooler, port **6543**. Add `?pgbouncer=true&connection_limit=1` to the end. |
| `database/.env` | `DIRECT_URL` | Session pooler, port **5432**. Used for migrations. |
| `backend/.env` | `DATABASE_URL` | Same value as `DATABASE_URL` in `database/.env`. |
| `backend/.env` | `PORT` | API port. Default `4000`. |
| `backend/.env` | `CLIENT_URL` | Browser origins allowed to call the API, comma-separated. Default `http://localhost:5173`. |
| `backend/.env` | `NODE_ENV` | `development`, `test` or `production`. |
| `frontend/.env` | `API_PROXY_TARGET` | Dev only: where Vite forwards `/api` requests. Default `http://localhost:4000`. |

> If your database password contains `@`, `#`, `/`, `%`, `:` or `?`, URL-encode those characters (for example `@` → `%40`).
>
> `.env` files are gitignored. Never commit real credentials. Only the `.env.example` files belong in the repository.

### 3. Set up the database

```bash
npm run db:generate   # generate the Prisma client
npm run db:migrate    # apply all migrations
npm run db:seed       # load categories and products (safe to run again)
```

### 4. Run the app

Use two terminals:

```bash
npm run dev:backend    # API at http://localhost:4000
npm run dev:frontend   # app at http://localhost:5173
```

Check that the API can reach the database:

```bash
curl http://localhost:4000/api/health
# {"status":"ok","database":"up"}
```

In development the frontend always calls `/api` on its own address, and Vite forwards those requests to the backend. In production, Vercel forwards them instead.

---

## Scripts

Run these from the repository root.

| Command | What it does |
|---|---|
| `npm run db:generate` | Generate the Prisma client from `database/prisma/schema.prisma` |
| `npm run db:migrate` | Apply pending migrations (`prisma migrate deploy`) |
| `npm run db:migrate:dev` | Create a new migration during development |
| `npm run db:seed` | Load or refresh the catalogue seed data |
| `npm run dev:backend` | Start the API with auto-reload |
| `npm run dev:frontend` | Start the Vite dev server |
| `npm test` | Run the backend test suite |
| `npm run typecheck` | Type-check all three packages |
| `npm run build` | Production build of the backend (`backend/dist`) and frontend (`frontend/dist`) |

## Testing

```bash
npm test
```

Current tests cover:
- **Pricing:** GST, the free-shipping threshold, tax rounding, and rejection of invalid amounts.
- **Order statuses:** every allowed change succeeds and the disallowed ones are rejected.
- **API errors:** the standard error format and security headers.

Database-backed tests (checkout, insufficient stock, duplicate checkout, permissions) are added in later phases. They run against a separate local PostgreSQL database, never against Supabase.

---

## Business rules

### Money

All amounts are stored as **integer paise** (INR × 100), so rounding errors from decimal numbers can't happen. The rules live in one file, [`backend/src/config/pricing.ts`](backend/src/config/pricing.ts):

| Rule | Value |
|---|---|
| GST | 18%, added on top of the subtotal, rounded to the nearest paisa |
| Shipping | ₹99, free when the subtotal is **above** ₹2,999 |
| Discount | None (always ₹0) |
| Total | subtotal − discount + GST + shipping |

The server always recalculates totals from current database prices. Prices or totals sent by the browser are ignored.

### Order lifecycle

```text
PLACED  → PAID | PAYMENT_FAILED | PAYMENT_CANCELLED | CANCELLED
PAID    → PACKED | CANCELLED
PACKED  → SHIPPED
SHIPPED → DELIVERED
```

`DELIVERED`, `CANCELLED`, `PAYMENT_FAILED` and `PAYMENT_CANCELLED` are final. The allowed changes are defined in one place, [`orderStates.ts`](backend/src/shared/orderStates/orderStates.ts). Any other change is rejected with `409 INVALID_STATUS_TRANSITION`.

Checkout has two steps:
1. Checkout creates a `PLACED` order and reserves its stock.
2. The payment page then simulates **Pay**, **Fail** or **Cancel**. A failed or cancelled payment returns the stock, and each stock change is logged.

**Revenue** is the sum of order totals with status `PAID`, `PACKED`, `SHIPPED` or `DELIVERED`.

### Database safeguards

The database itself enforces the critical rules, so a bug in the application can't break them:

- `CHECK` constraints: stock and every money column ≥ 0, quantities > 0, `total = subtotal − discount + tax + shipping`, and `line_total = unit_price × quantity`.
- `UNIQUE (user_id, idempotency_key)` on orders: a repeated checkout request can't create a second order.
- A partial unique index allows **at most one `PLACED` order per customer**, so stock can't be reserved twice.
- Orders store copies of the product name, price and delivery address, so later edits don't change past orders.
- **Row-level security is on for every table.** Supabase's REST API is therefore closed to the browser's public key. Only the backend, connecting through Prisma, can read or write data.

### API error format

Every error response has the same shape:

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "The requested quantity is not available.",
    "details": {}
  }
}
```

---

## Project status

| Phase | Scope | Status |
|---|---|---|
| 1 | Planning and decisions | ✅ Done |
| 2 | Project setup, database schema, migrations, seed | ✅ Done |
| 3 | Authentication and roles (Supabase Auth) | ⏳ Next |
| 4 | Catalogue and cart | Planned |
| 5 | Checkout, simulated payment, orders | Planned |
| 6 | Admin dashboard and operations | Planned |
| 7 | Security and reliability hardening | Planned |
| 8 | Database-backed tests | Planned |
| 9 | API docs, ER diagram, deployment | Planned |

**Demo credentials** for the admin and customer accounts will be listed here once Phase 3 adds them.

## Known limitations

- Payment is **simulated**. No payment provider is connected and no card data is collected or stored.
- Products have no sizes or variants. Each product has a single stock count.
- No discounts. GST and shipping use the fixed rules above.
- An abandoned unpaid (`PLACED`) order keeps its stock reserved until the customer or an admin cancels it. Unpaid orders don't expire automatically.
- Product images are external URLs (free Unsplash photos). There is no image upload.
- Brand names in the seed data are fictional.

## Project documents

| Document | Purpose |
|---|---|
| [PRD.md](PRD.md) | Product requirements and acceptance criteria |
| [Architecture.md](Architecture.md) | System structure and technical decisions |
| [Rules.md](Rules.md) | Implementation rules |
| [PLAN.md](PLAN.md) | Phase-by-phase delivery plan |
| [DESIGN.md](DESIGN.md) | Visual design system |
| [Memory.md](Memory.md) | Working log: decisions, progress, validation results |
