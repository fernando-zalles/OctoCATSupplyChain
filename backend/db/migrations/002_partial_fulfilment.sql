-- Migration: 002_partial_fulfilment
-- Adds 'partially-fulfilled' to purchase_orders.status CHECK constraint
-- and creates the fulfilment_records table.
--
-- SQLite cannot ALTER a CHECK constraint in-place, so we use the recommended
-- table-recreation pattern: create new table, copy data, drop old, rename.

PRAGMA foreign_keys = OFF;

-- ─── Recreate purchase_orders with updated CHECK constraint ───────────────────

CREATE TABLE purchase_orders_new (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id             INTEGER NOT NULL,
  supplier_id           INTEGER NOT NULL,
  created_by_user_id    INTEGER NOT NULL,
  status                TEXT    NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','submitted','approved','partially-fulfilled','fulfilled','cancelled')),
  total_amount          REAL    NOT NULL DEFAULT 0,
  created_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  submitted_at          TEXT,
  submitted_by_user_id  INTEGER,
  approved_at           TEXT,
  approved_by_user_id   INTEGER,
  fulfilled_at          TEXT,
  cancelled_at          TEXT,
  cancelled_by_user_id  INTEGER,
  cancellation_reason   TEXT,
  rejection_reason      TEXT
);

INSERT INTO purchase_orders_new SELECT * FROM purchase_orders;
DROP TABLE purchase_orders;
ALTER TABLE purchase_orders_new RENAME TO purchase_orders;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_po_branch_status   ON purchase_orders (branch_id, status);
CREATE INDEX IF NOT EXISTS idx_po_supplier_status ON purchase_orders (supplier_id, status);
CREATE INDEX IF NOT EXISTS idx_po_status          ON purchase_orders (status);

-- ─── Fulfilment Records ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fulfilment_records (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_order_id   INTEGER NOT NULL REFERENCES purchase_orders (id),
  line_item_id        INTEGER NOT NULL REFERENCES po_line_items (id),
  quantity_fulfilled  INTEGER NOT NULL CHECK (quantity_fulfilled >= 1),
  cumulative_qty      INTEGER NOT NULL,
  shipment_reference  TEXT,
  actor_user_id       INTEGER NOT NULL,
  created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_fulfilment_po        ON fulfilment_records (purchase_order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_fulfilment_line_item ON fulfilment_records (line_item_id);

PRAGMA foreign_keys = ON;
