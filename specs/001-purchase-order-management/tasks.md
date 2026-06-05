---
description: "Task list for Purchase Order Management feature"
---

# Tasks: Purchase Order Management

**Input**: Design documents from `/specs/001-purchase-order-management/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/openapi.yaml ✅

**TDD Policy**: Per constitution Principle II, contract and integration tests MUST be
written and confirmed FAILING before any implementation task in the same story begins.

**Organization**: Tasks are grouped by user story to enable independent implementation
and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Exact file paths are included in all task descriptions

## Path Conventions

- Backend source: `backend/src/`
- Backend tests: `backend/tests/`
- Frontend source: `frontend/src/`
- Frontend E2E tests: `frontend/tests/e2e/`
- Spec contracts: `specs/001-purchase-order-management/contracts/`

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Scaffold both workspaces with correct tooling before any feature code.

- [x] T001 Initialise backend workspace: `mkdir backend && cd backend && npm init -y && npm install --save-dev typescript ts-node-dev @types/node` in repo root
- [x] T002 Create `backend/tsconfig.json` with `strict: true`, `target: ES2022`, `module: CommonJS`, `outDir: dist`, `rootDir: src`
- [x] T003 [P] Create `backend/.eslintrc.json` and `backend/.prettierrc` with project-wide config (no-any rule, consistent style)
- [x] T004 Initialise frontend workspace: `npm create vite@latest frontend -- --template react-ts` in repo root
- [x] T005 [P] Verify `frontend/tsconfig.json` has `strict: true`; update if absent
- [x] T006 [P] Create `frontend/.eslintrc.json` and `frontend/.prettierrc` consistent with backend config
- [x] T007 Copy `specs/001-purchase-order-management/contracts/openapi.yaml` to `backend/openapi.yaml` (source of truth for runtime validation)
- [x] T008 Create full directory structure per plan.md: `backend/src/lib/purchase-orders/`, `backend/src/lib/approval/`, `backend/src/lib/notifications/`, `backend/src/repositories/`, `backend/src/services/`, `backend/src/api/routes/`, `backend/src/api/middleware/`, `backend/db/migrations/`, `backend/tests/contract/`, `backend/tests/integration/`, `backend/tests/unit/`, `frontend/src/components/purchase-orders/`, `frontend/src/pages/`, `frontend/src/context/`, `frontend/src/services/`, `frontend/tests/e2e/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T009 Install backend runtime deps: `npm install express better-sqlite3 express-openapi-validator nodemailer` and dev deps: `npm install --save-dev vitest @vitest/coverage-v8 supertest @types/express @types/better-sqlite3 @types/nodemailer @types/supertest` in `backend/`
- [x] T010 [P] Install frontend runtime deps: `npm install react-router-dom react-hook-form` and dev deps: `npm install --save-dev @playwright/test openapi-typescript` in `frontend/`
- [x] T011 Write `backend/db/migrations/001_initial_schema.sql` — creates `purchase_orders`, `po_line_items`, `po_audit_entries`, `notifications` tables with all columns, CHECK constraints, and indexes from data-model.md
- [x] T012 Implement SQLite connection + sequential migration runner in `backend/src/db/database.ts` — opens `better-sqlite3` connection, reads migration files in order, tracks applied migrations in `schema_migrations` table
- [x] T013 Implement JWT auth middleware in `backend/src/api/middleware/auth.ts` — extracts `userId`, `roles` (string array), `branchId` from Bearer token claims; attaches to `req.user`; returns 401 on missing token; no signature verification (trusted upstream)
- [x] T014 Configure Express app in `backend/src/api/app.ts` — mount `express-openapi-validator` with `backend/openapi.yaml`, JSON body parsing, auth middleware, purchase-orders router, error handler
- [x] T015 [P] Implement `PurchaseOrderRepository` in `backend/src/repositories/purchase-order.repository.ts` — methods: `create`, `findById`, `findByBranch`, `findBySupplier`, `findByStatus`, `updateStatus`, `updateTotal`
- [x] T016 [P] Implement `LineItemRepository` in `backend/src/repositories/line-item.repository.ts` — methods: `add`, `update`, `remove`, `findByPO`; each write updates `purchase_orders.total_amount` atomically in SQLite transaction
- [x] T017 [P] Implement `AuditRepository` in `backend/src/repositories/audit.repository.ts` — methods: `append` (INSERT only; no UPDATE/DELETE), `findByPO`
- [x] T018 [P] Implement `NotificationRepository` in `backend/src/repositories/notification.repository.ts` — methods: `create` (inserts with `delivery_status = 'pending'`), `markDelivered`, `markFailed`, `findPending`
- [x] T019 Create `backend/vitest.config.ts` — configures Vitest with `environment: 'node'`, coverage thresholds, test file patterns for `tests/contract/**`, `tests/integration/**`, `tests/unit/**`, `src/**/*.test.ts`
- [x] T020 [P] Create test database helper in `backend/tests/helpers/db.ts` — exports `createTestDb()` (opens in-memory or temp-file SQLite, runs all migrations, returns `db` instance) and `cleanDb(db)` (drops all data); used by all contract and integration tests
- [x] T021 Scaffold React app shell in `frontend/src/main.tsx` — wrap app in `AuthContext.Provider`; configure `BrowserRouter`; add `/purchase-orders` and `/purchase-orders/:id` and `/purchase-orders/new` routes
- [x] T022 [P] Implement `AuthContext` in `frontend/src/context/AuthContext.tsx` — reads JWT from `localStorage`, decodes claims (userId, roles, branchId), exposes `user` object and `hasRole(role)` helper; no signature verification

