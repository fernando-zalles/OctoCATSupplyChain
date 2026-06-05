# Data Model: Purchase Order Management

**Branch**: `001-purchase-order-management` | **Date**: 2026-06-04

## Entity Overview

```text
users ──────────────────────────────────────────────────────┐
branches ──────────────────────────────────────────────────┐ │
suppliers ────────────────────────────────────────────────┐ │ │
products ───────────────────────────────────────────────┐ │ │ │
                                                        │ │ │ │
purchase_orders ─────────────────────────────────────── FK FK FK FK
      │
      ├── po_line_items ──────────────────── FK (product_id)
      ├── po_audit_entries ──────────────── FK (actor_user_id)
      └── notifications
```

## Owned Tables (created by this feature)

### `purchase_orders`

| Column | Type | Nullable | Constraints | Notes |
|--------|------|----------|-------------|-------|
| id | INTEGER | NO | PK AUTOINCREMENT | |
| branch_id | INTEGER | NO | FK → branches(id) | Branch placing the order |
| supplier_id | INTEGER | NO | FK → suppliers(id) | Must be active at submission |
| created_by_user_id | INTEGER | NO | FK → users(id) | Buyer who created the PO |
| status | TEXT | NO | CHECK status IN (...) | See Status Values below |
| total_amount | REAL | NO | DEFAULT 0 | Recalculated on every line item write |
| created_at | TEXT | NO | DEFAULT CURRENT_TIMESTAMP | ISO 8601 |
| submitted_at | TEXT | YES | | Set on Draft → Submitted/Approved |
| submitted_by_user_id | INTEGER | YES | FK → users(id) | |
| approved_at | TEXT | YES | | Set on Submitted → Approved |
| approved_by_user_id | INTEGER | YES | FK → users(id) | NULL for auto-approved POs |
| fulfilled_at | TEXT | YES | | Set on Approved → Fulfilled |
| cancelled_at | TEXT | YES | | Set on → Cancelled |
| cancelled_by_user_id | INTEGER | YES | FK → users(id) | |
| cancellation_reason | TEXT | YES | | Required when cancelled |
| rejection_reason | TEXT | YES | | Set on Submitted → Draft (rejection) |

**Status Values** (SQLite CHECK constraint):
`'draft'`, `'submitted'`, `'approved'`, `'fulfilled'`, `'cancelled'`

**Indexes**:
- `idx_po_branch_status` ON `purchase_orders(branch_id, status)`
- `idx_po_supplier_status` ON `purchase_orders(supplier_id, status)`
- `idx_po_status` ON `purchase_orders(status)` (approver queue)

---

### `po_line_items`

| Column | Type | Nullable | Constraints | Notes |
|--------|------|----------|-------------|-------|
| id | INTEGER | NO | PK AUTOINCREMENT | |
| purchase_order_id | INTEGER | NO | FK → purchase_orders(id) ON DELETE CASCADE | |
| product_id | INTEGER | NO | FK → products(id) | Must be active at submission |
| quantity | INTEGER | NO | CHECK quantity >= 1 | |
| unit_price | REAL | NO | CHECK unit_price > 0 | Expected price at order time |
| line_total | REAL | NO | | Stored as quantity * unit_price |

**Indexes**:
- `idx_line_item_po` ON `po_line_items(purchase_order_id)`

---

### `po_audit_entries`

Immutable. No UPDATE or DELETE permitted.

| Column | Type | Nullable | Constraints | Notes |
|--------|------|----------|-------------|-------|
| id | INTEGER | NO | PK AUTOINCREMENT | |
| purchase_order_id | INTEGER | NO | FK → purchase_orders(id) | |
| actor_user_id | INTEGER | NO | FK → users(id) | User who caused the transition |
| from_status | TEXT | YES | | NULL for initial creation entry |
| to_status | TEXT | NO | | |
| reason | TEXT | YES | | Required for rejection and cancellation |
| created_at | TEXT | NO | DEFAULT CURRENT_TIMESTAMP | ISO 8601 |

