# E-Commerce Platform — 2-Day PERN Build Plan

This document is a practical execution plan for building the assigned e-commerce platform in two days using the **PERN stack**:

- **PostgreSQL** — relational database
- **Express.js** — backend API
- **React** — frontend
- **Node.js** — server runtime

The goal is to deliver a strong, working MVP that demonstrates the required end-to-end journey:

```text
Customer login
  -> browse/search products
  -> add product to cart
  -> checkout
  -> simulated payment
  -> exactly one order created
  -> stock safely reduced
  -> admin sees and updates order
  -> dashboard and audit log reflect the action
```

Do not spend the two days on optional features such as reviews, wishlists, real payment gateways, email notifications, complex coupon engines, or advanced shipping integrations.

---

## 1. Delivery strategy

### Build these features first

#### Customer

- Register and login.
- Browse products.
- Search, category filter, sorting, and pagination.
- View product details.
- Add products to a persistent cart.
- Manage delivery addresses.
- Checkout with a selected address.
- Simulated successful, failed, and cancelled payment.
- View order history and order details.

#### Admin

- Admin login.
- Product CRUD.
- Category CRUD or category management.
- Inventory updates.
- View all orders.
- Update valid order statuses.
- View customers.
- Dashboard with order and revenue summaries.
- Audit log for important actions.

#### Engineering requirements

- PostgreSQL schema and migrations.
- Seed data and demo accounts.
- Server-side validation.
- Server-side role-based authorization.
- Transaction-safe checkout.
- Non-negative inventory.
- Idempotent checkout requests.
- Unit/API tests for critical rules.
- README, API documentation, ER diagram, and known limitations.

---

## 2. Recommended stack

Use the following stack unless the project already has an established alternative:

### Backend

- Node.js
- Express.js
- TypeScript
- `pg` or Prisma/Drizzle for PostgreSQL access
- `zod` for request validation
- `bcrypt` for password hashing
- `jsonwebtoken` or secure cookie sessions
- `cors`
- `helmet`
- `morgan` or structured logging
- `dotenv`

### Frontend

- React
- Vite
- TypeScript
- React Router
- Axios or Fetch
- TanStack Query if already available
- Plain CSS, CSS Modules, or Tailwind if already configured

### Database

- PostgreSQL
- SQL migration files
- Seed script

### Testing

- Vitest or Jest
- Supertest for API tests
- React Testing Library only if time permits

### Documentation

- Markdown README
- Mermaid ER diagram
- OpenAPI YAML or a documented API endpoint table

Avoid adding many dependencies during the build. Prefer libraries already included in the repository.

---

## 3. Suggested project structure

```text
ecommerce-platform/
├── client/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── catalog/
│   │   │   ├── cart/
│   │   │   ├── checkout/
│   │   │   ├── orders/
│   │   │   └── admin/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── types/
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── db/
│   │   │   ├── migrations/
│   │   │   ├── pool.ts
│   │   │   └── seed.ts
│   │   ├── middleware/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── catalog/
│   │   │   ├── cart/
│   │   │   ├── checkout/
│   │   │   ├── orders/
│   │   │   ├── inventory/
│   │   │   ├── reports/
│   │   │   └── audit/
│   │   ├── routes/
│   │   ├── shared/
│   │   │   ├── errors/
│   │   │   ├── validation/
│   │   │   └── http/
│   │   ├── app.ts
│   │   └── server.ts
│   ├── tests/
│   └── package.json
├── docs/
│   ├── api.md
│   └── er-diagram.md
├── .env.example
├── docker-compose.yml
├── package.json
└── README.md
```

If the repository is empty, the first prompt should scaffold this structure. If a repository already exists, Antigravity must inspect and preserve the current conventions instead of rewriting everything.

---

## 4. Core database design

Use a relational schema with constraints. Keep the model small enough to finish in two days.

### Required tables

```text
users
categories
products
addresses
carts
cart_items
orders
order_items
payments
inventory_movements
audit_logs
idempotency_keys
```

### Recommended schema

#### `users`

