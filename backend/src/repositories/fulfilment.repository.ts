import { Db } from '../db/database';

export interface FulfilmentRecord {
  id: number;
  purchase_order_id: number;
  line_item_id: number;
  quantity_fulfilled: number;
  cumulative_qty: number;
  shipment_reference: string | null;
  actor_user_id: number;
  created_at: string;
}

export interface RecordShipmentInput {
  purchase_order_id: number;
  line_item_id: number;
  quantity_fulfilled: number;
  cumulative_qty: number;
  shipment_reference?: string;
  actor_user_id: number;
}

export class FulfilmentRepository {
  constructor(private db: Db) {}

  record(input: RecordShipmentInput): FulfilmentRecord {
    const result = this.db.prepare(`
      INSERT INTO fulfilment_records
        (purchase_order_id, line_item_id, quantity_fulfilled, cumulative_qty, shipment_reference, actor_user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      input.purchase_order_id,
      input.line_item_id,
      input.quantity_fulfilled,
      input.cumulative_qty,
      input.shipment_reference ?? null,
      input.actor_user_id,
    );
    return this.db.prepare('SELECT * FROM fulfilment_records WHERE id = ?')
      .get(result.lastInsertRowid) as FulfilmentRecord;
  }

  findByPO(poId: number): FulfilmentRecord[] {
    return this.db
      .prepare('SELECT * FROM fulfilment_records WHERE purchase_order_id = ? ORDER BY created_at ASC')
      .all(poId) as FulfilmentRecord[];
  }

  findByLineItem(lineItemId: number): FulfilmentRecord[] {
    return this.db
      .prepare('SELECT * FROM fulfilment_records WHERE line_item_id = ? ORDER BY created_at ASC')
      .all(lineItemId) as FulfilmentRecord[];
  }

  getCumulativeForLineItem(lineItemId: number): number {
    const row = this.db
      .prepare('SELECT COALESCE(SUM(quantity_fulfilled), 0) as total FROM fulfilment_records WHERE line_item_id = ?')
      .get(lineItemId) as { total: number };
    return row.total;
  }
}
