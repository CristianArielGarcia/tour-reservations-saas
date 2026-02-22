# Tour Reservations SaaS

A production-ready, multi-tenant SaaS platform for managing tour reservations, pricing, capacity, and payments. Built for tour agencies to manage their operations with a strong backend that enforces business rules and maintains complete audit trails.

## Quick Links to Documentation

- **[Product Scope & MVP](./01_product_scope_mvp.md)** — What's included in the MVP, features, and use cases
- **[Data Model & Schema](./02_data_model_schema.md)** — Database schema, entity relationships, and data structure
- **[Architecture & Technology Stack](./03_architecture_and_tech_stack.md)** — System design, component overview, deployment strategy
- **[API Contract](./04_api_contract.md)** — REST API endpoints, request/response formats, error codes
- **[Business Rules Engine](./06_business_rules_engine.md)** — Pricing logic, capacity rules, validation flows
- **[Developer Runbook](./07_dev_runbook.md)** — Local setup, running tests, deployment procedures

## Project Overview

This is a **monorepo** using **pnpm workspaces** containing:

- **`/apps/api`** — NestJS backend with REST API
- **`/apps/web`** — Next.js frontend (in development)
- **`/packages/database`** — Prisma schema and migrations
- **`/packages/types`** — Shared TypeScript types and DTOs
- **`/infrastructure`** — Docker Compose and database configuration

## Key Architecture Decisions

- **Backend:** NestJS + TypeScript (Fastify adapter)
- **Database:** Supabase (PostgreSQL) with RLS for tenant isolation
- **ORM:** Prisma for type-safe database access
- **Frontend:** Next.js with App Router
- **Package Manager:** pnpm
- **Authentication:** Supabase Auth (JWT-based)

## Multi-Tenancy Model

- Strict agency isolation using `agency_id` in all tables
- Row-Level Security (RLS) enforces tenant data boundaries
- RBAC with role-based guards in backend
- No cross-tenant joins in business logic

## Critical Features

- ✅ Deterministic pricing engine (versioned, non-overlapping ranges)
- ✅ Transactional capacity validation (prevents overbooking)
- ✅ Complete audit logging for compliance
- ✅ Event-driven architecture (ready for WhatsApp/email automation)
- ✅ Payment and refund tracking as accounting records
- ✅ Support for multiple currencies (USD, ARS)
- ✅ Passenger categories with custom pricing rules

## Getting Started

See [Developer Runbook](./07_dev_runbook.md) for:
- Environment setup
- Running locally with `pnpm dev`
- Database migrations
- Running tests
- Deployment procedures

## Security & Compliance

- All mutations enforced via backend only
- Input validation with DTOs and `class-validator`
- Helmet middleware for HTTP security
- JWT authentication with Supabase
- Immutable audit logs for all business events
- No direct database access from frontend

## Deployment Strategy

| Layer    | Platform |
|----------|----------|
| Frontend | Vercel |
| Backend  | Railway / Render / Fly.io |
| Database | Supabase (Managed PostgreSQL) |
| CI/CD    | GitHub Actions |

## Future Roadmap

- [ ] Next.js frontend implementation
- [ ] WhatsApp integration for notifications
- [ ] Email automation
- [ ] Advanced reporting and analytics
- [ ] Multi-currency settlement
- [ ] Mobile app (React Native)

## Contributing

1. Create a branch from `develop`
2. Make your changes following the architecture guidelines
3. Run `pnpm lint`, `pnpm typecheck`, `pnpm build`
4. Submit a pull request

## License

Proprietary — All rights reserved
