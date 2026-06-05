import { Db } from '../db/database';
import { POStatus } from './purchase-order.repository';

export interface AuditEntry {
  id: number;
  purchase_order_id: number;
  actor_user_id: number;
  from_status: POStatus | null;
  to_status: POStatus;
  reason: string | null;
  created_at: string;
}

export interface AppendAuditInput {
  purchase_order_id: number;
  actor_user_id: number;
  from_status: POStatus | null;
  to_status: POStatus;
  reason?: string;
}

export class AuditRepository {
  constructor(private db: Db) {}

  append(input: AppendAuditInput): AuditEntry {
    const result = this.db.prepare(`
      INSERT INTO po_audit_entries (purchase_order_id, actor_user_id, from_status, to_status, reason)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      input.purchase_order_id,
      input.actor_user_id,
      input.from_status ?? null,
      input.to_status,
      input.reason ?? null,
    );
    return this.db.prepare('SELECT * FROM po_audit_entries WHERE id = ?')
      .get(result.lastInsertRowid) as AuditEntry;
  }

  findByPO(poId: number): AuditEntry[] {
    return this.db
      .prepare('SELECT * FROM po_audit_entries WHERE purchase_order_id = ? ORDER BY created_at ASC')
      .all(poId) as AuditEntry[];
  }
}
