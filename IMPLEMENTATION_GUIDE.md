# Business Rules Engine Implementation Guide

This document describes the comprehensive implementation of the Business Rules Engine as specified in `06_business_rules_engine.md`.

## Overview

The Business Rules Engine is fully implemented across multiple services in the NestJS backend. It manages:

- **Capacity Management**: Real-time capacity tracking with transaction-level locking
- **Pricing Engine**: Deterministic pricing with catalog snapshot immutability
- **Status Derivation**: Automatic status updates based on payment accounting
- **Snapshot Recalculation**: Intelligent recalculation on structural changes
- **Adjustments Management**: Price exceptions with audit trail
- **Payment & Refunds**: Complete financial tracking and validation
- **Departure Edits**: Complex rules for date/time/capacity changes

## Architecture

### Core Services

#### 1. `CapacityEngineService` (`src/capacity-engine/capacity-engine.service.ts`)

**Responsibilities:**
- Compute `capacity_used` for a departure (queries active reservations only)
- Get capacity summary with derived fields
- Validate capacity with transaction-level row locking
- Prevent race conditions via `FOR UPDATE` locking

**Key Methods:**
- `computeCapacityUsed(departureId, agencyId, excludeReservationId?)`: Returns count of passengers occupying capacity
- `getCapacitySummary(departureId, agencyId)`: Returns full capacity state
- `validateCapacity(departureId, agencyId, requestedAdditional, allowOverbook)`: Validates capacity or allows override

**Implementation Details:**
- Uses raw SQL with proper exclusion of non-active statuses
- Filters passengers by `occupies_capacity = true` flag
- Counts only RESERVED, PARTIALLY_PAID, PAID, CONFIRMED statuses (§2.2)
- Supports optional reservation exclusion for update scenarios

#### 2. `PricingEngineService` (`src/pricing-engine/pricing-engine.service.ts`)

**Responsibilities:**
- Build deterministic pricing snapshots
- Resolve prices by validity ranges
- Apply category multipliers (BASE vs FEE/ADDON rules)
- Compute adjusted totals and status derivation

**Key Methods:**
- `buildSnapshot(input)`: Creates snapshot lines with pricing metadata
- `computeTotalFinal(totalSnapshot, adjustments)`: Applies adjustments to base total
- `computeAccountingTotals(totalFinal, payments, refunds)`: Derives financial state
- `deriveStatus(currentStatus, netPaid, totalFinal)`: Derives reservation status

**Implementation Details:**
- **Price Resolution** (§3.4): Selects price with greatest `valid_from` before departure date
- **BASE Item Pricing** (§3.5.1): `unit_price × passenger_category.base_price_multiplier` per passenger
- **FEE/ADDON Pricing** (§3.5.2): Uses `tour_item_category_rule.multiplier` (default 1.0)
- **PER_BOOKING Pricing** (§3.5.3): `unit_price × quantity` (no multipliers)
- **Rounding** (§3.8): Per-passenger rounding to 2 decimals, sum rounded results
- **Status Derivation** (§6.5): Preserves CONFIRMED status when fully paid

**Pricing Metadata** (§3.6):
```json
{
  "currency": "USD",
  "price_book_id": "...",
  "departure_date": "2025-03-15",
  "price_id": "...",
  "breakdown": [
    { "category_code": "ADULT", "count": 1, "multiplier": 1.0, "unit_price": 140, "total": 140 }
  ]
}
```

#### 3. `ReservationsService` (`src/reservations/reservations.service.ts`)

**Responsibilities:**
- Full reservation CRUD with capacity validation
- Snapshot recalculation on structural changes
- Status transitions with role-based validation
- Adjustments management (create/delete)

**Key Methods:**
- `create()`: Creates reservation with capacity check inside transaction
- `update()`: Detects structural changes and triggers recalculation
- `changeStatus()`: Validates transition and enforces role requirements
- `createAdjustment()`: Adds adjustment and recomputes totals
- `deleteAdjustment()`: Removes adjustment and updates status

**Structural Changes Triggering Recalculation** (§4.1):
- `departure_id` change
- Departure day change (via `isSameDay` check)
- `currency` change
- Passengers changed (add/remove/category)
- `selected_addons` changed

**Recalculation Procedure** (§4.3):
1. Lock reservation row `FOR UPDATE`
2. Delete old `reservation_items` and their `adjustments`
3. Recompute snapshot with current catalog prices
4. Update `total_snapshot`, `total_final` (adjustments = 0)
5. Create RECALCULATE audit entry

**Status Transitions** (§7):
```
DRAFT       → RESERVED, CANCELLED
RESERVED    → PARTIALLY_PAID, PAID, CONFIRMED, CANCELLED
PARTIALLY_PAID → PAID, CONFIRMED, CANCELLED
PAID        → CONFIRMED, CANCELLED (OWNER only)
CONFIRMED   → CANCELLED (OWNER only)
CANCELLED   → RESERVED (OWNER only, capacity check)
```

#### 4. `PaymentsService` (`src/payments/payments.service.ts`)

