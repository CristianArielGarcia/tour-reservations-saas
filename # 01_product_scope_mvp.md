# 01_product_scope_mvp.md
Tour Reservations SaaS (MVP Manual) — Multi-Agency (Multi-Tenant)

> **Goal:** Deliver a sellable MVP where agencies operate **100% manually** (they keep answering WhatsApp/email as today), while the system provides a robust backoffice for tours, departures, reservations, pricing, payments/refunds (as accounting records), with strong auditability and a design that can later support automation without redesign.

---

## 1) Scope (What the MVP includes)

### 1.1 Multi-Agency SaaS Core
- Multi-tenant data model with strict agency isolation.
- Users belong to one or more agencies.
- Role-based access control (RBAC) enforced by backend.

### 1.2 Backoffice Modules Included
1) **Tours (Products)**
- Create/edit/disable tours.
- Store optional: description, duration, internal code.

2) **Tour Items (Billable components)**
- CRUD items per tour:
  - `BASE` (main tour price)
  - `FEE` (mandatory extra cost, e.g., port fee, Harberton)
  - `ADDON` (optional extras, e.g., “Train to the End of the World”)
- Each item defines:
  - Charge type: per-person or per-booking
  - Optional vs mandatory
  - Default quantity
- Items exist so reservations never require manual price typing.

3) **Passenger Categories (Adults/Children/Infants)**
- CRUD passenger categories per agency.
- Each category defines:
  - Age bounds (optional)
  - Whether it occupies capacity
  - Base multiplier (e.g., adult 1.0, child 0.6, infant 0.0)

4) **Pricing**
- Support **USD** and **ARS**.
- Prices vary by season and within season using **validity ranges**:
  - `valid_from`, `valid_to` (non-overlapping for same item+currency)
- Prices are stored per tour-item and per currency (price book).

5) **Category rules for specific fees/addons**
- Example: child does not pay Harberton.
- Category overrides apply to `FEE/ADDON` items (not to BASE multipliers).

6) **Departures (Calendar of departures / schedules)**
- Create/edit departures per tour:
  - Date+time
  - Capacity
  - Status (active/closed/cancelled)
- View departures in calendar/list.
- Edit time/capacity with proper rules and audit.

7) **Reservations**
- Create reservation from:
  - a) calendar departure (departure-first)
  - b) reservations module (reservation-first)
- Store:
  - customer
  - passengers (identity + contact + lodging)
  - snapshot of pricing items and totals
- Update reservation (passengers, addons, currency, departure) with controlled recalculation.

8) **Manual Payments (Accounting only)**
- Record payments: method, amount, currency, reference.
- System updates reservation status based on recorded amounts.

9) **Manual Refunds (Accounting only)**
- Record refunds linked to payments (or directly to reservation if needed).
- System maintains a consistent balance (“numbers add up”).

10) **Audit Log**
- Track critical actions:
  - pricing changes
  - departure changes
  - reservation recalculation
  - state changes
  - overbooking overrides
  - adjustments
  - refunds

---

## 2) Non-Goals (Explicitly out of MVP)

The MVP does **NOT** include:
- WhatsApp integration/bot
- Email sending automation
- Payment processing (Stripe/MercadoPago/WeTravel) or payment link generation
- Webhooks and automatic reconciliation
- Provider-specific modules (transport, guides, seat assignments) beyond basic departure notes
- Advanced BI reporting and exports
- Multi-currency within the same reservation (mixing USD and ARS in one reservation)
- Complex discount engine beyond the defined category and item rules

These are planned as future iterations.

---

## 3) Key Design Principles (to keep it scalable & easy to modify)

1) **Separation of concerns**
- Tour = product
- Departure = schedule + capacity
- Pricing = catalog with validity ranges
- Reservation = snapshot + operational data
- Payments/Refunds = accounting records
- Overrides/Adjustments = explicit, auditable exceptions

2) **No manual price entry in reservations**
- Staff never types unit prices manually.
- Prices come from catalog + rules.
- Exceptions are handled through “adjustments” (see §8).

3) **Snapshot immutability**
- Existing reservations do not change when catalog prices change.

4) **Explicit exceptions**
- Overbooking is explicit (privileged) with reason and audit.
- Price modifications are explicit (adjustments) with reason and audit.

