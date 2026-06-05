import { Db } from '../db/database';

export interface LineItem {
  id: number;
  purchase_order_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface LineItemInput {
  product_id: number;
  quantity: number;
  unit_price: number;
}

export class LineItemRepository {
  constructor(private db: Db) {}

  private recalcTotal(poId: number): void {
    this.db.prepare(`
      UPDATE purchase_orders
      SET total_amount = (
        SELECT COALESCE(SUM(line_total), 0) FROM po_line_items WHERE purchase_order_id = ?
      )
      WHERE id = ?
    `).run(poId, poId);
  }

  add(poId: number, input: LineItemInput): LineItem {
    const lineTotal = input.quantity * input.unit_price;
    const tx = this.db.transaction(() => {
      const result = this.db.prepare(`
        INSERT INTO po_line_items (purchase_order_id, product_id, quantity, unit_price, line_total)
        VALUES (?, ?, ?, ?, ?)
      `).run(poId, input.product_id, input.quantity, input.unit_price, lineTotal);
      this.recalcTotal(poId);
      return result.lastInsertRowid as number;
    });
    const id = tx();
    return this.findById(id)!;
  }

  update(id: number, poId: number, input: LineItemInput): LineItem {
    const lineTotal = input.quantity * input.unit_price;
    const tx = this.db.transaction(() => {
      this.db.prepare(`
        UPDATE po_line_items SET product_id = ?, quantity = ?, unit_price = ?, line_total = ?
        WHERE id = ? AND purchase_order_id = ?
      `).run(input.product_id, input.quantity, input.unit_price, lineTotal, id, poId);
      this.recalcTotal(poId);
    });
    tx();
    return this.findById(id)!;
  }

  remove(id: number, poId: number): void {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM po_line_items WHERE id = ? AND purchase_order_id = ?').run(id, poId);
      this.recalcTotal(poId);
    });
    tx();
  }

  findByPO(poId: number): LineItem[] {
    return this.db.prepare('SELECT * FROM po_line_items WHERE purchase_order_id = ?').all(poId) as LineItem[];
  }

  findById(id: number): LineItem | null {
    return (this.db.prepare('SELECT * FROM po_line_items WHERE id = ?').get(id) as LineItem | undefined) ?? null;
  }
}
