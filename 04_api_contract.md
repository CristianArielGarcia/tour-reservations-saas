# 04_api_contract.md
Tour Reservations SaaS (MVP Manual) — REST API Contract v1

> This document is **self-contained** and defines the complete REST API contract for the MVP.
> - Base URLs, auth, headers
> - Standard response/error format
> - Endpoints (CRUD + operations)
> - Request/Response payloads (JSON)
> - Validation rules (MUST)
> - Authorization requirements (role gates)
> - Conflict rules (capacity, pricing validity overlap)
> - Transactional behavior requirements

---

## 1) API Conventions

### 1.1 Base URL
- `/api/v1`

### 1.2 Content Type
- Requests: `Content-Type: application/json`
- Responses: `application/json`

### 1.3 Authentication
- All endpoints require `Authorization: Bearer <JWT>` unless explicitly stated.
- JWT is issued by Supabase Auth.
- Backend MUST verify JWT and set `user_id`.

### 1.4 Agency Context
If a user can belong to multiple agencies, requests MUST include:
- `X-Agency-Id: <agency_uuid>`

If the user belongs to exactly one agency, backend MAY infer it and `X-Agency-Id` is optional.

Backend MUST validate that the user is an ACTIVE member of the agency.

### 1.5 Standard Success Envelope

API MAY return raw objects, but preferred to standardize:

```json
{
  "data": { }
}
```

For lists:

```json
{
  "data": [ ],
  "meta": {
    "page": 1,
    "page_size": 50,
    "total": 123
  }
}
```

### 1.6 Standard Error Envelope

All errors MUST return:

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": { }
  }
}
```

### 1.7 Error Codes (HTTP status mapping)

| HTTP | Code |
|------|------|
| 400  | `validation_error` |
| 401  | `unauthenticated` |
| 403  | `forbidden` |
| 404  | `not_found` |
| 409  | `conflict` (capacity, invalid transition, overlapping price ranges, inconsistent accounting) |
| 422  | `unprocessable` (business rule failure where conflict is not ideal) |
| 500  | `internal_error` |

---

## 2) Role Gates (Authorization)

Roles: `OWNER` · `STAFF` · `STAFF_PRICING` · `VIEWER`

| Role | Permissions |
|------|-------------|
| `VIEWER` | Read-only |
| `STAFF` | Manage tours/items/departures/reservations/payments/refunds (no pricing changes, no adjustments, no overbook) |
| `STAFF_PRICING` | STAFF + pricing + adjustments (+ optional overbook) |
| `OWNER` | Full + manage users + reopen cancelled + cancel paid |

Backend MUST enforce RBAC per endpoint defined below.

---

## 3) Common Data Types

| Type | Values |
|------|--------|
| Currency | `"USD"` or `"ARS"` |
| Reservation Status | `DRAFT` \| `RESERVED` \| `PARTIALLY_PAID` \| `PAID` \| `CONFIRMED` \| `CANCELLED` |
| Tour Item Kind | `BASE` \| `FEE` \| `ADDON` |
| Charge Type | `PER_PERSON` \| `PER_BOOKING` |
| Payment Method | `CASH` \| `TRANSFER` \| `CARD` \| `OTHER` |

---

## 4) Pagination (Lists)

For list endpoints, use:
- `page` (default `1`)
- `page_size` (default `50`, max `200`)

---

## 5) Health

```
GET /health
```

Public endpoint. Response:

```json
{ "data": { "status": "ok" } }
```

---

## 6) Agencies & Users

### 6.1 Get my agencies

```
GET /me/agencies
```

Auth required. Returns agencies where user is ACTIVE member.

```json
{
  "data": [
    { "id": "uuid", "name": "Piratour", "role": "OWNER" }
  ]
}
```

### 6.2 List agency users

```
GET /agencies/:agencyId/users
```

Role: `OWNER`

```json
{
  "data": [
    { "user_id": "uuid", "full_name": "Name", "role": "STAFF", "status": "ACTIVE" }
  ]
}
```

### 6.3 Invite user to agency

```
POST /agencies/:agencyId/users/invite
```

Role: `OWNER`

**Request:**
```json
{
  "email": "user@example.com",
  "role": "STAFF"
}
```

**Response:**
```json
{ "data": { "invited": true } }
```

### 6.4 Update user role

```
PATCH /agencies/:agencyId/users/:userId
```

Role: `OWNER`

**Request:**
```json
{ "role": "STAFF_PRICING", "status": "ACTIVE" }
```

**Response:**
```json
{ "data": { "updated": true } }
```

---

## 7) Tours

### 7.1 List tours

```
GET /tours
```

Role: `VIEWER+`

Query: `active=true|false` (optional)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "code": "PENGUIN_WALK",
      "name": "Terrestrial Penguin Walk",
      "description": "optional",
      "duration_minutes": 420,
      "active": true
    }
  ]
}
```

