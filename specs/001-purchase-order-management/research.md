# Research: Purchase Order Management

**Branch**: `001-purchase-order-management` | **Date**: 2026-06-04

## Decisions & Rationale

### 1. SQLite Driver

**Decision**: `better-sqlite3` (synchronous API)

**Rationale**: Synchronous API matches Express.js request handling without requiring
async/await wrappers for every query. Offers the best performance for SQLite on Node.js,
well-maintained (MIT), minimal transitive deps (~3). Constitution III requires a real
SQLite engine in tests — better-sqlite3 supports in-process SQLite with no network
layer, making test setup/teardown fast and deterministic.

**Alternatives considered**:
- `node-sqlite3` (async, callback-based): Rejected — async SQLite adds complexity with
  no benefit for a single-server deployment; callback style requires promisification.
- `@prisma/client` (ORM): Rejected — Constitution IV (Simplicity) and constitution
  prohibition on ORMs. Adds 50+ transitive deps and a code generation step.

---

### 2. Schema Migrations

**Decision**: Plain SQL migration files in `backend/db/migrations/`, applied at
startup via a lightweight custom runner (< 50 lines).

**Rationale**: No ORM means no migration framework dependency. A sequential numbered
migration file approach (`001_initial_schema.sql`, `002_...`) is transparent, auditable,
and trivially testable. Constitution VII (Minimal Dependencies) and IV (Simplicity)
favour this over adding a migration library.

**Alternatives considered**:
- `db-migrate` / `node-pg-migrate` adapted for SQLite: Rejected — adds a dependency
  and configuration overhead not justified for a single SQLite database.
- Knex.js schema builder: Rejected — ORM-adjacent; Constitution IV violation.

---

### 3. OpenAPI Runtime Validation

**Decision**: `express-openapi-validator` middleware applied globally to all routes.

**Rationale**: Constitution V (REST + OpenAPI) requires runtime validation of request
and response bodies against the OpenAPI schema. `express-openapi-validator` reads
`openapi.yaml` at startup and validates every incoming request and outgoing response
automatically. Spec-first workflow: `openapi.yaml` is authored first, then routes
implement it.

**Alternatives considered**:
- Manual Joi/Zod validation per route: Rejected — duplicates the OpenAPI spec, creating
  drift risk; Constitution V requires a single source of truth.
- `swagger-jsdoc` (code-first): Rejected — spec must be authored first; code-first
  generates spec from annotations which inverts the intended workflow.

---

### 4. Authentication / Role Extraction

**Decision**: Middleware reads a Bearer JWT from the `Authorization` header and
extracts `userId`, `roles`, and `branchId` from claims. No JWT verification
implemented — existing identity system is trusted upstream (API gateway or reverse
proxy validates the token before reaching this service).

**Rationale**: Spec assumption: "Users are already authenticated by an existing
identity system." Implementing JWT verification would add scope and a dependency
(`jsonwebtoken`) beyond what the feature requires. Trust boundary is at the edge.

**Alternatives considered**:
- Full JWT verification with `jsonwebtoken`: Deferred to infrastructure/security layer
  per the spec assumptions.
- API-key auth: Not applicable — user identity and roles needed for access control.

---

### 5. Notification Dispatch

**Decision**: Synchronous notification record creation (SQLite insert with
`delivery_status = 'pending'`) followed by asynchronous handoff to a `NotificationService`
that calls Nodemailer. For this feature, Nodemailer is stubbed: the stub logs to
console and always resolves. The real implementation is a drop-in replacement.

**Rationale**: FR-008c: PO transitions MUST NOT be blocked by notification failures.
Recording the notification synchronously in the same SQLite transaction as the status
change ensures the intent is never lost. The async dispatch honours the decoupling.
Constitution III allows mocking external I/O (email gateways) — Nodemailer stub is
the test double; the test file documents why.

**Alternatives considered**:
- Fire-and-forget HTTP call to external notification API: Rejected — out of scope;
  spec says this feature records intent and hands off to existing service.
- Bull/BullMQ job queue: Rejected — Constitution VII (Minimal Dependencies); retry
  strategy is owned by the notification service per FR-008c.

---

### 6. Frontend API Client

**Decision**: Typed `fetch` wrappers in `frontend/src/services/api.ts`. No Axios.

**Rationale**: Modern browsers support `fetch` natively. Types are generated from the
OpenAPI spec (via `openapi-typescript`), ensuring client types stay in sync with the
server contract. Avoids an additional runtime dependency. Constitution VII (Minimal
Dependencies).

**Alternatives considered**:
- Axios: Rejected — no meaningful benefit over fetch for a single-API SPA; adds ~13
  transitive deps.
- React Query / TanStack Query: Deferred — caching and server-state management are
  valuable but not required for v1 scope; can be added later.

---

### 7. Frontend State Management

**Decision**: React Context for authentication/user state only. Component-local state
(`useState`) for form data. No Redux or Zustand.

**Rationale**: User specified React Context. The application's state model is
straightforward: user identity (read once at login) + PO list (server-authoritative,
re-fetched on navigation). Constitution IV (Simplicity) — no global state library
needed for this scope.

**Alternatives considered**:
- Zustand: Deferred — would simplify optimistic updates but not required for v1.
- Redux Toolkit: Rejected — significant boilerplate overhead for the scope; Constitution
  IV violation.

---

### 8. Approval Threshold Enforcement

**Decision**: Threshold check lives in `backend/src/lib/approval/approval.lib.ts` as
a pure function: `requiresApproval(totalAmount: number): boolean`. Service layer calls
this before determining the post-submission status.

**Rationale**: Constitution I (Library-First) — pure function is independently
testable without Express or SQLite. SC-005 requires zero exceptions; isolating the
logic in a pure function makes it trivially verifiable.

---

### 9. Self-Approval Prevention

**Decision**: `approval.lib.ts` exports `canApprove(actorUserId, poCreatedByUserId, actorRoles)`.
Returns false if actorUserId === poCreatedByUserId, regardless of roles.

**Rationale**: FR-011 (clarified): a user holding both Buyer and Approver roles MUST
NOT approve their own PO. Pure function, independently testable, called by service
before any approval action.

---

### 10. PO Total Calculation

**Decision**: `total_amount` is stored on the PO record and recalculated on every
line item write (add/edit/remove). Calculated as `SUM(quantity * unit_price)` across
all line items.

**Rationale**: Storing the total avoids runtime aggregation on every PO list query
(SC-006 performance requirement). Recalculating on every write keeps it consistent
without a separate synchronisation job. SQLite transactions ensure atomicity.
