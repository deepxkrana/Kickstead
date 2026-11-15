# Kickstead API reference

Base URL: `/api`. In development the Vite server forwards it to `http://localhost:4000`. In production the Vercel rewrite forwards it to the EC2 backend.

All request and response bodies are JSON. Money is always **integer paise** (₹1 = 100 paise). Timestamps are ISO-8601 UTC strings. IDs are UUIDs.

---

## Conventions

### Authentication

Sign-in happens in the browser through Supabase Auth (Google OAuth, or email and password for the demo accounts). Send the Supabase access token on every protected request:

```http
Authorization: Bearer <supabase-access-token>
```

The API checks the token's signature against Supabase's public keys (ES256 via JWKS), plus its issuer, audience (`authenticated`) and expiry. A user's role (`CUSTOMER` or `ADMIN`) comes from the `users` table, never from the token.

| Access level | Meaning |
|---|---|
| Public | No token needed |
| Signed in | Any valid token. The user's row is created on first use. |
| Owner | Signed in, and the resource belongs to the caller. Other people's resources return `404`. |
| Admin | Signed in with role `ADMIN`. Customers get `403`. |

### Responses

```jsonc
// Single resource
{ "data": { … } }

// List
{ "data": [ … ], "meta": { "page": 1, "limit": 12, "total": 11, "totalPages": 1 } }
```

Every response carries `X-Request-Id` and `Cache-Control: no-store`. Requests may send `X-Request-Id` (8–64 characters, `[A-Za-z0-9-]`); it's reused for log correlation.

