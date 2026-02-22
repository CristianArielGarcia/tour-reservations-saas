# 06_business_rules_engine.md
Tour Reservations SaaS (MVP Manual) — Business Rules Engine Specification v1

> This document is **self-contained** and defines the **exact algorithms and rules** the backend must implement:
> - Capacity calculation + validation (including infants and overbook)
> - Pricing resolution (validity ranges, USD/ARS, base multipliers, fee overrides)
> - Snapshot generation and recalculation rules
> - Reservation status derivation from accounting (payments/refunds)
> - Adjustments logic (how they affect totals)
> - Departure edits rules (time/date/capacity)
> - Edge cases and failure codes
>
> No UI concerns here; only deterministic backend rules.

---

## 1) Definitions & Inputs

### 1.1 Core inputs used by rules
- `agency_id`
- `user_id` + `role`
- `departure_id`
- `departure.start_at` (timestamptz)
- `departure.capacity_total` (int)
- `reservation.status`
- `reservation.currency` (USD/ARS)
- `passengers[]` with `category_code`
- `tour_items[]` for the tour
- `prices[]` for each item and currency with validity ranges
- `category.base_price_multiplier`
- `item_category_rule.multiplier` (override multiplier for FEE/ADDON)
- `payments[]` and `refunds[]`

### 1.2 Determinism requirement
Given the same DB state and same request payload, the engine MUST produce the same result.

### 1.3 Timezone
- Use `agency.timezone` to interpret `departure_date = DATE(start_at at agency.timezone)`.
- Pricing selection is based on `departure_date` (not on reservation creation time).

---

## 2) Capacity Engine

### 2.1 What consumes capacity
A passenger consumes capacity if `passenger_category.occupies_capacity = true`.

MVP default expectation:
- `ADULT` → consumes capacity
- `CHILD` → consumes capacity
- `INFANT` → consumes capacity (even though price = 0)

### 2.2 Active statuses that count for `capacity_used`

Count passengers for reservations with status:
- `RESERVED`
- `PARTIALLY_PAID`
- `PAID`
- `CONFIRMED`

Do **NOT** count:
- `DRAFT`
- `CANCELLED`

### 2.3 `capacity_used` computation (canonical)

**Definition:** `capacity_used(departure) = number of passengers occupying capacity across all active reservations for that departure`

**Algorithm:**
1. Fetch all reservations for `departure_id` with active statuses.
2. Fetch all passengers for those reservations.
3. Join each passenger with their category by `category_code` (within same agency).
4. Count where `occupies_capacity = true`.

### 2.4 Capacity required by a reservation payload

```
capacity_required(payload) = number of passengers in payload where category.occupies_capacity = true
```

- Unknown `category_code` → 400 `validation_error`
- Inactive category → 422 `inactive_category`

### 2.5 Validation rules

Capacity MUST be validated **inside a DB transaction** on:
- Create reservation (`RESERVED`)
- Edit reservation passengers/categories
- Change reservation `departure_id`
- Reopen cancelled reservation to `RESERVED`
- `DRAFT → RESERVED` transition (if used)

### 2.6 Transaction & locking rules

To prevent race conditions:
1. Lock the departure row: `SELECT ... FROM tour_departures WHERE id = :departure_id FOR UPDATE`
2. Compute current `capacity_used` within the same transaction.
3. Validate: `capacity_used + capacity_required_new <= capacity_total`

When editing an existing reservation:
- Compute `capacity_used_excluding_current_reservation` (exclude current `reservation_id`)
- Validate: `capacity_used_excl + capacity_required_new <= capacity_total`

### 2.7 Overbooking rules

If capacity is exceeded and `override.enabled = false`:
- HTTP 409 `capacity_exceeded`
- Details: `capacity_total`, `capacity_used`, `capacity_required`, `remaining`

If `override.enabled = true`:
- Require permitted role: `OWNER` always; `STAFF_PRICING` if enabled for agency
- Require non-empty `override.reason`
- Persist on reservation:
  - `capacity_override = true`
  - `capacity_override_reason`
  - `capacity_override_by = user_id`
  - `capacity_override_at = now()`
- Insert audit entry: action `OVERRIDE`, entity `reservation`

### 2.8 Capacity error codes

| Code | HTTP | Trigger |
|------|------|---------|
| `validation_error` | 400 | Unknown `category_code` or missing override reason |
| `capacity_exceeded` | 409 | Capacity exceeded, no override |
| `forbidden` | 403 | Override requested but role not permitted |
| `inactive_category` | 422 | Category exists but is inactive |

---

## 3) Pricing Engine (Catalog → Snapshot)

