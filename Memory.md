# Project Memory

## E-Commerce Platform — Working State

This file is the persistent working memory for the developer and Antigravity. Update it after every meaningful implementation phase.

Do not use this file as a replacement for source code, tests, or the product requirements. Record decisions, current state, blockers, and verification results only.

---

## 1. Project identity

| Field | Value |
|---|---|
| Project | Kickstead — sneaker e-commerce platform |
| Stack | Supabase PostgreSQL + Prisma, Express.js, React (Vite), Node.js, TypeScript |
| Delivery window | Deadline 2026-11-14 |
| Primary users | Customer and Admin |
| Product goal | Complete customer-to-order journey with safe inventory and admin operations |
| Current phase | Phase 5 — Checkout + orders (complete). Next: Phase 6 — Admin |
| Last updated | 2026-11-13 |

---

## 2. Source-of-truth documents

| Document | Purpose | Status |
|---|---|---|
| `PRD.md` | Product scope and acceptance criteria | Created |
| `Architecture.md` | Application structure and technical decisions | Created |
| `Rules.md` | Developer and AI implementation constraints | Created |
| `PLAN.md` | Delivery sequence (referred to as `Phases.md` elsewhere) | Existing |
| `DESIGN.md` | Visual language and typography | Existing |
| `Memory.md` | Current state and progress | Created |

When a decision conflicts with this file, use this priority:

1. User's latest explicit instruction.
2. `PRD.md`.
3. `Architecture.md`.
4. `Rules.md`.
5. `Phases.md`.
6. `Design.md`.
7. This progress log.

---

## 3. Product decisions

### Confirmed

- The stack is PERN.
- The implementation target is a two-day MVP.
- Payment is simulated.
- The application has `CUSTOMER` and `ADMIN` roles.
- The customer journey is the highest-priority workflow.
- Checkout must be transaction-safe.
- Stock must never become negative.
- Repeated checkout requests must not create duplicate orders.
- The project requires admin operations, dashboard reporting, audit logs, tests, and documentation.
- `PLAN.md` and `DESIGN.md` already exist and must not be recreated.

### Decisions — 2026-11-13 planning session

Process:
- Rules.md and this file are the working instructions for the AI assistant (the docs call it "Antigravity").
- The user does all git commits. The AI never runs git commits and never adds itself as a contributor or co-author anywhere.
- The AI does nothing without explicit user instruction or permission.

Stack:
- Database: Supabase PostgreSQL, accessed through the Prisma ORM. The user provides the connection string when asked.
- Auth: Supabase Auth with the Google provider (see pending A1–A3).
- Repo layout: three top-level folders: `frontend/`, `backend/`, `database/`.
- Frontend: React + Vite + TypeScript, Tailwind with DESIGN.md tokens in the theme, TanStack Query for server data.
- Tests: Vitest + Supertest against an isolated test database (see pending B).
- Deployment: Dockerised backend on AWS EC2 t3.micro, deployed by a GitHub Actions CI/CD pipeline. Database on Supabase (see pending D).

Business rules:
- Payment is two-step. `POST /checkout` creates a PLACED order; a payment page then offers Pay / Fail / Cancel.
- Stock is reserved (decremented) when the order is PLACED. On payment failure or cancellation it is restored with a logged inventory movement. The cart is kept, and a retry needs a new idempotency key.
- A customer can cancel only in PLACED or PAID. Stock is restored with a logged movement; the refund is simulated.
- Money is INR stored in paise. GST is 18%, added on top. Shipping is ₹99 (9900 paise), free when the subtotal is above ₹2,999 (299900 paise). Discount is always 0. All of these live in one config file.
- Revenue is the sum of `total` for orders in PAID, PACKED, SHIPPED or DELIVERED.
- No sizes or variants: one stock count per product (known limitation).
- Seed products use made-up brand names with free placeholder or Unsplash image URLs.

### Follow-up decisions — 2026-11-13 (AI recommendations, approved by the user)