```text
id UUID PRIMARY KEY
name VARCHAR(120) NOT NULL
email VARCHAR(255) UNIQUE NOT NULL
password_hash TEXT NOT NULL
role VARCHAR(20) NOT NULL CHECK (role IN ('CUSTOMER', 'ADMIN'))
is_active BOOLEAN NOT NULL DEFAULT TRUE
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### `categories`

```text
id UUID PRIMARY KEY
name VARCHAR(100) UNIQUE NOT NULL
description TEXT
is_active BOOLEAN NOT NULL DEFAULT TRUE
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### `products`

```text
id UUID PRIMARY KEY
category_id UUID NOT NULL REFERENCES categories(id)
name VARCHAR(200) NOT NULL
slug VARCHAR(220) UNIQUE NOT NULL
description TEXT NOT NULL
price_cents INTEGER NOT NULL CHECK (price_cents >= 0)
stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0)
image_url TEXT
is_active BOOLEAN NOT NULL DEFAULT TRUE
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

For a two-day build, track stock directly on `products`. Add variants only if the product domain absolutely requires them.

#### `addresses`

```text
id UUID PRIMARY KEY
user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
full_name VARCHAR(120) NOT NULL
phone VARCHAR(30) NOT NULL
line1 VARCHAR(200) NOT NULL
line2 VARCHAR(200)
city VARCHAR(100) NOT NULL
state VARCHAR(100) NOT NULL
postal_code VARCHAR(20) NOT NULL
country VARCHAR(80) NOT NULL
is_default BOOLEAN NOT NULL DEFAULT FALSE
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### `carts` and `cart_items`

```text
carts
- id UUID PRIMARY KEY
- user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE
- created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

cart_items
- id UUID PRIMARY KEY
- cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE
- product_id UUID NOT NULL REFERENCES products(id)
- quantity INTEGER NOT NULL CHECK (quantity > 0)
- UNIQUE(cart_id, product_id)
```

#### `orders`

```text
id UUID PRIMARY KEY
order_number VARCHAR(30) UNIQUE NOT NULL
user_id UUID NOT NULL REFERENCES users(id)
status VARCHAR(30) NOT NULL
payment_status VARCHAR(30) NOT NULL
address_snapshot JSONB NOT NULL
subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0)
discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0)
tax_cents INTEGER NOT NULL DEFAULT 0 CHECK (tax_cents >= 0)
shipping_cents INTEGER NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0)
total_cents INTEGER NOT NULL CHECK (total_cents >= 0)
currency VARCHAR(3) NOT NULL DEFAULT 'INR'
idempotency_key VARCHAR(120) NOT NULL
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
UNIQUE(user_id, idempotency_key)
```

Recommended order statuses:

```text
PLACED
PAID
PACKED
SHIPPED
DELIVERED
CANCELLED
PAYMENT_FAILED
PAYMENT_CANCELLED
```

#### `order_items`

```text
id UUID PRIMARY KEY
order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE
product_id UUID REFERENCES products(id)
product_name_snapshot VARCHAR(200) NOT NULL
unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0)
quantity INTEGER NOT NULL CHECK (quantity > 0)
line_total_cents INTEGER NOT NULL CHECK (line_total_cents >= 0)
```

Store product name and price snapshots so historical orders remain correct even if the product later changes.

#### `payments`

```text
id UUID PRIMARY KEY
order_id UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE
status VARCHAR(30) NOT NULL
provider_reference VARCHAR(120) UNIQUE
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### `inventory_movements`

```text
id UUID PRIMARY KEY
product_id UUID NOT NULL REFERENCES products(id)
quantity_change INTEGER NOT NULL
reason VARCHAR(50) NOT NULL
order_id UUID REFERENCES orders(id)
actor_user_id UUID REFERENCES users(id)
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### `audit_logs`