### 3.1 Overview
The pricing engine computes `reservation_items` snapshot lines based on:
- Departure date + currency
- Tour items (`BASE` / `FEE` / `ADDON`)
- Passenger categories (base multipliers for `BASE`)
- Item-category rules for `FEE` / `ADDON`
- Selected addons and quantities

MVP requirements:
- No manual unit price entry
- Snapshot is persisted and does not change due to later catalog edits

### 3.2 Required inputs
- `tour_id` (from departure)
- `departure_date` (derived from `start_at` + agency timezone)
- `reservation.currency`
- `price_book_id` for that currency (default book)
- `passengers[]` with `category_code`
- `selected_addons[]` with quantities

### 3.3 Applicable tour items

| Condition | Include? |
|-----------|----------|
| `is_optional = false` (mandatory) | Always |
| `is_optional = true` (ADDON) | Only if present in `selected_addons` |

**Canonical MVP quantity rules:**
- `PER_PERSON` items: `quantity = number of charge units` (passengers counted, with multipliers applying per category)
- `PER_BOOKING` items: `quantity = item.default_quantity` or `selected_addons.quantity`

The engine MUST store enough metadata in `pricing_meta` to reconstruct the calculation.

### 3.4 Price resolution by validity

For each applicable tour item, find the price row where:
- `active = true`
- `tour_item_id` matches
- `price_book_id` matches currency
- `valid_from <= departure_date`
- `valid_to IS NULL OR valid_to >= departure_date`

Choose the row with the greatest `valid_from` (most recently effective price).

If no valid price found → `409 missing_price` (include `tour_item_id`, `currency`, `departure_date` in details).

### 3.5 Multipliers and category rules

#### 3.5.1 BASE item pricing

For each passenger:
```
unit_price_base = resolved_price.unit_price
multiplier      = passenger_category.base_price_multiplier
line_price      = unit_price_base × multiplier
```

Total BASE = `sum(line_price)` across all passengers.

Common defaults:
- Adult: `1.0` · Child: `0.6` · Infant: `0.0`

#### 3.5.2 FEE / ADDON item pricing

For each passenger:
```
unit_price_fee = resolved_price.unit_price
multiplier     = item_category_rule.multiplier  (if exists and active, else 1.0)
line_price     = unit_price_fee × multiplier
```

Examples:
- Harberton `CHILD = 0`, `INFANT = 0`
- Port Fee `INFANT = 0`

#### 3.5.3 PER_BOOKING items

Applied once per reservation — category multipliers do **not** apply:
```
total = unit_price × quantity
```

### 3.6 Snapshot line generation (canonical)

Produce one `reservation_items` row per applicable item:

| Field | Value |
|-------|-------|
| `name_snapshot` | `tour_item.name` |
| `kind_snapshot` | `tour_item.kind` |
| `charge_type_snapshot` | `tour_item.charge_type` |
| `is_optional_snapshot` | `tour_item.is_optional` |
| `quantity` | Computed charge units (PER_PERSON) or selected qty (PER_BOOKING) |
| `unit_price_snapshot` | Resolved unit price from price row |
| `total_price_snapshot` | Computed total after multipliers/rules |

`pricing_meta` MUST include at minimum:
- `currency`
- `price_book_id`
- `departure_date`
- `price_id` (`tour_item_prices.id`)

Recommended `pricing_meta.calculation_breakdown` for `PER_PERSON` items:

```json
{
  "per_category": [
    { "category_code": "ADULT",  "count": 2, "multiplier": 1.0, "unit_price": 140, "total": 280 },
    { "category_code": "CHILD",  "count": 1, "multiplier": 0.6, "unit_price": 140, "total": 84  },
    { "category_code": "INFANT", "count": 1, "multiplier": 0.0, "unit_price": 140, "total": 0   }
  ]
}
```

### 3.7 Totals

```
total_snapshot = sum(reservation_items.total_price_snapshot)
total_final    = total_snapshot + adjustments_total  (see §5)
```

At creation time, `adjustments_total = 0`, so `total_final = total_snapshot`.

### 3.8 Rounding rules

- Prices stored as `numeric(12,2)`.
- Compute per-passenger totals with full precision.
- Round line totals to 2 decimals.
- Sum rounded line totals.

### 3.9 Pricing error codes

| Code | HTTP | Trigger |
|------|------|---------|
| `missing_price` | 409 | No valid price found for an item |
| `missing_price_book` | 409 | Currency not supported / price book missing |
| `pricing_overlap` | 409 | EXCLUDE constraint violation on insert |

---

## 4) Reservation Snapshot Recalculation Engine

### 4.1 Structural changes that trigger recalculation

A reservation MUST be recalculated if ANY of the following change:
- `departure_id`
- Departure day (due to editing the departure)
- `currency`
- Passengers added/removed
- Passenger category changed
- Selected addons or quantities changed

