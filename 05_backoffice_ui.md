# 05_backoffice_ui.md
Tour Reservations SaaS (MVP Manual) — Backoffice UI Specification v1 (Detailed)

> This document is **self-contained** and defines the Backoffice Web UI for the MVP.
> It is designed for manual operations (agents/staff keep answering WhatsApp/email outside the system),
> while keeping the system automation-ready for future additions.

---

## 0) Scope & Non-Scope

### In scope (MVP)
- Multi-tenant backoffice for multiple agencies
- User login via Supabase Auth (email/password)
- Agency switcher (if user belongs to multiple agencies)
- CRUD for:
  - Tours
  - Tour items (BASE/FEE/ADDON)
  - Passenger categories (Adult/Child/Infant rules)
  - Pricing (validity ranges + item-category override rules)
  - Departures (calendar/list)
  - Reservations (create/edit + snapshot items)
  - Payments (manual)
  - Refunds (manual)
- Audit log viewing (OWNER / STAFF_PRICING)
- User management (OWNER only)

### Out of scope (MVP)
- WhatsApp automation
- Email automation
- Payment processing or payment gateway integration
- Public booking pages
- Customer portal
- Dynamic pickup routing / notifications

---

## 1) UI Goals & Principles

1. **Fast operations**: minimal clicks, optimized for daily booking workflow.
2. **No manual pricing typing**: system calculates snapshot lines; price exceptions via adjustments.
3. **Predictable recalculation**: user must see when recalculation happens and what it deletes.
4. **Strong safety rails**: capacity conflicts, overbook confirmations, and privilege-gated operations.
5. **Audit-first**: every critical operation must be traceable.
6. **Consistency with backend**:
   - UI never assumes rules; backend returns authoritative results.
   - UI displays derived totals from backend.

---

## 2) Design System (Implementation Guidance)

### 2.1 Layout
- Left sidebar navigation (collapsible)
- Main content area with:
  - Header: page title + primary actions
  - Filters row (for lists)
  - Content section (table/cards)
- Sticky top bar:
  - Agency switcher
  - User menu

### 2.2 UI Component Standards
- Data tables:
  - sortable columns
  - row click opens detail
- Forms:
  - clear section grouping
  - inline validation
  - “Save” (primary) + “Cancel” (secondary)
- Badges:
  - status badge (reservation/departure)
  - capacity badge (overbook)
  - currency badge
- Alerts:
  - destructive (requires confirmation + reason)
  - warning (non-blocking)
  - info (contextual)

### 2.3 Backend-driven UI
Every list and detail view should rely on backend responses for:
- derived totals (balance_due, net_paid, etc.)
- capacity_used/remaining
- reservation totals
- recalculated flags (if returned)

---

## 3) Roles, Permissions & UI Behavior

Roles:
- OWNER
- STAFF
- STAFF_PRICING
- VIEWER

### 3.1 Universal UI rules
- If user role lacks permission:
  - hide actions OR show disabled with tooltip “Insufficient permissions”
- Backend must still enforce authorization.

### 3.2 Permission matrix (detailed)

#### Tours
- VIEW: VIEWER+
- CREATE/EDIT/DEACTIVATE: STAFF+
- PRICING fields: not in tours

#### Pricing
- VIEW/EDIT: STAFF_PRICING+ (or OWNER)
- STAFF cannot access Pricing section.

#### Departures
- VIEW: VIEWER+
- CREATE/EDIT TIME: STAFF+
- CHANGE DATE (day): OWNER (or STAFF_PRICING if enabled)
- REDUCE CAPACITY BELOW USED: OWNER (or STAFF_PRICING if enabled)
- CLOSE: STAFF+

#### Reservations
- VIEW: VIEWER+
- CREATE/EDIT: STAFF+
- APPLY ADJUSTMENTS: STAFF_PRICING+
- OVERBOOK: OWNER or STAFF_PRICING (if enabled)
- CANCEL RESERVED/PARTIALLY_PAID: STAFF+
- CANCEL PAID/CONFIRMED: OWNER only
- REOPEN CANCELLED: OWNER only

