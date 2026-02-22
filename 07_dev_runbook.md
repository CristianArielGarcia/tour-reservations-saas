# 07_dev_runbook.md
Tour Reservations SaaS (MVP Manual) — Developer Runbook v1

> This document is **self-contained** and describes how to:
> - Create the repository structure (monorepo)
> - Set up Supabase (project, schema, RLS)
> - Configure backend (NestJS + Prisma)
> - Configure frontend (Next.js)
> - Run everything locally
> - Apply migrations + seed demo data
> - Common commands and troubleshooting
>
> **Assumptions:**
> - Node.js LTS installed
> - pnpm installed
> - Docker installed (optional but recommended)
> - A Supabase project exists (or you will create one)

---

## 1) Repository Layout (Monorepo)

```
/apps
  /api          # NestJS backend (Fastify adapter)
  /web          # Next.js backoffice

/packages
  /database     # Prisma schema + migrations + seeds
  /types        # Shared DTOs/types (optional, MVP-friendly)
  /config       # Shared lint/ts configs

/infrastructure
  docker-compose.yml    # optional local helpers
  supabase/             # SQL scripts for schema/RLS/bootstrap

/docs
  01_product_scope_mvp.md
  02_data_model_schema.md
  03_architecture_and_tech_stack.md
  04_api_contract.md
  05_backoffice_ui.md
  06_business_rules_engine.md
  07_dev_runbook.md
```

---

## 2) Tooling Versions (Recommended)

| Tool | Version |
|------|---------|
| Node.js | LTS (>= 20) |
| pnpm | Latest stable |
| PostgreSQL | Managed by Supabase |
| Prisma | Latest stable compatible with Node |
| NestJS | Latest stable |
| Next.js | Latest stable |

---

## 3) Initializing the Repo

### 3.1 Create repo + install pnpm workspace

At repo root:

```bash
pnpm init
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

---

## 4) Supabase Setup (MVP)

### 4.1 Create Supabase Project

In the Supabase dashboard, create a new project and save:
- Project URL
- Anon key
- Service role key
- DB connection string

### 4.2 Configure Auth
- Enable email/password authentication
- Optional: disable email confirmations for staging/dev

### 4.3 Apply DB Schema

Create the following folder structure:

```
/infrastructure/supabase/sql
  001_extensions.sql
  002_enums.sql
  003_schema.sql
  004_rls.sql
  005_policies.sql
```

Copy SQL definitions from `02_data_model_schema.md` and apply in the Supabase SQL editor in order: extensions → enums → schema → rls enable → policies.

---

## 5) Prisma Setup (`packages/database`)

### 5.1 Create package

```bash
mkdir -p packages/database
cd packages/database
pnpm init
pnpm add prisma @prisma/client
pnpm prisma init
```

### 5.2 Schema location

```
packages/database/prisma/schema.prisma
```

### 5.3 DB connection

In repo root `.env` (or `.env.local` for dev):

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/postgres?schema=public"
```

Supabase provides both a direct connection string and a pooled connection string. Use the pooled one for runtime if needed; use direct for migrations.

### 5.4 Generate client

```bash
pnpm prisma generate
```

### 5.5 Migrations

Use Prisma migrations **only**. Never edit old migrations.

```bash
pnpm prisma migrate dev --name init
```

If you applied schema manually in Supabase first:
- Baseline Prisma using `prisma db pull`
- Then create the correct schema file

**Preferred approach for consistency:** store schema in Prisma → migrate → apply migrations to Supabase.

---

## 6) Backend Setup (`apps/api`)

### 6.1 Create NestJS app

```bash
mkdir -p apps/api
cd apps/api
pnpm dlx @nestjs/cli new api --package-manager pnpm
```

Switch to Fastify:

```bash
pnpm add @nestjs/platform-fastify fastify
```

### 6.2 Dependencies

```bash
pnpm add @prisma/client
pnpm add class-validator class-transformer
pnpm add @supabase/supabase-js
pnpm add zod
pnpm add helmet
pnpm add @nestjs/config
pnpm add pino pino-pretty
```

> MVP can use `class-validator` since NestJS integrates it easily. `zod` is optional.

### 6.3 Environment variables (`apps/api/.env`)

```env
PORT=3001

DATABASE_URL="..."

SUPABASE_URL="https://xxxxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="xxxx"
SUPABASE_JWT_SECRET="xxxx"

APP_ENV="local"
```

### 6.4 Prisma client in monorepo

Generate client in `packages/database` and have the backend depend on that package via workspace reference. `packages/database` should export the Prisma client.

---

## 7) Frontend Setup (`apps/web`)

### 7.1 Create Next.js app

```bash
mkdir -p apps/web
cd apps/web
pnpm dlx create-next-app@latest web --ts --app
```

### 7.2 Environment variables (`apps/web/.env.local`)

