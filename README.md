# Kickstead

A sneaker store built on the PERN stack (PostgreSQL, Express, React, Node.js). Customers browse products, add them to a cart saved in the database, check out with a simulated payment and track their orders. Admins manage the catalogue, stock and orders, with a dashboard and an audit log.

The focus is on correctness rather than feature count:
- Prices and totals are calculated by the server.
- Stock can never go negative.
- Repeating a checkout request never creates a second order.
- Every permission check runs on the server.

> **Status: in progress.** The full customer journey is built (Phases 1–5 of 9): sign-in, catalogue, cart, addresses, checkout, simulated payment, order history and cancellation. The admin pages are placeholders until Phase 6. See [Project status](#project-status).

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, TypeScript, Tailwind CSS 4, React Router 7, TanStack Query 5 |
| Backend | Node.js, Express 5, TypeScript, zod, Helmet |
| Database | PostgreSQL on Supabase, Prisma 6 (ORM and migrations) |
| Auth | Supabase Auth: Google sign-in, plus email/password for the demo accounts. The API verifies tokens with `jose`. |
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
│   │   ├── middleware/  Auth (requireAuth / requireRole), error handler, 404, validation
│   │   ├── modules/     Feature modules (health, auth, users, catalog, cart, checkout, orders, …)
│   │   ├── routes/      Admin router (every route admin-only)
│   │   └── shared/      Errors, money calculations, order status rules
│   └── tests/
├── frontend/            React app
│   └── src/
│       ├── api/         Shared API client (adds the login token to every request)
│       ├── features/    Feature code (auth: provider, route guards, Google button)
│       ├── layouts/     Store and admin layouts
│       ├── pages/
│       ├── routes/
│       └── styles/      Tailwind theme built from DESIGN.md
└── package.json         npm workspaces root
```

---

## Getting started

### Prerequisites

- Node.js 22 or later (developed on Node 24) and npm 10 or later
- A [Supabase](https://supabase.com) project (the free tier is enough)
- A Google Cloud OAuth client, for Google sign-in (see step 3)

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
cp frontend/.env.example frontend/.env
```

Connection strings: in your Supabase project, click **Connect**, then choose **ORMs → Prisma**. API keys: **Project Settings → API Keys**.

| File | Variable | Description |
|---|---|---|
| `database/.env` | `DATABASE_URL` | Transaction pooler, port **6543**. Add `?pgbouncer=true&connection_limit=1` to the end. |
| `database/.env` | `DIRECT_URL` | Session pooler, port **5432**. Used for migrations. |
| `database/.env` | `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `database/.env` | `SUPABASE_SECRET_KEY` | Secret key (`sb_secret_…`). Used **only** by the seed script to create the demo users. Never expose it to the browser. |
| `backend/.env` | `DATABASE_URL` | Same value as `DATABASE_URL` in `database/.env`. |
| `backend/.env` | `PORT` | API port. Default `4000`. |
| `backend/.env` | `CLIENT_URL` | Browser origins allowed to call the API, comma-separated. Default `http://localhost:5173`. |
| `backend/.env` | `NODE_ENV` | `development`, `test` or `production`. |
| `backend/.env` | `SUPABASE_URL` | `https://<project-ref>.supabase.co`. Used to fetch Supabase's public signing keys. No secret needed. |
| `backend/.env` | `ADMIN_EMAILS` | Comma-separated emails that get the `ADMIN` role on first sign-in. |
| `frontend/.env` | `API_PROXY_TARGET` | Dev only: where Vite forwards `/api` requests. Default `http://localhost:4000`. |
| `frontend/.env` | `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `backend/.env.test` | `TEST_DATABASE_URL` | **Local** PostgreSQL database for the test suite, e.g. `postgresql://<user>@localhost:5432/kickstead_test`. It is wiped on every run. The tests refuse to run against Supabase. |
| `frontend/.env` | `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_…`). Designed to be public; RLS keeps the data closed. |

> If your database password contains `@`, `#`, `/`, `%`, `:` or `?`, URL-encode those characters (for example `@` → `%40`).
>
> `.env` files are gitignored. Never commit real credentials. Only the `.env.example` files belong in the repository.

### 3. Set up Supabase Auth