**Indexes**:
- `idx_audit_po` ON `po_audit_entries(purchase_order_id, created_at)`

---

### `notifications`

| Column | Type | Nullable | Constraints | Notes |
|--------|------|----------|-------------|-------|
| id | INTEGER | NO | PK AUTOINCREMENT | |
| purchase_order_id | INTEGER | NO | FK → purchase_orders(id) | |
| recipient_type | TEXT | NO | CHECK IN ('supplier','buyer') | |
| recipient_id | INTEGER | NO | | supplier_id or user_id depending on type |
| event_type | TEXT | NO | CHECK IN (...) | See Event Types below |
| created_at | TEXT | NO | DEFAULT CURRENT_TIMESTAMP | ISO 8601 |
| delivery_status | TEXT | NO | DEFAULT 'pending' CHECK IN (...) | See Delivery Status below |
| retry_count | INTEGER | NO | DEFAULT 0 | |

**Event Types**: `'submitted-pending'`, `'approved-confirmed'`, `'rejected'`, `'cancelled'`

**Delivery Status Values**: `'pending'`, `'delivered'`, `'failed'`

**Indexes**:
- `idx_notification_status` ON `notifications(delivery_status)` (retry queue)

---

## Read-Only Reference Tables (existing in system)

These tables are **not created** by this feature. This feature reads from them but
never writes to them.

### `users`

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | PK |
| name | TEXT | Display name |
| email | TEXT | For notifications |
| roles | TEXT | JSON array: e.g. `["buyer","approver"]` |
| branch_id | INTEGER | FK → branches(id); NULL for approvers |

### `branches`

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | PK |
| name | TEXT | Display name |

### `suppliers`

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | PK |
| name | TEXT | Display name |
| email | TEXT | For notifications |
| active | INTEGER | 1 = active, 0 = inactive |

### `products`

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | PK |
| name | TEXT | Display name |
| sku | TEXT | Stock-keeping unit |
| active | INTEGER | 1 = active, 0 = discontinued |

---

## State Machine

```text
                    ┌─────────────────────────────────┐
                    │              DRAFT               │
                    │  (editable; buyer owned)         │
                    └──────────────┬──────────────────┘
                                   │ submit
                    ┌──────────────▼──────────────────┐
              ┌─────┤   total < $10,000 → APPROVED    │
              │     │   total ≥ $10,000 → SUBMITTED   ├──── cancel (approver)
              │     └──────────────┬──────────────────┘
              │                    │ approve (approver,
              │                    │ not self)
              │     ┌──────────────▼──────────────────┐
              │     │            APPROVED              ├──── cancel (approver only)
              │     └──────────────┬──────────────────┘
              │                    │ fulfil (supplier)
              │     ┌──────────────▼──────────────────┐
              │     │           FULFILLED              │ (terminal)
              │     └─────────────────────────────────┘
              │
              │     reject (approver) ──► back to DRAFT
              │
              └───► CANCELLED (terminal; buyer: draft/submitted only;
                               approver: draft/submitted/approved)
```

---

## Validation Rules

| Rule | Enforced At |
|------|-------------|
| PO must have ≥ 1 line item at submission | Service (lib) |
| Line item quantity ≥ 1 | DB CHECK + lib validation |
| Line item unit_price > 0 | DB CHECK + lib validation |
| Supplier must be active at submission | Service (lib) |
| All products must be active at submission | Service (lib) |
| Self-approval forbidden | Service (lib) — canApprove() |
| Only Draft POs are editable | Service (lib) |
| Buyer can cancel only Draft/Submitted | Service (lib) |
| Cancellation reason required | Service (lib) + DB NOT NULL when status='cancelled' (enforced at write) |
| Rejection reason required | Service (lib) |

---

## Key Derived Values

| Value | Derived From | Storage |
|-------|-------------|---------|
| `total_amount` | SUM(line_item.line_total) | Stored on PO, updated on each line item write |
| `line_total` | quantity × unit_price | Stored on line item |
| `requires_approval` | total_amount ≥ 10000 | Not stored; computed at submission |
