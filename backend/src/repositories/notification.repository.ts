import { Db } from '../db/database';

export type RecipientType = 'supplier' | 'buyer';
export type EventType = 'submitted-pending' | 'approved-confirmed' | 'rejected' | 'cancelled';
export type DeliveryStatus = 'pending' | 'delivered' | 'failed';

export interface Notification {
  id: number;
  purchase_order_id: number;
  recipient_type: RecipientType;
  recipient_id: number;
  event_type: EventType;
  created_at: string;
  delivery_status: DeliveryStatus;
  retry_count: number;
}

export interface CreateNotificationInput {
  purchase_order_id: number;
  recipient_type: RecipientType;
  recipient_id: number;
  event_type: EventType;
}

export class NotificationRepository {
  constructor(private db: Db) {}

  create(input: CreateNotificationInput): Notification {
    const result = this.db.prepare(`
      INSERT INTO notifications (purchase_order_id, recipient_type, recipient_id, event_type)
      VALUES (?, ?, ?, ?)
    `).run(input.purchase_order_id, input.recipient_type, input.recipient_id, input.event_type);
    return this.db.prepare('SELECT * FROM notifications WHERE id = ?')
      .get(result.lastInsertRowid) as Notification;
  }

  markDelivered(id: number): void {
    this.db.prepare(`UPDATE notifications SET delivery_status = 'delivered' WHERE id = ?`).run(id);
  }

  markFailed(id: number): void {
    this.db.prepare(`
      UPDATE notifications SET delivery_status = 'failed', retry_count = retry_count + 1 WHERE id = ?
    `).run(id);
  }

  findPending(): Notification[] {
    return this.db
      .prepare(`SELECT * FROM notifications WHERE delivery_status = 'pending'`)
      .all() as Notification[];
  }

  findByPO(poId: number): Notification[] {
    return this.db
      .prepare('SELECT * FROM notifications WHERE purchase_order_id = ? ORDER BY created_at ASC')
      .all(poId) as Notification[];
  }
}