### 7.2 Create tour

```
POST /tours
```

Role: `STAFF+`

**Request:**
```json
{
  "code": "PENGUIN_WALK",
  "name": "Terrestrial Penguin Walk",
  "description": "optional",
  "duration_minutes": 420
}
```

**Validation:**
- `name` required
- `code` optional but if present must be unique per agency

**Response:**
```json
{ "data": { "id": "uuid" } }
```

### 7.3 Get tour

```
GET /tours/:tourId
```

Role: `VIEWER+`

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "code": "PENGUIN_WALK",
    "name": "Terrestrial Penguin Walk",
    "description": "optional",
    "duration_minutes": 420,
    "active": true
  }
}
```

### 7.4 Update tour

```
PATCH /tours/:tourId
```

Role: `STAFF+`

**Request (partial):**
```json
{
  "name": "New name",
  "description": "optional",
  "duration_minutes": 400,
  "active": true
}
```

**Response:**
```json
{ "data": { "updated": true } }
```

---

## 8) Tour Items

### 8.1 List tour items

```
GET /tours/:tourId/items
```

Role: `VIEWER+`

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "code": "BASE_TOUR",
      "name": "Tour base price",
      "kind": "BASE",
      "charge_type": "PER_PERSON",
      "is_optional": false,
      "default_quantity": 1,
      "active": true
    }
  ]
}
```

### 8.2 Create tour item

```
POST /tours/:tourId/items
```

Role: `STAFF+`

**Request:**
```json
{
  "code": "HARBERTON",
  "name": "Harberton entrance fee",
  "kind": "FEE",
  "charge_type": "PER_PERSON",
  "is_optional": false,
  "default_quantity": 1
}
```

**Validation:**
- `code` unique per `(tour, agency)`
- `default_quantity >= 1`

**Response:**
```json
{ "data": { "id": "uuid" } }
```

### 8.3 Update tour item

```
PATCH /tour-items/:itemId
```

Role: `STAFF+`

**Request (partial):**
```json
{
  "name": "New name",
  "is_optional": true,
  "active": true
}
```

**Response:**
```json
{ "data": { "updated": true } }
```

---

## 9) Passenger Categories

### 9.1 List passenger categories

```
GET /passenger-categories
```