```text
id UUID PRIMARY KEY
actor_user_id UUID REFERENCES users(id)
action VARCHAR(80) NOT NULL
entity_type VARCHAR(50) NOT NULL
entity_id UUID
metadata JSONB
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### `idempotency_keys`

This table is optional if `orders(user_id, idempotency_key)` is used directly. If implemented separately:

```text
id UUID PRIMARY KEY
user_id UUID NOT NULL REFERENCES users(id)
key VARCHAR(120) NOT NULL
response JSONB
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
UNIQUE(user_id, key)
```

---

## 5. Critical checkout algorithm

The checkout endpoint is the most important backend feature.

### Required behavior

1. Authenticate the customer.
2. Read the idempotency key.
3. If the same customer and key already created an order, return that order.
4. Start a database transaction.
5. Load the cart.
6. Lock the relevant product rows using `FOR UPDATE`.
7. Recheck that every product is active and has enough stock.
8. Recalculate all prices from database values.
9. Create the order and order items.
10. Decrement stock.
11. Record inventory movements.
12. Simulate payment.
13. Update payment and order statuses.
14. Write an audit log.
15. Clear the cart only after successful order creation.
16. Commit the transaction.
17. Roll back on any error.

### Stock update example

```sql
SELECT id, name, price_cents, stock_quantity
FROM products
WHERE id = $1
FOR UPDATE;
```

Then validate:

```text
stock_quantity >= requested_quantity
```

Update only after validation:

```sql
UPDATE products
SET stock_quantity = stock_quantity - $1,
    updated_at = NOW()
WHERE id = $2
  AND stock_quantity >= $1;
```

If the update affects zero rows, return a conflict response such as:

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "One or more products are no longer available in the requested quantity."
  }
}
```

Never accept `subtotal`, `total`, product price, or stock values from the browser as authoritative.

---

## 6. API contract

Implement only the endpoints needed for the MVP.

### Authentication

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Categories and products

```text
GET   /api/categories
GET   /api/products
GET   /api/products/:id
POST  /api/admin/categories
PATCH /api/admin/categories/:id
POST  /api/admin/products
PATCH /api/admin/products/:id
PATCH /api/admin/products/:id/stock
```

Product listing query parameters:

```text
q
categoryId
minPrice
maxPrice
sort
page
limit
```

### Addresses

```text
GET    /api/addresses
POST   /api/addresses
PATCH  /api/addresses/:id
DELETE /api/addresses/:id
```

### Cart

```text
GET    /api/cart
POST   /api/cart/items
PATCH  /api/cart/items/:id
DELETE /api/cart/items/:id
DELETE /api/cart
```

### Checkout and orders

```text
POST /api/checkout
GET  /api/orders
GET  /api/orders/:id
POST /api/orders/:id/cancel
```

Checkout request:

```json
{
  "addressId": "address-uuid",
  "paymentOutcome": "SUCCESS",
  "idempotencyKey": "checkout-unique-key"
}
```

Allowed payment outcomes:

```text
SUCCESS
FAILED
CANCELLED
```

### Admin

```text
GET   /api/admin/orders
PATCH /api/admin/orders/:id/status
GET   /api/admin/customers
GET   /api/admin/dashboard
GET   /api/admin/audit-logs
```

### Standard error response