Auth:
- A1. Google is the primary login provider. Supabase email/password is also enabled, but only for two seeded demo accounts (admin + customer), so the reviewer can log in without Google. Public sign-up is Google-only.
- A2. The admin role comes from an `ADMIN_EMAILS` env var. On a user's first authenticated API call, the backend upserts a row in our `users` table keyed by the Supabase auth user ID and assigns the role. Prisma manages only the `public` schema; Supabase's `auth` schema is not touched.
- A3. The Supabase JS client holds the session. The frontend sends the access token as `Authorization: Bearer` and Express verifies it. This deviates from the Rules.md HTTP-only cookie preference and will be documented. Tests replace the token verifier with a test double.

Testing:
- B. Tests run against a local Docker Postgres, and CI uses a Postgres service container. Tests never touch Supabase.

Repo:
- C. `database/` holds `schema.prisma`, migrations and seed. The backend uses the Prisma client generated from it. The backend Docker build context is the repo root so it can include `database/`.

Deployment:
- D1. Frontend is hosted on Vercel (free, automatic HTTPS). *AI pick — not offered as a recommendation earlier.*
- D2. No custom domain. Vercel rewrites `/api/*` to the EC2 backend, so the browser sees one HTTPS origin and no CORS or mixed-content problems. Known limitation: traffic from Vercel to EC2 is plain HTTP. *AI pick.*
- D3. GitHub-hosted runners build the backend image and push it to GHCR; the deploy step SSHes into EC2, which pulls the image and restarts the container.
- D4. Deployment is the final phase, after the core flows and tests pass.

Orders:
- E1. The cart is cleared when payment succeeds. While the customer has a PLACED order, checkout sends them to pay that order instead of creating a new one (no double reservation). Paying is safe to repeat because only a PLACED order can move to PAID.
- E2. Abandoned PLACED orders hold their stock until the customer or admin cancels them. Documented as a known limitation; no auto-expiry.

Frontend:
- F1. `/` is a hero with a featured-product grid and a "Shop all" link to `/products`. No auto-redirect.

Docs:
- G1. Deviations (Supabase Auth instead of bcrypt + JWT, Prisma instead of raw pg) are recorded here now. Architecture.md and Rules.md get updated in the documentation phase, with user permission. *AI pick.*

### Pending decisions

```text
None.
```

---

## 4. MVP feature checklist

### Foundation

- [x] Repository inspected.
- [x] Client and server scripts verified.
- [x] PostgreSQL connection configured. (Supabase ap-south-1; pooled :6543 runtime, session :5432 migrations)
- [x] `.env.example` created. (one per package: database/, backend/, frontend/)
- [x] Migration command created. (`npm run db:migrate`; 0001_init applied to Supabase)
- [x] Seed command created. (`npm run db:seed`; run twice, repeatable)
- [x] Health endpoint works. (200 {database:"up"} over the pooled connection)

### Authentication

- [x] Customer registration. (Google via Supabase; users row created on first API call)
- [x] Login. (Google OAuth + demo email/password)
- [x] Logout. (supabase.auth.signOut + query cache cleared)
- [x] Current-user endpoint. (GET /api/auth/me)
- [x] Password hashing. (handled by Supabase Auth; API never sees passwords)
- [x] Authentication middleware. (requireAuth, JWKS-verified ES256)
- [x] Admin role middleware. (requireRole; admin router protected at router level)
- [x] Ownership checks. (cart items, addresses, orders, payment, cancel → 404 for others; tested)
- [x] Customer cannot access admin endpoints. (403, tested + verified with real tokens)

### Catalogue

- [x] Categories.
- [x] Product listing.
- [x] Product search.
- [x] Category filter.
- [x] Sorting.
- [x] Pagination.
- [x] Product detail.
- [ ] Admin product CRUD.
- [ ] Admin category management.

### Cart and checkout

