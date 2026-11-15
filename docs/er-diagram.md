# Kickstead data model

Source of truth: [`database/prisma/schema.prisma`](../database/prisma/schema.prisma) and the SQL migrations in [`database/prisma/migrations/`](../database/prisma/migrations/). PostgreSQL on Supabase. Money is integer paise; timestamps are `timestamptz`; primary keys are UUIDs.

```mermaid
erDiagram
    USERS ||--o{ ADDRESSES : owns
    USERS ||--o| CARTS : has
    CARTS ||--o{ CART_ITEMS : contains
    PRODUCTS ||--o{ CART_ITEMS : "in"
    CATEGORIES ||--o{ PRODUCTS : groups
    USERS ||--o{ ORDERS : places
    ORDERS ||--|{ ORDER_ITEMS : contains
    PRODUCTS |o--o{ ORDER_ITEMS : "copied into"
    ORDERS ||--|| PAYMENTS : has
    PRODUCTS ||--o{ INVENTORY_MOVEMENTS : "stock changes"
    ORDERS |o--o{ INVENTORY_MOVEMENTS : causes
    USERS |o--o{ INVENTORY_MOVEMENTS : "made by"
    USERS |o--o{ AUDIT_LOGS : performs

    USERS {
        uuid id PK "= Supabase auth user id"
        varchar email UK
        varchar name
        enum role "CUSTOMER | ADMIN"
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }
    CATEGORIES {
        uuid id PK
        varchar name UK
        varchar slug UK
        text description
        boolean is_active
    }
    PRODUCTS {
        uuid id PK
        uuid category_id FK
        varchar name
        varchar slug UK
        varchar brand
        text description
        int price_paise "CHECK >= 0"
        int stock_quantity "CHECK >= 0"
        text image_url
        boolean is_active
        boolean is_featured
    }
    ADDRESSES {
        uuid id PK
        uuid user_id FK "ON DELETE CASCADE"
        varchar full_name
        varchar phone
        varchar line1
        varchar line2
        varchar city
        varchar state
        varchar postal_code
        varchar country
        boolean is_default "one per user (partial unique)"
    }
    CARTS {
        uuid id PK
        uuid user_id FK,UK "one cart per user"
    }
    CART_ITEMS {
        uuid id PK
        uuid cart_id FK "ON DELETE CASCADE"
        uuid product_id FK
        int quantity "CHECK > 0"
    }
    ORDERS {
        uuid id PK
        varchar order_number UK "KS-YYYYMMDD-XXXXXX"
        uuid user_id FK
        enum status "PLACED … DELIVERED"
        jsonb address_snapshot
        int subtotal_paise "CHECK >= 0"
        int discount_paise "CHECK >= 0"
        int tax_paise "CHECK >= 0"
        int shipping_paise "CHECK >= 0"
        int total_paise "CHECK = sub - disc + tax + ship"
        char currency "INR"
        varchar idempotency_key "UNIQUE(user_id, key)"
        timestamptz cancelled_at
        varchar cancel_reason
    }
    ORDER_ITEMS {
        uuid id PK
        uuid order_id FK "ON DELETE CASCADE"
        uuid product_id FK "nullable, ON DELETE SET NULL"
        varchar product_name_snapshot
        text product_image_snapshot
        int unit_price_paise "CHECK >= 0"
        int quantity "CHECK > 0"
        int line_total_paise "CHECK = unit x qty"
    }
    PAYMENTS {
        uuid id PK
        uuid order_id FK,UK
        enum status "PENDING | SUCCEEDED | FAILED | CANCELLED | REFUNDED"
        int amount_paise "CHECK >= 0"
        varchar provider "SIMULATED"
        varchar provider_reference UK
    }
    INVENTORY_MOVEMENTS {
        uuid id PK
        uuid product_id FK
        int quantity_change "CHECK <> 0"
        int stock_after "CHECK >= 0"
        enum reason "ORDER_RESERVED | ORDER_RELEASED | ORDER_CANCELLED | ADMIN_ADJUSTMENT | SEED"
        uuid order_id FK "nullable"
        uuid actor_user_id FK "nullable"
        varchar note
    }
    AUDIT_LOGS {
        uuid id PK
        uuid actor_user_id FK "nullable"
        varchar action
        varchar entity_type "ORDER | PRODUCT | CATEGORY"
        uuid entity_id
        jsonb metadata "no secrets"
    }
```

Every table also has `created_at`. Mutable tables have `updated_at`. Attributes are abbreviated in the diagram where obvious.

## Rules enforced by the database itself

| Rule | How |
|---|---|
| Stock never goes negative | `CHECK (stock_quantity >= 0)` on `products` and `CHECK (stock_after >= 0)` on movements, plus row locks and a conditional `UPDATE` in the app |
| Money is never negative and totals add up | `CHECK`s on every `*_paise` column; `total_paise = subtotal − discount + tax + shipping`; `line_total_paise = unit_price × quantity` |
| A checkout request can't create two orders | `UNIQUE (user_id, idempotency_key)` on `orders` |
| A customer can't reserve stock twice with parallel checkouts | Partial unique index `orders_one_placed_per_user ON orders(user_id) WHERE status = 'PLACED'` |
| One default address per customer | Partial unique index `addresses_one_default_per_user ON addresses(user_id) WHERE is_default` |
| One cart per user, one line per product | `UNIQUE (user_id)` on `carts`; `UNIQUE (cart_id, product_id)` on `cart_items` |
| Past orders don't change | Orders store copies of the address (`address_snapshot` JSONB) and of each item's name, image and unit price. `order_items.product_id` becomes `NULL` if a product is ever deleted. |
| Supabase's REST API can't read or write data | Row-level security is enabled with no policies on all 12 tables (including `_prisma_migrations`). The backend connects as the table owner through Prisma. |

## Indexes for common queries

- `products (is_active, created_at)` and `products (is_active, price_paise)` for catalogue sorting; `products (category_id)`; `products (stock_quantity)` for low stock
- `orders (user_id, created_at)` for order history; `orders (status, created_at)` for admin filters; `orders (created_at)`
- `inventory_movements (product_id, created_at)` and `(order_id)`; `audit_logs (created_at)`, `(entity_type, entity_id)`, `(actor_user_id)`
- Foreign-key indexes on `addresses.user_id`, `cart_items.product_id`, `order_items.order_id` and `order_items.product_id`

## Inventory ledger

`inventory_movements` is append-only. For every product, the sum of `quantity_change` equals `products.stock_quantity`, and each row's `stock_after` is the running total. `journey.test.ts` checks this across reservations, released payments, cancellations, refunds and admin adjustments.