### 4.2 Non-structural changes that must NOT trigger recalculation
- Editing notes
- Editing customer fields only
- Editing passenger contact details only (email/phone/lodging) without category changes
- Catalog price or rule changes

### 4.3 Recalculation procedure (canonical)

Inside a DB transaction:
1. Lock reservation row `FOR UPDATE`
2. Determine if recalculation is needed
3. If needed:
   - Delete `reservation_items` for `reservation_id`
   - Delete `reservation_item_adjustments` for those items
   - Recompute snapshot items using pricing engine (current catalog)
   - Recompute `total_snapshot` and `total_final` (adjustments = 0)
   - Recompute accounting totals (see §6)
   - Insert audit event:
     - `action: RECALCULATE`
     - `entity_type: reservation`
     - `changes`: old totals vs new totals + trigger reason

### 4.4 Response fields after recalculation

Backend should return:
```json
{
  "recalculated": true,
  "adjustments_removed": true
}
```

### 4.5 Recalculation errors

If recalculation fails due to missing price → rollback transaction and fail the entire operation.

---

## 5) Adjustments Engine

### 5.1 Purpose
Adjustments allow price exceptions without corrupting snapshot history.

### 5.2 Allowed roles
- `OWNER`
- `STAFF_PRICING`

### 5.3 Adjustment types and interpretation

Given `base_line_total = reservation_items.total_price_snapshot`:

| Type | Interpretation | Delta |
|------|---------------|-------|
| `OVERRIDE_UNIT_PRICE` | `amount` = new unit price; `new_line_total = amount × quantity` | `new_line_total - base_line_total` |
| `DISCOUNT_AMOUNT` | Fixed discount subtracted from reservation total | `-amount` |
| `DISCOUNT_PERCENT` | `amount` = percent (0–100) | `-(base_line_total × amount / 100)` |
| `SURCHARGE_AMOUNT` | Fixed surcharge added | `+amount` |

### 5.4 Application rules

```
total_adjustments = sum(delta for all adjustments)
total_final       = total_snapshot + total_adjustments
```

`total_final` MUST NOT be negative → reject with `422 invalid_total`.

### 5.5 Validations
- `reason` required
- `amount >= 0`
- `DISCOUNT_PERCENT` must be `<= 100`

### 5.6 Deleting adjustments
- Recompute `total_final`
- Recompute accounting status (`balance_due`)
- Audit `UPDATE` on adjustment entity

### 5.7 Adjustment removal on recalculation
MVP strict rule: structural changes that trigger recalculation MUST delete all adjustments. The audit entry must mention the removal.

---

## 6) Accounting Engine (Payments + Refunds) and Status Derivation

### 6.1 Definitions

```
total_paid     = sum(payments.amount where status = 'RECEIVED')
total_refunded = sum(payment_refunds.amount)
net_paid       = total_paid - total_refunded
balance_due    = max(total_final - net_paid, 0)
```

> If `net_paid > total_final` (overpaid), `balance_due = 0`. Overpaid amount may be surfaced as a derived field.

### 6.2 Currency constraints (MVP strict)
`payment.currency` MUST equal `reservation.currency`. If mismatch → `422 currency_mismatch`.

### 6.3 Payment record rules

On `POST /payments`:
- `amount > 0`
- `method` required
- `received_at` defaults to `now()`
- Create payment row
- Recompute accounting totals
- Derive status (see §6.5)
- Audit: `PAYMENT_RECORDED`

### 6.4 Refund rules

On `POST /refunds`:
- `amount > 0`
- `reason` required
- `sum(refunds for payment) <= payment.amount` (strict) → else `409 refund_exceeds_payment`
- Create refund row
- Recompute accounting totals
- Derive status
- Audit: `REFUND_RECORDED`

### 6.5 Status derivation (canonical)

Given reservation status is **not** `CANCELLED`:

```
if net_paid >= total_final:
    if already CONFIRMED → keep CONFIRMED
    else → set PAID

else if net_paid > 0:
    → set PARTIALLY_PAID

else:
    → set RESERVED
```

> If reservation is `CANCELLED`, payments/refunds remain recorded but status stays `CANCELLED`.

### 6.6 Cancel behavior with payments
- Cancelling `RESERVED` / `PARTIALLY_PAID`: `STAFF+`, reason required
- Cancelling `PAID` / `CONFIRMED`: `OWNER` only, reason required
- Payments/refunds are **never deleted** on cancel
- Capacity is released (CANCELLED not counted in `capacity_used`)

---

## 7) Reservation Status Transition Rules

### 7.1 Allowed transitions