**Checkpoint**: Foundation ready — all repositories, DB migrations, auth middleware, and test helpers exist. User story implementation can now begin.

---

## Phase 3: User Story 1 - Buyer Creates and Submits a PO (Priority: P1) 🎯 MVP

**Goal**: Buyer creates a PO, adds line items, and submits. POs under $10,000
auto-approve; supplier receives a notification.

**Independent Test**: Create a PO with two line items totalling $1,500, submit it,
verify status is `approved`, and verify a notification record exists for the supplier.

### Tests for User Story 1 ⚠️ Write these FIRST — confirm they FAIL before T028

- [x] T023 [P] [US1] Contract test: `POST /api/v1/purchase-orders` creates PO with status `draft` in `backend/tests/contract/create-po.test.ts` (uses `createTestDb()`)
- [x] T024 [P] [US1] Contract test: `POST /api/v1/purchase-orders/:id/line-items` adds item and updates `total_amount` in `backend/tests/contract/line-items.test.ts`
- [x] T025 [P] [US1] Contract test: `POST /api/v1/purchase-orders/:id/submit` with total < $10,000 returns status `approved` in `backend/tests/contract/submit-po.test.ts`
- [x] T026 [US1] Integration test: full buyer submission workflow — create PO, add 2 line items, submit, assert status=`approved`, notification record created, audit trail has 2 entries (created→draft, draft→approved) in `backend/tests/integration/po-submission.test.ts`
- [x] T027 [P] [US1] Unit tests for `po.lib.ts`: `validateSubmission` rejects empty line items, zero quantity, zero price; `getSubmissionStatus` returns `approved` for totals < $10,000 in `backend/src/lib/purchase-orders/po.lib.test.ts`

### Implementation for User Story 1