Role: `VIEWER+`

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "code": "CHILD",
      "name": "Child 3-11",
      "min_age_years": 3,
      "max_age_years": 11,
      "base_price_multiplier": 0.6,
      "occupies_capacity": true,
      "active": true
    }
  ]
}
```

### 9.2 Create passenger category

```
POST /passenger-categories
```

Role: `STAFF+`

**Request:**
```json
{
  "code": "INFANT",
  "name": "Infant 0-2",
  "min_age_years": 0,
  "max_age_years": 2,
  "base_price_multiplier": 0.0,
  "occupies_capacity": true
}
```

**Response:**
```json
{ "data": { "id": "uuid" } }
```

### 9.3 Update passenger category

```
PATCH /passenger-categories/:categoryId
```

Role: `STAFF+`

**Request:**
```json
{ "base_price_multiplier": 0.6, "active": true }
```

**Response:**
```json
{ "data": { "updated": true } }
```

---

## 10) Pricing

### 10.1 List price books

```
GET /price-books
```

Role: `STAFF_PRICING+`

**Response:**
```json
{
  "data": [
    { "id": "uuid", "currency": "USD", "name": "default", "active": true },
    { "id": "uuid", "currency": "ARS", "name": "default", "active": true }
  ]
}
```

### 10.2 Create price book

```
POST /price-books
```

Role: `STAFF_PRICING+`

**Request:**
```json
{ "currency": "USD", "name": "default" }
```

**Response:**
```json
{ "data": { "id": "uuid" } }
```

### 10.3 List prices for a tour item

```
GET /tour-items/:itemId/prices
```

Role: `STAFF_PRICING+`

Query: `price_book_id=uuid` (required)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "valid_from": "2026-01-01",
      "valid_to": "2026-03-31",
      "unit_price": 140.00,
      "active": true
    }
  ]
}
```

### 10.4 Create price validity range for a tour item

```
POST /tour-items/:itemId/prices
```

Role: `STAFF_PRICING+`

**Request:**
```json
{
  "price_book_id": "uuid",
  "valid_from": "2026-01-01",
  "valid_to": "2026-03-31",
  "unit_price": 140.00
}
```

**Validation:**
- `valid_to >= valid_from` (if not null)
- `EXCLUDE` constraint prevents overlap; if overlap occurs → `409` with code `pricing_overlap`

**Response:**
```json
{ "data": { "id": "uuid" } }
```

### 10.5 Close an existing price (recommended instead of editing)

```
POST /tour-item-prices/:priceId/close
```

Role: `STAFF_PRICING+`

**Request:**
```json
{ "valid_to": "2026-02-15" }
```

**Response:**
```json
{ "data": { "closed": true } }
```

### 10.6 Soft-disable a price

```
PATCH /tour-item-prices/:priceId
```

Role: `STAFF_PRICING+`

**Request:**
```json
{ "active": false }
```

**Response:**
```json
{ "data": { "updated": true } }
```

### 10.7 Item category rules (override multiplier)

```
GET /tour-items/:itemId/category-rules
```

Role: `STAFF_PRICING+`

**Response:**
```json
{
  "data": [
    { "id": "uuid", "passenger_category_id": "uuid", "multiplier": 0.0, "active": true }
  ]
}
```

---

```
POST /tour-items/:itemId/category-rules
```

Role: `STAFF_PRICING+`

**Request:**
```json
{
  "passenger_category_id": "uuid",
  "multiplier": 0.0
}
```

**Response:**
```json
{ "data": { "id": "uuid" } }
```

---

```
PATCH /tour-item-category-rules/:ruleId
```

Role: `STAFF_PRICING+`

**Request:**
```json
{ "multiplier": 1.0, "active": true }
```

**Response:**
```json
{ "data": { "updated": true } }
```

---

## 11) Departures (Calendar)

### 11.1 List departures

```
GET /departures
```

Role: `VIEWER+`

**Query:**
- `from=YYYY-MM-DD` (required)
- `to=YYYY-MM-DD` (required)
- `tour_id=uuid` (optional)

