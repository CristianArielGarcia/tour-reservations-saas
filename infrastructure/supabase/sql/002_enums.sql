-- 002_enums.sql
-- All application ENUM types

DO $$ BEGIN
  CREATE TYPE currency_code AS ENUM ('USD', 'ARS');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

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

DO $$ BEGIN
  CREATE TYPE tour_item_kind AS ENUM ('BASE', 'FEE', 'ADDON');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE charge_type AS ENUM ('PER_PERSON', 'PER_BOOKING');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('CASH', 'TRANSFER', 'CARD', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE departure_status AS ENUM ('ACTIVE', 'CLOSED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('RECEIVED', 'VOID');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

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
