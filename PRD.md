# Product Requirements Document

## E-Commerce Platform

**Project type:** Full-stack e-commerce MVP  
**Technology:** PERN — PostgreSQL, Express.js, React, Node.js  
**Delivery window:** Two days  
**Primary users:** Customers and administrators  
**Primary objective:** Deliver a correct, explainable, database-backed e-commerce workflow rather than a large collection of incomplete screens.

---

## 1. Product summary

Build a responsive web application that allows a customer to discover products, add products to a persistent cart, complete checkout using a simulated payment flow, and view the resulting order.

An administrator must be able to manage catalogue data, inventory, customers, and orders, while viewing dashboard summaries and an audit trail of important business actions.

The reviewer must be able to perform the complete customer journey and then confirm the result from the admin interface.

```text
Customer logs in
  -> searches for a product
  -> views product details
  -> adds product to cart
  -> selects a delivery address
  -> completes simulated payment
  -> receives exactly one order
  -> inventory is reduced safely
  -> admin sees and updates the order
  -> dashboard and audit log reflect the action
```

---

## 2. Problem statement

Small and medium-sized commerce businesses need a reliable way to:

- Present products to customers.
- Track product availability.
- Accept and process orders.
- Prevent overselling.
- Handle payment outcomes.
- Allow staff to manage order operations.
- Produce basic business summaries.

The application must demonstrate these capabilities with sound backend rules, database integrity, role-based access control, and reproducible local setup.

---

## 3. Goals

### Primary goals

1. Provide a complete customer-to-order journey.
2. Maintain a persistent product catalogue and cart.
3. Recalculate checkout totals on the server.
4. Prevent stock from becoming negative.
5. Prevent duplicate orders from repeated checkout requests.
6. Support simulated successful, failed, and cancelled payments.
7. Support valid order lifecycle transitions.
8. Provide protected admin operations.
9. Provide a basic dashboard and audit trail.
10. Provide tests and documentation that prove the important rules work.

### Secondary goals

- Provide a responsive and accessible interface.
- Keep the code understandable enough for a technical walkthrough.
- Make database setup repeatable from an empty database.
- Make the application easy to demonstrate using seed data.

---

## 4. Non-goals

The following are explicitly outside the two-day MVP unless all required functionality is already complete:

- Real payment gateway integration.
- Real credit/debit card handling.
- Email or SMS notifications.
- Product reviews and ratings.
- Wishlist functionality.
- Advanced coupon and promotion engines.
- Multi-vendor marketplace functionality.
- Complex shipping provider integration.
- Delivery map tracking.
- Product image upload infrastructure.
- Microservices.
- Native mobile applications.
- Production-grade analytics.

Payment is simulated only. No real payment credentials or sensitive financial information may be used.

---

## 5. Personas

### 5.1 Customer

A customer wants to find a product, understand its price and availability, add it to a cart, provide a delivery address, complete checkout, and track their order.

The customer must only be able to access their own profile, addresses, cart, and orders.

### 5.2 Administrator

An administrator manages the catalogue and operational workflow. They need to update products and stock, view customers, process orders, view summaries, and inspect important business activity.

Administrative capabilities must be protected by server-side role authorization.

### 5.3 Reviewer

The reviewer evaluates whether the application is correct, secure, explainable, and reproducible. The reviewer must be able to use demo credentials, follow the README, run the tests, and observe the critical edge cases.

---

## 6. Functional requirements

### 6.1 Authentication

The system must:

- Allow a customer to register.
- Allow a user to log in and log out.
- Hash passwords securely.
- Restore the current authenticated user.
- Distinguish between `CUSTOMER` and `ADMIN` roles.
- Reject unauthenticated requests to protected endpoints.
- Reject customers attempting to access admin endpoints.
- Use only dummy demo credentials in seed data and documentation.

### 6.2 Customer profile and addresses

The system must allow an authenticated customer to:

- View their profile.
- Update basic profile information.
- List their addresses.
- Create an address.
- Update an address.
- Delete an address.
- Select an address during checkout.

The selected address must be copied into the order as a snapshot so that changing a profile address does not change historical orders.

### 6.3 Product catalogue

The system must allow customers to:

- Browse active products.
- Search by product name or description.
- Filter by category.
- Filter by price range if implemented.
- Sort products.
- Navigate through paginated results.
- Open a product detail page.
- See current price and stock availability.

The backend must perform search, filtering, sorting, and pagination. The browser must not be the only layer responsible for these operations.

### 6.4 Product and category administration

An administrator must be able to:

- Create products.
- Edit products.
- Activate or deactivate products.
- Update product price.
- Update product description and image URL.
- Assign products to categories.
- Create and edit categories.
- Activate or deactivate categories.

### 6.5 Persistent cart

An authenticated customer must be able to:

- View their cart.
- Add a product.
- Change item quantity.
- Remove an item.
- Clear the cart.
- See current item prices.
- See calculated subtotal.
- Proceed to checkout.