Use one predictable format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid.",
    "details": {
      "field": "email"
    }
  }
}
```

Use appropriate status codes:

```text
400 Invalid input
401 Not authenticated
403 Not authorized
404 Resource not found
409 Conflict, stale stock, or duplicate request
422 Business rule failure
500 Unexpected server error
```

---

## 7. Frontend pages

### Public/customer pages

```text
/login
/register
/products
/products/:id
/cart
/checkout
/orders
/orders/:id
/profile
/addresses
```

### Admin pages

```text
/admin
/admin/products
/admin/products/new
/admin/products/:id/edit
/admin/orders
/admin/orders/:id
/admin/customers
/admin/audit-logs
```

### Required UI states

Every important page should have:

- Loading state.
- Empty state.
- Error state.
- Success feedback.
- Disabled submit state.

Use a simple, consistent layout. Functional clarity is more valuable than visual complexity.

---

## 8. Two-day timeline

## Day 1 — Foundation and primary customer journey

### Phase 1 — Repository inspection and planning

Time: 30–45 minutes

- Inspect the current repository.
- Identify existing package managers and scripts.
- Confirm whether PostgreSQL is available.
- Preserve existing code and conventions.
- Create a short implementation checklist.

### Phase 2 — Scaffold and database

Time: 2–3 hours

- Set up client and server if needed.
- Configure TypeScript.
- Configure environment variables.
- Create PostgreSQL migrations.
- Add all essential tables and constraints.
- Add seed data.
- Add customer and admin demo accounts.
- Add database scripts.

### Phase 3 — Authentication and authorization

Time: 1.5–2 hours

- Register.
- Login.
- Password hashing.
- JWT or secure cookie session.
- `requireAuth` middleware.
- `requireRole('ADMIN')` middleware.
- `/auth/me`.
- Frontend auth state and protected routes.

### Phase 4 — Catalogue and cart

Time: 3–4 hours

- Product listing.
- Search.
- Category filter.
- Sorting.
- Pagination.
- Product detail page.
- Add to cart.
- Update quantity.
- Remove item.
- Persistent cart API.

### Phase 5 — Checkout and order creation

Time: 3–4 hours

- Address CRUD or address creation.
- Checkout page.
- Transactional order creation.
- Stock recheck.
- Price calculation.
- Simulated payment.
- Idempotency.
- Order history.

At the end of Day 1, the complete customer flow must work.

---

## Day 2 — Admin, reliability, tests, and submission package

### Phase 6 — Admin operations

Time: 3–4 hours

- Admin dashboard.
- Product CRUD.
- Category management.
- Inventory update.
- Order list and order detail.
- Valid status transitions.
- Customer list.
- Audit log display.

### Phase 7 — Reliability and security hardening

Time: 2–3 hours

- Validate every request server-side.
- Verify customer ownership of carts, addresses, and orders.
- Verify admin-only routes.
- Add consistent errors.
- Confirm stock cannot become negative.
- Confirm duplicate checkout returns the original order.
- Confirm failed payment does not leave inconsistent records.
- Confirm cancelled orders follow documented behavior.

### Phase 8 — Tests

Time: 2–3 hours

Write focused tests for:

- Password/authentication.
- Admin authorization.
- Price calculation.
- Product search/filter.
- Checkout success.
- Insufficient stock.
- Duplicate checkout.
- Failed payment.
- Invalid order transition.

### Phase 9 — Documentation and final verification

Time: 2–3 hours

- README.
- `.env.example`.
- ER diagram.
- API documentation.
- Demo credentials.
- Test commands.
- Known limitations.
- Final clean setup test.
- Final walkthrough recording.

---

## 9. Copy-paste Antigravity prompts

Use these prompts sequentially. Do not send all prompts at once. After each phase, run the verification commands and only then continue.

---

## Prompt 1 — Inspect and plan the repository

```text
You are working on an e-commerce platform assessment that must be completed in two days using the PERN stack: PostgreSQL, Express.js, React, and Node.js.

First inspect the entire repository and existing package configuration. Do not modify files yet.

The required MVP is:
- customer registration and login
- server-side role-based authorization with CUSTOMER and ADMIN roles
- product catalogue with search, category filter, sorting, and pagination
- product detail page
- persistent cart
- address selection
- transactional checkout
- simulated SUCCESS, FAILED, and CANCELLED payments
- duplicate checkout protection using idempotency
- safe stock updates that never allow negative inventory
- customer order history
- admin product/category/inventory/order/customer management
- admin dashboard/report
- audit trail
- automated tests for success and negative/conflict cases
- README, API documentation, ER diagram, seed data, and demo credentials

Create a concise implementation plan based on the actual repository. Identify:
1. Existing frontend and backend structure.
2. Existing scripts and dependencies.
3. Whether PostgreSQL and migrations are already configured.
4. Files that should be reused.
5. Any blockers that must be resolved immediately.

Do not add optional features. Do not rewrite working code. At the end, provide the plan and the exact commands you will use for validation.
```

---

## Prompt 2 — Scaffold PERN foundation and database

```text
Implement the PERN foundation for the e-commerce MVP in the repository.

Preserve existing conventions where possible. If the repository is empty, create a maintainable client/server structure with TypeScript.

Set up:
- PostgreSQL connection configuration
- environment variable loading
- migration scripts
- seed scripts
- consistent API error handling
- CORS and basic security middleware
- server health endpoint
- frontend routing and API client