| From | To | Role required |
|------|----|---------------|
| `DRAFT` | `RESERVED` | `STAFF+` |
| `RESERVED` | `CANCELLED` | `STAFF+` + reason |
| `PARTIALLY_PAID` | `CANCELLED` | `STAFF+` + reason |
| `PAID` / `CONFIRMED` | `CANCELLED` | `OWNER` + reason |
| `CANCELLED` | `RESERVED` | `OWNER` + capacity check |
| `PAID` | `CONFIRMED` | `STAFF+` |

### 7.2 Invalid transitions
Any transition not listed above → `409 invalid_transition`.

---

## 8) Departure Edit Rules

### 8.1 Edit time-only (same calendar date)
- Allowed for `STAFF+`
- Does NOT trigger reservation repricing/recalculation
- Audit: `DEPARTURE_TIME_CHANGED`

### 8.2 Edit date (day changes)
- Privileged role required (`OWNER` or enabled `STAFF_PRICING`)
- If there are linked reservations:
  - MUST trigger recalculation for each linked reservation (transactional)
  - MUST remove adjustments
  - Audit: `DEPARTURE_DATE_CHANGED` + `RECALCULATE` per reservation

> MVP can process synchronously for small volumes. Guard with a threshold (e.g., >100 linked reservations → `422 too_many_reservations_to_reprice`, move to background job later).

### 8.3 Edit `capacity_total`

| Scenario | Role | Audit action |
|----------|------|-------------|
| Increase | `STAFF+` | `DEPARTURE_CAPACITY_INCREASED` |
| Decrease to ≥ `capacity_used` | `STAFF+` | `DEPARTURE_CAPACITY_DECREASED` |
| Decrease below `capacity_used` | Privileged + reason | `DEPARTURE_CAPACITY_DECREASED_OVERBOOKED` |

---

## 9) Edge Cases (Must be handled)

### 9.1 Infant occupies capacity but pays 0
- `occupies_capacity = true` → counted in capacity
- `base_price_multiplier = 0.0` → BASE price = 0
- Item-category rule can also set FEE/ADDON = 0 for infants

### 9.2 Changing passenger category after payments exist
- Triggers recalculation → adjustments removed → `total_final` changes
- Accounting recomputed:
  - If `net_paid >= new total_final` → status `PAID`
  - Otherwise → `PARTIALLY_PAID` or `RESERVED`

### 9.3 Overpaid reservations
- If `net_paid > total_final`: status = `PAID` / `CONFIRMED`, `balance_due = 0`
- UI may show "Overpaid by X" (derived field)

### 9.4 Missing prices for an item
- Reservation create/update must fail with `409 missing_price`
- No partial reservation saved (full rollback)

### 9.5 Pricing range overlap
- DB prevents via `EXCLUDE` constraint
- On insert conflict → `409 pricing_overlap`

### 9.6 Cancel after payment
- `OWNER` only
- Payments remain recorded; refunds can later reduce `net_paid`

### 9.7 Reopen cancelled when capacity is full
- Must run capacity check
- `OWNER` can overbook with reason

### 9.8 Editing departure date with many reservations
- If linked reservations exceed threshold (e.g., 100) → `422 too_many_reservations_to_reprice`
- Future: move to async background worker

---

## 10) Required Failure Codes Summary

| Code | HTTP |
|------|------|
| `validation_error` | 400 |
| `unauthenticated` | 401 |
| `forbidden` | 403 |
| `not_found` | 404 |
| `capacity_exceeded` | 409 |
| `missing_price` | 409 |
| `pricing_overlap` | 409 |
| `invalid_transition` | 409 |
| `refund_exceeds_payment` | 409 |
| `currency_mismatch` | 422 |
| `invalid_total` | 422 |
| `inactive_category` | 422 |
| `too_many_reservations_to_reprice` | 422 *(optional guard)* |

---

## 11) Test Scenarios (Minimum)

### Capacity
- Create reservation with 1 adult when `capacity_remaining = 0` → `409 capacity_exceeded`
- Same with `OWNER` override + reason → allowed, `reservation.capacity_override = true`
- Infant included: `capacity_used` increases; pricing = 0 for infant

### Pricing
- Departure date picks correct validity range
- Child multiplier applies only to `BASE`
- Harberton rule `CHILD = 0` applies to `FEE` only
- Missing price for any mandatory item → fail entire operation

### Recalculation
- Currency change triggers snapshot rebuild and deletes adjustments
- Passenger category change triggers recalculation; status derived accordingly

### Accounting
- Partial payment → `PARTIALLY_PAID`
- Full payment → `PAID`
- Refund reduces `net_paid` below `total_final` → `PARTIALLY_PAID`
- Refund exceeds payment → `409 refund_exceeds_payment`

### Departure edits
- Time-only change → reservations NOT recalculated
- Date change → all linked reservations recalculated, adjustments removed