5) **Migration-friendly**
- Avoid relying on platform-specific quirks.
- Keep business logic in backend; DB policies mainly isolate tenants.

---

## 4) Roles & Permissions (MVP)

### 4.1 Roles
- **OWNER**: full access for the agency (users, pricing, overbook, reopen cancelled)
- **STAFF**: operational management (departures, reservations, record payments)
- **STAFF_PRICING**: STAFF + manage pricing and apply price adjustments; may overbook if enabled
- **VIEWER**: read-only

### 4.2 Permission Matrix (Actions)

| Action | OWNER | STAFF | STAFF_PRICING | VIEWER |
|---|---:|---:|---:|---:|
| Read everything | ✅ | ✅ | ✅ | ✅ |
| CRUD Tours | ✅ | ✅ | ✅ | ❌ |
| CRUD Tour Items | ✅ | ✅ | ✅ | ❌ |
| CRUD Passenger Categories | ✅ | ✅ | ✅ | ❌ |
| CRUD Price Books | ✅ | ❌ | ✅ | ❌ |
| CRUD Item Prices (validity ranges) | ✅ | ❌ | ✅ | ❌ |
| CRUD Item Category Rules | ✅ | ❌ | ✅ | ❌ |
| CRUD Departures | ✅ | ✅ | ✅ | ❌ |
| Create/Edit Reservations | ✅ | ✅ | ✅ | ❌ |
| Cancel reservation | ✅ | ✅ | ✅ | ❌ |
| Reopen cancelled reservation | ✅ | ❌ | ❌ | ❌ |
| Record Payments (manual) | ✅ | ✅ | ✅ | ❌ |
| Record Refunds (manual) | ✅ | ✅ | ✅ | ❌ |
| Apply price adjustments | ✅ | ❌ | ✅ | ❌ |
| Overbook (ignore capacity) | ✅ | ❌ | ✅* | ❌ |
| Manage agency users/roles | ✅ | ❌ | ❌ | ❌ |

\* Overbook for STAFF_PRICING is configurable (default ON).

---

## 5) Reservation Status Model

### 5.1 Statuses (MVP)
- **DRAFT**: being assembled; does **not** consume capacity
- **RESERVED**: active reservation; consumes capacity
- **PARTIALLY_PAID**: partial net paid
- **PAID**: net paid covers total_final
- **CONFIRMED** *(optional operational state)*: reserved + paid + “ops confirmed”
- **CANCELLED**: cancelled; does not consume capacity

### 5.2 Status rules
- `CANCELLED` never counts for capacity.
- `DRAFT` never counts for capacity.
- Reservation status is derived from net paid thresholds:
  - `net_paid >= total_final` => PAID (or CONFIRMED if manually advanced)
  - `0 < net_paid < total_final` => PARTIALLY_PAID
  - `net_paid = 0` => RESERVED (unless cancelled)

### 5.3 Allowed transitions (minimum)
- DRAFT → RESERVED (STAFF+)
- RESERVED → PARTIALLY_PAID (on payment record)
- RESERVED → PAID (on full payment record)
- PARTIALLY_PAID → PAID (additional payment)
- PAID → CONFIRMED (optional, STAFF+)
- RESERVED → CANCELLED (STAFF+; reason required)
- PARTIALLY_PAID → CANCELLED (policy: allowed; reason required)
- PAID → CANCELLED (OWNER only; reason required)
- CANCELLED → RESERVED (OWNER only; capacity check applies or requires overbook permission)

---

## 6) Passenger Data Requirements (MVP)

For each passenger:
- First name (required)
- Last name (required)
- Document ID (passport/ID) **required**
- Birth date (optional)
- Category code (ADULT/CHILD/INFANT) required (selected by staff; can be auto-suggested if birth date exists)

Additional info useful for future automation (pickup notifications, etc.):
- Contact phone (optional)
- Contact email (optional)
- Lodging address / hotel (optional)

> Note: Passenger contact can be stored per passenger or per reservation customer; MVP can store both with preference to store on passenger for future pickup automation. Avoid over-normalization initially; keep consistent.

---

## 7) Capacity Management (No overselling, but allow controlled overbook)

