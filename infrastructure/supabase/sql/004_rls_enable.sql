-- 004_rls_enable.sql
-- Enable Row Level Security on all tenant-scoped tables

ALTER TABLE tours                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_items                ENABLE ROW LEVEL SECURITY;
ALTER TABLE passenger_categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_books               ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_item_prices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_item_category_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_departures           ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_passengers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_item_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_refunds           ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log                 ENABLE ROW LEVEL SECURITY;
