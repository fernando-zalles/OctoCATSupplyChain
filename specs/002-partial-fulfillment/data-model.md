# Data Model: Partial Fulfilment

**Branch**: `002-partial-fulfillment` | **Date**: 2026-06-04

## Changes to Existing Tables

### `purchase_orders` — status CHECK constraint update

The status column's CHECK constraint gains `'partially-fulfilled'`:

**Old**: `CHECK (status IN ('draft','submitted','approved','fulfilled','cancelled'))`

**New**: `CHECK (status IN ('draft','submitted','approved','partially-fulfilled','fulfilled','cancelled'))`

Full updated state machine:

```text
DRAFT
  │ submit
  ▼
SUBMITTED ──── (total < $10k: auto) ────────────────────────────────┐
  │ approve (approver, not self)                                      │
  ▼                                                                   ▼
APPROVED ──────────────────── first shipment ──────────► PARTIALLY FULFILLED
  │                                                            │
  │                          (all qtys complete)               │ (all qtys complete)
  └──────────────────────────────────────────────────────────►▼
                                                           FULFILLED  (terminal)

Any pre-fulfilled status ──── cancel ──────────────────► CANCELLED  (terminal)
```

Note: The direct APPROVED → FULFILLED single-step transition is removed. All
paths to FULFILLED now require at least one shipment record.

---

## New Tables

### `fulfilment_records`

Immutable. No UPDATE or DELETE permitted on this table.

| Column | Type | Nullable | Constraints | Notes |
|--------|------|----------|-------------|-------|
| id | INTEGER | NO | PK AUTOINCREMENT | |
| purchase_order_id | INTEGER | NO | FK → purchase_orders(id) | |
| line_item_id | INTEGER | NO | FK → po_line_items(id) | |
| quantity_fulfilled | INTEGER | NO | CHECK >= 1 | Qty shipped in this event |
| cumulative_qty | INTEGER | NO | | Sum of all fulfilled qty for this line item after this record |
| shipment_reference | TEXT | YES | | Free-text (tracking number, delivery note, etc.) |
| actor_user_id | INTEGER | NO | | Supplier user who recorded the shipment |
| created_at | TEXT | NO | DEFAULT current timestamp | ISO 8601 |

**Indexes**:
- `idx_fulfilment_po` ON `fulfilment_records(purchase_order_id, created_at)`
- `idx_fulfilment_line_item` ON `fulfilment_records(line_item_id)`

---

## Derived Values

| Value | Derived From | When Computed |
|-------|-------------|---------------|
| `fulfilled_qty` per line item | `SUM(quantity_fulfilled)` from `fulfilment_records WHERE line_item_id = ?` | On read (display) |
| `outstanding_qty` per line item | `line_item.quantity - fulfilled_qty` | On read (display) |
| New PO status after shipment | `computePOStatus(lineItems, cumulative records)` | At write time in service layer |

---

## Validation Rules

| Rule | Enforced At |
|------|-------------|
| `quantity_fulfilled >= 1` | DB CHECK + lib |
| `cumulative_qty <= line_item.quantity` (no over-delivery) | Service (lib) before insert |
| Shipment only on `approved` or `partially-fulfilled` PO | Service (lib) |
| Records are immutable | No UPDATE/DELETE routes exposed |

---

## Migration Summary

Migration `002_partial_fulfilment.sql`:
1. `PRAGMA foreign_keys = OFF`
2. Recreate `purchase_orders` with updated CHECK constraint (table-recreation pattern)
3. Recreate all indexes on `purchase_orders`
4. `CREATE TABLE fulfilment_records ...`
5. `CREATE INDEX` for fulfilment_records
6. `PRAGMA foreign_keys = ON`
