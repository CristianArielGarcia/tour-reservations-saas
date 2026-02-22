-- 006_seed_demo.sql
-- Demo seed data for local development/testing
-- Idempotent: uses ON CONFLICT DO NOTHING / DO UPDATE

-- NOTE: Requires a real user in auth.users first. Replace the placeholder UUID
-- with an actual auth user ID before running. The seed.ts script handles this
-- programmatically using the service role key.

-- This file is for reference / manual Supabase SQL editor runs.
-- Use packages/database/prisma/seed.ts for automated seeding.
