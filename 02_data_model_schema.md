# 02_data_model_schema.md
Tour Reservations SaaS — Multi-Tenant (Supabase/Postgres) — Schema v1 (MVP Manual)

> This document is **self-contained** and defines the **complete database schema** for the MVP:
> - Tables, columns, types
> - PK/FK
> - Constraints and indexes
> - Validity range non-overlap for prices (EXCLUDE constraint)
> - Snapshot pricing model
> - Adjustments
> - Manual payments + manual refunds (accounting consistency)
> - Overbooking metadata
> - Audit log
> - RLS (tenant isolation policies) — exact approach and policy templates

---

## 1) Global Principles & Conventions

### 1.1 Multi-tenancy
- All business/domain tables MUST include: `agency_id uuid NOT NULL`.
- Cross-tenant access MUST be prevented via:
  - Backend RBAC (primary)
  - Postgres RLS tenant isolation (secondary defense)

### 1.2 Primary keys
- Use `uuid` PKs for all tables.
- Default PK: `uuid_generate_v4()`.

### 1.3 Timestamps
- Use `timestamptz` for created/updated timestamps.
- Default `created_at = now()`.

### 1.4 Soft deletes
- Operational/product tables use `active boolean` rather than physical deletes when appropriate:
  - tours, tour_items, passenger_categories, price_books, rules
- Reservations/payments/refunds/audit should be immutable (no deletes).

### 1.5 Snapshot immutability
- Reservation pricing is stored as snapshot lines:
  - `reservation_items.unit_price_snapshot`, `total_price_snapshot`
- Catalog changes MUST NOT change past reservations.

---

## 2) Required Postgres Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
```

---

## 3) ENUM Types

### 3.1 currency_code

```sql
DO $$ BEGIN
  CREATE TYPE currency_code AS ENUM ('USD', 'ARS');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
