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
| Current phase | Phase 9 — Deployment (backend live on EC2 via CI/CD; Vercel frontend + prod auth URLs pending) |
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
- [x] Admin product CRUD.
- [x] Admin category management.

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
- [x] Valid order transitions.
- [x] Admin order list.
- [x] Admin order detail.
- [x] Admin inventory update.
- [x] Admin customer list.
- [x] Dashboard summary.
- [x] Audit log creation.
- [x] Audit log view.

### Quality and delivery

- [x] Unit tests.
- [x] API/integration tests.
- [x] Insufficient-stock test.
- [x] Duplicate-checkout test.
- [x] Failed-payment test.
- [x] Invalid-transition test.
- [x] Authorization test.
- [x] README.
- [x] API documentation. (docs/api.md)
- [x] ER diagram. (docs/er-diagram.md)
- [x] Demo credentials. (seeded + in README)
- [x] Known limitations.
- [x] Clean database setup verified. (fresh local DB: migrate + seed ×2, 2026-11-14)
- [ ] Production build verified.
- [ ] Walkthrough video prepared.

---

## 5. Current implementation state

Update this section after each phase.

### Last completed phase

```text
Phases 1–8 complete (planning, scaffold + database, auth, catalogue + cart, checkout + orders, admin, hardening, test review).
```

### Current work

```text
Phase 9: deployment files written; waiting on user for GitHub secrets, server .env, SG port 22, Vercel project.
```

### Next task