Create migrations for:
- users
- categories
- products
- addresses
- carts
- cart_items
- orders
- order_items
- payments
- inventory_movements
- audit_logs

Use UUID primary keys where practical. Add foreign keys, unique constraints, non-negative checks, useful indexes, timestamps, and order idempotency protection.

Use integer cents for money. Use these roles:
- CUSTOMER
- ADMIN

Use these order statuses:
- PLACED
- PAID
- PACKED
- SHIPPED
- DELIVERED
- CANCELLED
- PAYMENT_FAILED
- PAYMENT_CANCELLED

Seed:
- one admin account
- one customer account
- at least three categories
- at least eight products with realistic stock
- at least one customer address

Use only dummy credentials and document them in a development-only seed file or README. Never commit real secrets.

After implementation:
1. Run migrations from a clean database if possible.
2. Run the seed command.
3. Run the backend type-check/build.
4. Report all changed files and any unresolved issues.
```

---

## Prompt 3 — Authentication and authorization

```text
Implement authentication and authorization for the PERN e-commerce MVP.

Requirements:
- customer registration
- login
- logout
- current-user endpoint
- secure password hashing with bcrypt
- JWT or secure HTTP-only cookie authentication, following the repository's existing conventions
- server-side requireAuth middleware
- server-side requireRole middleware
- CUSTOMER and ADMIN roles
- account active check
- validation with clear errors

Protect resources by ownership:
- customers may access only their own profile, addresses, cart, and orders
- customers must not access admin endpoints
- admins may access admin endpoints

Implement frontend:
- login page
- registration page
- auth state restoration
- protected routes
- admin route protection
- logout action
- clear unauthorized and validation messages

Do not rely only on hidden frontend buttons. Every authorization decision must be enforced on the server.

Add tests for:
- successful registration/login
- invalid credentials
- unauthenticated request
- customer calling an admin endpoint returns 403
- customer cannot access another customer's order

Run the relevant tests and type-check/build after implementation.
```

---

## Prompt 4 — Catalogue and persistent cart

```text
Implement the customer catalogue and persistent cart.

Backend requirements:
- GET /api/categories
- GET /api/products
- GET /api/products/:id
- GET /api/cart
- POST /api/cart/items
- PATCH /api/cart/items/:id
- DELETE /api/cart/items/:id
- DELETE /api/cart

Product listing must support:
- q search by product name and description
- categoryId filter
- minPrice and maxPrice
- sort by newest, price ascending, and price descending
- server-side pagination with page and limit
- active products only for customers

Validate:
- product existence
- active product status
- positive integer quantity
- quantity not greater than current stock
- authenticated ownership of cart

Never trust product price or totals from the client. The server must read current product data from PostgreSQL.

Frontend pages:
- product catalogue
- product detail
- search and filter controls
- pagination
- cart page
- quantity update
- remove item
- clear cart

Include loading, empty, error, and success states. Keep the UI simple and responsive.

Add tests for product filtering and adding/removing cart items.
Run tests and type-check/build.
```

---

## Prompt 5 — Checkout, payment simulation, stock safety, and idempotency

```text
Implement the critical checkout workflow for the PERN e-commerce MVP.

Endpoint:
POST /api/checkout

Request:
{
  "addressId": "uuid",
  "paymentOutcome": "SUCCESS | FAILED | CANCELLED",
  "idempotencyKey": "client-generated-unique-key"
}

Implement checkout as a PostgreSQL transaction:
1. Authenticate the customer.
2. Validate the address belongs to the customer.
3. Check whether the same customer and idempotencyKey already produced an order. If yes, return the existing order and do not repeat side effects.
4. Load the customer's cart.
5. Lock relevant product rows with SELECT FOR UPDATE.
6. Recheck active status and stock.
7. Recalculate subtotal, discount, tax, shipping, and total on the server.
8. Snapshot the delivery address into the order.
9. Create one order and order items.
10. Decrement stock safely.
11. Insert inventory movements.
12. Insert payment record.
13. Set order/payment state based on paymentOutcome.
14. Insert an audit log.
15. Clear the cart only according to the documented payment/checkout behavior.
16. Commit or roll back atomically.