```env
NEXT_PUBLIC_API_BASE_URL="http://localhost:3001/api/v1"
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="xxxxx"
```

**Frontend responsibilities:**
- Login via Supabase Auth
- Call backend with `Bearer` token
- Never write to DB directly

---

## 8) Local Run (Development)

### 8.1 Install all deps

```bash
pnpm install
```

### 8.2 Run backend

```bash
pnpm --filter api dev
```

### 8.3 Run frontend

```bash
pnpm --filter web dev
```

Expected:
- API → `http://localhost:3001`
- Web → `http://localhost:3000`

---

## 9) Workspace Scripts (Recommended)

In root `package.json`:

```json
{
  "scripts": {
    "dev":       "pnpm -r --parallel dev",
    "build":     "pnpm -r build",
    "lint":      "pnpm -r lint",
    "typecheck": "pnpm -r typecheck"
  }
}
```

---

## 10) Database Seed (MVP Demo Data)

### 10.1 Why seeding is needed

To test the MVP quickly, you need:
- An agency
- Passenger categories (ADULT/CHILD/INFANT)
- A tour with items
- Price books for USD and ARS
- Initial validity price ranges
- Departures

### 10.2 Seed approach

Create `packages/database/seed.ts` with the following actions (in order):

1. Create agency: `"Demo Agency"`
2. Create passenger categories: `ADULT`, `CHILD`, `INFANT`
3. Create tour: `"Terrestrial Penguin Walk"`
4. Create tour items:
   - `BASE_TOUR` (BASE, PER_PERSON)
   - `HARBERTON` (FEE, PER_PERSON)
   - `PORT_FEE` (FEE, PER_PERSON)
   - `TRAIN_OPTION` (ADDON, PER_PERSON, optional)
5. Create price books: USD default, ARS default
6. Create `tour_item_prices` validity ranges
7. Create category rules:
   - `HARBERTON`: CHILD = 0, INFANT = 0
   - `BASE` handled by `base_price_multiplier`
8. Create departures for the next several days

> The seed SHOULD be **idempotent**: use upserts by `(agency_id, code)`.

---

## 11) RLS Troubleshooting

Prisma uses the DB connection credentials directly. If those credentials are not a Postgres superuser, RLS will apply.

**Options:**

| Approach | Notes |
|----------|-------|
| Use a DB role that bypasses RLS | Not broadly recommended |
| Keep RLS + ensure `agency_id` is valid | Recommended for MVP |

**Recommended approach:**
- Keep RLS enabled on all tenant tables
- Ensure every insert includes a valid `agency_id` matching user membership
- Never access the DB directly from the frontend — only the backend uses the DB

---

## 12) Common Commands

### Prisma

```bash
pnpm prisma generate         # regenerate client after schema changes
pnpm prisma migrate dev      # create + apply a new migration (dev)
pnpm prisma migrate deploy   # apply pending migrations (prod)
pnpm prisma studio           # visual DB browser
pnpm prisma db pull          # introspect existing DB into schema
```

### Backend

```bash
pnpm --filter api start:dev   # watch mode
pnpm --filter api build       # production build
pnpm --filter api start:prod  # run production build
```

### Frontend

```bash
pnpm --filter web dev         # watch mode
pnpm --filter web build       # production build
pnpm --filter web start       # run production build
```

---

## 13) Operational Guardrails (MVP)

- All reservation create/update operations must be **transactional**.
- Departure row must be **locked** (`FOR UPDATE`) during capacity validation.
- Missing price must **block** reservation creation entirely.
- Recalculation **deletes adjustments** (strict MVP rule).
- Cancelling a paid reservation requires `OWNER` role.

---

## 14) Troubleshooting

### 14.1 `pricing_overlap` errors

**Cause:** Overlapping validity ranges for the same `tour_item` + currency.

**Fix:** Close old ranges (`valid_to`) before creating new ones.

### 14.2 Capacity conflicts

**Cause:** Departure is full and no override is enabled.

**Fix:** Increase `capacity_total`, or overbook with a privileged role and reason.

### 14.3 Currency mismatch

**Cause:** Payment currency differs from reservation currency.

**Fix:** Enforce that payment currency selection matches reservation currency (UI + backend).

### 14.4 RLS blocks inserts

**Cause:** `agency_id` in the request does not match the user's membership.

**Fix:** Ensure the request includes `X-Agency-Id` and the user is an active member of that agency.

---

## 15) MVP Ready Criteria (Local)

You are MVP-ready when you can locally:

- [ ] Create agency + user membership
- [ ] Create tour + items
- [ ] Create price books + validity prices
- [ ] Create departures
- [ ] Create reservation (auto pricing snapshot)
- [ ] Record payment
- [ ] Record refund
- [ ] See status updates and accounting totals
- [ ] See `capacity_used` / `capacity_remaining` in departures
- [ ] Confirm audit entries are created for critical actions