### Errors

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "One or more products are no longer available in the requested quantity.",
    "details": { "items": [{ "productId": "…", "name": "Rebound Mid", "available": 1, "requested": 2 }] }
  }
}
```

| Status | Codes |
|---|---|
| 400 | `VALIDATION_ERROR` (`details.issues[]` lists `{ path, message }`), `INVALID_JSON`, `BAD_REQUEST` |
| 401 | `UNAUTHENTICATED` (no or malformed token), `INVALID_TOKEN`, `TOKEN_EXPIRED` |
| 403 | `FORBIDDEN` (wrong role), `ACCOUNT_DISABLED` |
| 404 | `NOT_FOUND`, `ROUTE_NOT_FOUND`, `ORDER_NOT_FOUND`, `ADDRESS_NOT_FOUND`, `CART_ITEM_NOT_FOUND` |
| 409 | `INSUFFICIENT_STOCK`, `PENDING_ORDER_EXISTS`, `INVALID_STATUS_TRANSITION`, `ORDER_NOT_CANCELLABLE`, `ACCOUNT_CONFLICT`, `PRODUCT_SLUG_TAKEN`, `PRODUCT_NAME_TAKEN`, `CATEGORY_SLUG_TAKEN`, `CATEGORY_NAME_TAKEN`, `UNIQUE_CONSTRAINT`, `FOREIGN_KEY_CONSTRAINT`, `CONSTRAINT_VIOLATION` |
| 413 | `PAYLOAD_TOO_LARGE` (body over 100 KB) |
| 422 | `CART_EMPTY`, `PRODUCT_UNAVAILABLE`, `QUANTITY_LIMIT`, `ADDRESS_LIMIT`, `DEFAULT_ADDRESS_REQUIRED`, `CATEGORY_NOT_FOUND`, `STOCK_NEGATIVE`, `NO_CHANGE`, `PAYMENT_STATUS_NOT_ADMIN` |
| 429 | `RATE_LIMITED`. See the `RateLimit` and `RateLimit-Policy` headers. |
| 500 | `INTERNAL_ERROR`. `details.requestId` matches the server log line. Stack traces are never returned. |
| 503 | `AUTH_UNAVAILABLE`: Supabase's signing keys couldn't be fetched. Retry; don't sign the user out. |

### Request validation

- Bodies are **strict**: unknown fields are rejected with `400`. Clients therefore can't send prices, totals, stock or roles.
- Query parameters are validated and type-converted. Unknown query parameters are ignored.
- `page` is ≥ 1 and ≤ 10,000. `limit` is capped per endpoint.
- Search terms are literal: `%` and `_` aren't treated as wildcards.

### Rate limits

| Scope | Limit |
|---|---|
| All `/api` requests | 300 per minute per client IP |
| `POST /checkout`, `POST /orders/:id/payment`, `POST /orders/:id/cancel` | 20 per minute per user |

---

## Health

### `GET /health` (public)

`200 { "status": "ok", "database": "up" }`, or `503 { "status": "degraded", "database": "down" }`.

---

## Auth and profile

### `GET /auth/me` (signed in)

Returns the current user. Creates the `users` row on first call: the role is `ADMIN` if the email is listed in `ADMIN_EMAILS`, otherwise `CUSTOMER`.

```json
{ "data": { "id": "751b…", "email": "customer@kickstead.dev", "name": "Demo Customer", "role": "CUSTOMER" } }
```

There are no register, login or logout endpoints. Supabase Auth handles those in the browser.

### `PATCH /profile` (signed in)

Body: `{ "name": "Asha Rao" }` (1–120 characters). Email and role can't be changed here; sending them gets `400`.

---

## Catalogue (public)

### `GET /categories`

Active categories, sorted by name. Response: `{ data: [{ id, name, slug, description }] }`.

### `GET /products`

Only active products in active categories. Search, filtering, sorting and pagination all run in PostgreSQL.

| Query | Type | Notes |
|---|---|---|
| `q` | string ≤ 100 | Case-insensitive match on name, brand or description |
| `categoryId` | UUID | |
| `category` | slug | Alternative to `categoryId` |
| `minPrice`, `maxPrice` | integer paise | Inclusive. `minPrice ≤ maxPrice`. |
| `sort` | `newest` (default) \| `price_asc` \| `price_desc` \| `name_asc` | Ties broken by id, so pages are stable |
| `featured` | `true` \| `false` | |
| `page`, `limit` | integers | `limit` 1–48, default 12 |

```http
GET /api/products?category=basketball&sort=price_asc&limit=2
```
```json
{
  "data": [
    {
      "id": "9328…", "slug": "voltvale-rebound-mid", "name": "Rebound Mid", "brand": "Volt & Vale",
      "pricePaise": 799900, "stockQuantity": 1, "stockStatus": "LOW_STOCK",
      "imageUrl": "https://images.unsplash.com/…", "isFeatured": false,
      "category": { "id": "…", "name": "Basketball", "slug": "basketball" }
    }
  ],
  "meta": { "page": 1, "limit": 2, "total": 3, "totalPages": 2 }
}
```

`stockStatus` is `IN_STOCK`, `LOW_STOCK` (≤ 5) or `OUT_OF_STOCK`.

### `GET /products/:idOrSlug`

The product summary plus `description`. Inactive products, products in inactive categories, and unknown ids or slugs return `404`.

---

## Cart (signed in, own cart)

Every cart endpoint returns the **full, recalculated cart** using current database prices:

```json
{
  "data": {
    "id": "…",
    "items": [
      {
        "id": "…", "quantity": 2, "lineTotalPaise": 1299800, "issue": null,
        "product": { "id": "…", "slug": "stridewell-tempo-red", "name": "Tempo Runner", "brand": "Stridewell",
                     "imageUrl": "…", "pricePaise": 649900, "stockQuantity": 24, "stockStatus": "IN_STOCK", "isAvailable": true }
      }
    ],
    "itemCount": 2,
    "totals": { "subtotalPaise": 1299800, "discountPaise": 0, "taxPaise": 233964, "shippingPaise": 0, "totalPaise": 1533764 },
    "canCheckout": true
  }
}
```

`issue` is `null`, `UNAVAILABLE`, `OUT_OF_STOCK` or `INSUFFICIENT_STOCK`. `canCheckout` is `false` when the cart is empty or any item has an issue. The totals are an estimate; checkout recalculates them inside its transaction.

| Method and path | Body | Notes |
|---|---|---|
| `GET /cart` | | Returns an empty cart (`id: null`) if none exists yet |
| `POST /cart/items` | `{ productId, quantity? = 1 }` | `201`. Adds to the existing line if the product is already in the cart. Can return `404` (unknown product), `422 PRODUCT_UNAVAILABLE`, `422 QUANTITY_LIMIT` (more than 10 per line), or `409 INSUFFICIENT_STOCK` with `{ available, requested, inCart }`. |
| `PATCH /cart/items/:itemId` | `{ quantity }` (1–10) | Owner only (`404` otherwise). Stock-checked. |
| `DELETE /cart/items/:itemId` | | Owner only |
| `DELETE /cart` | | Clears the cart |

The stock check here gives early feedback only and doesn't reserve stock. Checkout does the final check.

---

## Addresses (signed in, owner)

Fields: `fullName` (≤ 120), `phone` (7–20 digits, spaces, `-`, optional leading `+`), `line1` (≤ 200), `line2?`, `city`, `state`, `postalCode` (3–12 alphanumeric), `country` (default `India`), `isDefault`.

| Method and path | Notes |
|---|---|
| `GET /addresses` | Default first, then newest |
| `POST /addresses` | `201`. The first address always becomes the default. Maximum 10 (`422 ADDRESS_LIMIT`). |
| `PATCH /addresses/:id` | Partial update. `{ "isDefault": true }` switches the default. Un-defaulting the only default gets `422 DEFAULT_ADDRESS_REQUIRED`. |
| `DELETE /addresses/:id` | `204`. Deleting the default promotes the newest remaining address. Orders keep their own copy of the address. |

---

## Checkout (signed in)

### `POST /checkout`

```json
{ "addressId": "8b0c…", "idempotencyKey": "6f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7" }
```

- **Body:** `idempotencyKey` is 8–120 characters (`[A-Za-z0-9._:-]`). Generate one per checkout attempt and reuse it when retrying. Nothing else is accepted.
- **What happens (one transaction):** the address must belong to the caller. The products in the cart are locked (`FOR UPDATE`) and rechecked. Totals are calculated from database prices. Then the order, its items and copies of address and product data, and a `PENDING` payment are created, and stock is reserved and logged.
- **`201`:** a new `PLACED` order.
- **`200` with `Idempotent-Replayed: true`:** this customer already used this key. The original order is returned unchanged, with no new side effects, even if the request body differs.
- **Errors:**

| Status | Code | Details |
|---|---|---|
| 404 | `ADDRESS_NOT_FOUND` | Missing address, or someone else's |
| 422 | `CART_EMPTY` | |
| 422 | `PRODUCT_UNAVAILABLE` | `{ productIds }` |
| 409 | `INSUFFICIENT_STOCK` | `{ items: [{ productId, name, available, requested }] }` |
| 409 | `PENDING_ORDER_EXISTS` | `{ orderId, orderNumber }`. Pay or cancel that order first. |

The order shape is shown below.

---

## Orders (signed in, owner)

### Order object

```json
{
  "data": {
    "id": "…", "orderNumber": "KS-20261113-Z2GZHC", "status": "PAID", "currency": "INR",
    "createdAt": "…", "updatedAt": "…", "cancelledAt": null, "cancelReason": null,
    "totals": { "subtotalPaise": 1299800, "discountPaise": 0, "taxPaise": 233964, "shippingPaise": 0, "totalPaise": 1533764 },
    "address": { "fullName": "Demo Customer", "phone": "+91 98765 43210", "line1": "221 Linking Road", "line2": "Flat 4B…", "city": "Mumbai", "state": "Maharashtra", "postalCode": "400050", "country": "India" },
    "items": [{ "id": "…", "productId": "…", "productSlug": "stridewell-tempo-red", "name": "Tempo Runner", "imageUrl": "…", "unitPricePaise": 649900, "quantity": 2, "lineTotalPaise": 1299800 }],
    "payment": { "status": "SUCCEEDED", "provider": "SIMULATED", "reference": "SIM-…", "amountPaise": 1533764, "updatedAt": "…" },
    "actions": { "canPay": false, "canCancel": true }
  }
}
```

### Status lifecycle

```text
PLACED  → PAID | PAYMENT_FAILED | PAYMENT_CANCELLED | CANCELLED
PAID    → PACKED | CANCELLED
PACKED  → SHIPPED
SHIPPED → DELIVERED
DELIVERED, CANCELLED, PAYMENT_FAILED, PAYMENT_CANCELLED: final
```

Payment status values: `PENDING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `REFUNDED`.