- [x] Persistent cart.
- [x] Add item.
- [x] Update quantity.
- [x] Remove item.
- [x] Clear cart.
- [x] Address CRUD or seeded address selection.
- [x] Server-side pricing.
- [x] Checkout transaction.
- [x] Stock recheck.
- [x] Non-negative stock protection.
- [x] Successful payment simulation.
- [x] Failed payment simulation.
- [x] Cancelled payment simulation.
- [x] Idempotency.
- [x] Order confirmation.

### Orders and admin

- [x] Customer order history.
- [x] Customer order detail.
- [ ] Valid order transitions.
- [ ] Admin order list.
- [ ] Admin order detail.
- [ ] Admin inventory update.
- [x] Admin customer list. (GET /api/admin/customers API only; page in Phase 6)
- [ ] Dashboard summary.
- [ ] Audit log creation. (order created / payment / cancellation done; admin product/inventory/status in Phase 6)
- [ ] Audit log view.

### Quality and delivery

- [ ] Unit tests.
- [ ] API/integration tests. (catalogue + cart done against local test DB; checkout/orders pending)
- [x] Insufficient-stock test.
- [x] Duplicate-checkout test.
- [x] Failed-payment test.
- [ ] Invalid-transition test.
- [x] Authorization test.
- [ ] README.
- [ ] API documentation.
- [ ] ER diagram.
- [x] Demo credentials. (seeded + in README)
- [ ] Known limitations.
- [ ] Clean database setup verified.
- [ ] Production build verified.
- [ ] Walkthrough video prepared.

---

## 5. Current implementation state

Update this section after each phase.

### Last completed phase

```text
Phases 1–5 complete (planning, scaffold + database, auth, catalogue + cart, checkout + orders).
```

### Current work

```text
None — waiting for the user to start Phase 6.
```

### Next task

```text
Phase 6 — Admin: dashboard (counts, revenue rule, low stock), products + categories CRUD/activate, stock adjustment (ADMIN_ADJUSTMENT movement + audit), orders list/search/detail, status transitions via assertTransition (+ admin cancel via cancelLockedOrder), customers page, audit log page. Code-split admin routes.
```

### Blockers

```text
None. Note: the DB password contains an unencoded "@" — Prisma tolerates it, psql does not. Encode as %40 before using the URL in other tools / CI secrets.
```

---

## 6. Phase log

Use one entry for each completed phase.

### Phase template

```text
## YYYY-MM-DD — Phase name

Status: [complete / partial / blocked]

Implemented:
- 

Files changed:
- 

Validation:
- Command:
- Result:

Decisions:
- 

Known issues:
- 

Next action:
- 
```

### Phase history