#### Payments/Refunds
- RECORD: STAFF+
- VIEW: VIEWER+

#### Users & Roles
- OWNER only

#### Audit
- OWNER + STAFF_PRICING

---

## 4) Global Navigation & Routes

### 4.1 Auth
- `/login`
- `/reset-password` (optional)
- `/logout`

### 4.2 Backoffice pages
- `/dashboard`
- `/calendar` (departures calendar/list)
- `/departures/:departureId`
- `/reservations`
- `/reservations/new`
- `/reservations/:reservationId`
- `/tours`
- `/tours/new`
- `/tours/:tourId`
- `/tours/:tourId/items`
- `/pricing`
- `/pricing/price-books`
- `/pricing/tour-items/:itemId/prices`
- `/pricing/tour-items/:itemId/category-rules`
- `/passenger-categories`
- `/customers` (optional MVP)
- `/audit`
- `/users` (owner only)
- `/settings` (owner only)

---

## 5) Login & Session UX

### 5.1 Login
Fields:
- email
- password

Actions:
- Sign in
- Forgot password

After login:
- If user belongs to 1 agency → redirect `/dashboard`
- If multiple agencies → show agency picker modal:
  - list agencies + role
  - select sets `X-Agency-Id` context for all requests

### 5.2 Session handling
- Store Supabase session token securely (standard Next.js client session handling)
- Add `Authorization: Bearer <token>` to API calls
- Add `X-Agency-Id` header for all backoffice calls (when needed)

---

## 6) Dashboard

### 6.1 Page content
Widgets:

1) **Upcoming departures (next 7 days)**
- Tour name
- start_at
- capacity_total / used / remaining
- badge if overbooked

2) **Overbook alerts**
- list of departures where `is_overbooked=true`
- highlight red

3) **Reservations needing payment**
- list where balance_due > 0
- show:
  - customer
  - departure
  - total_final
  - net_paid
  - balance_due

4) **Recent activity**
- last 10 audit entries (if role allows) OR last 10 reservations created

### 6.2 Actions
- Click departure -> open departure detail
- Click reservation -> open reservation detail

---

## 7) Calendar / Departures List

### 7.1 Views
MVP required:
- List view with date range filter
Optional:
- Week calendar view

### 7.2 Filters
- `from` date (required)
- `to` date (required)
- tour filter (optional)
- status filter (ACTIVE/CLOSED/CANCELLED)
- show only overbooked (optional)

### 7.3 Columns
- start_at
- tour name
- status badge
- capacity_total
- capacity_used
- remaining
- overbook badge

### 7.4 Actions
- New departure (STAFF+)
- Row click -> detail

---

## 8) Create/Edit Departure Modal/Form

### 8.1 Create form fields
- tour_id (required)
- start_at (required)
- capacity_total (required, >=0)
- notes (optional)

### 8.2 Edit form fields
- start_at
- capacity_total
- status
- notes

### 8.3 Validation & rules UI
#### Time change same date
- allowed for STAFF+
- no recalculation warning needed

#### Date(day) change
- privileged role required
- show blocking warning:
  - “Changing the departure day triggers reservation repricing for linked reservations.”
  - “All adjustments will be removed.”
- require reason input (required)

#### Capacity decrease below used
- privileged role required
- show blocking warning:
  - “New capacity is below currently used capacity; departure will be marked overbooked.”
- require reason input (required)

### 8.4 Close departure
- action button “Close departure”
- asks confirmation + optional reason
- status becomes CLOSED

---

## 9) Departure Detail

### 9.1 Header summary
- Tour name
- start_at
- status
- capacity_total
- capacity_used (derived)
- capacity_remaining (derived)
- overbook badge (if overbooked)

### 9.2 Tab: Reservations
Columns:
- reservation id short
- customer
- status
- total_final
- balance_due
- passengers count
- overbook override badge

Actions:
- Create reservation for this departure (STAFF+)

---

## 10) Reservations List

