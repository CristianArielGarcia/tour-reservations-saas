-- 005_rls_policies.sql
-- RLS policies for tenant isolation (secondary defense — RBAC is primary)
-- Pattern: user may access rows where agency_id is in their active memberships.

-- ─── HELPER MACRO (DRY representation) ───────────────────────────────────────
-- The membership subquery used in all policies:
--   SELECT au.agency_id FROM agency_users au
--   WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'

-- ─── tours ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS tours_select ON tours;
DROP POLICY IF EXISTS tours_insert ON tours;
DROP POLICY IF EXISTS tours_update ON tours;
DROP POLICY IF EXISTS tours_delete ON tours;

CREATE POLICY tours_select ON tours FOR SELECT
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY tours_insert ON tours FOR INSERT
  WITH CHECK (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY tours_update ON tours FOR UPDATE
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'))
  WITH CHECK (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY tours_delete ON tours FOR DELETE
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

-- ─── tour_items ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS tour_items_select ON tour_items;
DROP POLICY IF EXISTS tour_items_insert ON tour_items;
DROP POLICY IF EXISTS tour_items_update ON tour_items;
DROP POLICY IF EXISTS tour_items_delete ON tour_items;

CREATE POLICY tour_items_select ON tour_items FOR SELECT
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY tour_items_insert ON tour_items FOR INSERT
  WITH CHECK (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY tour_items_update ON tour_items FOR UPDATE
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'))
  WITH CHECK (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY tour_items_delete ON tour_items FOR DELETE
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

-- ─── passenger_categories ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS passenger_categories_select ON passenger_categories;
DROP POLICY IF EXISTS passenger_categories_insert ON passenger_categories;
DROP POLICY IF EXISTS passenger_categories_update ON passenger_categories;
DROP POLICY IF EXISTS passenger_categories_delete ON passenger_categories;

CREATE POLICY passenger_categories_select ON passenger_categories FOR SELECT
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY passenger_categories_insert ON passenger_categories FOR INSERT
  WITH CHECK (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY passenger_categories_update ON passenger_categories FOR UPDATE
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'))
  WITH CHECK (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY passenger_categories_delete ON passenger_categories FOR DELETE
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

-- ─── price_books ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS price_books_select ON price_books;
DROP POLICY IF EXISTS price_books_insert ON price_books;
DROP POLICY IF EXISTS price_books_update ON price_books;
DROP POLICY IF EXISTS price_books_delete ON price_books;

CREATE POLICY price_books_select ON price_books FOR SELECT
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY price_books_insert ON price_books FOR INSERT
  WITH CHECK (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY price_books_update ON price_books FOR UPDATE
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'))
  WITH CHECK (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY price_books_delete ON price_books FOR DELETE
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

-- ─── tour_item_prices ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS tour_item_prices_select ON tour_item_prices;
DROP POLICY IF EXISTS tour_item_prices_insert ON tour_item_prices;
DROP POLICY IF EXISTS tour_item_prices_update ON tour_item_prices;
DROP POLICY IF EXISTS tour_item_prices_delete ON tour_item_prices;

CREATE POLICY tour_item_prices_select ON tour_item_prices FOR SELECT
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY tour_item_prices_insert ON tour_item_prices FOR INSERT
  WITH CHECK (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY tour_item_prices_update ON tour_item_prices FOR UPDATE
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'))
  WITH CHECK (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY tour_item_prices_delete ON tour_item_prices FOR DELETE
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

-- ─── tour_item_category_rules ─────────────────────────────────────────────────

DROP POLICY IF EXISTS tour_item_category_rules_select ON tour_item_category_rules;
DROP POLICY IF EXISTS tour_item_category_rules_insert ON tour_item_category_rules;
DROP POLICY IF EXISTS tour_item_category_rules_update ON tour_item_category_rules;
DROP POLICY IF EXISTS tour_item_category_rules_delete ON tour_item_category_rules;

CREATE POLICY tour_item_category_rules_select ON tour_item_category_rules FOR SELECT
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY tour_item_category_rules_insert ON tour_item_category_rules FOR INSERT
  WITH CHECK (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY tour_item_category_rules_update ON tour_item_category_rules FOR UPDATE
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'))
  WITH CHECK (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY tour_item_category_rules_delete ON tour_item_category_rules FOR DELETE
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

-- ─── tour_departures ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS tour_departures_select ON tour_departures;
DROP POLICY IF EXISTS tour_departures_insert ON tour_departures;
DROP POLICY IF EXISTS tour_departures_update ON tour_departures;
DROP POLICY IF EXISTS tour_departures_delete ON tour_departures;

CREATE POLICY tour_departures_select ON tour_departures FOR SELECT
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY tour_departures_insert ON tour_departures FOR INSERT
  WITH CHECK (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY tour_departures_update ON tour_departures FOR UPDATE
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'))
  WITH CHECK (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY tour_departures_delete ON tour_departures FOR DELETE
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

-- ─── customers ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS customers_select ON customers;
DROP POLICY IF EXISTS customers_insert ON customers;
DROP POLICY IF EXISTS customers_update ON customers;
DROP POLICY IF EXISTS customers_delete ON customers;

CREATE POLICY customers_select ON customers FOR SELECT
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY customers_insert ON customers FOR INSERT
  WITH CHECK (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY customers_update ON customers FOR UPDATE
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'))
  WITH CHECK (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY customers_delete ON customers FOR DELETE
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

-- ─── reservations ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS reservations_select ON reservations;
DROP POLICY IF EXISTS reservations_insert ON reservations;
DROP POLICY IF EXISTS reservations_update ON reservations;
DROP POLICY IF EXISTS reservations_delete ON reservations;

CREATE POLICY reservations_select ON reservations FOR SELECT
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY reservations_insert ON reservations FOR INSERT
  WITH CHECK (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY reservations_update ON reservations FOR UPDATE
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'))
  WITH CHECK (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY reservations_delete ON reservations FOR DELETE
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

-- ─── reservation_passengers ───────────────────────────────────────────────────
-- Access via reservation's agency_id

DROP POLICY IF EXISTS reservation_passengers_select ON reservation_passengers;
DROP POLICY IF EXISTS reservation_passengers_insert ON reservation_passengers;
DROP POLICY IF EXISTS reservation_passengers_update ON reservation_passengers;
DROP POLICY IF EXISTS reservation_passengers_delete ON reservation_passengers;

CREATE POLICY reservation_passengers_select ON reservation_passengers FOR SELECT
  USING (reservation_id IN (SELECT r.id FROM reservations r
    WHERE r.agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE')));

CREATE POLICY reservation_passengers_insert ON reservation_passengers FOR INSERT
  WITH CHECK (reservation_id IN (SELECT r.id FROM reservations r
    WHERE r.agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE')));

CREATE POLICY reservation_passengers_update ON reservation_passengers FOR UPDATE
  USING (reservation_id IN (SELECT r.id FROM reservations r
    WHERE r.agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE')));

CREATE POLICY reservation_passengers_delete ON reservation_passengers FOR DELETE
  USING (reservation_id IN (SELECT r.id FROM reservations r
    WHERE r.agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE')));

-- ─── reservation_items ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS reservation_items_select ON reservation_items;
DROP POLICY IF EXISTS reservation_items_insert ON reservation_items;
DROP POLICY IF EXISTS reservation_items_update ON reservation_items;
DROP POLICY IF EXISTS reservation_items_delete ON reservation_items;

CREATE POLICY reservation_items_select ON reservation_items FOR SELECT
  USING (reservation_id IN (SELECT r.id FROM reservations r
    WHERE r.agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE')));

CREATE POLICY reservation_items_insert ON reservation_items FOR INSERT
  WITH CHECK (reservation_id IN (SELECT r.id FROM reservations r
    WHERE r.agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE')));

CREATE POLICY reservation_items_update ON reservation_items FOR UPDATE
  USING (reservation_id IN (SELECT r.id FROM reservations r
    WHERE r.agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE')));

CREATE POLICY reservation_items_delete ON reservation_items FOR DELETE
  USING (reservation_id IN (SELECT r.id FROM reservations r
    WHERE r.agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE')));

-- ─── reservation_item_adjustments ─────────────────────────────────────────────

DROP POLICY IF EXISTS reservation_item_adjustments_select ON reservation_item_adjustments;
DROP POLICY IF EXISTS reservation_item_adjustments_insert ON reservation_item_adjustments;
DROP POLICY IF EXISTS reservation_item_adjustments_delete ON reservation_item_adjustments;

CREATE POLICY reservation_item_adjustments_select ON reservation_item_adjustments FOR SELECT
  USING (reservation_item_id IN (SELECT ri.id FROM reservation_items ri
    JOIN reservations r ON r.id = ri.reservation_id
    WHERE r.agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE')));

CREATE POLICY reservation_item_adjustments_insert ON reservation_item_adjustments FOR INSERT
  WITH CHECK (reservation_item_id IN (SELECT ri.id FROM reservation_items ri
    JOIN reservations r ON r.id = ri.reservation_id
    WHERE r.agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE')));

CREATE POLICY reservation_item_adjustments_delete ON reservation_item_adjustments FOR DELETE
  USING (reservation_item_id IN (SELECT ri.id FROM reservation_items ri
    JOIN reservations r ON r.id = ri.reservation_id
    WHERE r.agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE')));

-- ─── payments ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS payments_select ON payments;
DROP POLICY IF EXISTS payments_insert ON payments;
DROP POLICY IF EXISTS payments_update ON payments;

CREATE POLICY payments_select ON payments FOR SELECT
  USING (reservation_id IN (SELECT r.id FROM reservations r
    WHERE r.agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE')));

CREATE POLICY payments_insert ON payments FOR INSERT
  WITH CHECK (reservation_id IN (SELECT r.id FROM reservations r
    WHERE r.agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE')));

CREATE POLICY payments_update ON payments FOR UPDATE
  USING (reservation_id IN (SELECT r.id FROM reservations r
    WHERE r.agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE')));

-- ─── payment_refunds ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS payment_refunds_select ON payment_refunds;
DROP POLICY IF EXISTS payment_refunds_insert ON payment_refunds;

CREATE POLICY payment_refunds_select ON payment_refunds FOR SELECT
  USING (payment_id IN (SELECT p.id FROM payments p
    JOIN reservations r ON r.id = p.reservation_id
    WHERE r.agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE')));

CREATE POLICY payment_refunds_insert ON payment_refunds FOR INSERT
  WITH CHECK (payment_id IN (SELECT p.id FROM payments p
    JOIN reservations r ON r.id = p.reservation_id
    WHERE r.agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE')));

-- ─── audit_log ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS audit_log_select ON audit_log;
DROP POLICY IF EXISTS audit_log_insert ON audit_log;

CREATE POLICY audit_log_select ON audit_log FOR SELECT
  USING (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));

CREATE POLICY audit_log_insert ON audit_log FOR INSERT
  WITH CHECK (agency_id IN (SELECT au.agency_id FROM agency_users au WHERE au.user_id = auth.uid() AND au.status = 'ACTIVE'));