```text
## 2026-11-13 — Phase 5: Checkout, payment, orders

Status: complete

Implemented:
- backend: audit.service (recordAudit in caller's tx; action constants), inventory.service (reserveStock: conditional decrement + ORDER_RESERVED movement; releaseStock: ORDER_RELEASED/ORDER_CANCELLED), addresses module (owner-scoped CRUD, first = default, single default, promote on delete, max 10, strict bodies, separate no-default update schema), PATCH /api/profile, POST /api/checkout (one interactive tx: address ownership → cart → SELECT … FOR UPDATE OF p ORDER BY id → idempotency re-check → pending PLACED check → availability/stock checks → DB-priced totals → order + snapshots + items + PENDING payment → reserveStock → audit; P2002 on idempotency → replay, on one-PLACED index → 409 PENDING_ORDER_EXISTS; 201 new / 200 + Idempotent-Replayed), orders: GET list/detail (owner), POST :id/payment (lock row; SUCCESS → PAID + SIM ref + remove ordered products from cart; FAILED/CANCELLED → release stock, keep cart; same outcome repeat = replay), POST :id/cancel (PLACED|PAID; release stock; payment CANCELLED or REFUNDED; audit). cancelLockedOrder + lockOrder exported for Phase 6 admin. Tx options maxWait 10s / timeout 20s.
- frontend: AddressForm (field-level server errors), AddressesPage, ProfilePage, CheckoutPage (address radio/inline add, review, one idempotency key per attempt, PENDING_ORDER_EXISTS/INSUFFICIENT_STOCK handling), OrdersPage (paginated), OrderDetailPage (simulated payment panel Pay/Fail/Cancel, result banners, cancel with confirm, items/address/totals/payment), StatusBadge, format helpers.

Validation:
- typecheck pass; npm test 120/120 ×3 consecutive runs (no flakiness), incl. 6-buyer last-unit race (1×201, 5×409, stock 0) and 5× concurrent same-key (1×201, 4×200, one order); build pass
- Live vs Supabase (transaction pooler) as demo customer: checkout 201 (stock 24→22), replay 200 (22), second key 409 PENDING_ORDER_EXISTS, FAILED → stock 24 + cart kept, checkout #2 → PAID + cart cleared, cancel → REFUNDED + stock 24. Leaves 2 demo orders (KS-20261113-6DE6D3 PAYMENT_FAILED, KS-20261113-Z2GZHC CANCELLED).

Decisions:
- Payment UI lives on /orders/:id (no separate /pay route); checkout redirects there.
- Payment endpoint is owner-only; admin status changes come in Phase 6.
- On SUCCESS only the ordered products are removed from the cart (items added after ordering stay).

Known issues:
- None blocking. Abandoned PLACED orders hold stock until cancelled (documented limitation).

Next action:
- Phase 6.

## 2026-11-13 — Phase 4: Catalogue and cart

Status: complete

Implemented:
- backend catalog: GET /api/categories, GET /api/products (q over name/brand/description ILIKE, categoryId|category slug, minPrice/maxPrice paise, sort newest|price_asc|price_desc|name_asc with id tiebreak, featured, page, limit ≤ 48; active products in active categories only), GET /api/products/:idOrSlug (404 when inactive). stockStatus IN_STOCK/LOW_STOCK(≤5)/OUT_OF_STOCK computed server-side.
- backend cart (requireAuth, owner-scoped): GET, POST items (increments existing line), PATCH/DELETE items/:itemId (404 CART_ITEM_NOT_FOUND if not own), DELETE cart. Strict bodies (unknown keys e.g. price → 400). Early checks: PRODUCT_UNAVAILABLE 422, QUANTITY_LIMIT 422 (max 10/line), INSUFFICIENT_STOCK 409 with {available, requested, inCart}. Every response = full cart with current DB prices, per-item issue (UNAVAILABLE/OUT_OF_STOCK/INSUFFICIENT_STOCK), totals via calculateOrderTotals, canCheckout.
- test infra: local Homebrew Postgres `kickstead_test` (user choice over Docker); backend/.env.test (gitignored) + .env.test.example; vitest globalSetup migrates via Prisma run from an empty temp dir (no .env loading), verifies target host, refuses supabase URLs; resetDatabase guard (must be kickstead_test); factories; test app with `user:<id>` fake tokens resolved from DB; fileParallelism off.
- frontend: catalog/cart types + APIs, useCart + mutations (setQueryData with server cart; refetch on error), ProductsPage (URL-synced search w/ debounce, category chips, sort, ₹ price range → paise, pagination, skeleton/empty/error), ProductDetailPage (stock badge, qty picker capped by stock−inCart and 10, sign-in redirect, added feedback, API errors), CartPage (qty update, remove, confirm-clear, issues, server totals, checkout gating), HomePage featured grid, header cart count badge, vendor chunk splitting.

Validation:
- npm run typecheck → pass; npm test → 86/86 (34 new DB-backed catalogue/cart tests); npm run build → pass, no chunk warning
- Supabase intact after tests (12 products, 4 categories, 3 users incl. user's Google login → Google sign-in works)
- Live API vs Supabase data as demo customer: categories, pagination meta, search, category+sort, inactive 404, add → totals 1,299,800 + 233,964 GST + free shipping = 1,533,764 paise, last-unit 409 with details, price injection 400; demo cart cleared afterwards

Decisions:
- Test DB = local Homebrew Postgres (user, 2026-11-13). CI will use a Postgres service container.
- URL keeps price filters in rupees; API takes paise.
- Cart GET does not create a cart; first add does.
- Mutations return 201 (add) / 200 with the full cart rather than 204.

Known issues:
- Cart add has a benign read-then-write race (two parallel adds could exceed stock in the cart); checkout's locked recheck is authoritative.

Next action:
- Phase 5.

## 2026-11-13 — Phase 3: Authentication and roles

Status: complete (backend verified end-to-end with real Supabase tokens; Google UI flow pending user browser test)

Setup (with user):
- Keys: publishable → frontend/.env; secret → database/.env (seed only); SUPABASE_URL in all three. ADMIN_EMAILS=deepakrrana5@gmail.com,admin@kickstead.dev in backend/.env.
- Google OAuth client created by user; Supabase Google provider verified ON; Google accepts client_id + redirect_uri.
- Project JWT signing: ES256 (JWKS published) → backend needs no secret.

Implemented:
- backend: env SUPABASE_URL/ADMIN_EMAILS; tokenVerifier (jose, remote JWKS, issuer/audience 'authenticated'/expiry, asymmetric algs only, UUID sub + email required); auth.service (resolveUser: find or upsert users row, role from ADMIN_EMAILS on creation only, email sync, ACCOUNT_DISABLED); middleware/auth (requireAuth → 401 UNAUTHENTICATED/INVALID_TOKEN/TOKEN_EXPIRED, requireRole → 403 FORBIDDEN); GET /api/auth/me; admin router (requireAuth+requireRole at router level) with GET /api/admin/customers (paginated, q search); shared pagination helper; createApp({ tokenVerifier }) for test injection.
- database seed: demo admin + customer created/updated in Supabase Auth (pre-confirmed, password reset each run), mirrored into users with same id and enforced role; demo customer gets a default Mumbai address.
- frontend: supabase client (PKCE), AuthProvider (session + /api/auth/me role via TanStack Query), API client attaches Bearer token, RequireAuth / RequireAuth role=ADMIN guards (loading, redirect with return path, 403 view, disabled-account view), LoginPage (Google + demo login with fill buttons), RegisterPage (Google sign-up), /auth/callback, header account nav (name, Admin link, sign out), admin sidebar user + sign out, StateViews (LoadingState, MessageState, ErrorMessage).
- Root engines node >=22 (supabase-js requirement). README updated (auth setup, env vars, demo credentials, auth flow, limitations).

Files changed:
- package.json, README.md, Memory.md, backend/.env.example, backend/vitest.config.ts, database/prisma/seed.ts
- backend/src/{app.ts,config/env.ts,middleware/auth.ts,modules/auth/{tokenVerifier,auth.service,auth.routes}.ts,modules/users/{users.repository,users.schemas,users.controller}.ts,routes/admin.routes.ts,shared/http/pagination.ts}
- backend/tests/{tokenVerifier,auth}.test.ts
- frontend/src/{main.tsx,vite-env.d.ts,lib/supabase.ts,api/{client,authApi}.ts,features/auth/{AuthProvider,RequireAuth,GoogleButton}.tsx,features/auth/{types,returnTo}.ts,components/StateViews.tsx,pages/{LoginPage,RegisterPage,AuthCallbackPage}.tsx,layouts/{StoreLayout,AdminLayout}.tsx,routes/router.tsx}

Validation:
- npm run typecheck → pass; npm test → 52/52 pass; npm run build → pass (frontend chunk-size warning from supabase-js, non-blocking)
- Seed run twice → demo users ready both times (idempotent)
- Real Supabase password grant → ES256 tokens; local API: me(customer)=200 CUSTOMER, me(admin)=200 ADMIN, admin/customers(customer)=403, admin/customers(admin)=200, tampered token=401 INVALID_TOKEN, wrong password at Supabase=400
- Dev servers: /login 200, Vite proxy /api/health ok, anon /api/auth/me 401, auth modules transform OK

Decisions:
- No /api/auth/register|login|logout endpoints: Supabase Auth handles them in the browser; API exposes /auth/me. (Deviation from PLAN.md contract; documented.)
- Role assigned on user creation only; DB is the source of truth afterwards. Seed enforces demo roles.
- Response convention: { data } for single resources, { data, meta: { page, limit, total, totalPages } } for lists.
- Auth tests mock users.repository (in-memory); DB-backed auth tests in Phase 8.

Known issues:
- Frontend bundle ~592 kB (175 kB gzip), mostly supabase-js; code-split admin routes later.
- Google flow + redirect allow-list not yet exercised in a real browser.

Next action:
- User browser test → Phase 4.

## 2026-11-13 — Phase 2: Scaffold + database

Status: complete

Supabase validation (2026-11-13):
- prisma migrate deploy → 0001_init applied
- seed run 1 → 12 products created; run 2 → 0 created, 12 updated (repeatable)
- DB checks → 4 categories, 12 products (11 active, 4 featured), 12 SEED movements, RLS on 11/11 tables, 16 CHECK constraints, 2 partial unique indexes
- Negative stock UPDATE and zero-quantity movement INSERT → rejected by CHECK constraints (rolled back; stock unchanged)
- Backend /api/health with backend/.env → 200 {status:"ok", database:"up"}
- Fix: Supabase advisor flagged RLS disabled on public._prisma_migrations (Prisma creates it outside 0001_init). Added migration 0002_rls_prisma_migrations; applied; 0 public tables without RLS.

Implemented:
- Root npm workspaces: database/, backend/, frontend/. Root scripts: db:generate, db:migrate, db:migrate:dev, db:seed, dev:backend, dev:frontend, typecheck, test, build.
- database/: Prisma schema (11 tables, 4 enums), initial migration 0001_init with hand-written CHECK constraints, partial unique indexes (one PLACED order per user, one default address per user) and RLS enabled on all tables; repeatable seed (4 categories, 12 products incl. 1 inactive, a stock-1 product and low-stock items, with SEED inventory movements).
- backend/: Express 5 app (helmet, CORS allow-list, JSON limit, morgan), zod env config, Prisma client, standard error handler (AppError, Zod, body-parser, Prisma P2002/P2003/P2004/P2025, safe 500), notFound, validate middleware, pricing config + calculateOrderTotals, order state machine, GET /api/health with DB check.
- frontend/: Vite + React 19 + TS, Tailwind v4 with DESIGN.md tokens/typography/components, React Router with every PRD route (placeholders), store + admin layouts, home hero, single API client (ApiError), TanStack Query client, formatPaise.

Files changed:
- package.json, .gitignore, Memory.md
- database/{package.json,tsconfig.json,.env.example,prisma/schema.prisma,prisma/seed.ts,prisma/migrations/0001_init/migration.sql,prisma/migrations/migration_lock.toml}
- backend/{package.json,tsconfig.json,tsconfig.build.json,vitest.config.ts,.env.example}
- backend/src/{app.ts,server.ts,config/env.ts,config/pricing.ts,db/prisma.ts,middleware/{errorHandler,notFound,validate}.ts,modules/health/health.routes.ts,shared/errors/AppError.ts,shared/money/pricing.ts,shared/orderStates/orderStates.ts}
- backend/tests/{pricing,orderStates,app}.test.ts
- frontend/{package.json,tsconfig.json,vite.config.ts,.env.example,index.html,public/favicon.svg}
- frontend/src/{main.tsx,styles/index.css,api/client.ts,lib/{queryClient,money}.ts,components/PagePlaceholder.tsx,layouts/{StoreLayout,AdminLayout}.tsx,pages/{HomePage,NotFoundPage}.tsx,routes/router.tsx}

Validation:
- npm run typecheck → pass (database, backend, frontend)
- npm test → 26/26 pass (pricing, order transitions, error format/security headers)
- npm run build → pass (backend tsc, frontend vite)
- Built server smoke test with unreachable DB → /api/health 503 {database:"down"}, unknown route 404 standard error shape
- Unsplash seed image URLs → all 200

Decisions:
- Pinned stable majors: Prisma 6.19.3, TypeScript 5.9.3, Vite 7, Vitest 3, React Router 7, React 19, Express 5, Tailwind 4, zod 4. (npm `latest` for prisma is an 8.0 RC; TS 7 is the new Go compiler.)
- Separate .env per package (database, backend, frontend); never committed.
- Payment status lives only in `payments` (not duplicated on `orders`).
- `users.id` = Supabase auth user id (no default). Demo users + address seeding moved to Phase 3.
- Browser calls same-origin /api: Vite proxy in dev, Vercel rewrite in prod.
- Admin dashboard low-stock threshold = 5 (backend/src/config/pricing.ts).

Known issues:
- npm audit: 6 findings, all in dev-only tooling (vitest/tinypool, prisma CLI's deepmerge-ts). Fix needs major upgrades; deferred.
- Prisma warns `package.json#prisma` seed config is deprecated in Prisma 7; fine on 6.x.