### 10.1 Filters
- date range by departure date
- status
- tour
- currency
- unpaid only (balance_due > 0)
- search by customer name/document_id (optional)

### 10.2 Columns
- created_at
- departure start_at
- tour name
- customer
- status
- currency
- total_final
- net_paid
- balance_due
- badges:
  - “Overbook override”
  - “Overpaid” (if net_paid > total_final)

### 10.3 Actions
- New reservation (STAFF+)
- Row click -> reservation detail

---

## 11) Create Reservation Screen (Core workflow)

### 11.1 Entry points
- From calendar (departure preselected)
- From reservations list (choose tour then departure)

### 11.2 Sections

#### A) Reservation header
- departure selector (required)
- currency selector (required)
- notes (optional)

#### B) Customer
- full_name (required)
- email (optional)
- phone (optional)
- lodging_address (optional)

#### C) Passengers
- table with add/remove passenger rows
Per passenger:
- first_name (required)
- last_name (required)
- document_id (required)
- birth_date (optional)
- category_code (required)
- email/phone/lodging optional

Validation:
- at least 1 passenger
- document_id unique within the reservation form

#### D) Addons
- list of optional ADDON items for the tour
- each addon:
  - checkbox select
  - quantity input (default 1, min 1)
- fees that are mandatory are not shown here (they are auto included)

#### E) Pricing Preview (read-only)
Shows computed preview returned by backend “preview” endpoint OR computed after save.
MVP recommended:
- Implement a “Preview” button that calls backend to compute:
  - snapshot lines
  - totals
  - capacity impact

Preview UI:
- Items table:
  - item name
  - kind
  - charge type
  - quantity
  - unit price
  - total
- Totals:
  - total_snapshot
  - total_final (same unless adjustments exist)

#### F) Capacity Preview (read-only)
- capacity_total
- capacity_used current
- seats required by this reservation
- remaining after

If capacity exceeded:
- show error banner
- if user has override permission:
  - show override panel

#### G) Overbook Override Panel (conditional)
Visible only if:
- capacity exceeded
- role has override permission

Fields:
- enabled checkbox
- reason text (required if enabled)

### 11.3 Save behavior
On Save:
- backend performs transaction:
  - capacity check (with lock)
  - snapshot generation
  - create reservation
  - audit
- UI navigates to reservation detail

---

## 12) Reservation Detail Screen

### 12.1 Header summary
- Status badge
- departure start_at
- tour name
- customer name
- currency
- totals:
  - total_snapshot
  - total_final
  - total_paid
  - total_refunded
  - net_paid
  - balance_due
- badges:
  - “Override” if capacity_override=true
  - “Overpaid” if net_paid > total_final

### 12.2 Tabs

#### Tab 1: Items (Snapshot)
- list reservation_items
- columns:
  - name_snapshot
  - kind_snapshot
  - charge_type_snapshot
  - quantity
  - unit_price_snapshot
  - total_price_snapshot
- show pricing_meta (collapsed details)

#### Tab 2: Passengers
- list passengers
- edit allowed for STAFF+:
  - passenger names
  - category_code (STRUCTURAL change triggers recalculation)
  - contact fields
- UI MUST warn if category changes will recalc:
  - “This will recalculate pricing and remove adjustments.”

#### Tab 3: Payments
- list payments
- add payment form (STAFF+)

#### Tab 4: Refunds
- list refunds grouped by payment
- add refund form (STAFF+)

#### Tab 5: Adjustments (STAFF_PRICING+ only)
- list adjustments
- add adjustment form
- delete adjustment optional

#### Tab 6: Audit (OWNER/STAFF_PRICING)
- audit entries related to reservation (filter by entity_id)

### 12.3 Reservation actions (top right)
- Cancel reservation:
  - STAFF+ can cancel RESERVED/PARTIALLY_PAID
  - OWNER only can cancel PAID/CONFIRMED
  - reason required
- Reopen cancelled (OWNER only):
  - triggers capacity check
- Confirm reservation (optional):
  - from PAID → CONFIRMED

---

## 13) Adjustments UI Details