| Method and path | Body | Notes |
|---|---|---|
| `GET /orders` | | Own orders, newest first. `limit` ≤ 50, default 10. Items: `{ id, orderNumber, status, paymentStatus, totalPaise, currency, itemCount, imageUrl, createdAt }`. |
| `GET /orders/:id` | | Order object. Another user's order returns `404`. |
| `POST /orders/:id/payment` | `{ "outcome": "SUCCESS" \| "FAILED" \| "CANCELLED" }` | Simulated gateway; only a `PLACED` order can be paid. See below. |
| `POST /orders/:id/cancel` | `{ "reason"?: string ≤ 300 }`, or no body | Only `PLACED` or `PAID` orders (otherwise `409 ORDER_NOT_CANCELLABLE`). Returns stock. A paid order's payment becomes `REFUNDED` (simulated); an unpaid one becomes `CANCELLED`. |

**Payment outcomes:**
- `SUCCESS` → order `PAID`, payment `SUCCEEDED` with a `SIM-…` reference, and the ordered products are removed from the cart.
- `FAILED` / `CANCELLED` → order `PAYMENT_FAILED` / `PAYMENT_CANCELLED`, reserved stock returned and logged, and the cart is kept.
- Repeating the same outcome returns `200` with `Idempotent-Replayed: true` and no new side effects.
- Any other change gets `409 INVALID_STATUS_TRANSITION`. Each change locks the order row, so a double click or a Pay racing a Cancel applies only once.

---

## Admin (role `ADMIN`)

Every route below requires an admin. Anonymous requests get `401`, customers get `403`, and nothing changes.

### `GET /admin/dashboard`