- [x] T028 [US1] Implement `backend/src/lib/purchase-orders/po.lib.ts` — exports: `validateSubmission(lineItems)` (throws on invalid), `getSubmissionStatus(total)` returns `'approved' | 'submitted'`, `isEditable(status)` returns boolean, `canCancel(status, actorRole)` returns boolean
- [x] T029 [P] [US1] Implement `backend/src/lib/notifications/notification.lib.ts` — exports: `buildNotification(poId, recipientType, recipientId, eventType)` returns a `NewNotification` value object; no side effects
- [x] T030 [US1] Implement `PurchaseOrderService.create`, `addLineItem`, `updateLineItem`, `removeLineItem` in `backend/src/services/purchase-order.service.ts` — calls lib validation, delegates to repositories, wraps line item writes in SQLite transactions
- [x] T031 [US1] Implement `PurchaseOrderService.submit` in `backend/src/services/purchase-order.service.ts` — calls `validateSubmission`, calls `getSubmissionStatus`, calls `NotificationService.dispatch`, appends audit entry; all in one SQLite transaction
- [x] T032 [US1] Implement `NotificationService` with Nodemailer stub in `backend/src/services/notification.service.ts` — `dispatch(notification)`: inserts notification record (pending), calls stubbed `sendEmail` (logs to console; always resolves); does not block caller
- [x] T033 [US1] Implement Express routes in `backend/src/api/routes/purchase-orders.ts`: `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `POST /:id/line-items`, `PUT /:id/line-items/:lineItemId`, `DELETE /:id/line-items/:lineItemId`, `POST /:id/submit` — thin handlers delegating to service
- [x] T034 [P] [US1] Implement `CreatePurchaseOrderPage` in `frontend/src/pages/CreatePurchaseOrderPage.tsx` — form with supplier select, line item add/edit/remove rows (React Hook Form), running total display, submit button
- [x] T035 [P] [US1] Implement `PurchaseOrderListPage` in `frontend/src/pages/PurchaseOrderListPage.tsx` — shows branch POs for buyers; status filter dropdown; links to detail page
- [x] T036 [US1] Add typed API client methods to `frontend/src/services/api.ts`: `createPO`, `getPO`, `listPOs`, `updatePO`, `addLineItem`, `updateLineItem`, `removeLineItem`, `submitPO` — all use `fetch` with Bearer token; types derived from OpenAPI schemas
- [x] T037 [US1] Playwright E2E test in `frontend/tests/e2e/create-submit-po.spec.ts`: buyer logs in → creates PO → adds 2 line items → submits → asserts status badge shows "Approved"

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Approval Workflow for High-Value POs (Priority: P2)

**Goal**: POs ≥ $10,000 enter `submitted` status; approver approves or rejects; self-approval
blocked; supplier notified on approval; buyer notified on rejection.

**Independent Test**: Submit a $15,000 PO → verify status=`submitted`; log in as approver
(different user) → approve → verify status=`approved`, supplier notification created;
submit a second $15,000 PO → reject → verify status=`draft`, buyer notification created.

### Tests for User Story 2 ⚠️ Write these FIRST — confirm they FAIL before T042

- [x] T038 [P] [US2] Contract test: `POST /api/v1/purchase-orders/:id/submit` with total ≥ $10,000 returns status `submitted` in `backend/tests/contract/submit-po.test.ts` (extend existing file)
- [x] T039 [P] [US2] Contract test: `POST /api/v1/purchase-orders/:id/approve` transitions `submitted → approved`; returns 403 if actor is PO creator in `backend/tests/contract/approve-po.test.ts`
- [x] T040 [P] [US2] Contract test: `POST /api/v1/purchase-orders/:id/reject` transitions `submitted → draft`; returns 400 when reason is missing in `backend/tests/contract/reject-po.test.ts`
- [x] T041 [US2] Integration test: approval workflow — submit $15,000 PO, approve as different approver, assert status=`approved`, audit has 3 entries; second PO submitted, rejected, assert status=`draft`, rejection_reason stored in `backend/tests/integration/approval-workflow.test.ts`
- [x] T042 [P] [US2] Unit tests for `approval.lib.ts`: `requiresApproval(9999)` false, `requiresApproval(10000)` true; `canApprove(userId, poCreatorId, roles)` false when same user, false when no approver role, true otherwise in `backend/src/lib/approval/approval.lib.test.ts`

### Implementation for User Story 2

- [x] T043 [US2] Implement `backend/src/lib/approval/approval.lib.ts` — exports: `requiresApproval(total: number): boolean` (threshold $10,000), `canApprove(actorId, creatorId, roles): boolean` (blocks self-approval and non-approver roles)
- [x] T044 [US2] Implement `PurchaseOrderService.approve` and `PurchaseOrderService.reject` in `backend/src/services/purchase-order.service.ts` — both call `canApprove`, dispatch notifications, append audit entries; all in SQLite transactions
- [x] T045 [US2] Implement Express routes in `backend/src/api/routes/purchase-orders.ts`: `POST /:id/approve`, `POST /:id/reject` — delegate to service; map auth errors to 403, status-conflict errors to 409
- [x] T046 [P] [US2] Add approver queue section to `frontend/src/pages/PurchaseOrderListPage.tsx` — shown only when user `hasRole('approver')`; filters status=`submitted`
- [x] T047 [P] [US2] Add approve/reject action panel to `frontend/src/pages/PurchaseOrderDetailPage.tsx` — shows when PO status=`submitted` and user `hasRole('approver')` and user is not PO creator; reject requires reason input
- [x] T048 [P] [US2] Add API client methods to `frontend/src/services/api.ts`: `approvePO(id)`, `rejectPO(id, reason)`
- [x] T049 [US2] Playwright E2E test in `frontend/tests/e2e/approval-workflow.spec.ts`: buyer submits $15,000 PO → approver logs in → approves → buyer sees "Approved"; second PO → approver rejects with reason → buyer sees "Draft" with rejection reason

**Checkpoint**: User Stories 1 and 2 are both independently functional.

---

## Phase 5: User Story 3 - Supplier Marks PO as Fulfilled (Priority: P3)

**Goal**: Supplier views their approved POs and marks one Fulfilled; buyer sees updated status.

**Independent Test**: Log in as Supplier A → find an Approved PO → mark Fulfilled → verify
status=`fulfilled` and `fulfilled_at` timestamp recorded; log in as buyer → verify PO shows Fulfilled.

### Tests for User Story 3 ⚠️ Write these FIRST — confirm they FAIL before T052

- [x] T050 [P] [US3] Contract test: `POST /api/v1/purchase-orders/:id/fulfil` transitions `approved → fulfilled`; returns 409 if status is not `approved` in `backend/tests/contract/fulfil-po.test.ts`
- [x] T051 [US3] Integration test: supplier fulfilment — seed Approved PO for supplier, call fulfil as supplier user, assert status=`fulfilled`, fulfilled_at set, audit entry appended in `backend/tests/integration/fulfilment.test.ts`

### Implementation for User Story 3

- [x] T052 [US3] Implement `PurchaseOrderService.fulfil` in `backend/src/services/purchase-order.service.ts` — validates actor has `supplier` role and is the PO's supplier; updates status, sets `fulfilled_at`, appends audit entry
- [x] T053 [US3] Implement Express route in `backend/src/api/routes/purchase-orders.ts`: `POST /:id/fulfil`
- [x] T054 [P] [US3] Add supplier PO list view to `frontend/src/pages/PurchaseOrderListPage.tsx` — shows when user `hasRole('supplier')`; displays POs addressed to this supplier; defaults to status=`approved` filter
- [x] T055 [P] [US3] Add fulfil action to `frontend/src/pages/PurchaseOrderDetailPage.tsx` — shows Fulfil button when status=`approved` and user `hasRole('supplier')` and is the PO's supplier
- [x] T056 [P] [US3] Add API client method to `frontend/src/services/api.ts`: `fulfilPO(id)`
- [x] T057 [US3] Playwright E2E test in `frontend/tests/e2e/fulfil-po.spec.ts`: supplier views approved PO list → clicks Fulfil → PO status shows "Fulfilled"; buyer refreshes detail page → sees Fulfilled status

**Checkpoint**: User Stories 1, 2, and 3 are all independently functional.

---

## Phase 6: User Story 4 - Cancel a Purchase Order (Priority: P4)

**Goal**: Buyers cancel their own Draft/Submitted POs; approvers cancel any pre-fulfilment PO.
Cancellation reason recorded. Cancelled POs are read-only.

**Independent Test**: Buyer cancels their Draft PO with reason → status=`cancelled`, read-only.
Buyer attempts to cancel Approved PO → 403 rejected. Approver cancels Approved PO with reason → status=`cancelled`.

### Tests for User Story 4 ⚠️ Write these FIRST — confirm they FAIL before T060

- [x] T058 [P] [US4] Contract test: `POST /api/v1/purchase-orders/:id/cancel` — buyer can cancel Draft/Submitted (200), buyer cannot cancel Approved (403), approver can cancel Approved (200), Fulfilled cannot be cancelled (409), reason required (400) in `backend/tests/contract/cancel-po.test.ts`
- [x] T059 [US4] Integration test: buyer cancels Draft PO; buyer fails to cancel Approved PO; approver cancels Approved PO; assert cancellation_reason stored, audit entry appended, status=`cancelled` in `backend/tests/integration/cancellation.test.ts`

### Implementation for User Story 4

- [x] T060 [US4] Implement `PurchaseOrderService.cancel` in `backend/src/services/purchase-order.service.ts` — calls `canCancel(status, actorRole)` from `po.lib.ts`, requires `reason`, updates status and `cancelled_at`, appends audit entry; all in SQLite transaction
- [x] T061 [US4] Implement Express route in `backend/src/api/routes/purchase-orders.ts`: `POST /:id/cancel`
- [x] T062 [P] [US4] Add cancel action to `frontend/src/pages/PurchaseOrderDetailPage.tsx` — shows Cancel button for eligible statuses per role; opens confirmation modal with reason textarea
- [x] T063 [P] [US4] Add API client method to `frontend/src/services/api.ts`: `cancelPO(id, reason)`
- [x] T064 [US4] Playwright E2E test in `frontend/tests/e2e/cancel-po.spec.ts`: buyer cancels Draft PO → status "Cancelled"; buyer attempts cancel on Approved → button absent; approver cancels Approved PO with reason → status "Cancelled", reason visible

**Checkpoint**: All four user stories are independently functional and testable.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Audit trail read endpoint, error handling, UI polish, and validation.

- [x] T065 [P] Implement `AuditService.getAuditTrail(poId)` in `backend/src/services/purchase-order.service.ts` and Express route `GET /api/v1/purchase-orders/:id/audit` in `backend/src/api/routes/purchase-orders.ts`
- [x] T066 [P] Add API client method `getAuditTrail(id)` and render audit trail table on `frontend/src/pages/PurchaseOrderDetailPage.tsx` (actor, from → to status, reason, timestamp)
- [x] T067 [P] Implement global error-handling middleware in `backend/src/api/middleware/error.ts` — maps known error types to HTTP status codes (ValidationError→400, AuthError→403, NotFoundError→404, ConflictError→409); formats as `{ error: string, details?: string[] }`
- [x] T068 [P] Add status badge colour-coding and status filter UI to `frontend/src/pages/PurchaseOrderListPage.tsx`
- [ ] T069 Run quickstart.md validation — execute each curl example from `specs/001-purchase-order-management/quickstart.md` against the running server; confirm expected responses
- [x] T070 [P] Run `npm audit` in `backend/` and `frontend/`; resolve any high-severity vulnerabilities

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **User Story phases (3–6)**: Depend on Foundational completion; can proceed in parallel across stories if team capacity allows; within each story, tests MUST fail before implementation
- **Polish (Phase 7)**: Depends on all desired user stories complete

### User Story Dependencies

- **US1 (P1)**: No dependencies on other stories — start after Foundational
- **US2 (P2)**: No hard dependencies on US1 code, but approval workflow builds on submission; start after Foundational
- **US3 (P3)**: No hard dependencies on US1/US2 — start after Foundational
- **US4 (P4)**: `po.lib.ts` `canCancel` extends US1 lib — start after T028

### Within Each User Story

1. Write tests → confirm they FAIL
2. Implement lib functions (pure, no DB)
3. Implement repositories (if new ones needed)
4. Implement service methods
5. Implement Express routes
6. Implement frontend components
7. Implement frontend API client methods
8. Write Playwright E2E test
9. Confirm all tests PASS

### Parallel Opportunities

- All `[P]` tasks within a phase can run concurrently
- Setup tasks T002–T008 can all run in parallel after T001
- Foundational T015–T022 can all run in parallel after T009/T010/T011/T012
- All contract tests within a story can be written in parallel
- Frontend (T034–T037) and backend routes (T033) for US1 can run in parallel once the service layer (T030–T032) is complete

---

## Parallel Example: User Story 1

```text
After T028 (po.lib.ts) is complete:

Parallel group A (backend):
  T029 — notification.lib.ts
  T030 — PurchaseOrderService CRUD methods
  (T031 depends on T030 — sequential)

Parallel group B (frontend, after T033 route exists):
  T034 — CreatePurchaseOrderPage
  T035 — PurchaseOrderListPage
  T036 — API client methods
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (write tests → confirm fail → implement)
4. **STOP and VALIDATE**: Run `npm test` in backend; run `npm run test:e2e` in frontend
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → scaffold ready
2. User Story 1 → buyer can create and submit POs (MVP!)
3. User Story 2 → approval workflow added; high-value POs controlled
4. User Story 3 → fulfilment loop closed
5. User Story 4 → cancellation added; full lifecycle complete
6. Polish → audit trail UI, error handling, security audit

### Parallel Team Strategy

With multiple developers (after Foundational is done):

- Developer A: User Story 1 backend lib + service + routes
- Developer B: User Story 1 frontend pages
- Developer C: User Story 2 lib + service (can start once approval.lib.ts interface is agreed)

---

## Notes

- `[P]` tasks have no shared-file conflicts with concurrent tasks in the same phase
- `[USN]` label maps each task to its user story for traceability
- Constitution Principle II: every story's test tasks MUST precede its implementation tasks
- Constitution Principle III: all `backend/tests/` use real SQLite via `createTestDb()`; no mocking of the data layer
- Notemailer stub is the only permitted mock (external I/O exception per constitution)
- Commit after each checkpoint to mark story completion
- Stop at any checkpoint to validate and demo the story independently