### 13.1 Add adjustment modal
Fields:
- reservation_item_id (select from snapshot items)
- type (enum)
- amount
- reason (required)

Validation:
- amount >= 0
- if percent: <= 100

Preview:
- show:
  - current total_final
  - new total_final after applying this adjustment

Behavior:
- after save:
  - refresh totals and status
  - show toast “Adjustment applied”

---

## 14) Payments UI Details

### 14.1 Add payment modal
Fields:
- amount > 0
- method (required)
- currency (read-only = reservation currency)
- reference (optional)
- received_at (default now)

After save:
- refresh totals
- status auto-updated by backend

---

## 15) Refunds UI Details

### 15.1 Add refund modal
Fields:
- payment_id (required)
- amount > 0
- reason required

UI must show remaining refundable for payment:
- payment.amount - sum(refunds)

Block save if exceeds.

After save:
- refresh totals and status

---

## 16) Tours UI

### 16.1 Tours List
- columns:
  - code
  - name
  - duration
  - active
- actions:
  - New tour (STAFF+)
  - Edit tour
  - Manage items (link)

### 16.2 Tour Detail
Editable:
- name
- description
- duration_minutes
- active

---

## 17) Tour Items UI

### 17.1 Items List per Tour
- columns:
  - code
  - name
  - kind
  - charge_type
  - optional
  - active

### 17.2 Item Form (Create/Edit)
Fields:
- code (required)
- name (required)
- kind (required)
- charge_type (required)
- is_optional
- default_quantity >=1
- active flag

---

## 18) Passenger Categories UI

### 18.1 List
- code
- name
- age range
- base multiplier
- occupies_capacity
- active

### 18.2 Create/Edit
- code unique
- base multiplier >=0
- occupies_capacity boolean

---

## 19) Pricing UI (STAFF_PRICING+)

### 19.1 Price Books
- list books: USD default, ARS default
- create additional book optional (MVP can keep one per currency)

### 19.2 Item Prices (Validity Ranges)
For a selected tour item and selected price book:
- list ranges:
  - valid_from
  - valid_to (or infinity)
  - unit_price
  - active

Actions:
- create new range
- close range (set valid_to)
- disable range (active=false)

Errors:
- overlap returns conflict:
  - show message: “This price overlaps an existing validity range.”

### 19.3 Item Category Rules
For a selected tour item:
- show passenger categories
- allow multiplier override per category
Examples:
- Harberton: child multiplier 0
- Port fee: infant multiplier 0

---

## 20) Users & Roles UI (OWNER)

### 20.1 List users
- name/email
- role
- status

### 20.2 Invite
- email + role

### 20.3 Edit membership
- change role
- deactivate

---

## 21) Audit UI

Visible for:
- OWNER
- STAFF_PRICING

List:
- date
- entity_type
- entity_id
- action
- created_by

Detail:
- changes JSON

---

## 22) Required Alerts & Confirmations (Non-negotiable)

### 22.1 Recalculation warning
When an edit triggers snapshot recalculation:
- must warn:
  - adjustments will be removed
  - totals may change
- require explicit confirmation checkbox

### 22.2 Overbook warning
When capacity exceeded and override is used:
- require reason
- require confirmation
- show resulting overbooked state

### 22.3 Cancel paid warning
- owner-only
- reason required
- show:
  - payments remain recorded
  - accounting remains consistent

### 22.4 Refund validation
- block if refund exceeds payment remaining refundable amount

---

## 23) MVP Screen Checklist (Implementation Acceptance)

MVP is complete when the backoffice supports:

- ✅ Login + agency selection
- ✅ Tours CRUD + items CRUD
- ✅ Passenger categories CRUD
- ✅ Pricing CRUD (validity + category rules)
- ✅ Departures list/calendar + create/edit/close
- ✅ Reservation list + create/edit + detail
- ✅ Snapshot items shown and immutable except via recalculation
- ✅ Payments + refunds entry
- ✅ Adjustments (pricing roles)
- ✅ Audit viewing
- ✅ User management (owner)

---