Important rules:
- stock must never become negative
- repeated checkout requests must not create duplicate orders
- totals from the browser must be ignored
- failed or cancelled payment must leave consistent order and inventory state
- money must use integer cents
- return 409 for stale or insufficient stock
- return predictable JSON errors

Implement:
- checkout page
- address selection
- order summary
- payment outcome selector for demo purposes
- success/failure/cancellation UI
- order confirmation
- customer order list and detail pages

Add tests for:
- successful checkout
- insufficient stock
- duplicate checkout with the same idempotency key
- failed payment
- cancelled payment
- invalid address ownership
- two attempts to purchase the final stock item, if practical

Run migrations, seed data, tests, and type-check/build. Do not proceed to unrelated features until this flow works end to end.
```

---

## Prompt 6 — Admin dashboard and operations

```text
Implement the admin side of the e-commerce MVP. All routes must enforce ADMIN authorization on the server.

Backend endpoints:
- GET /api/admin/dashboard
- GET /api/admin/products
- POST /api/admin/products
- PATCH /api/admin/products/:id
- PATCH /api/admin/products/:id/stock
- POST /api/admin/categories
- PATCH /api/admin/categories/:id
- GET /api/admin/orders
- GET /api/admin/orders/:id
- PATCH /api/admin/orders/:id/status
- GET /api/admin/customers
- GET /api/admin/audit-logs

Admin functionality:
- product create/edit/activate/deactivate
- category create/edit/activate/deactivate
- inventory update
- order search/filter
- order detail
- valid order status transitions
- customer list
- dashboard summary
- audit log list

Allowed order transitions:
- PLACED -> PAID, PAYMENT_FAILED, PAYMENT_CANCELLED, CANCELLED
- PAID -> PACKED, CANCELLED
- PACKED -> SHIPPED
- SHIPPED -> DELIVERED
- DELIVERED -> no transition
- CANCELLED -> no transition
- PAYMENT_FAILED -> no transition unless you explicitly support retry
- PAYMENT_CANCELLED -> no transition unless you explicitly support retry

Reject invalid transitions with a 409 or 422 response.

Dashboard metrics should be calculated consistently from orders:
- total orders
- paid/revenue orders
- pending orders
- cancelled orders
- low-stock products
- total revenue

Every material admin action must create an audit log, especially:
- product creation/update
- inventory update
- order status update
- order cancellation

Frontend pages:
- admin dashboard
- admin products
- admin product form
- admin orders
- admin order detail
- admin customers
- admin audit logs

Use simple tables, filters, forms, and clear success/error messages. Add at least one test proving a customer cannot access these endpoints.
```

---

## Prompt 7 — Tests, hardening, and acceptance verification

```text
Perform a focused reliability and acceptance pass on the e-commerce MVP. Do not add optional features.

Review the implementation against these acceptance tests:
1. Customer can find a product, add it to cart, and place an order end to end.
2. Stock is checked again at checkout and can never become negative.
3. Repeated checkout requests do not create duplicate orders.
4. Failed payment and cancellation are handled consistently.
5. Admin updates are protected and dashboard reports reconcile with orders.

Add or fix automated tests for:
- authentication
- role authorization
- product search/filter/pagination
- cart persistence
- successful checkout
- insufficient stock
- duplicate checkout
- failed payment
- invalid order transition
- customer attempting admin access
- customer attempting another customer's resource

Review all critical endpoints for:
- server-side validation
- predictable errors
- transaction handling
- ownership checks
- safe integer money calculations
- no negative stock
- no trust in client-supplied prices or totals
- no secrets in source code

Run:
- database migration from a clean database if possible
- seed
- all tests
- type-check
- production build

Fix only issues related to the requested e-commerce MVP. Report any remaining limitations clearly.
```

---

## Prompt 8 — Documentation and final submission package

```text
Prepare the final submission package for the e-commerce platform assessment.

Create or update:

1. README.md
Include:
- project overview
- feature list
- technology stack
- architecture
- local prerequisites
- environment variables
- database creation
- migration commands
- seed commands
- development commands
- production build command
- test commands
- dummy demo credentials
- API documentation link/path
- ER diagram link/path
- known limitations

