---
description: "Task list for Partial Fulfilment feature"
---

# Tasks: Partial Fulfilment

**Input**: Design documents from `/specs/002-partial-fulfillment/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/openapi-patch.yaml ✅

**TDD Policy**: Per constitution Principle II, contract and integration tests MUST be
written and confirmed FAILING before any implementation task in the same story begins.

**Context**: This feature extends the existing Purchase Order system from feature 001.
The old `POST /api/v1/purchase-orders/:id/fulfil` endpoint is **removed** in Phase 2
before any user story work begins.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

- Backend source: `backend/src/`
- Backend tests: `backend/tests/`
- Frontend source: `frontend/src/`
- Migrations: `backend/db/migrations/`
- OpenAPI spec: `backend/openapi.yaml`

---

## Phase 1: Setup

**Purpose**: Create new directories needed for this feature's lib and repository files.

- [x] T001 Create `backend/src/lib/partial-fulfilment/` directory for the new pure-logic module

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Migration, type updates, OpenAPI changes, and removal of the old single-step
fulfil endpoint. ALL must complete before any user story work begins.

**⚠️ CRITICAL**: The old `POST /:id/fulfil` route is removed here. Tests relying on it will
break until the new shipment route (US1) is in place.

- [x] T002 Write `backend/db/migrations/002_partial_fulfilment.sql` — uses SQLite table-recreation pattern to add `'partially-fulfilled'` to `purchase_orders.status` CHECK constraint, then creates `fulfilment_records` table with all columns and indexes from data-model.md; wraps entire migration in `PRAGMA foreign_keys = OFF / ON`
- [x] T003 Update `POStatus` type alias in `backend/src/repositories/purchase-order.repository.ts` to include `'partially-fulfilled'` alongside the existing five status values
- [x] T004 [P] Update `backend/openapi.yaml` — (a) add `'partially-fulfilled'` to all `PurchaseOrderStatus` enum occurrences, (b) remove the `POST /purchase-orders/{id}/fulfil` path block, (c) add `POST /purchase-orders/{id}/line-items/{lineItemId}/shipments` path, (d) add `GET /purchase-orders/{id}/fulfilment-history` path, (e) add `RecordShipmentRequest` and `FulfilmentRecord` schemas — use `specs/002-partial-fulfillment/contracts/openapi-patch.yaml` as the source
- [x] T005 Remove the `fulfil()` method and its `POST /:id/fulfil` Express route from `backend/src/services/purchase-order.service.ts` and `backend/src/api/routes/purchase-orders.ts`
- [x] T006 [P] Remove `fulfilPO` from `frontend/src/services/api.ts` and remove the Fulfil button block from `frontend/src/pages/PurchaseOrderDetailPage.tsx` (the per-line-item shipment UI replaces it in US1)

**Checkpoint**: Migration file exists, types updated, OpenAPI updated, old endpoint removed.
Run `npm test` — existing tests that called the fulfil endpoint will now fail; that is expected and will be fixed by US2.

---

## Phase 3: User Story 1 - Supplier Records a Partial Shipment (Priority: P1) 🎯 MVP

**Goal**: Supplier records a quantity against a specific line item on an Approved PO.
PO transitions to Partially Fulfilled. Progress (fulfilled/ordered) is visible per line item.

**Independent Test**: Approved PO with two line items (5 units each). Record 3 units on
line item 1. Verify PO status = `partially-fulfilled`, line item 1 shows 3/5, line item 2
shows 0/5, one fulfilment record exists.

### Tests for User Story 1 ⚠️ Write these FIRST — confirm they FAIL before T011

- [x] T007 [P] [US1] Contract test: `POST /api/v1/purchase-orders/:id/line-items/:lineItemId/shipments` on an Approved PO with `{"quantityFulfilled": 3}` returns 201 and PO status `partially-fulfilled` in `backend/tests/contract/shipment.test.ts`
- [x] T008 [P] [US1] Contract test: over-delivery returns 409 — submit qty that would cause `cumulative > ordered` in `backend/tests/contract/shipment.test.ts`
- [x] T009 [P] [US1] Contract test: shipment on a Draft/Submitted/Cancelled PO returns 409 in `backend/tests/contract/shipment.test.ts`
- [x] T010 [US1] Integration test: partial shipment workflow — create Approved PO with 2 line items, record partial shipment on line item 1, assert PO status=`partially-fulfilled`, assert `fulfilment_records` row exists with correct `cumulative_qty`, assert audit entry appended in `backend/tests/integration/partial-fulfilment.test.ts`
- [x] T011 [P] [US1] Unit tests for `fulfilment.lib.ts`: `validateShipment` throws on qty≤0, throws on over-delivery; `computePOStatus` returns `partially-fulfilled` when any line item has outstanding qty, returns `fulfilled` when all line items complete in `backend/src/lib/partial-fulfilment/fulfilment.lib.test.ts`

### Implementation for User Story 1

- [x] T012 [US1] Implement `backend/src/lib/partial-fulfilment/fulfilment.lib.ts` — exports: `validateShipment(currentCumulativeQty: number, incomingQty: number, orderedQty: number): void` (throws `ValidationError` on over-delivery or invalid qty); `computePOStatus(items: Array<{quantity: number, fulfilledQty: number}>): 'partially-fulfilled' | 'fulfilled'`
- [x] T013 [US1] Implement `backend/src/repositories/fulfilment.repository.ts` — methods: `record(input)` (INSERT only, no UPDATE/DELETE); `findByPO(poId)` returns records ordered by `created_at ASC`; `findByLineItem(lineItemId)`; `getCumulativeForLineItem(lineItemId)` returns sum of `quantity_fulfilled` for that line item
- [x] T014 [US1] Implement `PurchaseOrderService.recordShipment(poId, lineItemId, actorUserId, actorRoles, input)` in `backend/src/services/purchase-order.service.ts` — validates actor has `supplier` role; validates PO status is `approved` or `partially-fulfilled`; calls `getCumulativeForLineItem`, calls `validateShipment`; inserts fulfilment record; recomputes PO status via `computePOStatus` across all line items; calls `poRepo.updateStatus` if status changed; appends audit entry
- [x] T015 [US1] Implement Express route `POST /:id/line-items/:lineItemId/shipments` in `backend/src/api/routes/purchase-orders.ts` — thin handler: parse `quantityFulfilled` and optional `shipmentReference` from body, call `poService.recordShipment`, return updated PO detail (201)
- [x] T016 [US1] Add `recordShipment(token, poId, lineItemId, input)` to `frontend/src/services/api.ts`
- [x] T017 [US1] Update `frontend/src/pages/PurchaseOrderDetailPage.tsx` — replace the removed Fulfil button with a per-line-item shipment form: for each line item show `fulfilled/ordered` progress; if PO status is `approved` or `partially-fulfilled` and user `hasRole('supplier')`, show a qty input + optional shipment reference input + "Record Shipment" button per line item

**Checkpoint**: US1 independently functional — supplier can record partial shipments, PO transitions to Partially Fulfilled, progress visible per line item.

---

## Phase 4: User Story 2 - PO Auto-Transitions to Fully Fulfilled (Priority: P2)

**Goal**: When a shipment completes the last outstanding line item quantity, the PO
automatically transitions to Fulfilled. No supplier action beyond the final shipment.

**Independent Test**: Partially Fulfilled PO with line item 1 at 3/5 and line item 2 at 0/5.
Record 2 units on line item 1 (completing it). Record 5 units on line item 2 (completing it).
Verify final status = `fulfilled`.

### Tests for User Story 2 ⚠️ Write these FIRST — confirm they FAIL before US2 is live

- [x] T018 [P] [US2] Contract test: recording the final unit on the last incomplete line item returns status `fulfilled` in `backend/tests/contract/shipment.test.ts` (extend existing file)
- [x] T019 [P] [US2] Contract test: attempting a shipment on a `fulfilled` PO returns 409 in `backend/tests/contract/shipment.test.ts`
- [x] T020 [US2] Integration test: multi-shipment completion — ship all quantities across two line items in three separate calls; verify final PO status=`fulfilled`, audit trail shows the `partially-fulfilled → fulfilled` transition, no further shipments accepted in `backend/tests/integration/partial-fulfilment.test.ts` (extend existing file)

### Implementation for User Story 2

No additional implementation files — `computePOStatus` from T012 and `recordShipment` from T014 already handle the fully-fulfilled case. US2 tests validate existing logic.

- [x] T021 [US2] Verify existing `computePOStatus` unit test in `backend/src/lib/partial-fulfilment/fulfilment.lib.test.ts` covers the all-items-complete branch (add a test case if missing from T011)

**Checkpoint**: US1 and US2 both independently functional — full lifecycle from first shipment to completion covered.

---

## Phase 5: User Story 3 - View Fulfilment History (Priority: P3)

**Goal**: Buyers and approvers retrieve the complete ordered list of shipment events for
a PO. Each record shows line item, quantity, reference, actor, and timestamp.

**Independent Test**: PO with 3 fulfilment records across 2 line items. Retrieve history.
Verify 3 records returned in chronological order with correct `lineItemId`, `quantityFulfilled`,
`cumulativeQty`, and `actorUserId`.

### Tests for User Story 3 ⚠️ Write these FIRST — confirm they FAIL before T022

- [x] T022 [P] [US3] Contract test: `GET /api/v1/purchase-orders/:id/fulfilment-history` returns records array in chronological order in `backend/tests/contract/fulfilment-history.test.ts`
- [x] T023 [P] [US3] Contract test: empty history returns `{"records": []}` (not 404) in `backend/tests/contract/fulfilment-history.test.ts`
- [x] T024 [P] [US3] Contract test: supplier for a different PO receives 403 when accessing history in `backend/tests/contract/fulfilment-history.test.ts`

### Implementation for User Story 3

- [x] T025 [US3] Implement `PurchaseOrderService.getFulfilmentHistory(poId, actorUserId, actorRoles)` in `backend/src/services/purchase-order.service.ts` — retrieves PO (throws NotFoundError if absent); performs same access check as `getPO`; returns `fulfilmentRepo.findByPO(poId)`
- [x] T026 [US3] Implement Express route `GET /:id/fulfilment-history` in `backend/src/api/routes/purchase-orders.ts` — calls `poService.getFulfilmentHistory`, returns `{ records: [...] }` with camelCase fields
- [x] T027 [P] [US3] Add `getFulfilmentHistory(token, poId)` to `frontend/src/services/api.ts`
- [x] T028 [US3] Add fulfilment history section to `frontend/src/pages/PurchaseOrderDetailPage.tsx` — fetches history on load, renders table: Line Item | Qty Shipped | Cumulative | Reference | By | When; shown for all roles that can view the PO

**Checkpoint**: All three user stories independently functional and testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T029 [P] Add `'partially-fulfilled'` to the status filter dropdown and `STATUS_COLOURS` map in `frontend/src/pages/PurchaseOrderListPage.tsx` (colour suggestion: `#e06000` — amber-orange to distinguish from approved green)
- [x] T030 Run quickstart.md validation — execute all curl examples from `specs/002-partial-fulfillment/quickstart.md`; confirm expected statuses at each step
- [x] T031 [P] Run `npm test` to confirm all 56 existing feature-001 tests still pass alongside the new feature-002 tests

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories; removes old endpoint
- **US1 (Phase 3)**: Depends on Foundational completion
- **US2 (Phase 4)**: Depends on US1 completion (uses same lib and service)
- **US3 (Phase 5)**: Depends on Foundational completion; can run in parallel with US1/US2 on the repository layer, but shares the service file — coordinate or run sequentially
- **Polish (Phase 6)**: Depends on all user stories complete

