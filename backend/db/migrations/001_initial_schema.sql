-- Migration: 001_initial_schema
-- Creates all tables for the Purchase Order management feature.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ─── Purchase Orders ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS purchase_orders (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id             INTEGER NOT NULL,
  supplier_id           INTEGER NOT NULL,
  created_by_user_id    INTEGER NOT NULL,
  status                TEXT    NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','submitted','approved','fulfilled','cancelled')),
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

CREATE INDEX IF NOT EXISTS idx_po_branch_status   ON purchase_orders (branch_id, status);
CREATE INDEX IF NOT EXISTS idx_po_supplier_status ON purchase_orders (supplier_id, status);
CREATE INDEX IF NOT EXISTS idx_po_status          ON purchase_orders (status);

-- ─── PO Line Items ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS po_line_items (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_order_id   INTEGER NOT NULL REFERENCES purchase_orders (id) ON DELETE CASCADE,
  product_id          INTEGER NOT NULL,
  quantity            INTEGER NOT NULL CHECK (quantity >= 1),
  unit_price          REAL    NOT NULL CHECK (unit_price > 0),
  line_total          REAL    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_line_item_po ON po_line_items (purchase_order_id);

-- ─── PO Audit Entries ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS po_audit_entries (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_order_id   INTEGER NOT NULL REFERENCES purchase_orders (id),
  actor_user_id       INTEGER NOT NULL,
  from_status         TEXT,
  to_status           TEXT    NOT NULL,
  reason              TEXT,
  created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_po ON po_audit_entries (purchase_order_id, created_at);

-- ─── Notifications ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_order_id   INTEGER NOT NULL REFERENCES purchase_orders (id),
  recipient_type      TEXT    NOT NULL CHECK (recipient_type IN ('supplier','buyer')),
  recipient_id        INTEGER NOT NULL,
  event_type          TEXT    NOT NULL
                        CHECK (event_type IN ('submitted-pending','approved-confirmed','rejected','cancelled')),
  created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  delivery_status     TEXT    NOT NULL DEFAULT 'pending'
                        CHECK (delivery_status IN ('pending','delivered','failed')),
  retry_count         INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_notification_status ON notifications (delivery_status);

-- ─── Migration Tracking ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS schema_migrations (
  name       TEXT NOT NULL PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