Response includes derived fields: `capacity_used`, `capacity_remaining`, `is_overbooked`.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "tour_id": "uuid",
      "start_at": "2026-03-27T14:30:00-03:00",
      "capacity_total": 20,
      "capacity_used": 17,
      "capacity_remaining": 3,
      "is_overbooked": false,
      "status": "ACTIVE"
    }
  ]
}
```

### 11.2 Create departure

```
POST /departures
```

Role: `STAFF+`

**Request:**
```json
{
  "tour_id": "uuid",
  "start_at": "2026-03-27T14:30:00-03:00",
  "capacity_total": 20,
  "notes": "optional"
}
```

**Response:**
```json
{ "data": { "id": "uuid" } }
```

### 11.3 Update departure

```
PATCH /departures/:departureId
```

Role: `STAFF+` for time increase; `OWNER` for date changes and capacity reductions below used.

**Request (partial):**
```json
{
  "start_at": "2026-03-27T15:00:00-03:00",
  "capacity_total": 18,
  "notes": "optional",
  "status": "ACTIVE",
  "capacity_change_reason": "string (required if reducing below used)"
}
```

**Rules:**
- If `date(day)` changes and there are reservations → backend MUST trigger snapshot recalculation and delete adjustments.
- If `capacity_total` decreases below `capacity_used` → requires privileged role + reason.

**Response:**
```json
{ "data": { "updated": true } }
```

### 11.4 Close departure

```
POST /departures/:departureId/close
```

Role: `STAFF+`

**Request:**
```json
{ "reason": "optional" }
```

**Response:**
```json
{ "data": { "closed": true } }
```

---

## 12) Reservations

### 12.1 List reservations

```
GET /reservations
```

Role: `VIEWER+`

**Query:**
- `from=YYYY-MM-DD` (optional)
- `to=YYYY-MM-DD` (optional)
- `status=RESERVED|PAID|...` (optional)
- `tour_id=uuid` (optional)
- `departure_id=uuid` (optional)
- `page`, `page_size`

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "departure_id": "uuid",
      "status": "RESERVED",
      "currency": "USD",
      "total_snapshot": 350.00,
      "total_final": 350.00,
      "net_paid": 0.00,
      "balance_due": 350.00,
      "created_at": "2026-02-22T12:00:00Z"
    }
  ],
  "meta": { "page": 1, "page_size": 50, "total": 123 }
}
```

### 12.2 Create reservation

```
POST /reservations
```

Role: `STAFF+` · Status defaults to `RESERVED`.

**Request:**
```json
{
  "departure_id": "uuid",
  "currency": "USD",
  "customer": {
    "full_name": "Juan Perez",
    "email": "juan@email.com",
    "phone": "+549...",
    "lodging_address": "Hotel XYZ"
  },
  "passengers": [
    {
      "first_name": "Juan",
      "last_name": "Perez",
      "birth_date": "1985-02-10",
      "document_id": "P1234567",
      "category_code": "ADULT",
      "email": "optional",
      "phone": "optional",
      "lodging_address": "optional"
    }
  ],
  "selected_addons": [
    { "tour_item_code": "TRAIN_OPTION", "quantity": 1 }
  ],
  "capacity_override": {
    "enabled": false,
    "reason": null
  }
}
```

**Validation MUST:**
- Departure exists and is `ACTIVE`
- `currency` in `(USD, ARS)`
- `customer.full_name` required
- `passengers >= 1`
- Each passenger `document_id` required and unique within reservation
- `category_code` exists for agency
- Addon codes exist and are `ADDON` items for the tour
- Compute capacity within transaction:
  - If capacity exceeded and `override.enabled = false` → `409 capacity_exceeded`
  - If capacity exceeded and `override.enabled = true` → requires privileged role + reason

