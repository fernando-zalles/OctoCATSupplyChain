# Implementation Plan: Purchase Order Management

**Branch**: `001-purchase-order-management` | **Date**: 2026-06-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-purchase-order-management/spec.md`

## Summary

Build a full-stack Purchase Order management system allowing branch buyers to create
POs against suppliers, route high-value POs (≥ $10,000) through an approval workflow,
notify suppliers at submission and approval, and track the full lifecycle (Draft →
Submitted → Approved → Fulfilled / Cancelled). The system uses an Express.js REST API
(TypeScript, OpenAPI spec-first) backed by SQLite, with a React frontend. TDD is
enforced: contract and integration tests are written first against a real SQLite
database; all business logic lives in independently testable `lib/` modules.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20 LTS (backend); TypeScript 5.x with
React 18 (frontend)

**Primary Dependencies**:
- Backend: Express 4, better-sqlite3, express-openapi-validator, nodemailer (stub)
- Frontend: React 18, React Router 6, React Hook Form
- Dev: Vitest, Playwright, ESLint, Prettier

**Storage**: SQLite via better-sqlite3 (synchronous driver; no ORM)

**Testing**: Vitest (unit + integration + contract), Playwright (E2E)

**Target Platform**: Web browser (desktop); Node.js 20 LTS server

**Project Type**: Web application (REST API backend + React SPA frontend)

**Performance Goals**:
- PO list retrieval ≤ 2 s for up to 10,000 POs (SC-006)
- Supplier notifications generated within 30 s of triggering transition (SC-002)

**Constraints**:
- No authentication implementation — JWT claims supply user identity and roles
- No product/supplier/branch management — those entities are read-only from existing
  data
- Single base currency; no multi-currency
- Mobile out of scope for v1

**Scale/Scope**: Single-organisation deployment; up to 10,000 POs; web browsers only

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Library-First | ✅ PASS | All business logic in `backend/src/lib/`; routes are thin |
| II. TDD | ✅ PASS | Contract tests written first; Red-Green-Refactor enforced in tasks |
| III. Integration Tests Over Mocks | ✅ PASS | SQLite used in all persistence tests; Nodemailer mocked (external I/O exception documented) |
| IV. Simplicity Over Abstraction | ⚠️ VIOLATION | Repository pattern used — justified in Complexity Tracking |
| V. REST + OpenAPI | ✅ PASS | OpenAPI 3.x spec-first; express-openapi-validator enforces at runtime |
| VI. TypeScript strict | ✅ PASS | strict: true in both tsconfig files; no `any` |
| VII. Minimal Dependencies | ✅ PASS | All deps evaluated; Playwright transitive dep count accepted (E2E requires browser automation) |

## Project Structure

### Documentation (this feature)

```text
specs/001-purchase-order-management/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── openapi.yaml     # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── lib/
│   │   ├── purchase-orders/          # PO creation, validation, state machine
│   │   │   ├── po.lib.ts
│   │   │   └── po.lib.test.ts
│   │   ├── approval/                 # Approval workflow, threshold logic
│   │   │   ├── approval.lib.ts
│   │   │   └── approval.lib.test.ts
│   │   └── notifications/            # Notification record creation
│   │       ├── notification.lib.ts
│   │       └── notification.lib.test.ts
│   ├── repositories/
│   │   ├── purchase-order.repository.ts
│   │   ├── line-item.repository.ts
│   │   ├── audit.repository.ts
│   │   └── notification.repository.ts
│   ├── services/
│   │   ├── purchase-order.service.ts
│   │   └── notification.service.ts
│   └── api/
│       ├── routes/
│       │   └── purchase-orders.ts
│       ├── middleware/
│       │   └── auth.ts
│       └── app.ts
├── db/
│   └── migrations/
│       └── 001_initial_schema.sql
├── tests/
│   ├── contract/                     # API contract tests (written first)
│   ├── integration/                  # DB integration tests (written first)
│   └── unit/                         # Optional edge-case unit tests
└── openapi.yaml                      # Source of truth for API contracts

frontend/
├── src/
│   ├── components/
│   │   └── purchase-orders/
│   ├── pages/
│   │   ├── PurchaseOrderListPage.tsx
│   │   ├── PurchaseOrderDetailPage.tsx
│   │   └── CreatePurchaseOrderPage.tsx
│   ├── context/
│   │   └── AuthContext.tsx
│   └── services/
│       └── api.ts                    # Typed fetch wrappers (no axios)
└── tests/
    └── e2e/                          # Playwright E2E tests
```

**Structure Decision**: Web application (Option 2). Backend and frontend are separate
workspaces in a monorepo root. Backend follows library-first: `lib/` contains pure
business logic, `repositories/` handles SQLite access, `services/` orchestrates,
`api/routes/` are thin Express handlers. Frontend uses React Context for auth state
and typed fetch wrappers — no additional state management library.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Repository pattern (Principle IV) | 8 distinct entities each requiring CRUD + query operations against SQLite; without repositories, identical query patterns repeat across every service function exceeding the 3-instance threshold immediately | Direct DB access in service functions would scatter SQL strings across business logic, making integration testing and query reuse impractical at this entity count |
