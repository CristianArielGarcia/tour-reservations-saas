# 03_architecture_and_tech_stack.md
Tour Reservations SaaS — Architecture & Technology Stack

## Table of Contents
1. [Architectural Goals](#1-architectural-goals)
2. [Technology Stack](#2-technology-stack-final-decisions)
3. [Authentication & Authorization](#3-authentication--authorization)
4. [Multi-Tenancy Strategy](#4-multi-tenancy-strategy)
5. [Backend Module Structure](#5-backend-module-structure-nestjs)
6. [Transaction Strategy](#6-transaction-strategy)
7. [Event-Ready Architecture](#7-event-ready-architecture-future-automation)
8. [Pricing Engine](#8-pricing-engine-placement)
9. [Capacity Engine](#9-capacity-engine-placement)
10. [Logging & Audit](#10-logging--audit-strategy)
11. [Error Handling](#11-error-handling-strategy)
12. [Migration Strategy](#12-migration-strategy)
13. [Environment Configuration](#13-environment-strategy)
14. [Deployment Strategy](#14-deployment-strategy-initial)
15. [Scaling Strategy](#15-scaling-strategy)
16. [Migration Off Supabase](#16-migration-off-supabase-future-proofing)
17. [Security Principles](#17-security-principles)
18. [Summary](#18-summary)

---

# 1. Architectural Goals

The architecture must:

1. Support multi-tenant SaaS from day one.
2. Allow strict business rule enforcement in backend.
3. Keep database portable (avoid vendor lock-in).
4. Be automation-ready (WhatsApp, email, payments later).
5. Be maintainable by a small team (initially 1 founder).
6. Be migration-friendly if scaling requires moving away from Supabase.
7. Separate concerns cleanly:
   - Product logic
   - Persistence
   - API
   - UI
   - Future automation layer

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT TIER                                   │
│  ┌──────────────────────┐                                           │
│  │   Next.js Frontend   │                                           │
│  │  (Browser + Server)  │                                           │
│  └──────────────────────┘                                           │
└────────────────┬────────────────────────────────────────────────────┘
                 │ HTTPS + JWT
                 │
┌────────────────┴────────────────────────────────────────────────────┐
│                        API TIER                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │           NestJS Backend (Node.js LTS)                       │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │        NestJS Modules                                  │  │  │
│  │  │  ┌──────────────────────────────────────────────────┐  │  │  │
│  │  │  │ Auth | Agencies | Tours | Departures | Pricing   │  │  │  │
│  │  │  │ Reservations | Payments | Capacity | Audit       │  │  │  │
│  │  │  └──────────────────────────────────────────────────┘  │  │  │
│  │  │                                                         │  │  │
│  │  │  ┌──────────────────────────────────────────────────┐  │  │  │
│  │  │  │ Core Services                                    │  │  │  │
│  │  │  │ • Pricing Engine (deterministic calculations)   │  │  │  │
│  │  │  │ • Capacity Engine (transactional validation)    │  │  │  │
│  │  │  │ • Payment Service (accounting records)          │  │  │  │
│  │  │  │ • Audit Logger (immutable business events)      │  │  │  │
│  │  │  └──────────────────────────────────────────────────┘  │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │                        ↓ Prisma ORM                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────┬────────────────────────────────────────────────────┘
                 │ JDBC / TCP Port 5432
                 │
┌────────────────┴────────────────────────────────────────────────────┐
│                        DATA TIER                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Supabase (PostgreSQL + RLS + Auth)                         │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  Agencies | Users | Tours | Items | Departures       │  │  │
│  │  │  Reservations | Passengers | Pricing | Payments       │  │  │
│  │  │  Audit Log | Category Rules                           │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │                                                              │  │
│  │  RLS Policies: Tenant isolation per agency_id              │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

# 2. Technology Stack (Final Decisions)

## Backend
- **Framework:** NestJS
- **Language:** TypeScript
- **Runtime:** Node.js LTS
- **HTTP adapter:** Fastify (via Nest adapter)

Reason:
- Mature structure
- Dependency injection
- Guards for RBAC
- Pipes for validation
- Interceptors for audit logging
- Strong modularity

---

## ORM
- **Prisma**

Reason:
- Mature and widely adopted
- Excellent TypeScript support
- Strong migration tooling
- Clean schema definition
- Compatible with Supabase/Postgres
- Easy to migrate to pure Postgres later

---

## Database
- **Supabase (PostgreSQL)**

Reason:
- Managed Postgres
- Built-in Auth
- RLS support
- Good DX
- Easy migration path to standard Postgres

> **Important:** Business logic must not rely on Supabase-specific features.

---

## Frontend
- **Next.js (App Router)**
- **TypeScript**
- UI library TBD (e.g., shadcn/ui or similar)

Reason:
- Server + client rendering flexibility
- Easy deployment
- Good integration with API backend
- Suitable for backoffice dashboards

---

## Monorepo Structure
- Package manager: **pnpm**
- Repository structure:

```
/apps
  /api        → NestJS backend
  /web        → Next.js frontend

/packages
  /database   → Prisma schema + migrations
  /types      → Shared DTOs & types
  /config     → Shared tsconfig, eslint config

/infrastructure
  docker-compose.yml
  supabase/

docs/
  01_product_scope_mvp.md
  02_data_model_schema.md
  03_architecture_and_tech_stack.md
  ...
```

Reason for monorepo:
- Shared types between backend and frontend
- Easier refactoring
- Single source of truth
- Better for solo founder velocity

---

# 3. Authentication & Authorization

## Authentication
- Supabase Auth (JWT-based)
- Backend verifies JWT
- Frontend never accesses DB directly

## Authorization
- RBAC enforced in backend
- Roles loaded from `agency_users`
- Guards implemented per route

> RLS is used **only** for tenant isolation. Never rely on RLS for business permissions.

---

# 4. Multi-Tenancy Strategy

Each domain table includes `agency_id`.

**Backend:**
- Extract agency context from JWT or request header
- Validate user membership
- Enforce role permissions

**RLS:**
- Ensures row-level isolation
- Prevents cross-tenant data access

No cross-tenant joins allowed in business logic.

---

# 5. Backend Module Structure (NestJS)

```
src/
  modules/
    auth/
    users/
    agencies/
    tours/
    pricing/
    departures/
    reservations/
    payments/
    audit/
```

Each module contains:
- controller
- service
- repository layer (Prisma access)
- DTOs
- guards

> No business logic in controllers.

---

# 6. Transaction Strategy

Critical operations must use DB transactions:

- Creating reservation
- Updating passengers
- Changing departure
- Overbooking
- Applying adjustments
- Recording payment/refund

Prisma transaction API must wrap:
- Capacity check
- Snapshot rebuild
- Status update
- Audit insert

> No partial updates allowed.

---

# 7. Event-Ready Architecture (Future Automation)

System must emit domain events internally.

Examples:
- `reservation.created`
- `reservation.updated`
- `reservation.paid`
- `reservation.cancelled`
- `departure.overbooked`

Implementation:
- Initially: simple event emitter inside backend
- Later: outbox pattern table for async workers

> No automation logic inside reservation service itself.

---

# 8. Pricing Engine Placement

Pricing resolution must be:
- Pure backend service
- Deterministic
- Stateless
- Fully testable

No pricing logic in frontend.

Algorithm responsibilities:
- Resolve valid price by date
- Apply base multipliers
- Apply category overrides
- Generate snapshot lines
- Compute totals

---

# 9. Capacity Engine Placement

Capacity calculation must:
- Run inside transaction
- Lock departure row when validating
- Prevent race conditions

Implementation detail:
- `SELECT ... FOR UPDATE` on departure
- Recompute `capacity_used` inside transaction

---

# 10. Logging & Audit Strategy

Two layers:

1. Operational logging (console/log system)
2. Business `audit_log` table

Audit must log:
- Entity type
- Entity ID
- Action
- Before/after changes (JSON)
- User ID
- Timestamp

> No critical mutation without audit entry.

---

# 11. Error Handling Strategy

Use structured error responses:

| Code | Meaning |
|------|---------|
| 400  | Validation error |
| 401  | Unauthenticated |
| 403  | Unauthorized |
| 404  | Not found |
| 409  | Conflict (capacity / pricing overlap / etc.) |
| 500  | Internal error |

> Never leak DB errors directly.

---

# 12. Migration Strategy

Prisma migrations stored in:

```
/packages/database/prisma/migrations
```

Rules:
- Never edit old migrations.
- Create new migration per schema change.
- Version control everything.

---

# 13. Environment Strategy

## Environments
- `local`
- `staging`
- `production`

Variables:
```
DATABASE_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET
APP_BASE_URL
```

> Secrets never stored in repo.

---

# 14. Deployment Strategy (Initial)

| Layer    | Platform |
|----------|----------|
| Backend  | Railway / Render / Fly.io / similar |
| Frontend | Vercel (ideal for Next.js) |
| Database | Supabase managed instance |

CI via **GitHub Actions:**
- Lint
- Type check
- Build

---

# 15. Scaling Strategy

When growth happens:

1. Move to dedicated Postgres if needed.
2. Add read replicas.
3. Introduce caching layer (Redis) for capacity-heavy queries.
4. Introduce queue system for automation (BullMQ / similar).
5. Split automation workers from API.

> The core schema remains unchanged.

---

# 16. Migration Off Supabase (Future-Proofing)

To migrate:
- Export Postgres DB
- Replace Supabase Auth with:
  - Custom JWT server
  - Auth0
  - Clerk
- Keep Prisma schema unchanged
- Keep RLS optional

> No business logic tied to Supabase APIs.

---

# 17. Security Principles

- All mutations via backend only.
- No direct DB writes from frontend.
- Validate all inputs with DTO + `class-validator`.
- Sanitize text fields.
- Rate limit sensitive endpoints.
- Use `helmet` middleware.
- Validate currency consistency on payments.

---

# 18. Testing Strategy

## Unit Tests
- Test pricing engine calculations in isolation
- Test capacity engine logic independently
- Test each service's business logic without DB

## Integration Tests
- Test module interactions (e.g., ReservationsService calling PricingEngine)
- Test full reservation flow with transactional rollback
- Test RBAC guards and authorization

## E2E Tests
- Test complete API workflows (create reservation → pay → verify audit)
- Test multi-tenant isolation (ensure cross-tenant data leaks don't occur)
- Test error scenarios (overbooking, pricing conflicts, etc.)

## Testing Tools
- Framework: Jest
- Database: Isolated test DB or testcontainers
- Mocking: jest.mock() for external services (Supabase, payments)

> Always test the critical path: reservation creation, payment, and audit logging.

---

# 19. CI/CD Pipeline

## GitHub Actions Workflow

```yaml
name: Build & Test

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm typecheck

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm build

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm test --run
```

## Deployment
- **Backend:** Automatic deploy to staging on merge to develop; manual approval to production.
- **Frontend:** Automatic deploy to production on merge to main via Vercel.

---

# 20. Key Data Flows

## Reservation Creation Flow

```
1. Frontend submits CreateReservationDto
   ↓
2. Backend validates DTO (pipes)
   ↓
3. Auth guard verifies JWT and extracts agency_id
   ↓
4. ReservationsService.create() starts transaction
   ↓
5. Capacity validation (SELECT ... FOR UPDATE on departure)
   ↓
6. PricingEngine resolves current prices
   ↓
7. Apply passenger categories and overrides
   ↓
8. Insert reservation + passengers + snapshot
   ↓
9. Emit domain event: reservation.created
   ↓
10. Return 201 + reservation details
```

## Payment Recording Flow

```
1. Webhook from payment provider → Backend payment controller
   ↓
2. Verify webhook signature
   ↓
3. PaymentsService.recordPayment() starts transaction
   ↓
4. Fetch reservation and verify amount
   ↓
5. Update reservation.payment_status
   ↓
6. Insert audit log entry
   ↓
7. Emit domain event: reservation.paid
   ↓
8. Return 200 OK
   ↓
9. Trigger notification automation (future: email/WhatsApp)
```

## Overbooking Prevention Flow

```
1. Reservation creation → CapacityEngine.validate()
   ↓
2. SELECT departure FOR UPDATE (locks row)
   ↓
3. Recalculate capacity_used from reservations
   ↓
4. If capacity_used + new_passengers > capacity → THROW conflict error
   ↓
5. Otherwise → transaction proceeds
   ↓
6. UNLOCK on transaction commit
```

---

# 21. Module Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                   AppModule (Entry Point)                        │
└─────────────────────────────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ↓                    ↓                    ↓
   ┌─────────┐           ┌─────────┐        ┌──────────┐
   │ AuthMod │           │PrismaServ│      │HelmMid   │
   └─────────┘           └─────────┘        └──────────┘
        │                     │
        │         ┌───────────┼───────────────┐
        │         │           │               │
        ↓         ↓           ↓               ↓
   ┌──────────────────────────────────────────────┐
   │   ReservationsService (Core)                 │
   │   - calls PricingEngine                      │
   │   - calls CapacityEngine                     │
   │   - calls AuditService                       │
   └──────────────────────────────────────────────┘
        │      │           │
        │      │           └──→ PricingService
        │      └──────────────→ DeparturesService
        │                       TourItemsService
        │
        └──────────────────────→ PaymentsService
                                AuditService
```

---

# 22. Summary

| Layer        | Technology |
|--------------|------------|
| Backend      | NestJS + Prisma |
| Database     | Supabase Postgres |
| Frontend     | Next.js |
| Repo         | Monorepo (pnpm) |
| Auth         | Supabase JWT |
| Multi-tenancy | `agency_id` + RLS |
| Pricing      | Versioned + non-overlapping ranges |
| Capacity     | Derived + transactional validation |
| Accounting   | Manual payment/refund consistency |
| Testing      | Jest + E2E integration tests |
| CI/CD        | GitHub Actions |
| Deployment   | Vercel (Frontend), Railway/Render (Backend), Supabase (DB) |

This architecture supports:
- Immediate MVP launch
- Multi-agency SaaS with strict tenant isolation
- Deterministic pricing calculations
- Transactional capacity validation (no overbooking)
- Complete audit trails for compliance
- Automation expansion (event-driven foundation)
- Horizontal scaling via caching and queues
- Migration flexibility (away from Supabase without code changes)
