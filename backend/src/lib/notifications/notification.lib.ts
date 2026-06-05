import type { RecipientType, EventType } from '../../repositories/notification.repository';

export interface NewNotification {
  purchase_order_id: number;
  recipient_type: RecipientType;
  recipient_id: number;
  event_type: EventType;
}

export function buildNotification(
  poId: number,
  recipientType: RecipientType,
  recipientId: number,
  eventType: EventType,
): NewNotification {
  return { purchase_order_id: poId, recipient_type: recipientType, recipient_id: recipientId, event_type: eventType };
}
