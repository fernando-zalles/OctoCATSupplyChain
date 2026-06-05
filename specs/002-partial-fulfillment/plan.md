# Implementation Plan: Partial Fulfilment

**Branch**: `002-partial-fulfillment` | **Date**: 2026-06-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-partial-fulfillment/spec.md`

## Summary

Extend the Purchase Order system to support per-line-item partial fulfilment.
Suppliers record shipments against individual line items; the PO transitions to
Partially Fulfilled after the first shipment and to Fulfilled when all line item
quantities are satisfied. A new read endpoint exposes the full shipment history per
PO. This feature replaces the existing direct Approved → Fulfilled single-step
transition with a shipment-by-shipment model.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20 LTS (backend); TypeScript 5.x +
React 18 (frontend) — unchanged from feature 001

**Primary Dependencies**: Same as feature 001 — Express 4, better-sqlite3,
express-openapi-validator. No new runtime dependencies.

**Storage**: SQLite via better-sqlite3. Requires schema migration 002 to:
  1. Add `fulfilment_records` table
  2. Recreate `purchase_orders` with updated status CHECK constraint (adds
     `'partially-fulfilled'`)

**Testing**: Vitest (unit + integration + contract); existing test helpers reused

**Target Platform**: Same as feature 001

**Performance Goals**:
- Fulfilment history retrieval ≤ 2 s for up to 1,000 records per PO (SC-103)
- Shipment recording completes in under 500 ms server-side

**Constraints**:
- SQLite CHECK constraints cannot be altered with ALTER TABLE; the `purchase_orders`
  table must be recreated in migration 002 to add `'partially-fulfilled'` to the
  status enum
- The old `POST /api/v1/purchase-orders/:id/fulfil` endpoint is **removed** and
  replaced by the new per-line-item shipment endpoint. Any callers must migrate.
- Fulfilment records are immutable; no UPDATE or DELETE on `fulfilment_records`

**Scale/Scope**: Up to 1,000 fulfilment records per PO; same organisational scale
as feature 001

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Library-First | ✅ PASS | New `lib/partial-fulfilment/` module contains pure shipment logic; route handlers remain thin |
| II. TDD | ✅ PASS | Contract and integration tests written before implementation per task ordering |
| III. Integration Tests Over Mocks | ✅ PASS | Real SQLite with migration 002 applied in test DB; no mock of data layer |
| IV. Simplicity | ✅ PASS | Extends existing repository and service patterns; no new abstraction layers |
| V. REST + OpenAPI | ✅ PASS | New endpoints added to `backend/openapi.yaml`; validator enforces at runtime |
| VI. TypeScript strict | ✅ PASS | Existing tsconfig unchanged; new files follow same strict rules |
| VII. Minimal Dependencies | ✅ PASS | Zero new runtime dependencies |

## Project Structure

### Documentation (this feature)

```text
specs/002-partial-fulfillment/
├── plan.md                    # This file
├── research.md                # Phase 0 output
├── data-model.md              # Phase 1 output
├── quickstart.md              # Phase 1 output
├── contracts/
│   └── openapi-patch.yaml    # New/changed endpoints only
└── tasks.md                  # Phase 2 output (/speckit-tasks)
```

### Source Code changes (repository root)

```text
backend/
├── db/migrations/
│   └── 002_partial_fulfilment.sql      # NEW
├── src/
│   ├── lib/
│   │   └── partial-fulfilment/         # NEW
│   │       ├── fulfilment.lib.ts
│   │       └── fulfilment.lib.test.ts
│   ├── repositories/
│   │   └── fulfilment.repository.ts    # NEW (insert + read only)
│   ├── services/
│   │   └── purchase-order.service.ts   # MODIFIED — adds recordShipment, getFulfilmentHistory
│   └── api/
│       └── routes/
│           └── purchase-orders.ts      # MODIFIED — adds shipment + history routes,
│                                       #   removes old POST /:id/fulfil
├── openapi.yaml                        # MODIFIED
└── tests/
    ├── contract/
    │   ├── shipment.test.ts            # NEW
    │   └── fulfilment-history.test.ts  # NEW
    └── integration/
        └── partial-fulfilment.test.ts  # NEW

frontend/
└── src/
    └── pages/
        └── PurchaseOrderDetailPage.tsx # MODIFIED — per-line-item shipment form
```

**Structure Decision**: Extension of existing web application (feature 001). No new
top-level directories. New `lib/partial-fulfilment/` follows established `lib/<domain>/`
pattern.

## Complexity Tracking

> No constitution violations for this feature.
