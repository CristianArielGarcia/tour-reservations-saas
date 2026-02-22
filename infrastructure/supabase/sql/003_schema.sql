-- 003_schema.sql
-- Complete table schema for Tour Reservations SaaS

-- ─── TENANCY & USERS ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agencies (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            text NOT NULL,
  default_currency currency_code NOT NULL DEFAULT 'USD',
  timezone        text NOT NULL DEFAULT 'America/Argentina/Ushuaia',
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_agencies_name ON agencies (name);

-- profiles mirrors auth.users for app-specific data
CREATE TABLE IF NOT EXISTS profiles (
  id          uuid PRIMARY KEY, -- must match auth.users.id
  full_name   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agency_users (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id  uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       text NOT NULL,       -- OWNER | STAFF | STAFF_PRICING | VIEWER
  status     text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_users_agency_id ON agency_users (agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_users_user_id   ON agency_users (user_id);

-- ─── TOURS & TOUR ITEMS ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tours (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id        uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  code             text,
  name             text NOT NULL,
  description      text,
  duration_minutes int,
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tours_agency_id ON tours (agency_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tours_agency_code
  ON tours (agency_id, code)
  WHERE code IS NOT NULL;

CREATE TABLE IF NOT EXISTS tour_items (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id        uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  tour_id          uuid NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  code             text NOT NULL,
  name             text NOT NULL,
  kind             tour_item_kind NOT NULL,
  charge_type      charge_type NOT NULL,
  is_optional      boolean NOT NULL DEFAULT false,
  default_quantity int NOT NULL DEFAULT 1,
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, tour_id, code),
  CHECK (default_quantity >= 1)
);

CREATE INDEX IF NOT EXISTS idx_tour_items_tour_id   ON tour_items (tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_items_agency_id ON tour_items (agency_id);

-- ─── PASSENGER CATEGORIES ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS passenger_categories (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id            uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  code                 text NOT NULL,
  name                 text NOT NULL,
  min_age_years        int,
  max_age_years        int,
  base_price_multiplier numeric(6,3) NOT NULL DEFAULT 1.000,
  occupies_capacity    boolean NOT NULL DEFAULT true,
  active               boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, code),
  CHECK (base_price_multiplier >= 0),
  CHECK (min_age_years IS NULL OR min_age_years >= 0),
  CHECK (max_age_years IS NULL OR max_age_years >= 0),
  CHECK (min_age_years IS NULL OR max_age_years IS NULL OR min_age_years <= max_age_years)
);

CREATE INDEX IF NOT EXISTS idx_passenger_categories_agency_id
  ON passenger_categories (agency_id);

-- ─── PRICING ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS price_books (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id  uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  currency   currency_code NOT NULL,
  name       text NOT NULL DEFAULT 'default',
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, currency, name)
);

CREATE INDEX IF NOT EXISTS idx_price_books_agency_id ON price_books (agency_id);

CREATE TABLE IF NOT EXISTS tour_item_prices (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id    uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  tour_item_id uuid NOT NULL REFERENCES tour_items(id) ON DELETE RESTRICT,
  price_book_id uuid NOT NULL REFERENCES price_books(id) ON DELETE RESTRICT,
  valid_from   date NOT NULL,
  valid_to     date,  -- null means infinity
  unit_price   numeric(12,2) NOT NULL,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (unit_price >= 0),
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

-- Generated column for non-overlap enforcement
ALTER TABLE tour_item_prices
  ADD COLUMN IF NOT EXISTS valid_range daterange
  GENERATED ALWAYS AS (
    daterange(valid_from, COALESCE(valid_to, 'infinity'::date), '[]')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_tip_item_book_validfrom
  ON tour_item_prices (tour_item_id, price_book_id, valid_from DESC);

CREATE INDEX IF NOT EXISTS idx_tip_agency_id ON tour_item_prices (agency_id);

-- Non-overlapping EXCLUDE constraint — enforces pricing integrity
DO $$ BEGIN
  ALTER TABLE tour_item_prices
    ADD CONSTRAINT tour_item_prices_no_overlap
    EXCLUDE USING gist (
      tour_item_id  WITH =,
      price_book_id WITH =,
      valid_range   WITH &&
    )
    WHERE (active = true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS tour_item_category_rules (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id             uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  tour_item_id          uuid NOT NULL REFERENCES tour_items(id) ON DELETE CASCADE,
  passenger_category_id uuid NOT NULL REFERENCES passenger_categories(id) ON DELETE CASCADE,
  multiplier            numeric(6,3) NOT NULL DEFAULT 1.000,
  active                boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, tour_item_id, passenger_category_id),
  CHECK (multiplier >= 0)
);

CREATE INDEX IF NOT EXISTS idx_ticr_item_id     ON tour_item_category_rules (tour_item_id);
CREATE INDEX IF NOT EXISTS idx_ticr_category_id ON tour_item_category_rules (passenger_category_id);

-- ─── DEPARTURES ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tour_departures (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id      uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  tour_id        uuid NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  start_at       timestamptz NOT NULL,
  capacity_total int NOT NULL,
  status         departure_status NOT NULL DEFAULT 'ACTIVE',
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (capacity_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_departures_agency_start
  ON tour_departures (agency_id, start_at);

CREATE INDEX IF NOT EXISTS idx_departures_tour_start
  ON tour_departures (tour_id, start_at);

-- ─── CUSTOMERS ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id       uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  full_name       text NOT NULL,
  email           text,
  phone           text,
  lodging_address text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_agency_email ON customers (agency_id, email);
CREATE INDEX IF NOT EXISTS idx_customers_agency_phone ON customers (agency_id, phone);

-- ─── RESERVATIONS ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reservations (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id      uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  departure_id   uuid NOT NULL REFERENCES tour_departures(id) ON DELETE RESTRICT,
  customer_id    uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  status         reservation_status NOT NULL DEFAULT 'RESERVED',
  currency       currency_code NOT NULL,

  -- Snapshot totals
  total_snapshot numeric(12,2) NOT NULL DEFAULT 0,
  total_final    numeric(12,2) NOT NULL DEFAULT 0,

  -- Accounting caches (derived, kept consistent by backend)
  total_paid     numeric(12,2) NOT NULL DEFAULT 0,
  total_refunded numeric(12,2) NOT NULL DEFAULT 0,
  net_paid       numeric(12,2) NOT NULL DEFAULT 0,
  balance_due    numeric(12,2) NOT NULL DEFAULT 0,

  notes text,

  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Overbooking metadata
  capacity_override        boolean   NOT NULL DEFAULT false,
  capacity_override_reason text,
  capacity_override_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  capacity_override_at     timestamptz,

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

CREATE TABLE IF NOT EXISTS reservation_passengers (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id  uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  first_name      text NOT NULL,
  last_name       text NOT NULL,
  birth_date      date,
  document_id     text NOT NULL,
  category_code   text NOT NULL,
  email           text,
  phone           text,
  lodging_address text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reservation_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_res_passengers_reservation
  ON reservation_passengers (reservation_id);

CREATE TABLE IF NOT EXISTS reservation_items (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id       uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  tour_item_id         uuid NOT NULL REFERENCES tour_items(id) ON DELETE RESTRICT,
  name_snapshot        text NOT NULL,
  kind_snapshot        tour_item_kind NOT NULL,
  charge_type_snapshot charge_type NOT NULL,
  is_optional_snapshot boolean NOT NULL,
  quantity             int NOT NULL,
  unit_price_snapshot  numeric(12,2) NOT NULL,
  total_price_snapshot numeric(12,2) NOT NULL,
  pricing_meta         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (quantity >= 0),
  CHECK (unit_price_snapshot >= 0),
  CHECK (total_price_snapshot >= 0)
);

CREATE INDEX IF NOT EXISTS idx_res_items_reservation
  ON reservation_items (reservation_id);

-- ─── ADJUSTMENTS ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reservation_item_adjustments (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_item_id uuid NOT NULL REFERENCES reservation_items(id) ON DELETE CASCADE,
  type                adjustment_type NOT NULL,
  amount              numeric(12,2) NOT NULL,
  reason              text NOT NULL,
  created_by          uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_adjustments_item
  ON reservation_item_adjustments (reservation_item_id);

-- ─── PAYMENTS & REFUNDS ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payments (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  status         payment_status NOT NULL DEFAULT 'RECEIVED',
  amount         numeric(12,2) NOT NULL,
  currency       currency_code NOT NULL,
  method         payment_method NOT NULL,
  reference      text,
  received_at    timestamptz NOT NULL DEFAULT now(),
  created_by     uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_payments_reservation ON payments (reservation_id);

CREATE TABLE IF NOT EXISTS payment_refunds (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  amount     numeric(12,2) NOT NULL,
  reason     text NOT NULL,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_refunds_payment ON payment_refunds (payment_id);

-- ─── AUDIT LOG ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id   uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id   uuid NOT NULL,
  action      text NOT NULL,
  changes     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by  uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_agency_entity
  ON audit_log (agency_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_created_at
  ON audit_log (created_at DESC);