The cart must be stored in PostgreSQL and remain available after a page refresh.

### 6.6 Checkout and pricing

Checkout must:

- Require authentication.
- Require a valid address owned by the customer.
- Load cart contents from the database.
- Load current product prices from the database.
- Recalculate subtotal on the server.
- Apply configured discount, tax, and shipping rules, even if those rules are simple.
- Calculate a final total on the server.
- Never trust totals or prices supplied by the browser.
- Create one order for one valid checkout request.

Money must be represented using integer minor units such as cents or paise.

### 6.7 Simulated payment

The customer must be able to demonstrate:

- Successful payment.
- Failed payment.
- Cancelled payment.

The payment outcome must be recorded and reflected in the order state. The system must not store real card information.

### 6.8 Inventory

The system must:

- Display product stock to the relevant users.
- Validate quantity when adding to the cart.
- Revalidate stock during checkout.
- Prevent stock from becoming negative.
- Update stock atomically during order confirmation.
- Record inventory movements for order-related changes and admin stock updates.

### 6.9 Order lifecycle

The system must support these states where applicable:

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

Only valid transitions may be performed:

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

Terminal states such as `DELIVERED`, `CANCELLED`, `PAYMENT_FAILED`, and `PAYMENT_CANCELLED` must not be changed arbitrarily.

### 6.10 Duplicate checkout protection

The checkout operation must accept an idempotency key.

For the same authenticated customer and the same idempotency key:

- The first request may create the order.
- A repeated request must return the original result or a safe equivalent.
- A repeated request must not create another order.
- Stock must not be deducted twice.
- Payment must not be simulated twice.

This protection must exist on the server and in the database, not only in the frontend.

### 6.11 Customer order history

Customers must be able to:

- View their own orders.
- View order details.
- View items, quantities, prices, totals, payment status, delivery address snapshot, and order status.
- Cancel an order only when the business rules allow it.

### 6.12 Admin order management

An administrator must be able to:

- View all orders.
- Search or filter orders.
- Open order details.
- Update valid order statuses.
- Cancel eligible orders.
- See the customer and payment information relevant to operations.

### 6.13 Dashboard and reports

The admin dashboard must show at least:

- Total order count.
- Paid order count.
- Pending order count.
- Cancelled order count.
- Total revenue based on a documented rule.
- Low-stock product count or list.

Reports must reconcile with the underlying order records.

### 6.14 Audit trail

The system must record material business actions, including:

- Product creation or update.
- Inventory update.
- Order creation.
- Payment outcome.
- Order status update.
- Order cancellation.

Audit records should identify the actor, action, entity, entity ID, timestamp, and useful metadata without storing secrets.

---

## 7. Required pages

### Customer pages

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

Every major page must provide loading, empty, success, and error states where relevant.

---

## 8. Acceptance criteria

### AC-01: End-to-end customer journey

Given a seeded customer account and active product, the customer can:

1. Log in.
2. Find a product.
3. Open the product detail page.
4. Add a valid quantity to the cart.
5. Select an address.
6. Complete simulated successful payment.
7. Create an order.
8. View the order confirmation.
9. View the order in order history.

### AC-02: Safe stock handling

Given a product with stock quantity `1`, a customer attempting to buy quantity `2` receives a clear conflict response and stock remains `1`.

Two concurrent attempts to buy the final unit must not result in negative stock. At most one may succeed.

### AC-03: Idempotent checkout

Given the same customer, cart, and idempotency key, repeating the checkout request does not create a second order or deduct stock twice.

### AC-04: Payment failure

Given a failed or cancelled simulated payment, the order and payment records show the correct state and inventory remains consistent according to the documented implementation.

### AC-05: Authorization

A customer request to an admin endpoint returns `403 Forbidden` and does not change data.

### AC-06: Valid state transitions

An administrator can move an order through valid states, but invalid transitions are rejected with a clear business error.

### AC-07: Reconciled reporting

Dashboard totals are calculated from the same order records visible in the admin order view and follow a documented revenue rule.

### AC-08: Reproducible setup

A reviewer can follow the README to:

- Configure the environment.
- Create or connect to PostgreSQL.
- Run migrations.
- Seed demo data.
- Start the client and server.
- Run tests.

---

## 9. Success metrics

The MVP is successful when:

- The primary customer journey works without manual database changes.
- Critical business rules are enforced server-side.
- Stock cannot become negative.
- Duplicate checkout cannot create duplicate orders.
- Admin actions are protected and auditable.
- Tests cover the important success and failure cases.
- A clean setup can reproduce the application.
- The developer can explain the architecture and modify it during a walkthrough.

---

## 10. Assumptions and limitations

- Payment is simulated.
- Shipping and tax may use simple configurable rules.
- Products use a single stock quantity unless variants are essential.
- Product images may be represented by URLs or placeholders.
- Deployment may be local-only.
- Demo users are created through seed data.
- No real personal, payment, or production credentials are used.