### 7.1 Definitions
- `capacity_total`: max passengers for a departure
- `capacity_used`: total passengers occupying capacity in active reservations
- `capacity_remaining`: `capacity_total - capacity_used`
- A passenger category defines `occupies_capacity`.

### 7.2 Which reservations count for capacity_used
Count passengers belonging to reservations with status:
- RESERVED
- PARTIALLY_PAID
- PAID
- CONFIRMED

Do not count:
- DRAFT
- CANCELLED

### 7.3 Infant rule (explicit)
- INFANT price multiplier = 0 (does not pay)
- INFANT occupies capacity = true (consumes a seat/cupo)

### 7.4 Capacity validation points
Capacity must be validated in these operations:
- Create reservation (when moving to RESERVED)
- Update reservation passenger list (add/remove/change categories)
- Reopen cancelled reservation
- Move DRAFT → RESERVED

### 7.5 Overbooking (controlled exception)
If capacity would be exceeded:
- Operation is rejected unless user has OVERBOOK permission.
- If overbook is used:
  - store `capacity_override = true`
  - require `capacity_override_reason` (mandatory)
  - store `capacity_override_by`, `capacity_override_at`
  - log audit entry
- The departure is flagged as “OVERBOOKED” (for UI alerts).

### 7.6 Capacity reduction on departure
If capacity_total is decreased:
- If new capacity_total >= capacity_used: allowed (role permitting) + audit
- If new capacity_total < capacity_used:
  - only privileged role can apply
  - departure remains OVERBOOKED
  - audit + reason required

---

## 8) Pricing Model (Seasonal, USD/ARS, Adults/Children/Infants)

### 8.1 Key requirements
- Prices vary by season and within season.
- Support USD and ARS.
- Base discount applies only to the tour BASE item:
  - CHILD pays a percentage of adult base (e.g., 60%)
  - INFANT pays 0
- Fees/addons do **not** get base discount, but can have explicit category rules:
  - Example: Harberton fee is 0 for CHILD and INFANT.

### 8.2 Tour Items classification
Each tour item has:
- `kind`: BASE / FEE / ADDON
- `charge_type`: PER_PERSON / PER_BOOKING
- `is_optional`: true/false
- `default_quantity`: integer >= 1

### 8.3 Validity-based pricing
Prices are stored per:
- tour_item
- currency (price book)
- `valid_from`, `valid_to`

**Non-overlapping constraint:** For any given (tour_item, currency), price validity ranges must not overlap.

### 8.4 Price resolution date rule
Prices are selected using:
- `departure_date` = DATE(departure.start_at)
- Not the reservation creation date.

### 8.5 Category rules logic
1) For BASE items:
- `unit_price * passenger_category.base_price_multiplier`

2) For FEE and ADDON items:
- Ignore base multiplier.
- Apply item-category override if present; otherwise multiplier = 1.0.

### 8.6 Example pricing composition (Terrestrial Penguin Walk)
Reservation items should be generated automatically:
- BASE Tour (PER_PERSON): adult full; child 60%; infant 0
- Harberton entrance (FEE, PER_PERSON): adult full; child 0; infant 0
- Port fee (FEE, PER_PERSON): adult full; child full; infant configurable (typically 0)
- Optional addon “Train” (ADDON, PER_PERSON): adult full; child full; infant configurable

---

## 9) Reservation Snapshot & Recalculation Rules

### 9.1 Snapshot definition
When a reservation is created or updated (structural changes), the system computes and stores:
- reservation_items with:
  - name_snapshot
  - kind_snapshot
  - charge_type_snapshot
  - quantity
  - unit_price_snapshot
  - total_price_snapshot
  - pricing_meta (currency, validity used, etc.)

Totals:
- `total_snapshot` = sum of reservation_items total_price_snapshot
- `total_final` = total_snapshot + adjustments (discounts/surcharges)

### 9.2 Catalog changes do not affect existing reservations
Updating:
- item prices
- validity ranges
- category multipliers
- item-category rules
must NOT automatically modify existing reservations.

### 9.3 Recalculation triggers (automatic)
Reservation snapshot MUST be recalculated when any of these changes:
- departure_id changes
- departure date changes (time-only does not)
- currency changes
- passengers list changes (add/remove)
- passenger category changes
- optional addons selection/quantity changes