```text
1. Verify Docker image locally (needs Docker Desktop running) or via first CI run.
2. User (step-by-step, does it themselves): install self-hosted runner on EC2 (label kickstead-ec2, service), set fork-PR approval to all external contributors, create /opt/kickstead/.env (no quotes), add GitHub secrets DATABASE_URL + DIRECT_URL, commit + push (user does git). SSH stays limited to user IP (user cannot/will not open 22 publicly).
3. Vercel project (root frontend/, VITE_* env vars) → then Supabase Site URL/Redirect URLs, Google JS origin, CLIENT_URL on server.
4. Ask permission: update Architecture.md/Rules.md for the Supabase Auth + Prisma deviations (decision G1).
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
## 2026-11-15 — Security review (qa-skills `security-testing`)

Installed: `npx skills@1.8.1 add petrkindlmann/qa-skills` (vercel-labs CLI; repo MIT, inspected first: 50 markdown skills + 2 benign scripts) → project-level `.claude/skills/` (50 skills, copied) + `skills-lock.json`.

Layers & results:
- Secrets: full git history (9 commits) → 0 (no real keys, passwords, PEMs, JWTs, .env/.pem ever committed).
- SCA (OSV API, every lockfile version): production 0 advisories. Upgraded vitest + @vitest/coverage-v8 3.2.7 → 4.1.12 → dev advisories 9 → 1 (removed 2 CRITICAL tinypool RCEs, vitest/mocker, glob, minimatch). Remaining: deepmerge-ts (Prisma CLI, dev-only, not in image) accepted.
- SAST (Semgrep 1.182.1 in scratchpad venv; latest has no Intel-mac binary): 7 mutable action tags → pinned all actions to commit SHAs (checkout/setup-node v4.4.0, setup-buildx v3.12.0, login v3.7.0, build-push v6.19.2). 7 INFO helmet confirmations. 2 "hardcoded password" = public demo password (accepted; flagged risk).
- Live probes vs production: all pass (A01/A02/A04/A05/A06/A10, Supabase RLS 0 rows + insert 401, EC2 only :80). alg:none token → Vercel firewall 403 (x-vercel-mitigated: deny), API direct → 401.
- Auth tests: added alg:none + tampered-payload tests (204 total). Repo settings: fork PR approval all_external_contributors, GITHUB_TOKEN read-only.
- Deliverable: docs/security.md (OWASP 2025 map, accepted risks, recommendations). ZAP/actionlint via Docker were blocked by the tool permission classifier.

Key risk raised to user: public demo admin on public production — accepted for review, deactivate/rotate afterwards.

## 2026-11-15 — Phase 9 (part 2): first automated deploy

Status: backend deployed

- Runner registered with default name/labels (ip-172-31-11-210; self-hosted,Linux,X64) and initially offline → deploy job queued. Changed deploy `runs-on` to [self-hosted, linux, x64]; removed `environment: production` (editor warning, not needed); fixed job-level env using `env.IMAGE` (invalid context).
- First deploy failed: wrong DB credentials in /opt/kickstead/.env → Supabase pooler ECIRCUITBREAKER after repeated auth failures. Workflow now removes the failed container when there is no previous version (prevents health checks hammering the DB).
- INCIDENT: a masking regex (`[^@]*`) printed the DB password in the conversation because the password contains '@'. Temp file deleted; user advised to reset the Supabase DB password to letters/digits only and update database/.env, backend/.env, GitHub secrets, /opt/kickstead/.env. 2026-11-15: user rotated the password (new value = old + one character; still contains '@'). Verified: new accepted, old rejected, local .env files + server + GitHub-secret-driven pipeline all working. Advised a fully random letters/digits password since both values were shared in the conversation; user's call.
- Commit 268972d: CI/CD green end-to-end (test → publish → deploy). Container healthy on EC2; public http://13.201.19.151/api/health → ok/up.

- Frontend live at https://kickstead.vercel.app (Vercel root frontend/; /api rewrite → EC2 verified; CSP/HSTS/XFO headers verified). User updated Supabase Site URL/Redirect URLs, Google JS origin, CLIENT_URL on server.
- Runner was only online while `./run.sh` was open → installed as systemd service (actions.runner.deepxkrana-Kickstead.ip-172-31-11-210, enabled, runs as ubuntu). GitHub reports it online. Deploys now need no manual server action.

Next: user browser test of demo + Google sign-in on production; optional permission to update Architecture.md/Rules.md (G1); final README status.

## 2026-11-14 — Phase 9 (part 1): EC2 + docs + pipeline files

Status: partial

Infrastructure (user, guided):
- EC2 Ubuntu 24.04 t3.micro ap-south-1, Elastic IP 13.201.19.151, SG: 22 (user IP), 80 (anywhere). Docker 29.1.3, user in docker group, 2 GB swap (persistent), /opt/kickstead. SSH initially timed out: SG source IP mismatch / network (user's network also intercepts :80 with a proxy returning 502).
- GitHub repo deepxkrana/Kickstead (public, default branch main).

Files:
- Dockerfile (3 stages: build → prod deps with --omit=dev and explicit removal of prisma CLI/@prisma/config → runtime node:22-bookworm-slim + openssl, non-root `node`, HEALTHCHECK, copies generated node_modules/.prisma incl. debian-openssl-3.0.x engine), .dockerignore.
- .github/workflows/ci-cd.yml: test job (Postgres 16 service, npm ci, db:generate, typecheck, test, build) on push/PR; deploy job on main: prisma migrate deploy (secrets) → buildx push ghcr.io/<owner>/kickstead-api:{sha,latest} (GHA cache) → SSH (key secret, ssh-keyscan) → docker login with job GITHUB_TOKEN → pull → swap container (--env-file /opt/kickstead/.env, -p 80:4000, --memory 600m, log rotation) → health check loop → auto-rollback to previous image → prune; then public health check.
- frontend/vercel.json: /api/:path* → http://13.201.19.151/api/:path*, SPA fallback, CSP (self, Google Fonts, https: images, *.supabase.co), XFO DENY, nosniff, Referrer-Policy, Permissions-Policy, immutable asset caching.
- docs/api.md (full reference + error code table), docs/er-diagram.md (Mermaid + DB-enforced rules + indexes + ledger), docs/deployment.md (runbook, secrets, server .env, rollback, limitations). README links them.

Validation:
- vercel.json valid JSON; workflow valid YAML; deploy + remote heredoc scripts pass `bash -n` after YAML de-indentation (REMOTE terminator at column 0).
- Docker image built and run locally (see below).

Decisions:
- User cannot open SSH to 0.0.0.0/0 → deploy via a self-hosted GitHub Actions runner on the EC2 instance (outbound only; matches original Q19 "github runner"). Jobs: test (GitHub-hosted) → publish (GitHub-hosted: migrate + build/push GHCR linux/amd64) → deploy (self-hosted: pull, swap, health, rollback). Secrets reduced to DATABASE_URL + DIRECT_URL.
- Server env lives only on the host (/opt/kickstead/.env), never in CI.

Docker image verified locally (2026-11-14):
- Found: `--omit=dev` still installed the Prisma CLI tree (prisma, @prisma/config, c12, jiti, deepmerge-ts, typescript…) because they are "devOptional" in the lockfile (optional peers of @prisma/client); `--omit=peer` did not help. Fix: `npm ci --omit=dev --omit=optional` (lockfile has 0 purely-optional packages, so no runtime loss). Result: 116 MB, 92 packages, CLI tree absent, all runtime deps present.
- Ran against Supabase: health ok, catalogue/search ok, admin 401, JWKS verification inside container ok, Docker HEALTHCHECK healthy, ~38 MB RAM, non-root `node`.

## 2026-11-14 — Phase 8: Test gap review

Status: complete

Method: coverage report (added @vitest/coverage-v8@3.2.7, `npm run test:coverage`) + mapping every PRD AC and Rules §10 item to tests.

Bugs found and fixed:
- Concurrent first sign-in: Prisma upsert is not atomic → 98/120 parallel first requests returned 409 UNIQUE_CONSTRAINT (real impact: /auth/me + /cart fire together on a new user's first page). createIfMissing now inserts and on P2002 re-reads the row; a different id with the same email → 409 ACCOUNT_CONFLICT.
- Bodiless POST to endpoints with all-optional bodies (POST /orders/:id/cancel) returned 400 (Express 5 req.body undefined). validate() now parses `req.body ?? {}`. Found by the ledger test (the cancel never happened; a later "set stock" masked the total).

Added tests (176 → 202):
- journey.test.ts: AC-01 full path via API incl. admin + dashboard + audit actor attribution; inventory ledger invariant (sum of movements = stock, every running stockAfter correct, reasons sequence).
- gaps.test.ts: two tabs/different keys race, price change at checkout, inactive category at checkout, 10-cap at checkout, same key different address, reserveStock second guard, admin cancel PLACED then customer pay 409, AC-05 no data change on admin status, profile cannot change role/email, address limit + default rule, admin product detail/movements, CATEGORY_NOT_FOUND, CATEGORY_NAME_TAKEN, empty update 400, real-DB provisioning (ADMIN_EMAILS, 10×8 concurrent first sign-ins, email sync, ACCOUNT_CONFLICT), customer search real rows, health DB-down 503, errorHandler Prisma mapping + safe 500.
- orders.test.ts: bodiless cancel accepted; bodiless payment still 400.

Validation:
- 202/202 ×3 consecutive runs; coverage 98.15% lines / 92.14% branches / 99.11% functions (92.74% before); only env.ts < 90% (startup failure path, manually verified).
- AC-08: fresh local DB → migrate deploy (from empty temp cwd, no .env) → seed ×2 (no Supabase keys) → 11 tables + _prisma_migrations, RLS 12/12, 16 CHECKs, ledger balanced → dropped.

Decisions:
- No frontend component tests (PLAN: "only if time permits"); business rules are enforced and tested server-side.

Next action:
- Phase 9.

## 2026-11-13 — Phase 7: Security and reliability hardening

Status: complete

Findings & fixes:
- BUG: Prisma `contains` does not escape LIKE wildcards ("%" matched all 11 products). Added shared/db/likeLiteral and applied to all 4 searches (catalog, admin products, admin orders, customers). Verified live: "%" → 0.
- Auth: JWKS fetch failures were reported as 401 INVALID_TOKEN; now AuthUnavailableError → 503 AUTH_UNAVAILABLE (logged with request id).
- npm audit --omit=dev: 3 high = deepmerge-ts via Prisma CLI (@prisma/config), pulled in as @prisma/client peer. Not reachable at runtime; fix requires Prisma 7 (breaking). Accepted + documented; plan to exclude CLI from runtime Docker image.
- Contrast: #FF0000 on white = 4.00:1 (fails AA small text); primary-40 = 3.95:1. Added --color-error-strong #D00000 (5.70:1) for small red text and white-on-red badges; kept #FF0000 for accents/borders and on black header (5.25:1). Placeholder/"No image" text → primary-60 (8.45:1). Deviation from DESIGN.md recorded here and in index.css.

Implemented:
- express-rate-limit@8: global 300/min/IP on /api; sensitive 20/min/user on checkout, payment, cancel; 429 RATE_LIMITED in standard error shape + draft-8 RateLimit headers; disabled in NODE_ENV=test unless injected via createApp({ rateLimits }).
- requestContext middleware: X-Request-Id (reuses safe incoming id), Cache-Control: no-store; request id in 500 bodies + error/auth logs.
- env: production refuses wildcard CLIENT_URL. pagination page ≤ 10,000. server: unhandledRejection logged, uncaughtException exits (container restarts).
- frontend a11y: error-strong token, .input focus ring, global focus-visible outline, reduced-motion (spinner/skeleton/transitions), skip-to-content link + main#main in both layouts.

Validation:
- typecheck pass; npm test 176/176 (new: security.test.ts — 16 protected endpoints 401, public endpoints 200, headers, request id reuse/sanitise, 413, page cap, CORS allow/deny, wildcard literal search, per-user checkout 429 without affecting other users, global per-IP 429; auth 503; verifier outage); build pass
- Production build smoke: headers present (CSP, HSTS, nosniff, RateLimit, X-Request-Id, no-store, CORS only for localhost:5173), access log has no auth headers, wildcard CORS in production → startup error.
- Contrast ratios computed (WCAG formula), not estimated.

Next action:
- Phase 8.

## 2026-11-13 — Phase 6: Admin

Status: complete

Implemented:
- backend (all behind router-level requireAuth + requireRole ADMIN): GET /admin/dashboard (one groupBy on orders → totals, byStatus, revenue for REVENUE_STATUSES, documented revenueRule; low stock (active, ≤5) count + top 10; recent 5), products list (all incl. inactive; q/categoryId/status/lowStock) / detail (+ last 50 movements) / create (slugify, initialStock → ADMIN_ADJUSTMENT movement, PRODUCT_CREATED audit) / update (strict, no stock; PRODUCT_UPDATED audit with changed fields from→to; *_SLUG_TAKEN 409) / stock (row lock, set|adjust, STOCK_NEGATIVE / NO_CHANGE 422, movement + INVENTORY_ADJUSTED audit), categories list (product counts) / create / update (audited), orders list (q on order number / customer name / email, status) / detail (customer, adminActions.nextStatuses, audit history, movements) / PATCH status (ADMIN_TARGET_STATUSES = PACKED|SHIPPED|DELIVERED|CANCELLED; payment statuses → 422 PAYMENT_STATUS_NOT_ADMIN; lockOrder + assertTransition; CANCELLED reuses cancelLockedOrder), customers, audit logs (action/entityType/entityId filters, actor).
- frontend (lazy-loaded route modules): dashboard (stat tiles linking to filtered lists, revenue rule, recent orders, low stock), products (filters, active toggle with confirm, inline stock editor with preview), product form (create/edit, ₹→paise, field errors, image preview, stock history), categories (add, rename, activate/deactivate with impact warning), orders (search, status chips), order detail (allowed next-status buttons, cancel with reason prompt, history timeline, stock movements, customer/payment/totals/address), customers, audit log (filters, entity links, metadata summary). Admin nav gains Categories. Removed unused PagePlaceholder.

Validation:
- typecheck pass; npm test 147/147 (27 new admin tests: 10 endpoints × 401/403, product/stock/category admin, AC-06 transitions + invalid 409s + 422 payment status, admin cancel refund/restock, search/filter, AC-07 dashboard reconciliation, audit filters + no secrets); build pass (admin chunks 2–8 kB each)
- Live vs Supabase: customer→dashboard 403; PAID→DELIVERED 409; set PAID 422; PACKED→SHIPPED→DELIVERED with ADMIN audit; restock +1 logged; revenue 0 → 766,882 paise (649,900 + 18% GST, free shipping); search, audit, customers OK. Leaves 1 DELIVERED demo order; Tempo stock back to 24 via logged adjustment.

Decisions:
- Admins cannot set payment outcomes; only fulfilment + cancel. (Interpretation of PRD PLACED→PAID: that transition happens through the payment flow.)
- Admin categories page added (/admin/categories) — not in PRD page list but needed for category management.
- Customer list excludes ADMIN users.

Known issues:
- None blocking.

Next action:
- Phase 7.

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