2. docs/api.md
Document every implemented endpoint with:
- method and path
- authentication requirement
- request body/query parameters
- success response
- error responses
- example request and response

3. docs/er-diagram.md
Create a Mermaid ER diagram covering:
- users
- categories
- products
- addresses
- carts
- cart_items
- orders
- order_items
- payments
- inventory_movements
- audit_logs

4. .env.example
Include placeholders only. Do not include real passwords, tokens, or credentials.

5. A test evidence section in README
Explain the critical tests for:
- insufficient stock
- duplicate checkout
- failed payment
- unauthorized admin access

Use honest known limitations. Do not claim real payment processing or production-grade deployment if it is only simulated.

Then perform a clean verification:
- install dependencies
- configure environment from .env.example
- create database
- run migrations
- run seed
- start backend and frontend
- run tests
- run production build

Report the exact final commands, demo credentials, and any remaining blockers.
```

---

## 10. Final manual acceptance checklist

Before submission, manually verify the following.

### Customer flow

- [ ] Register works.
- [ ] Login works.
- [ ] Customer cannot open admin pages or APIs.
- [ ] Product search works.
- [ ] Category filter works.
- [ ] Sorting works.
- [ ] Pagination works.
- [ ] Product detail works.
- [ ] Product can be added to cart.
- [ ] Cart persists after refresh.
- [ ] Quantity can be updated.
- [ ] Invalid quantity is rejected.
- [ ] Address can be selected.
- [ ] Checkout succeeds.
- [ ] Order confirmation appears.
- [ ] Order appears in customer order history.

### Inventory and payment

- [ ] Checkout rechecks stock.
- [ ] Stock never becomes negative.
- [ ] Insufficient stock returns a clear error.
- [ ] Successful payment creates the expected state.
- [ ] Failed payment is visible and consistent.
- [ ] Cancelled payment is visible and consistent.
- [ ] Repeating the same checkout request does not create another order.

### Admin flow

- [ ] Admin login works.
- [ ] Admin can create/edit products.
- [ ] Admin can update stock.
- [ ] Admin can view orders.
- [ ] Admin can change valid order statuses.
- [ ] Invalid status transitions are rejected.
- [ ] Admin can view customers.
- [ ] Dashboard totals are understandable.
- [ ] Audit logs are created and visible.

### Submission quality

- [ ] No `.env` file is committed.
- [ ] No real credentials are committed.
- [ ] `.env.example` is present.
- [ ] Migrations work from an empty database.
- [ ] Seed data works.
- [ ] Tests pass.
- [ ] Production build passes.
- [ ] README setup steps work on a clean machine.
- [ ] API documentation exists.
- [ ] ER diagram exists.
- [ ] Demo credentials are documented.
- [ ] Known limitations are documented.
- [ ] Video is 3–5 minutes.

---

## 11. Recommended demo script

Use this sequence for the 3–5 minute walkthrough video:

1. Show the login page and log in as a customer.
2. Search for a product.
3. Filter or sort the catalogue.
4. Open product details.
5. Add a product to the cart.
6. Open the cart and change quantity.
7. Proceed to checkout.
8. Select an address.
9. Choose successful simulated payment.
10. Place the order.
11. Show the order confirmation and order history.
12. Log in as admin.
13. Show the same order in the admin order list.
14. Update the order from `PAID` to `PACKED`.
15. Show the dashboard summary.
16. Show the audit log.
17. Briefly demonstrate insufficient stock or repeated checkout protection.

Keep the demo focused on correctness and business rules.

---

## 12. What to explicitly declare as limitations

It is acceptable to document limitations such as:

- Payment is simulated and no real payment provider is connected.
- Shipping is represented by a fixed or zero amount.
- Tax rules are simplified.
- Product variants are not implemented because the MVP uses simple products.
- Email notifications are not implemented.
- Image upload is replaced by image URLs or placeholders.
- Deployment is local-only.
- Admin user creation is seed-based rather than self-service.

Do not hide incomplete functionality. A smaller, correct, explainable system is better than a larger system with broken workflows.

