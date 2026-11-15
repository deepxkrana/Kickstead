# Kickstead

A sneaker store built on the PERN stack (PostgreSQL, Express, React, Node.js). Customers browse products, add them to a cart saved in the database, check out with a simulated payment and track their orders. Admins manage the catalogue, stock and orders, with a dashboard and an audit log.

The focus is on correctness rather than feature count:
- Prices and totals are calculated by the server.
- Stock can never go negative.
- Repeating a checkout request never creates a second order.
- Every permission check runs on the server.

> **Status: in progress.** The customer journey, the admin side, the hardening and the test suite are complete (Phases 1–8 of 9): 202 tests, 98% line coverage. Remaining: API docs, the ER diagram and deployment. See [Project status](#project-status).

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
├── docs/                API reference, ER diagram, deployment runbook
├── .github/workflows/   CI/CD pipeline
├── Dockerfile           Production API image
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
| `npm test` | Run the backend test suite (needs the local test database) |
| `npm run test:coverage` | Same, with a coverage report |
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

Current tests: **202, all passing, 98.2% line coverage, 92% branch coverage** (`npm run test:coverage`). They cover:
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
  - **Cancelling:** a `PLACED` order gets stock back and payment `CANCELLED`; a `PAID` order is refunded (simulated). Cancelling twice, after packing, or someone else's order is rejected.
- **Admin** (AC-05 to AC-07):
  - All 10 admin endpoints return `401` to anonymous users and `403` to customers, with no data change.
  - **Products:** create (with a generated slug, starting stock logged, audited) and update (with a before/after audit trail). Duplicate slugs get `409`, and stock can't be set through the product update.
  - **Stock changes:** set or adjust, logged and audited. Going negative or making no change gets `422`.
  - **Categories:** create, rename and deactivate. Deactivating hides the category's products from shoppers.
  - **Fulfilment:** `PAID → PACKED → SHIPPED → DELIVERED`, each step audited.
  - **Invalid changes:** a skipped step or a move out of a final state gets `409`. An admin trying to set a payment outcome gets `422`.
  - **Admin cancellation:** refunds and restocks.
  - **Order search:** by order number or email, and by status.
  - **The dashboard reconciles with the orders list:** counts by status, and revenue only from paid or fulfilled orders.
  - The audit log is filterable and contains no secrets.
- **Full journey (AC-01), in one test:**
  1. The customer signs in, searches, opens the product, adds it to the cart, adds an address, checks out and pays.
  2. The order shows up as confirmed and in their history.
  3. The admin finds the same order and packs it.
  4. The dashboard revenue updates, and the audit log shows each action with its actor.
- **Inventory ledger:** after reserve, release, cancel, refund and admin adjustments, every product's movements add up to its current stock, and every running total matches.
- **Edge cases:**
  - Two browser tabs checking out with different keys → one order and one `409`.
  - The price at checkout wins over the price when the item went into the cart.
  - A deactivated category blocks checkout. The 10-per-item cap is enforced at checkout too.
  - A reused key with a different address returns the original order.
  - The second overselling guard works even without the row lock.
  - Once an admin cancels an unpaid order, the customer can't pay it.
  - The profile update can't change role or email.
  - Address limits work, and so does admin catalogue validation.
  - 8 concurrent first sign-ins create exactly one user.
  - Database errors map to the right status codes. Unexpected errors return a safe `500` with no internal details.
- **Security:**
  - All 16 customer endpoints return `401` without a token.
  - API responses carry `no-store`, a request ID and security headers. Other origins get no CORS header.
  - Bodies over 100 KB get `413`, and absurd page numbers get `400`.
  - Search treats `%` and `_` literally.
  - Checkout is rate-limited per user (`429 RATE_LIMITED`) without affecting other users, and the whole API is rate-limited per IP.
  - An unreachable Supabase key server gives `503 AUTH_UNAVAILABLE`, not `401`. They run against a separate local PostgreSQL database, never against Supabase.

---

### Acceptance criteria → tests

| PRD criterion | Proven by |
|---|---|
| **AC-01** End-to-end customer journey | `journey.test.ts` → *complete customer journey, confirmed by the admin* |
| **AC-02** Safe stock handling | `checkout.test.ts` → *buying 2 of a product with stock 1 returns 409 and stock stays 1*; *lets at most one of many buyers win* (6 parallel buyers, last unit); `gaps.test.ts` → second guard; `journey.test.ts` → ledger invariant |
| **AC-03** Idempotent checkout | `checkout.test.ts` → *replays the original order*; *exactly one order when the same key is sent concurrently*; `gaps.test.ts` → two tabs with different keys; reused key with a different address |
| **AC-04** Payment failure / cancellation | `orders.test.ts` → *FAILED / CANCELLED returns the stock, keeps the cart*; *a failed order is final*; *concurrent Pay and Fail* |
| **AC-05** Authorization | `admin.test.ts` → every admin endpoint returns 401/403 with no data change; `security.test.ts` → all 16 customer endpoints return 401; ownership tests in cart, addresses, orders and checkout |
| **AC-06** Valid state transitions | `admin.test.ts` → fulfilment path, invalid transitions return 409, payment statuses return 422; `orderStates.test.ts` → full transition map |
| **AC-07** Reconciled reporting | `admin.test.ts` → *dashboard reconciles with orders* (compared against the admin order list) |
| **AC-08** Reproducible setup | Each test run migrates the local database from the committed migrations. Also checked by hand: a brand-new empty database → `migrate deploy` → seed ×2 → 12 tables, RLS 12/12, 16 checks, balanced ledger |

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

**Revenue** is the sum of order totals (including GST and shipping) with status `PAID`, `PACKED`, `SHIPPED` or `DELIVERED`. Cancelled orders (including refunded ones), unpaid orders and failed payments are excluded. The dashboard computes every figure with one grouped query on the `orders` table, so it always matches the admin order list.

**Who changes what:**
- **Customers** record payment outcomes (`PAID`, `PAYMENT_FAILED`, `PAYMENT_CANCELLED`) through the payment flow, and can cancel `PLACED` or `PAID` orders.
- **Admins** move orders through fulfilment (`PACKED → SHIPPED → DELIVERED`) and can cancel `PLACED` or `PAID` orders. They can't set payment outcomes by hand.
- Every change goes through the same transition map and an order-row lock, and is audited.

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

### API endpoints

Summary below; full request and response shapes and error codes are in **[docs/api.md](docs/api.md)**.

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
| GET | `/api/admin/dashboard` | Admin | Order counts, revenue (see the rule below), low stock, recent orders |
| GET / POST | `/api/admin/products` | Admin | List all products (`q`, `categoryId`, `status`, `lowStock`, paging) or create one (`initialStock` optional) |
| GET / PATCH | `/api/admin/products/:id` | Admin | Detail with stock history, or update fields (price, status, featured, …). Stock can't be changed here. |
| PATCH | `/api/admin/products/:id/stock` | Admin | `{ mode: "set" \| "adjust", quantity, note? }`. Logged as `ADMIN_ADJUSTMENT`. |
| GET / POST | `/api/admin/categories` | Admin | List with product counts, or create |
| PATCH | `/api/admin/categories/:id` | Admin | Rename, describe, activate or deactivate |
| GET | `/api/admin/orders` | Admin | `q` (order number, customer name or email), `status`, paging |
| GET | `/api/admin/orders/:id` | Admin | Detail, customer, allowed next statuses, audit history, stock movements |
| PATCH | `/api/admin/orders/:id/status` | Admin | `{ status: PACKED \| SHIPPED \| DELIVERED \| CANCELLED, reason? }` |
| GET | `/api/admin/customers` | Admin | Paginated customer list, `q` search |
| GET | `/api/admin/audit-logs` | Admin | `action`, `entityType`, `entityId`, paging |

Success responses use `{ "data": … }`. Lists add `"meta": { page, limit, total, totalPages }`. Cart endpoints reject unknown fields, so a client can't send a price.

### Security and reliability

| Area | What is in place |
|---|---|
| Authentication | Supabase JWTs are checked locally against Supabase's public keys. Only asymmetric signing algorithms are accepted, and issuer, audience, expiry and subject are all checked. If the keys can't be fetched, the API answers `503 AUTH_UNAVAILABLE` rather than `401`, so users aren't signed out during an outage. |
| Authorization | `requireAuth` runs on every non-public route, and `requireRole('ADMIN')` on the whole `/api/admin` router. Ownership checks on carts, addresses and orders return `404` for other people's data. Roles come from the database. |
| Validation | Every body, query and route parameter is validated with zod. Strict bodies reject unknown fields, so a client can't send prices or totals. Page size and page number are capped. Search escapes SQL wildcards. |
| Rate limiting | 300 requests/min per IP across `/api`, and 20/min per user for checkout, payment and cancellation. Exceeding either returns `429 RATE_LIMITED` with standard `RateLimit` headers. Behind a proxy, `trust proxy` makes sure the real client IP is used. |
| HTTP | Helmet security headers (CSP, HSTS, nosniff, frame-ancestors), CORS restricted to `CLIENT_URL` (a wildcard is refused at startup in production), a 100 KB body limit, `Cache-Control: no-store` on API responses, and no `X-Powered-By` header. |
| Errors and logs | One error format. Stack traces are never sent to clients. Each request gets an `X-Request-Id`, which is included in `500` responses and in server logs. Access logs never contain bodies or auth headers. Unhandled rejections are logged; an uncaught exception exits the process so the container restarts it. |
| Data integrity | Locking transactions, CHECK constraints, unique and partial unique indexes, and order-row locks for status changes (see above). Row-level security keeps Supabase's REST API closed. |
| Accessibility | Visible labels on all fields, focus rings, a "Skip to content" link, reduced-motion support, and live regions for async feedback. Text colors meet WCAG AA (≥ 4.5:1): small red text uses `#D00000` (5.7:1). DESIGN.md's `#FF0000` (4.0:1) is kept for accents and borders, and on the black header (5.3:1). |

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
| 6 | Admin dashboard and operations | ✅ Done |
| 7 | Security and reliability hardening | ✅ Done |
| 8 | Test gap review and coverage | ✅ Done |
| 9 | API docs, ER diagram, deployment | 🔄 Docs and pipeline written; first deploy pending |

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
- Rate limits are kept in memory, per server process. That's fine for the single EC2 instance. Running several instances would need a shared store such as Redis.
- `npm audit` reports a high-severity advisory in `deepmerge-ts`. It's used only by the Prisma **CLI's** config loader, which npm pulls in as a peer of `@prisma/client`. The running server never calls it and never passes it user input. Fixing it needs a breaking upgrade to Prisma 7, so it's accepted for the MVP. Advisories in Vitest are dev-only.
- New accounts are created through Google only. Supabase can't turn off email sign-up for some providers and leave it on for others, so someone could create an email/password account through Supabase's API. It would only ever be a `CUSTOMER`.
- The Supabase session (access and refresh tokens) is kept in browser storage by the Supabase client, not in an HTTP-only cookie. The API accepts it as a Bearer token.
- Roles are assigned at first sign-in. Adding an email to `ADMIN_EMAILS` later doesn't promote an existing customer.

## Deployment

The backend runs as a Docker container on AWS EC2, the frontend on Vercel, and the database on Supabase. GitHub Actions tests every push. A push to `main` then migrates the database and builds the image on GitHub's runners. A self-hosted runner on the EC2 instance then pulls the image, swaps the container and checks its health, rolling back automatically if the check fails. No inbound SSH is needed. See **[docs/deployment.md](docs/deployment.md)** for setup, the required secrets and how to operate the server.

```bash
docker build -t kickstead-api .                                           # production image: 116 MB, no Prisma CLI or dev tools
docker run --env-file backend/.env -e NODE_ENV=production -p 4000:4000 kickstead-api
```

## Project documents

| Document | Purpose |
|---|---|
| [docs/api.md](docs/api.md) | Endpoint reference: auth, request and response shapes, error codes, rate limits |
| [docs/er-diagram.md](docs/er-diagram.md) | Mermaid ER diagram and the rules the database enforces |
| [docs/deployment.md](docs/deployment.md) | EC2, GitHub Actions, Vercel and Supabase deployment runbook |
| [PRD.md](PRD.md) | Product requirements and acceptance criteria |
| [Architecture.md](Architecture.md) | System structure and technical decisions |
| [Rules.md](Rules.md) | Implementation rules |
| [PLAN.md](PLAN.md) | Phase-by-phase delivery plan |
| [DESIGN.md](DESIGN.md) | Visual design system |
| [Memory.md](Memory.md) | Working log: decisions, progress, validation results |