**Responsibilities:**
- Record payments with status derivation
- Create refunds with validation
- Compute accounting totals

**Key Methods:**
- `createPayment()`: Records payment, recomputes accounting, derives status
- `createRefund()`: Creates refund, validates vs payment amount

**Payment Recording** (§6.3):
- Creates payment with status = RECEIVED
- Defaults `received_at` to `now()`
- Currency must match reservation currency (§6.2)
- Recomputes all accounting totals
- Creates PAYMENT_RECORDED audit entry

**Refund Validation** (§6.4):
- Validates `sum(refunds for payment) <= payment.amount`
- Throws `409 refund_exceeds_payment` if exceeded
- Creates REFUND_RECORDED audit entry

#### 5. `DeparturesService` (`src/departures/departures.service.ts`)

**Responsibilities:**
- Departure CRUD
- Date change handling with mass recalculation
- Capacity adjustment with privilege checks

**Date Change Behavior** (§8.2):
- Time-only changes (same calendar date): No recalculation (audit: DEPARTURE_TIME_CHANGED)
- Date changes: Recalculate all linked active reservations
- Guard: Reject if >100 linked reservations (MVP threshold)
- Throws: `422 too_many_reservations_to_reprice`
- Deletes all adjustments from recalculated reservations

**Capacity Changes** (§8.3):
- Increase: Allowed (audit: DEPARTURE_CAPACITY_INCREASED)
- Decrease to ≥ capacity_used: Allowed (audit: DEPARTURE_CAPACITY_DECREASED)
- Decrease below capacity_used: Requires STAFF_PRICING + reason (audit: DEPARTURE_CAPACITY_DECREASED_OVERBOOKED)

## Error Codes

All errors follow the structured API error format with HTTP status, error code, and optional details.

### HTTP Status Codes

| Status | Codes |
|--------|-------|
| 400 Bad Request | `validation_error` |
| 401 Unauthorized | `unauthenticated` |
| 403 Forbidden | `forbidden` |
| 404 Not Found | `not_found` |
| 409 Conflict | `capacity_exceeded`, `missing_price`, `pricing_overlap`, `invalid_transition`, `refund_exceeds_payment` |
| 422 Unprocessable Entity | `currency_mismatch`, `invalid_total`, `inactive_category`, `too_many_reservations_to_reprice` |

### Key Error Scenarios

**Capacity**:
- `capacity_exceeded` (409): Exceeds capacity without override
- Includes: `capacity_total`, `capacity_used`, `requested_additional` in details

**Pricing**:
- `missing_price` (409): No valid price for mandatory item on departure date
- `pricing_overlap` (409): Price validity range conflict

**Categories**:
- `inactive_category` (422): Category exists but is inactive
- Validates on: reservation create/update, prevents using inactive categories

**Transitions**:
- `invalid_transition` (409): Status transition not allowed

**Accounting**:
- `currency_mismatch` (422): Payment currency ≠ reservation currency
- `invalid_total` (422): Adjustment would make total negative
- `refund_exceeds_payment` (409): Refund exceeds payment amount

**Operations**:
- `too_many_reservations_to_reprice` (422): >100 reservations for date change (MVP guard)

## Validations

### Capacity Validation

**Location**: Inside transaction with `FOR UPDATE` lock on departure

**Rules**:
- Count passengers with `occupies_capacity = true`
- Compare against `capacity_total`
- Allow override only with OWNER role and reason
- Audit overrides with full trail

**Scenarios**:
- Create reservation (§2.5)
- Edit reservation (passengers/categories/departure)
- Reopen cancelled (§9.7)

### Pricing Validation

**Location**: During snapshot building

**Rules**:
- Validate price exists for EACH mandatory item
- Price must be within validity range for departure date
- Currency must have active price book
- Fail entire operation if ANY mandatory item missing price (no partial)

**Error**: `409 missing_price` with item details

### Status Validation

**Location**: On status change requests

**Rules**:
- Only allowed transitions in TRANSITIONS matrix
- PAID/CONFIRMED → CANCELLED: OWNER role required
- CANCELLED → RESERVED: OWNER role required, capacity check
- Reason required when cancelling

**Error**: `409 invalid_transition`

### Role-Based Access Control

**Capacity Override**: OWNER or STAFF_PRICING
**Adjustments**: STAFF_PRICING or OWNER
**Departure Date Edit**: OWNER or STAFF_PRICING
**Cancel PAID/CONFIRMED**: OWNER only

## Transaction Management

All capacity and pricing operations use explicit transactions with proper locking.

### Create Reservation Transaction:
```
1. Lock departure row (FOR UPDATE)
2. Compute capacity_used
3. Validate: capacity_used + requested ≤ capacity_total (or override)
4. Create or update customer
5. Create reservation
6. Create passengers
7. Create snapshot items
8. Audit CREATE
```

### Update Reservation Transaction:
```
1. Lock departure row (FOR UPDATE)
2. If structural change:
   - Validate capacity (excluding current reservation)
   - Delete old items + adjustments
   - Create new snapshot items
   - Audit RECALCULATE
3. Else:
   - Update non-structural fields only
   - Audit UPDATE
```