Next action:
- Get Supabase connection strings → migrate → seed → verify health → Phase 3.
```

---

## 7. Demo accounts

Use dummy credentials only. Replace these values with the actual seeded credentials after implementation.

| Role | Email | Password | Status |
|---|---|---|---|
| Admin | `admin@kickstead.dev` | `Kickstead@Demo1` | Approved 2026-11-13; seeded in Phase 3 |
| Customer | `customer@kickstead.dev` | `Kickstead@Demo1` | Approved 2026-11-13; seeded in Phase 3 |

Personal admin (Google sign-in): `deepakrrana5@gmail.com`, set via `ADMIN_EMAILS` in backend/.env.

If these credentials are changed, update:

- This file.
- `README.md`.
- Seed documentation.
- Walkthrough notes.

Never use a real personal password.

---

## 8. API and business-rule notes

### Required endpoint groups

```text
/api/auth
/api/categories
/api/products
/api/addresses
/api/cart
/api/checkout
/api/orders
/api/admin
```

### Required order transitions

```text
PLACED -> PAID
PLACED -> PAYMENT_FAILED
PLACED -> PAYMENT_CANCELLED
PLACED -> CANCELLED
PAID -> PACKED
PAID -> CANCELLED
PACKED -> SHIPPED
SHIPPED -> DELIVERED
```

### Required checkout guarantees

```text
- Server recalculates totals.
- Server rechecks stock.
- Stock never becomes negative.
- Checkout is transactional.
- Same customer + same idempotency key does not duplicate an order.
- Payment outcome is recorded.
- Inventory movement is recorded.
- Audit event is recorded.
```

---

## 9. Validation log

Record commands and outcomes here instead of relying on memory.

| Date | Command | Result | Notes |
|---|---|---|---|
| 2026-11-13 | Not run | Pending | Implementation has not started |

Recommended commands:

```bash
npm install
npm run db:migrate
npm run db:seed
npm test
npm run typecheck
npm run build
```

Use the repository's actual script names if they differ.

---

## 10. Known limitations

Update this list honestly before submission:

```text
- Payment is simulated.
- No product sizes/variants; one stock count per product.
- Discount is always 0; tax and shipping use simple fixed rules.
- Abandoned PLACED orders keep stock reserved until cancelled.
- Auth token is sent as a Bearer header (Supabase client session), not an HTTP-only cookie.
- Traffic from Vercel to the EC2 backend is plain HTTP (no custom domain).
```

Do not remove a limitation unless the implementation and tests prove it is resolved.

---

## 11. Handoff instructions for Antigravity

Before starting work:

1. Read `PRD.md`.
2. Read `Architecture.md`.
3. Read `Rules.md`.
4. Read `Phases.md` and `Design.md`.
5. Read this file.
6. Inspect the repository.
7. Update the current phase before making changes.

After completing work:

1. Run relevant validation.
2. Update the phase log.
3. Update the checklist.
4. Record decisions and blockers.
5. State the next action.

Never mark a feature complete based only on a generated component or route. Verify the behavior through the API, database, tests, or a real UI flow as appropriate.