1. **Google Cloud Console → APIs & Services:** configure the OAuth consent screen (External, and add test users). Then create an **OAuth client ID** of type *Web application*:
   - Authorized JavaScript origin: `http://localhost:5173`
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
2. **Supabase → Authentication → Sign In / Providers:** enable **Google** with that client ID and secret. Keep **Email** enabled, because the demo accounts use it.
3. **Supabase → Authentication → URL Configuration:** set Site URL to `http://localhost:5173` and add `http://localhost:5173/**` to Redirect URLs.

### 4. Set up the database

```bash
npm run db:generate   # generate the Prisma client
npm run db:migrate    # apply all migrations
npm run db:seed       # load the catalogue and create the demo accounts (safe to run again)
```

### 5. Run the app

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
| `npm run db:seed` | Load or refresh the catalogue, and create or reset the demo accounts |
| `npm run dev:backend` | Start the API with auto-reload |
| `npm run dev:frontend` | Start the Vite dev server |
| `npm test` | Run the backend test suite |
| `npm run typecheck` | Type-check all three packages |
| `npm run build` | Production build of the backend (`backend/dist`) and frontend (`frontend/dist`) |

## Testing

The test suite needs a **local** PostgreSQL database. It is never pointed at Supabase.

```bash
createdb kickstead_test                               # once
cp backend/.env.test.example backend/.env.test        # then set your local user
npm test
```

Each run applies the migrations to `kickstead_test` and resets the tables between tests. As safeguards, the setup:
- refuses any `supabase.co` URL,
- runs Prisma from an empty temporary folder, so it can't read the real `.env` files,
- checks the target host before migrating.

Current tests (120) cover:
- **Pricing:** GST, the free-shipping threshold, tax rounding, and rejection of invalid amounts.
- **Order statuses:** every allowed change succeeds and the disallowed ones are rejected.
- **API errors:** the standard error format and security headers.
- **Token verification:** uses real ES256 tokens signed with a throwaway key. Expired, wrong issuer, wrong audience, wrong key, HS256 and malformed tokens are all rejected.
- **Authentication and roles:**
  - Missing or bad token → `401`. Disabled account → `403`.
  - On first sign-in, a user gets `ADMIN` if their email is in `ADMIN_EMAILS`, otherwise `CUSTOMER`.
  - A customer calling an admin endpoint → `403`. An admin gets `200`.

- **Catalogue** (against a real database):
  - Only active products in active categories are shown.
  - Search covers name, brand and description, case-insensitively.
  - Category filters (by id or slug), price range, every sort order and pagination all work.
  - Invalid queries get `400`. The detail page loads by id or slug, and returns `404` for inactive products.
- **Cart** (against a real database):
  - Requires sign-in, and the cart is saved in the database.
  - Totals are calculated on the server. Adding the same product again increases its quantity.
  - Adding beyond stock gets `409 INSUFFICIENT_STOCK` and leaves the cart unchanged. More than 10 of one product gets `422`.
  - A client-supplied price gets `400`.
  - Another customer's cart items return `404`.
  - Items that went out of stock or were deactivated are flagged, and checkout is blocked.
  - The cart always uses the current database price.

- **Addresses:**
  - Create, edit and delete work. Only one address is the default, and deleting it promotes another.
  - Other customers' addresses return `404`, and invalid input gets `400`.
- **Checkout** (acceptance criteria AC-01 to AC-03):
  - One `PLACED` order, priced from the database, with stock reserved and logged and an audit record. The cart is kept.
  - Address and product snapshots don't change when the originals are edited later.
  - Client-sent totals get `400`, an empty cart `422`, and another customer's address `404`.
  - Buying 2 when only 1 is in stock gets `409`, and stock stays 1.
  - Deactivated products get `422`, and a second unpaid order gets `409`.
  - The same idempotency key, sequential or 5 at once, produces exactly one order and one stock deduction. Keys are scoped per customer.
  - **6 customers buying the last unit at the same moment → exactly one order, stock ends at 0.**
- **Payment and orders** (AC-04):
  - **Pay:** `PAID`, ordered items removed from the cart. Paying twice is idempotent.
  - **Fail or cancel payment:** stock returned and logged, cart kept.
  - A failed order is final. A simultaneous Pay and Fail on the same order apply exactly one outcome.
  - Order lists and details show only the customer's own orders.
  - **Cancelling:** a `PLACED` order gets stock back and payment `CANCELLED`; a `PAID` order is refunded (simulated). Cancelling twice, after packing, or someone else's order is rejected. They run against a separate local PostgreSQL database, never against Supabase.

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

