# Research: Partial Fulfilment

**Branch**: `002-partial-fulfillment` | **Date**: 2026-06-04

## Decisions & Rationale

### 1. SQLite Schema Migration for CHECK Constraint Change

**Decision**: Migration 002 uses SQLite's recommended table-recreation pattern to
update the `purchase_orders.status` CHECK constraint.

**Pattern**:
```sql
-- 1. Create shadow table with new constraint
CREATE TABLE purchase_orders_new (..., status CHECK (..., 'partially-fulfilled', ...));
-- 2. Copy all data
INSERT INTO purchase_orders_new SELECT * FROM purchase_orders;
-- 3. Drop old table and foreign key dependents (recreate after)
DROP TABLE purchase_orders;
-- 4. Rename
ALTER TABLE purchase_orders_new RENAME TO purchase_orders;
-- 5. Recreate indexes
```

**Rationale**: SQLite does not support `ALTER TABLE ... MODIFY COLUMN` or changing
CHECK constraints in-place. This is the official SQLite documentation approach.
`PRAGMA foreign_keys = OFF` is set for the duration of the recreation to avoid
constraint violations during the interim state.

**Alternatives considered**:
- Removing the CHECK constraint entirely: Rejected — the constraint is a meaningful
  data integrity guardrail; removing it weakens guarantees.
- Using `PRAGMA ignore_check_constraints = 1`: Rejected — suppresses all CHECK
  constraints globally during the window; too broad and risky.

---

### 2. Fulfilled Quantity Tracking — Stored vs. Derived

**Decision**: Store `cumulative_qty` on each `fulfilment_records` row (snapshot at
insert time). Also provide a derived `fulfilled_qty` aggregate on the line item for
display, computed as `SUM(quantity_fulfilled)` from `fulfilment_records`.

**Rationale**: Storing cumulative at insert time enables fast over-delivery validation
without a separate aggregate query at write time (just compare `cumulative_qty` of the
latest record to `po_line_items.quantity`). The aggregate is still used for display
but is never on the write path. Consistent with the research.md decision for
`total_amount` in feature 001 (stored derived values for performance).

**Alternatives considered**:
- Derived-only (always SUM): Rejected — requires a query on every shipment submission
  to validate over-delivery; adds a round-trip and a race condition risk.
- Store on line item (`fulfilled_qty` column): Rejected — mutable field on a line item
  is harder to audit and complicates the immutability story for records.

---

### 3. Old `POST /:id/fulfil` Endpoint Removal

**Decision**: Remove the old endpoint entirely rather than deprecating it alongside
the new shipment model.

**Rationale**: Keeping both paths creates two ways to reach `fulfilled` status — one
that bypasses per-line-item tracking. This would break the invariant that "every
fulfilled PO has a complete fulfilment history." Since this is a new codebase with no
external consumers yet, a clean removal is safe and simpler.

**Alternatives considered**:
- Keeping `/fulfil` as a "mark all remaining quantities fulfilled" convenience: Deferred
  as a possible future enhancement; out of scope per the spec.
- Deprecating with a warning: Rejected — no external consumers exist; deprecation
  overhead is unnecessary.

---

### 4. Status Transition Logic Location

**Decision**: The logic that decides whether a shipment tips the PO into
`partially-fulfilled` or `fulfilled` lives in `lib/partial-fulfilment/fulfilment.lib.ts`
as a pure function: `computePOStatus(lineItems, fulfilmentRecords)`.

**Rationale**: Constitution Principle I — pure business logic belongs in the lib layer,
independently testable without Express or SQLite. The service calls this function
after recording the shipment and then calls `poRepo.updateStatus` accordingly.

---

### 5. Over-Delivery Validation

**Decision**: Validated in the service layer before inserting into `fulfilment_records`.
The check is: `existingCumulativeQty + incomingQty > lineItem.quantity`.

**Rationale**: Database-level enforcement via a trigger would be more robust but adds
SQLite trigger complexity. Service-layer validation is consistent with how other business
rules (FR-004, FR-011) are enforced in feature 001, and the lib unit test covers 100%
of the threshold logic.

---

### 6. Fulfilment History Endpoint Access Control

**Decision**: Accessible to buyers (their branch's POs), approvers (all POs), and the
PO's assigned supplier. Same access rules as `GET /api/v1/purchase-orders/:id`.

**Rationale**: History is an audit record; access should mirror the PO detail endpoint's
access rules. No new role or permission model needed.