### Departure Date Change Transaction:
```
1. Lock departure row (FOR UPDATE)
2. Find linked active reservations
3. Guard: reject if >100 reservations
4. For each reservation:
   - Delete items + adjustments
   - Mark for recalculation
5. Create audit entries
```

## Determinism Guarantee

Per §1.2 of 06_business_rules_engine.md:

> Given the same DB state and same request payload, the engine MUST produce the same result.

**Implementation**:
- All prices resolved by validity ranges (not by creation time)
- Snapshots are immutable (never recalculated due to catalog changes)
- Rounding rules consistent (per-passenger then sum)
- Status derivation deterministic (only based on payments/refunds/total)
- No external API calls or non-deterministic operations

## Audit Trail

Every business rule violation, override, or structural change creates audit entries.

**Key Audit Actions**:
- CREATE: Reservation created
- UPDATE: Non-structural fields updated
- RECALCULATE: Snapshot rebuilt (includes trigger and before/after totals)
- STATUS_CHANGE: Manual status transition
- OVERRIDE: Capacity override allowed
- ADJUSTMENT_ADDED: Adjustment applied
- ADJUSTMENT_DELETED: Adjustment removed
- PAYMENT_RECORDED: Payment processed
- REFUND_RECORDED: Refund created
- DEPARTURE_TIME_CHANGED: Departure time edited (same day)
- DEPARTURE_DATE_CHANGED: Departure date changed (different day)
- DEPARTURE_CAPACITY_INCREASED: Capacity increased
- DEPARTURE_CAPACITY_DECREASED: Capacity decreased (no overbooking)
- DEPARTURE_CAPACITY_DECREASED_OVERBOOKED: Capacity decreased below current usage

## Testing Strategy

Comprehensive test suite in `src/business-rules/business-rules.spec.ts` covers:

1. **Capacity Engine** (§2)
   - Active status filtering
   - Passenger category filtering
   - Overbooking validation
   - Audit trail

2. **Pricing Engine** (§3)
   - Item applicability
   - Price resolution by validity
   - Multiplier application (BASE vs FEE/ADDON)
   - Rounding rules
   - Metadata preservation

3. **Snapshot Recalculation** (§4)
   - Structural vs non-structural changes
   - Adjustment deletion
   - Audit generation

4. **Adjustments** (§5)
   - Role-based access
   - Adjustment types and calculations
   - Total validation
   - Deletion and status updates

5. **Accounting & Status** (§6)
   - Payment recording
   - Refund validation
   - Status derivation with CONFIRMED preservation
   - Overpaid handling

6. **Status Transitions** (§7)
   - Valid transition matrix
   - Role requirements
   - Invalid transition rejection

7. **Departure Edits** (§8)
   - Time-only vs date changes
   - Mass recalculation
   - Capacity adjustments
   - Guard against too many reservations

8. **Edge Cases** (§9)
   - Infant handling (capacity vs pricing)
   - Category changes post-payment
   - Overpaid reservations
   - Missing prices
   - Cancel after payment
   - Reopen when full
   - Mass recalculation guards

9. **Integration Tests**
   - Full lifecycle: create → pay → confirm → cancel
   - Pricing adjustments and refunds
   - Category changes and recalculation
   - Departure date changes
   - Capacity override audit trail

## Performance Considerations

1. **Capacity Computation**: Uses efficient SQL aggregation with joins
2. **Pricing Snapshot**: Built once, reused (immutable design)
3. **Recalculation Guard**: Prevents mass recalculation >100 reservations
4. **Locking Strategy**: Row-level locks only on affected departures/reservations
5. **Audit Trail**: Asynchronous where possible

## Future Enhancements

- [ ] Background job queue for mass recalculation (>100 reservations)
- [ ] Batch payment processing
- [ ] Currency conversion/multi-currency support (currently MVP strict)
- [ ] Advanced reporting on pricing exceptions
- [ ] Machine learning for pricing optimization
- [ ] Real-time capacity alerting

## Compliance Checklist

- ✅ §1: Definitions & Inputs (all inputs used correctly)
- ✅ §2: Capacity Engine (with row locking, audit trail)
- ✅ §3: Pricing Engine (deterministic, with metadata)
- ✅ §4: Snapshot Recalculation (structural change detection)
- ✅ §5: Adjustments Engine (with validation & audit)
- ✅ §6: Accounting & Status (with CONFIRMED preservation)
- ✅ §7: Status Transitions (full matrix validation)
- ✅ §8: Departure Edits (time/date/capacity rules)
- ✅ §9: Edge Cases (all scenarios handled)
- ✅ §10: Error Codes (all error types implemented)
- ✅ §11: Test Scenarios (comprehensive test suite)

## References

- **Specification**: `06_business_rules_engine.md`
- **Data Model**: `02_data_model_schema.md`
- **API Contract**: `04_api_contract.md`
- **Architecture**: `03_architecture_and_tech_stack.md`