### Authentication and roles

```text
Browser ──(Google OAuth or email/password)──▶ Supabase Auth ──▶ signed JWT (ES256)
Browser ──(Authorization: Bearer <JWT>)────▶ Express API
API: check signature against Supabase's public keys → check issuer, audience, expiry
     → load or create the row in users → read role from the database → allow or deny
```

- Sign-up and sign-in happen in the browser through Supabase Auth. The API never sees a password.
- Both sign-in methods produce the same kind of Supabase JWT. The API verifies it locally against Supabase's public signing keys, so it needs no shared secret.
- The **role comes from our `users` table**, never from the token or the browser. On first sign-in a user becomes `ADMIN` if their email is in `ADMIN_EMAILS`, otherwise `CUSTOMER`. After that the database is the source of truth.
- Every `/api/admin/*` route sits behind `requireAuth` + `requireRole('ADMIN')` at the router level. The frontend's route guards only control what pages are shown.
- Deactivated accounts get `403 ACCOUNT_DISABLED`.

### Checkout transaction and idempotency

`POST /api/checkout` takes only `{ addressId, idempotencyKey }`. Everything else comes from the database inside **one transaction**:

```text
BEGIN
  check the address belongs to the customer → read the cart
  SELECT … FROM products … ORDER BY id FOR UPDATE       -- lock rows in a fixed order (no deadlocks)
  re-check the idempotency key (a duplicate may have committed while we waited)
  reject if the customer already has an unpaid PLACED order
  re-check every product is active and in stock          -- 422 / 409 with details
  calculate totals from locked database prices
  INSERT order (+ copies of address and product data) + order_items + payment (PENDING)
  UPDATE products SET stock = stock − qty WHERE stock >= qty   -- second guard
  INSERT inventory_movements (ORDER_RESERVED) + audit_log (ORDER_CREATED)
COMMIT   (any error → ROLLBACK: no partial order, no partial stock change)
```

- **Three layers stop overselling:** the row lock with a re-check, the conditional `UPDATE`, and the `CHECK (stock_quantity >= 0)` constraint.
- **Duplicate checkout:** the browser generates one key per checkout attempt.
  - The same customer and key always return the original order (`200` with `Idempotent-Replayed: true`), with no further side effects.
  - `UNIQUE (user_id, idempotency_key)` enforces this in the database. A concurrent duplicate that loses the race is caught and replayed.
- **One unpaid order at a time:** a partial unique index (`status = 'PLACED'`) stops the same stock being reserved twice.
- **Payment** (`POST /api/orders/:id/payment`) locks the order row first, so a double-clicked Pay, or Pay racing Cancel, applies only once.
  - `SUCCESS` → `PAID`, and the ordered products are removed from the cart.
  - `FAILED` / `CANCELLED` → stock is returned and logged, and the cart is kept for a retry with a new key.
- **Cancellation** (`PLACED` or `PAID` only) returns stock. A paid order's payment is marked `REFUNDED` (simulated).

### Database safeguards

The database itself enforces the critical rules, so a bug in the application can't break them:

- `CHECK` constraints: stock and every money column ≥ 0, quantities > 0, `total = subtotal − discount + tax + shipping`, and `line_total = unit_price × quantity`.
- `UNIQUE (user_id, idempotency_key)` on orders: a repeated checkout request can't create a second order.
- A partial unique index allows **at most one `PLACED` order per customer**, so stock can't be reserved twice.
- Orders store copies of the product name, price and delivery address, so later edits don't change past orders.
- **Row-level security is on for every table.** Supabase's REST API is therefore closed to the browser's public key. Only the backend, connecting through Prisma, can read or write data.