### Within Each User Story

1. Write tests → confirm they FAIL (constitution Principle II)
2. Implement lib functions (pure, no DB)
3. Implement repository methods
4. Implement service methods
5. Implement Express routes
6. Implement frontend changes
7. Confirm all tests PASS

### Parallel Opportunities

- T004, T005, T006 can run in parallel (different files) once T002 and T003 are done
- All contract tests within a story [P] can be written together
- T012 (lib) and T013 (repository) can run in parallel — different files, no dependencies
- T016 (API client) and T027 (API client) can run after route exists
- T029 (list page) is independent of all story implementation

---

## Implementation Strategy

### MVP First (US1 Only)

1. Phase 1 + Phase 2 (migration, type updates, OpenAPI, old endpoint removal)
2. Phase 3 (US1): Write tests → confirm fail → implement → confirm pass
3. **STOP and VALIDATE**: Supplier can record partial shipments; PO status updates correctly
4. Demo: use quickstart.md curl examples up through step 2

### Incremental Delivery

1. Foundational → old fulfil endpoint cleanly removed, migration applied
2. US1 → partial shipments work end-to-end
3. US2 → completion transition verified by tests (no new implementation)
4. US3 → history endpoint live
5. Polish → status filter updated, regression suite green

---

## Notes

- The migration 002 MUST be applied before any test that touches `purchase_orders.status` with `'partially-fulfilled'` — `createTestDb()` in `backend/tests/helpers/db.ts` runs all migrations automatically, so this is handled
- The existing `fulfil.test.ts` contract tests from feature 001 will FAIL after T005 removes the route — delete or update those tests as part of T005
- Constitution Principle III: `fulfilment.repository.ts` must be tested with real SQLite via `createTestDb()`; no mocking of the data layer
