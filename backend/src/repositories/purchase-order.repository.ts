import { Db } from '../db/database';

export type POStatus = 'draft' | 'submitted' | 'approved' | 'partially-fulfilled' | 'fulfilled' | 'cancelled';

export interface PurchaseOrder {
  id: number;
  branch_id: number;
  supplier_id: number;
  created_by_user_id: number;
  status: POStatus;
  total_amount: number;
  created_at: string;
  submitted_at: string | null;
  submitted_by_user_id: number | null;
  approved_at: string | null;
  approved_by_user_id: number | null;
  fulfilled_at: string | null;
  cancelled_at: string | null;
  cancelled_by_user_id: number | null;
  cancellation_reason: string | null;
  rejection_reason: string | null;
}

export interface CreatePOInput {
  branch_id: number;
  supplier_id: number;
  created_by_user_id: number;
}

export interface UpdateStatusInput {
  id: number;
  status: POStatus;
  actorUserId: number;
  submittedAt?: string;
  approvedAt?: string;
  fulfilledAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  rejectionReason?: string;
  approvedByUserId?: number;
}

export class PurchaseOrderRepository {
  constructor(private db: Db) {}

  create(input: CreatePOInput): PurchaseOrder {
    const stmt = this.db.prepare(`
      INSERT INTO purchase_orders (branch_id, supplier_id, created_by_user_id)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(input.branch_id, input.supplier_id, input.created_by_user_id);
    return this.findById(result.lastInsertRowid as number)!;
  }

  findById(id: number): PurchaseOrder | null {
    return (
      (this.db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id) as PurchaseOrder | undefined) ?? null
    );
  }

  findByBranch(branchId: number, status?: POStatus): PurchaseOrder[] {
    if (status) {
      return this.db
        .prepare('SELECT * FROM purchase_orders WHERE branch_id = ? AND status = ? ORDER BY created_at DESC')
        .all(branchId, status) as PurchaseOrder[];
    }
    return this.db
      .prepare('SELECT * FROM purchase_orders WHERE branch_id = ? ORDER BY created_at DESC')
      .all(branchId) as PurchaseOrder[];
  }

  findBySupplier(supplierId: number, status?: POStatus): PurchaseOrder[] {
    if (status) {
      return this.db
        .prepare('SELECT * FROM purchase_orders WHERE supplier_id = ? AND status = ? ORDER BY created_at DESC')
        .all(supplierId, status) as PurchaseOrder[];
    }
    return this.db
      .prepare('SELECT * FROM purchase_orders WHERE supplier_id = ? ORDER BY created_at DESC')
      .all(supplierId) as PurchaseOrder[];
  }

  findByStatus(status: POStatus): PurchaseOrder[] {
    return this.db
      .prepare('SELECT * FROM purchase_orders WHERE status = ? ORDER BY created_at DESC')
      .all(status) as PurchaseOrder[];
  }

  updateStatus(input: UpdateStatusInput): PurchaseOrder {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE purchase_orders SET
        status                = ?,
        submitted_at          = COALESCE(?, submitted_at),
        submitted_by_user_id  = COALESCE(?, submitted_by_user_id),
        approved_at           = COALESCE(?, approved_at),
        approved_by_user_id   = COALESCE(?, approved_by_user_id),
        fulfilled_at          = COALESCE(?, fulfilled_at),
        cancelled_at          = COALESCE(?, cancelled_at),
        cancelled_by_user_id  = COALESCE(?, cancelled_by_user_id),
        cancellation_reason   = COALESCE(?, cancellation_reason),
        rejection_reason      = COALESCE(?, rejection_reason)
      WHERE id = ?
    `).run(
      input.status,
      input.submittedAt ?? null,
      input.status === 'submitted' || input.status === 'approved' ? input.actorUserId : null,
      input.approvedAt ?? null,
      input.approvedByUserId ?? null,
      input.fulfilledAt ?? null,
      input.cancelledAt ?? null,
      input.status === 'cancelled' ? input.actorUserId : null,
      input.cancellationReason ?? null,
      input.rejectionReason ?? null,
      input.id,
    );
    void now;
    return this.findById(input.id)!;
  }

  updateTotal(id: number, total: number): void {
    this.db.prepare('UPDATE purchase_orders SET total_amount = ? WHERE id = ?').run(total, id);
  }

  list(filters: { branchId?: number; supplierId?: number; status?: POStatus; limit?: number; offset?: number }): { items: PurchaseOrder[]; total: number } {
    const conditions: string[] = [];
    const params: (number | string)[] = [];

    if (filters.branchId != null) { conditions.push('branch_id = ?'); params.push(filters.branchId); }
    if (filters.supplierId != null) { conditions.push('supplier_id = ?'); params.push(filters.supplierId); }
    if (filters.status) { conditions.push('status = ?'); params.push(filters.status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = (this.db.prepare(`SELECT COUNT(*) as c FROM purchase_orders ${where}`).get(...params) as { c: number }).c;
    const items = this.db
      .prepare(`SELECT * FROM purchase_orders ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(...params, filters.limit ?? 50, filters.offset ?? 0) as PurchaseOrder[];

    return { items, total };
  }
}