**Pricing MUST:**
- Resolve prices by departure date and currency
- Apply `BASE` multipliers on `BASE` item only
- Apply item-category overrides for `FEE`/`ADDON`
- Build `reservation_items` snapshot
- Compute `total_snapshot` and `total_final`

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "status": "RESERVED",
    "total_snapshot": 350.00,
    "total_final": 350.00
  }
}
```

### 12.3 Get reservation detail

```
GET /reservations/:reservationId
```

Role: `VIEWER+`

Response includes: customer, passengers, items snapshot, adjustments, payments, refunds, derived accounting totals.

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "status": "RESERVED",
    "currency": "USD",
    "customer": {
      "id": "uuid",
      "full_name": "Juan Perez",
      "email": "x",
      "phone": "y",
      "lodging_address": "z"
    },
    "passengers": [
      { "id": "uuid", "first_name": "Juan", "last_name": "Perez", "document_id": "P123", "category_code": "ADULT" }
    ],
    "items": [
      {
        "id": "uuid",
        "tour_item_id": "uuid",
        "name_snapshot": "Tour",
        "kind_snapshot": "BASE",
        "charge_type_snapshot": "PER_PERSON",
        "quantity": 1,
        "unit_price_snapshot": 140.00,
        "total_price_snapshot": 140.00,
        "pricing_meta": { }
      }
    ],
    "adjustments": [
      { "id": "uuid", "reservation_item_id": "uuid", "type": "DISCOUNT_AMOUNT", "amount": 10.00, "reason": "promo", "created_at": "..." }
    ],
    "payments": [
      { "id": "uuid", "amount": 100.00, "currency": "USD", "method": "TRANSFER", "reference": "abc", "received_at": "..." }
    ],
    "refunds": [
      { "id": "uuid", "payment_id": "uuid", "amount": 20.00, "reason": "partial refund", "created_at": "..." }
    ],
    "totals": {
      "total_snapshot": 350.00,
      "total_final": 340.00,
      "total_paid": 100.00,
      "total_refunded": 20.00,
      "net_paid": 80.00,
      "balance_due": 260.00
    }
  }
}
```

### 12.4 Update reservation

```
PATCH /reservations/:reservationId
```

Role: `STAFF+`

**Request (partial):**
```json
{
  "currency": "ARS",
  "departure_id": "uuid",
  "customer": { "full_name": "New Name", "email": "new@email.com", "phone": "x", "lodging_address": "y" },
  "passengers": [
    { "id": "uuid", "category_code": "CHILD" }
  ],
  "selected_addons": [
    { "tour_item_code": "TRAIN_OPTION", "quantity": 2 }
  ],
  "notes": "optional",
  "capacity_override": { "enabled": true, "reason": "Late extra seats approved" }
}
```

**Rules MUST:**
- If `currency` / `departure` / `passengers` / `categories` / `addons` changed → snapshot recalculation:
  - Delete `reservation_items`
  - Delete adjustments
  - Rebuild snapshot
  - Audit `reservation_recalculated`
- Capacity must be checked transactionally when passenger count or departure changes.
- Overbook requires privilege and reason.

**Response:**
```json
{ "data": { "updated": true } }
```

### 12.5 Change reservation status

```
POST /reservations/:reservationId/status
```

Role: `STAFF+` (`OWNER` required for `PAID→CANCELLED` and `CANCELLED→RESERVED`)

**Request:**
```json
{
  "status": "CANCELLED",
  "reason": "Customer cancelled"
}
```

**Validation:**
- `reason` required for `CANCELLED`
- `CANCELLED→RESERVED` only `OWNER` and capacity rules apply (or overbook)

**Response:**
```json
{ "data": { "status": "CANCELLED" } }
```

---

## 13) Adjustments

### 13.1 Create adjustment

```
POST /reservations/:reservationId/adjustments
```

Role: `STAFF_PRICING+` or `OWNER`

**Request:**
```json
{
  "reservation_item_id": "uuid",
  "type": "DISCOUNT_PERCENT",
  "amount": 10,
  "reason": "Commercial discount"
}
```

**Rules:**
- `reason` required
- `amount >= 0`
- If `DISCOUNT_PERCENT`, amount must be `<= 100`
- Backend recomputes `total_final` and accounting (`balance_due`, etc.)
- Audit required

**Response:**
```json
{ "data": { "id": "uuid" } }
```

### 13.2 Delete adjustment

```
DELETE /adjustments/:adjustmentId
```

Role: `STAFF_PRICING+` or `OWNER`

**Response:**
```json
{ "data": { "deleted": true } }
```