### 9.4 Recalculation behavior
On recalculation:
- Remove previous reservation_items
- Remove existing adjustments (to avoid conflicting on a new snapshot)
- Recompute snapshot from current catalog rules
- Record audit entry: `reservation_recalculated = true`

> Future iteration may preserve adjustments as separate “re-apply” actions, but MVP keeps it strict and consistent.

---

## 10) Price Adjustments (Modifying a reservation price after creation)

### 10.1 Why adjustments exist
Operations need flexibility (discounts, corrections, special cases) without corrupting history.

### 10.2 Rule
- Do not “edit” unit prices in reservation_items directly without trace.
- Apply explicit adjustments with reason and user attribution.

### 10.3 Adjustment types (MVP)
- Override unit price (per item)
- Discount amount
- Discount percent
- Surcharge amount

### 10.4 Adjustment requirements
- Only OWNER or STAFF_PRICING.
- Reason is mandatory.
- Audit entry is mandatory.

---

## 11) Payments & Refunds (Accounting Consistency)

### 11.1 Payments (manual records)
Record:
- amount
- currency
- method (cash/transfer/card/other)
- reference (optional)
- received_at
- created_by

Payment does not charge or communicate with any provider.

### 11.2 Refunds (manual records)
Refund is recorded for accounting consistency.
Record:
- amount
- reason (mandatory)
- timestamp
- created_by
Refund is typically linked to a payment, but MVP may allow reservation-level refunds if needed.

### 11.3 Consistency equations
- `total_paid = SUM(payments.amount where status=RECEIVED)`
- `total_refunded = SUM(refunds.amount)`
- `net_paid = total_paid - total_refunded`
- `balance_due = total_final - net_paid`

### 11.4 Status derived from net_paid
- net_paid >= total_final → PAID (or CONFIRMED if ops advanced)
- 0 < net_paid < total_final → PARTIALLY_PAID
- net_paid = 0 → RESERVED

---

## 12) Editing Departures (Time/Date/Capacity)

### 12.1 Editing time only (same date)
- Allowed if role permits.
- Does not trigger reservation repricing.
- Audit entry required.

### 12.2 Editing date (day changes)
- Allowed only if role permits (OWNER recommended).
- Triggers recalculation of affected reservations (because departure_date changes).
- Removes adjustments.
- Audit entry required.

### 12.3 Editing capacity_total
- Increasing capacity: allowed (role permitting), audit required.
- Decreasing capacity:
  - if new capacity_total >= capacity_used: allowed, audit required.
  - if new capacity_total < capacity_used:
    - only privileged role allowed
    - departure becomes OVERBOOKED
    - reason required
    - audit required

---

## 13) MVP UI Screens (High-level)

1) Login
2) Dashboard (alerts for overbooked departures, upcoming departures, recent reservations)
3) Tours (list, create, edit, disable)
4) Tour Items (inside tour)
5) Passenger Categories
6) Pricing (price books, item prices by validity, item-category rules)
7) Departures Calendar (create/edit departures, see capacity used/remaining, overbook alerts)
8) Reservations (list/filter; create; edit; status changes; payments; refunds; adjustments)
9) Users & Roles (OWNER only)

Detailed UI + permission mapping is specified in `05_backoffice_ui.md`.

---

## 14) Acceptance Criteria (MVP)

### Multi-tenant
- Data isolation: a user must never read/write data from another agency.

### Operations
- Staff can create/edit/cancel reservations.
- System enforces capacity; overbook is controlled and auditable.
- Prices are auto-generated from tour items and catalog.
- Reservation snapshot remains stable over time.
- Payments/refunds keep consistent accounting.

### Auditability
Audit log exists for:
- reservation state changes
- overbook actions
- departure changes (time/date/capacity)
- reservation recalculation
- pricing changes in catalog
- adjustments
- refunds

---

## 15) Notes for Future Automation (Not implemented in MVP)

This MVP is designed to support future modules:
- WhatsApp bot flow: user selects tour/date, system checks availability, collects passenger info, creates reservation
- Email templates: use stored tour description/duration/includes
- Payment providers: generate links, receive webhooks, auto-mark PAID
- Event/outbox pattern: reservation.created, reservation.paid, etc.

These will be defined in later documents once MVP is stable.