```json
{
  "data": {
    "totals": { "totalOrders": 6, "paidOrders": 1, "pendingOrders": 0, "toFulfil": 0, "cancelledOrders": 2, "failedPayments": 3, "revenuePaise": 766882 },
    "byStatus": { "PLACED": 0, "PAID": 0, "PACKED": 0, "SHIPPED": 0, "DELIVERED": 1, "CANCELLED": 2, "PAYMENT_FAILED": 2, "PAYMENT_CANCELLED": 1 },
    "revenueRule": "Revenue = sum of order totals (incl. GST and shipping) for orders in PAID, PACKED, SHIPPED or DELIVERED. …",
    "lowStock": { "threshold": 5, "count": 3, "products": [{ "id": "…", "name": "Rebound Mid", "brand": "Volt & Vale", "stockQuantity": 1, "imageUrl": "…" }] },
    "recentOrders": [{ "id": "…", "orderNumber": "…", "status": "DELIVERED", "totalPaise": 766882, "createdAt": "…", "customer": { "name": "…", "email": "…" } }]
  }
}
```

- `paidOrders` counts orders in the revenue statuses.
- `toFulfil` = `PAID` + `PACKED`.
- `failedPayments` = `PAYMENT_FAILED` + `PAYMENT_CANCELLED`.
- All figures come from one grouped query on `orders`, so they match `GET /admin/orders`.

### Products

| Method and path | Body / query | Notes |
|---|---|---|
| `GET /admin/products` | `q` (name, brand or slug), `categoryId`, `status=all\|active\|inactive`, `lowStock=true`, `page`, `limit` | Includes inactive products |
| `GET /admin/products/:id` | | Product plus `movements` (the last 50 stock changes, with order and actor) |
| `POST /admin/products` | `{ name, brand, description (≥ 10 characters), pricePaise, categoryId, slug?, imageUrl?, isActive? = true, isFeatured? = false, initialStock? = 0 }` | `201`. The slug is generated from the name if omitted. Initial stock is logged as `ADMIN_ADJUSTMENT`. Audited (`PRODUCT_CREATED`). |
| `PATCH /admin/products/:id` | any of `name, slug, brand, description, pricePaise, imageUrl, categoryId, isActive, isFeatured` | Stock **can't** be changed here. The audit log records changed fields as before → after (`PRODUCT_UPDATED`). Duplicate slug: `409 PRODUCT_SLUG_TAKEN`. |
| `PATCH /admin/products/:id/stock` | `{ mode: "set" \| "adjust", quantity, note? }` | Locks the product row. A negative result gets `422 STOCK_NEGATIVE`; no change gets `422 NO_CHANGE`. Logged as an `ADMIN_ADJUSTMENT` movement and audited (`INVENTORY_ADJUSTED`). |

### Categories

| Method and path | Body | Notes |
|---|---|---|
| `GET /admin/categories` | | All categories with `productCount` |
| `POST /admin/categories` | `{ name, slug?, description?, isActive? }` | `201`. Audited. |
| `PATCH /admin/categories/:id` | any of `name, slug, description, isActive` | Deactivating hides the category's products from shoppers and blocks their checkout. Audited. |

### Orders

| Method and path | Body / query | Notes |
|---|---|---|
| `GET /admin/orders` | `q` (order number, customer name or email), `status`, `page`, `limit` | Rows include `customer`, `paymentStatus`, `itemCount` |
| `GET /admin/orders/:id` | | Order object plus `customer`, `adminActions.nextStatuses`, `history` (audit entries with actor) and `movements` |
| `PATCH /admin/orders/:id/status` | `{ status: "PACKED" \| "SHIPPED" \| "DELIVERED" \| "CANCELLED", reason? }` | Checked against the lifecycle above (`409 INVALID_STATUS_TRANSITION`). `PAID`, `PAYMENT_FAILED` and `PAYMENT_CANCELLED` get `422 PAYMENT_STATUS_NOT_ADMIN`: payment outcomes only come from the payment flow. `CANCELLED` returns stock and refunds a paid order. Audited. |

### Customers and audit log

| Method and path | Query | Notes |
|---|---|---|
| `GET /admin/customers` | `q` (name or email), `page`, `limit` | Customers only, with `orderCount` |
| `GET /admin/audit-logs` | `action`, `entityType=ORDER\|PRODUCT\|CATEGORY`, `entityId`, `page`, `limit` (≤ 100, default 25) | Newest first, with `actor { id, name, email, role }` and `metadata` (business context only, never secrets) |

Audit actions: `ORDER_CREATED`, `PAYMENT_RECORDED`, `ORDER_STATUS_CHANGED`, `ORDER_CANCELLED`, `PRODUCT_CREATED`, `PRODUCT_UPDATED`, `INVENTORY_ADJUSTED`, `CATEGORY_CREATED`, `CATEGORY_UPDATED`.
