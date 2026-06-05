import nodemailer from 'nodemailer';
import { NotificationRepository, type Notification } from '../repositories/notification.repository';
import { buildNotification, type NewNotification } from '../lib/notifications/notification.lib';
import type { RecipientType, EventType } from '../repositories/notification.repository';

const transporter = nodemailer.createTransport({ jsonTransport: true });

async function sendEmail(recipientId: number, eventType: EventType): Promise<void> {
  console.log(`[Notification stub] → recipient:${recipientId} event:${eventType}`);
  // Replace with real nodemailer config when notification service is wired up.
  await transporter.sendMail({
    from: 'noreply@octocat.internal',
    to: `user-${recipientId}@octocat.internal`,
    subject: `Purchase Order: ${eventType}`,
    text: `Your purchase order status has changed: ${eventType}`,
  });
}

export class NotificationService {
  constructor(private notifRepo: NotificationRepository) {}

  async dispatch(
    poId: number,
    recipientType: RecipientType,
    recipientId: number,
    eventType: EventType,
  ): Promise<void> {
    const notification = this.notifRepo.create(
      buildNotification(poId, recipientType, recipientId, eventType),
    );
    // Fire-and-forget — PO transition is never blocked by delivery
    void this.deliver(notification);
  }

  private async deliver(notification: Notification): Promise<void> {
    try {
      await sendEmail(notification.recipient_id, notification.event_type);
      try { this.notifRepo.markDelivered(notification.id); } catch { /* DB may be closed */ }
    } catch (err) {
      console.error(`[Notification] Delivery failed for id:${notification.id}`, err);
      try { this.notifRepo.markFailed(notification.id); } catch { /* DB may be closed */ }
    }
  }
}