```

### 3.2 reservation_status

```sql
DO $$ BEGIN
  CREATE TYPE reservation_status AS ENUM (
    'DRAFT',
    'RESERVED',
    'PARTIALLY_PAID',
    'PAID',
    'CONFIRMED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
```

### 3.3 tour_item_kind

```sql
DO $$ BEGIN
  CREATE TYPE tour_item_kind AS ENUM ('BASE','FEE','ADDON');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
```

### 3.4 charge_type

```sql
DO $$ BEGIN
  CREATE TYPE charge_type AS ENUM ('PER_PERSON','PER_BOOKING');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
```

### 3.5 payment_method

```sql
DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('CASH','TRANSFER','CARD','OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
```

### 3.6 departure_status

```sql
DO $$ BEGIN
  CREATE TYPE departure_status AS ENUM ('ACTIVE','CLOSED','CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
```

### 3.7 payment_status

```sql
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('RECEIVED','VOID');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
```

### 3.8 adjustment_type

```sql
DO $$ BEGIN
  CREATE TYPE adjustment_type AS ENUM (
    'OVERRIDE_UNIT_PRICE',
    'DISCOUNT_AMOUNT',
    'DISCOUNT_PERCENT',
    'SURCHARGE_AMOUNT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
```

---

## 4) Tenancy & Users

### 4.1 agencies

```sql
CREATE TABLE IF NOT EXISTS agencies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  default_currency currency_code NOT NULL DEFAULT 'USD',
  timezone text NOT NULL DEFAULT 'America/Argentina/Ushuaia',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_agencies_name ON agencies (name);
```

### 4.2 profiles (optional mirror; auth.users is source of truth)

In Supabase, users exist in `auth.users`. This table stores app-specific profile info.

```sql
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY, -- must match auth.users.id
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 4.3 agency_users (membership + role)

```sql
CREATE TABLE IF NOT EXISTS agency_users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL,         -- OWNER | STAFF | STAFF_PRICING | VIEWER
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_users_agency_id ON agency_users (agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_users_user_id ON agency_users (user_id);
```

---

## 5) Tours & Tour Items

### 5.1 tours

```sql
CREATE TABLE IF NOT EXISTS tours (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,

  code text,                  -- optional stable identifier (slug-ish)
  name text NOT NULL,
  description text,
  duration_minutes int,

  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tours_agency_id ON tours (agency_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tours_agency_code
  ON tours (agency_id, code)
  WHERE code IS NOT NULL;
```

### 5.2 tour_items

```sql
CREATE TABLE IF NOT EXISTS tour_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  tour_id uuid NOT NULL REFERENCES tours(id) ON DELETE CASCADE,

  code text NOT NULL,              -- e.g. BASE_TOUR, HARBERTON, PORT_FEE, TRAIN_OPTION
  name text NOT NULL,
  kind tour_item_kind NOT NULL,
  charge_type charge_type NOT NULL,
  is_optional boolean NOT NULL DEFAULT false,
  default_quantity int NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (agency_id, tour_id, code),
  CHECK (default_quantity >= 1)
);

CREATE INDEX IF NOT EXISTS idx_tour_items_tour_id ON tour_items (tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_items_agency_id ON tour_items (agency_id);
```

---

## 6) Passenger Categories (Adult/Child/Infant)

### 6.1 passenger_categories

```sql
CREATE TABLE IF NOT EXISTS passenger_categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,

  code text NOT NULL,                  -- ADULT | CHILD | INFANT (configurable per agency)
  name text NOT NULL,
  min_age_years int,
  max_age_years int,

  base_price_multiplier numeric(6,3) NOT NULL DEFAULT 1.000,
  occupies_capacity boolean NOT NULL DEFAULT true,

  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (agency_id, code),
  CHECK (base_price_multiplier >= 0),
  CHECK (min_age_years IS NULL OR min_age_years >= 0),
  CHECK (max_age_years IS NULL OR max_age_years >= 0),
  CHECK (min_age_years IS NULL OR max_age_years IS NULL OR min_age_years <= max_age_years)
);

CREATE INDEX IF NOT EXISTS idx_passenger_categories_agency_id
  ON passenger_categories (agency_id);
```

---

## 7) Pricing (USD/ARS + validity ranges + non-overlap)

### 7.1 price_books

One row per agency per currency.

```sql
CREATE TABLE IF NOT EXISTS price_books (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,

  currency currency_code NOT NULL,
  name text NOT NULL DEFAULT 'default',

  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (agency_id, currency, name)
);

CREATE INDEX IF NOT EXISTS idx_price_books_agency_id ON price_books (agency_id);
```

### 7.2 tour_item_prices

Validity is based on departure date. Prices must not overlap for the same item+price_book.

```sql
CREATE TABLE IF NOT EXISTS tour_item_prices (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,

  tour_item_id uuid NOT NULL REFERENCES tour_items(id) ON DELETE RESTRICT,
  price_book_id uuid NOT NULL REFERENCES price_books(id) ON DELETE RESTRICT,

  valid_from date NOT NULL,
  valid_to date, -- null means infinity
  unit_price numeric(12,2) NOT NULL,

  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CHECK (unit_price >= 0),
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

-- Range column to enforce non-overlap
ALTER TABLE tour_item_prices
  ADD COLUMN IF NOT EXISTS valid_range daterange
  GENERATED ALWAYS AS (daterange(valid_from, COALESCE(valid_to, 'infinity'::date), '[]')) STORED;

-- Indexes for fast resolution
CREATE INDEX IF NOT EXISTS idx_tip_item_book_validfrom
  ON tour_item_prices (tour_item_id, price_book_id, valid_from DESC);

CREATE INDEX IF NOT EXISTS idx_tip_agency_id
  ON tour_item_prices (agency_id);

-- Non-overlapping constraint for active prices of same (tour_item, price_book)
DO $$ BEGIN
  ALTER TABLE tour_item_prices
    ADD CONSTRAINT tour_item_prices_no_overlap
    EXCLUDE USING gist (
      tour_item_id WITH =,
      price_book_id WITH =,
      valid_range WITH &&
    )
    WHERE (active = true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
```

### 7.3 tour_item_category_rules

For FEE/ADDON items: per-category multiplier override (e.g., Harberton CHILD=0).
BASE discounts are handled via `passenger_categories.base_price_multiplier`, not here.

```sql
CREATE TABLE IF NOT EXISTS tour_item_category_rules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,

  tour_item_id uuid NOT NULL REFERENCES tour_items(id) ON DELETE CASCADE,
  passenger_category_id uuid NOT NULL REFERENCES passenger_categories(id) ON DELETE CASCADE,

  multiplier numeric(6,3) NOT NULL DEFAULT 1.000, -- commonly 0 or 1
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (agency_id, tour_item_id, passenger_category_id),
  CHECK (multiplier >= 0)
);

CREATE INDEX IF NOT EXISTS idx_ticr_item_id ON tour_item_category_rules (tour_item_id);
CREATE INDEX IF NOT EXISTS idx_ticr_category_id ON tour_item_category_rules (passenger_category_id);
```

---

## 8) Departures (Schedules + capacity)

### 8.1 tour_departures

```sql
CREATE TABLE IF NOT EXISTS tour_departures (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,

  tour_id uuid NOT NULL REFERENCES tours(id) ON DELETE CASCADE,

  start_at timestamptz NOT NULL,  -- date+time of departure
  capacity_total int NOT NULL,

  status departure_status NOT NULL DEFAULT 'ACTIVE',
  notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CHECK (capacity_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_departures_agency_start
  ON tour_departures (agency_id, start_at);

CREATE INDEX IF NOT EXISTS idx_departures_tour_start
  ON tour_departures (tour_id, start_at);
```

> `capacity_used` is NOT stored; it is derived via queries (see §14).

---

## 9) Customers

### 9.1 customers

```sql
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,

  full_name text NOT NULL,
  email text,
  phone text,
  lodging_address text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_agency_email ON customers (agency_id, email);
CREATE INDEX IF NOT EXISTS idx_customers_agency_phone ON customers (agency_id, phone);
```

---

## 10) Reservations (Core)

### 10.1 reservations

```sql
CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,

  departure_id uuid NOT NULL REFERENCES tour_departures(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,

  status reservation_status NOT NULL DEFAULT 'RESERVED',
  currency currency_code NOT NULL,

  -- snapshot totals
  total_snapshot numeric(12,2) NOT NULL DEFAULT 0,
  total_final numeric(12,2) NOT NULL DEFAULT 0,

  -- accounting (optional caches; can be derived but useful for speed)
  total_paid numeric(12,2) NOT NULL DEFAULT 0,
  total_refunded numeric(12,2) NOT NULL DEFAULT 0,
  net_paid numeric(12,2) NOT NULL DEFAULT 0,
  balance_due numeric(12,2) NOT NULL DEFAULT 0,

  notes text,

  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Overbook metadata (controlled exception)
  capacity_override boolean NOT NULL DEFAULT false,
  capacity_override_reason text,
  capacity_override_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  capacity_override_at timestamptz,

  -- Validation helpers
  CHECK (total_snapshot >= 0),
  CHECK (total_final >= 0),
  CHECK (total_paid >= 0),
  CHECK (total_refunded >= 0),
  CHECK (net_paid >= 0),
  CHECK (balance_due >= 0)
);

CREATE INDEX IF NOT EXISTS idx_reservations_agency_status
  ON reservations (agency_id, status);

CREATE INDEX IF NOT EXISTS idx_reservations_departure
  ON reservations (departure_id);

CREATE INDEX IF NOT EXISTS idx_reservations_created_at
  ON reservations (created_at DESC);
```

> **Note:** For consistency, backend updates the accounting caches (`total_paid`/`refunded`/`net`/`balance`) whenever payments/refunds change. Alternatively, create a view; MVP can keep caches to simplify UI and filters.

### 10.2 reservation_passengers

```sql
CREATE TABLE IF NOT EXISTS reservation_passengers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,

  first_name text NOT NULL,
  last_name text NOT NULL,
  birth_date date,

  document_id text NOT NULL,       -- passport/ID; required
  category_code text NOT NULL,     -- snapshot code e.g. ADULT/CHILD/INFANT

  email text,
  phone text,
  lodging_address text,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (reservation_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_res_passengers_reservation
  ON reservation_passengers (reservation_id);
```

### 10.3 reservation_items (pricing snapshot lines)

```sql
CREATE TABLE IF NOT EXISTS reservation_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,

  tour_item_id uuid NOT NULL REFERENCES tour_items(id) ON DELETE RESTRICT,

  -- snapshot fields (do not depend on future catalog changes)
  name_snapshot text NOT NULL,
  kind_snapshot tour_item_kind NOT NULL,
  charge_type_snapshot charge_type NOT NULL,
  is_optional_snapshot boolean NOT NULL,

  quantity int NOT NULL,
  unit_price_snapshot numeric(12,2) NOT NULL,
  total_price_snapshot numeric(12,2) NOT NULL,

  pricing_meta jsonb NOT NULL DEFAULT '{}'::jsonb, -- currency, price_book_id, validity, etc.
  created_at timestamptz NOT NULL DEFAULT now(),

  CHECK (quantity >= 0),
  CHECK (unit_price_snapshot >= 0),
  CHECK (total_price_snapshot >= 0)
);

CREATE INDEX IF NOT EXISTS idx_res_items_reservation
  ON reservation_items (reservation_id);
```

> Quantity can be 0 for optional lines not selected if you choose to keep them. MVP recommended: only create lines that apply (mandatory + selected addons), quantity >= 1.

---

## 11) Adjustments (Modify reservation price after creation, auditable)

### 11.1 reservation_item_adjustments

```sql
CREATE TABLE IF NOT EXISTS reservation_item_adjustments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_item_id uuid NOT NULL REFERENCES reservation_items(id) ON DELETE CASCADE,

  type adjustment_type NOT NULL,
  amount numeric(12,2) NOT NULL, -- interpretation depends on type (percent vs amount)
  reason text NOT NULL,

  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),

  CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_adjustments_item
  ON reservation_item_adjustments (reservation_item_id);
```

> Backend computes impact to update `reservation.total_final`.
> **Rule:** Any recalculation of reservation snapshot deletes adjustments (MVP strict rule).

---

## 12) Manual Payments & Refunds (Accounting only)

### 12.1 payments

```sql
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,

  status payment_status NOT NULL DEFAULT 'RECEIVED',
  amount numeric(12,2) NOT NULL,
  currency currency_code NOT NULL,
  method payment_method NOT NULL,
  reference text,
  received_at timestamptz NOT NULL DEFAULT now(),

  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),

  CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_payments_reservation
  ON payments (reservation_id);
```

### 12.2 payment_refunds

```sql
CREATE TABLE IF NOT EXISTS payment_refunds (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,

  amount numeric(12,2) NOT NULL,
  reason text NOT NULL,

  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),

  CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_refunds_payment
  ON payment_refunds (payment_id);
```

> Backend MUST ensure: a payment is not refunded above its amount in total (`sum(refunds) <= payment.amount`). Enforce in backend; optional trigger later.

---

## 13) Audit Log

### 13.1 audit_log

```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,

  entity_type text NOT NULL,   -- 'reservation', 'departure', 'tour', 'pricing', etc.
  entity_id uuid NOT NULL,

  action text NOT NULL,        -- 'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'OVERRIDE', 'RECALCULATE'
  changes jsonb NOT NULL DEFAULT '{}'::jsonb, -- {before:{}, after:{}} or custom event payload

  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_agency_entity
  ON audit_log (agency_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_created_at
  ON audit_log (created_at DESC);
```

---

## 14) Derived Queries (Capacity + Price Resolution)

### 14.1 capacity_used for a departure (conceptual query)

Counts passengers that occupy capacity for active reservations.

```sql
-- :departure_id
SELECT COALESCE(SUM(CASE WHEN pc.occupies_capacity THEN 1 ELSE 0 END), 0) AS capacity_used
FROM reservations r
JOIN reservation_passengers rp ON rp.reservation_id = r.id
JOIN passenger_categories pc
  ON pc.agency_id = r.agency_id
 AND pc.code = rp.category_code
WHERE r.departure_id = :departure_id
  AND r.status IN ('RESERVED','PARTIALLY_PAID','PAID','CONFIRMED');
```

### 14.2 capacity_remaining

```sql
SELECT d.capacity_total
     - COALESCE(used.capacity_used, 0) AS capacity_remaining
FROM tour_departures d
LEFT JOIN (
  SELECT r.departure_id, COUNT(*) AS capacity_used
  FROM reservations r
  JOIN reservation_passengers rp ON rp.reservation_id = r.id
  JOIN passenger_categories pc
    ON pc.agency_id = r.agency_id
   AND pc.code = rp.category_code
  WHERE r.status IN ('RESERVED','PARTIALLY_PAID','PAID','CONFIRMED')
    AND pc.occupies_capacity = true
  GROUP BY r.departure_id
) used ON used.departure_id = d.id
WHERE d.id = :departure_id;
```

### 14.3 Price resolution for an item for a given date + currency (conceptual query)

```sql
-- :tour_item_id, :price_book_id, :date
SELECT tip.*
FROM tour_item_prices tip
WHERE tip.tour_item_id = :tour_item_id
  AND tip.price_book_id = :price_book_id
  AND tip.active = true
  AND tip.valid_from <= :date
  AND (tip.valid_to IS NULL OR tip.valid_to >= :date)
ORDER BY tip.valid_from DESC
LIMIT 1;
```

---

## 15) RLS (Row Level Security) — Tenant Isolation

### 15.1 Strategy

- RLS is used as **secondary defense** to prevent cross-agency access.
- Business permissions (role) are enforced in backend.
- RLS policies only check membership in `agency_users`.

### 15.2 Helper membership rule (concept)

User can access rows where:

> `row.agency_id` belongs to an agency where user is `ACTIVE`.

### 15.3 Enable RLS on all tenant tables

```sql
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE passenger_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_item_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_item_category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_departures ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_item_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
```

### 15.4 Policy template (SELECT) — example for reservations

```sql
DROP POLICY IF EXISTS reservations_select ON reservations;

CREATE POLICY reservations_select
ON reservations
FOR SELECT
USING (
  agency_id IN (
    SELECT au.agency_id
    FROM agency_users au
    WHERE au.user_id = auth.uid()
      AND au.status = 'ACTIVE'
  )
);
```

### 15.5 Policy template (INSERT/UPDATE/DELETE) — example for reservations

```sql
DROP POLICY IF EXISTS reservations_insert ON reservations;
DROP POLICY IF EXISTS reservations_update ON reservations;
DROP POLICY IF EXISTS reservations_delete ON reservations;

CREATE POLICY reservations_insert
ON reservations
FOR INSERT
WITH CHECK (
  agency_id IN (
    SELECT au.agency_id
    FROM agency_users au
    WHERE au.user_id = auth.uid()
      AND au.status = 'ACTIVE'
  )
);

CREATE POLICY reservations_update
ON reservations
FOR UPDATE
USING (
  agency_id IN (
    SELECT au.agency_id
    FROM agency_users au
    WHERE au.user_id = auth.uid()
      AND au.status = 'ACTIVE'
  )
)
WITH CHECK (
  agency_id IN (
    SELECT au.agency_id
    FROM agency_users au
    WHERE au.user_id = auth.uid()
      AND au.status = 'ACTIVE'
  )
);

CREATE POLICY reservations_delete
ON reservations
FOR DELETE
USING (
  agency_id IN (
    SELECT au.agency_id
    FROM agency_users au
    WHERE au.user_id = auth.uid()
      AND au.status = 'ACTIVE'
  )
);
```

> Repeat the same policy pattern for all tenant tables.

### 15.6 Important note about backend

For the MVP, the backend will typically use the **Supabase Service Role key** to perform DB operations.
RLS is still recommended for defense-in-depth and to keep future direct DB access safe.

---

## 16) Integrity & Operational Rules (Must be enforced by backend)

- Capacity checks must be done **transactionally** when moving to `RESERVED` or modifying passengers.
- Overbook requires privileged permission and reason, stored in `reservation` + audit.
- Price non-overlap is enforced by `EXCLUDE` constraint.
- Reservation snapshot is rebuilt on structural changes (departure date/day, currency, passengers, addons).
- Adjustments are removed on snapshot rebuild (MVP strict).
- `Sum(refunds)` must not exceed payment amount (enforce in backend).
- Reservation accounting totals must remain consistent: `total_paid`, `total_refunded`, `net_paid`, `balance_due`.
- Deleting historical rows is not allowed (payments/refunds/audit/reservations should not be deleted).

---

## 17) Recommended Views (Optional but useful)

### 17.1 departure_capacity_view (optional)

Provides per-departure `capacity_used` and remaining for fast listing.

Implement as `VIEW` or computed in backend. MVP can compute in backend; view can be added later.

---

## 18) Notes on Migration/Portability

Schema uses standard Postgres features + `btree_gist`.

No reliance on Supabase-specific computed APIs.

Moving to custom Postgres later is straightforward:
- dump/restore
- reconfigure auth separately
- keep same schema and constraints