### API endpoints (so far)

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | API and database status |
| GET | `/api/categories` | Public | Active categories |
| GET | `/api/products` | Public | `q`, `categoryId` or `category` (slug), `minPrice`/`maxPrice` (paise), `sort` (`newest` \| `price_asc` \| `price_desc` \| `name_asc`), `featured`, `page`, `limit` (≤ 48) |
| GET | `/api/products/:idOrSlug` | Public | Product detail |
| GET | `/api/auth/me` | Signed in | Current user and role |
| GET | `/api/cart` | Signed in | Own cart with server-calculated totals and per-item stock issues |
| POST | `/api/cart/items` | Signed in | `{ productId, quantity }`. Adds to the existing line if the product is already in the cart. |
| PATCH | `/api/cart/items/:itemId` | Signed in (owner) | `{ quantity }` |
| DELETE | `/api/cart/items/:itemId` | Signed in (owner) | Remove one item |
| DELETE | `/api/cart` | Signed in | Clear the cart |
| PATCH | `/api/profile` | Signed in | `{ name }` |
| GET / POST | `/api/addresses` | Signed in | List or create own addresses. The first one becomes the default. |
| PATCH / DELETE | `/api/addresses/:id` | Signed in (owner) | Edit or delete. `{ isDefault: true }` switches the default. |
| POST | `/api/checkout` | Signed in | `{ addressId, idempotencyKey }` → `201` new `PLACED` order, or `200` replay |
| GET | `/api/orders` | Signed in | Own orders, newest first, paginated |
| GET | `/api/orders/:id` | Signed in (owner) | Order detail with items, address, totals, payment and available actions |
| POST | `/api/orders/:id/payment` | Signed in (owner) | `{ outcome: "SUCCESS" \| "FAILED" \| "CANCELLED" }` (simulated) |
| POST | `/api/orders/:id/cancel` | Signed in (owner) | `{ reason? }`. Only `PLACED` or `PAID` orders. |
| GET | `/api/admin/customers` | Admin | Paginated customer list, `q` search |

Success responses use `{ "data": … }`. Lists add `"meta": { page, limit, total, totalPages }`. Cart endpoints reject unknown fields, so a client can't send a price.

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
| 3 | Authentication and roles (Supabase Auth) | ✅ Done |
| 4 | Catalogue and cart | ✅ Done |
| 5 | Checkout, simulated payment, orders | ✅ Done |
| 6 | Admin dashboard and operations | ⏳ Next |
| 7 | Security and reliability hardening | Planned |
| 8 | Database-backed tests | Planned |
| 9 | API docs, ER diagram, deployment | Planned |

## Demo credentials

Created by `npm run db:seed`. These are dummy accounts for reviewers. Use **Demo login** on the sign-in page.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@kickstead.dev` | `Kickstead@Demo1` |
| Customer | `customer@kickstead.dev` | `Kickstead@Demo1` |

The demo customer has a saved delivery address in Mumbai. Running the seed again resets both passwords to the values above.

## Known limitations

- Payment is **simulated**. No payment provider is connected and no card data is collected or stored.
- Products have no sizes or variants. Each product has a single stock count.
- No discounts. GST and shipping use the fixed rules above.
- An abandoned unpaid (`PLACED`) order keeps its stock reserved until the customer or an admin cancels it. Unpaid orders don't expire automatically.
- Product images are external URLs (free Unsplash photos). There is no image upload.
- Brand names in the seed data are fictional.
- The stock check when adding to the cart only gives early feedback. It doesn't reserve stock. Stock is reserved only when checkout places the order, and that is where the final check happens.
- Product search uses case-insensitive substring matching (`ILIKE`), with no full-text ranking.
- New accounts are created through Google only. Supabase can't turn off email sign-up for some providers and leave it on for others, so someone could create an email/password account through Supabase's API. It would only ever be a `CUSTOMER`.
- The Supabase session (access and refresh tokens) is kept in browser storage by the Supabase client, not in an HTTP-only cookie. The API accepts it as a Bearer token.
- Roles are assigned at first sign-in. Adding an email to `ADMIN_EMAILS` later doesn't promote an existing customer.

## Project documents

| Document | Purpose |
|---|---|
| [PRD.md](PRD.md) | Product requirements and acceptance criteria |
| [Architecture.md](Architecture.md) | System structure and technical decisions |
| [Rules.md](Rules.md) | Implementation rules |
| [PLAN.md](PLAN.md) | Phase-by-phase delivery plan |
| [DESIGN.md](DESIGN.md) | Visual design system |
| [Memory.md](Memory.md) | Working log: decisions, progress, validation results |