---

## 14) Payments (manual)

### 14.1 Record a payment

```
POST /reservations/:reservationId/payments
```

Role: `STAFF+`

**Request:**
```json
{
  "amount": 350.00,
  "currency": "USD",
  "method": "TRANSFER",
  "reference": "Receipt 123",
  "received_at": "2026-02-22T10:00:00-03:00"
}
```

**Rules:**
- `amount > 0`
- `currency` must equal `reservation.currency` (MVP strict)
- Update derived totals: `total_paid`, `net_paid`, `balance_due`
- Update reservation status based on `net_paid` vs `total_final`

**Response:**
```json
{ "data": { "id": "uuid" } }
```

### 14.2 List payments

```
GET /reservations/:reservationId/payments
```

Role: `VIEWER+`

**Response:**
```json
{
  "data": [
    { "id": "uuid", "amount": 100.00, "currency": "USD", "method": "TRANSFER" }
  ]
}
```

---

## 15) Refunds (manual)

### 15.1 Record a refund for a payment

```
POST /payments/:paymentId/refunds
```

Role: `STAFF+`

**Request:**
```json
{
  "amount": 50.00,
  "reason": "Partial refund",
  "created_at": "2026-02-22T12:00:00-03:00"
}
```

**Rules:**
- `amount > 0`
- Total refunded for payment must not exceed `payment.amount`
- Update reservation derived totals and status

**Response:**
```json
{ "data": { "id": "uuid" } }
```

---

## 16) Audit (read-only)

### 16.1 List audit entries

```
GET /audit
```

Role: `OWNER` (or `STAFF_PRICING+`)

**Query:** `entity_type`, `entity_id`, date range, pagination

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "entity_type": "reservation",
      "entity_id": "uuid",
      "action": "RECALCULATE",
      "changes": { },
      "created_by": "uuid",
      "created_at": "..."
    }
  ]
}
```

---

## 17) Conflict & Validation Rules (Must)

### 17.1 Capacity conflict

If reservation operation exceeds capacity and override not allowed → `HTTP 409`

```json
{
  "error": {
    "code": "capacity_exceeded",
    "details": {
      "capacity_total": 20,
      "capacity_used": 20,
      "requested_additional": 2
    }
  }
}
```

### 17.2 Pricing overlap

On creating price ranges, `EXCLUDE` constraint failure → `409`

```json
{ "error": { "code": "pricing_overlap" } }
```

### 17.3 Invalid status transitions

→ `409`

```json
{ "error": { "code": "invalid_transition" } }
```

### 17.4 Currency mismatch on payments

→ `422`

```json
{ "error": { "code": "currency_mismatch" } }
```

### 17.5 Refund exceeds payment

→ `409`

```json
{ "error": { "code": "refund_exceeds_payment" } }
```

---

## 18) Idempotency (Optional)

MVP MAY skip idempotency. If implemented, support `Idempotency-Key` header for:
- `POST /reservations`
- `POST /reservations/:id/payments`
- `POST /payments/:id/refunds`

---

## 19) Transaction Requirements (Must)

The following endpoints MUST run in a DB transaction:

| Endpoint | Reason |
|----------|--------|
| `POST /reservations` | Capacity check + snapshot + audit |
| `PATCH /reservations/:id` | Capacity check + snapshot rebuild + audit |
| `POST /reservations/:id/status` | Capacity impact + audit |
| `POST /reservations/:id/adjustments` | Totals update + audit |
| `POST /reservations/:id/payments` | Totals update + status update |
| `POST /payments/:id/refunds` | Totals update + refund cap check |
| `PATCH /departures/:id` | Date change / capacity reduction |
| `POST /tour-items/:itemId/prices` | Overlap constraint handling |

Each transaction must include:
- Capacity validation (with row lock via `SELECT ... FOR UPDATE`)
- Snapshot rebuild (if triggered)
- Derived totals update
- Audit insert
