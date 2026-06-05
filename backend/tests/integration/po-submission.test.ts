import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, cleanDb } from '../helpers/db';
import type { Db } from '../../src/db/database';
import { PurchaseOrderRepository } from '../../src/repositories/purchase-order.repository';
import { LineItemRepository } from '../../src/repositories/line-item.repository';
import { AuditRepository } from '../../src/repositories/audit.repository';
import { NotificationRepository } from '../../src/repositories/notification.repository';
import { PurchaseOrderService } from '../../src/services/purchase-order.service';
import { NotificationService } from '../../src/services/notification.service';

let db: Db;
let poService: PurchaseOrderService;
let auditRepo: AuditRepository;
let notifRepo: NotificationRepository;

beforeEach(() => {
  db = createTestDb();
  const poRepo = new PurchaseOrderRepository(db);
  const liRepo = new LineItemRepository(db);
  auditRepo = new AuditRepository(db);
  notifRepo = new NotificationRepository(db);
  const notifService = new NotificationService(notifRepo);
  poService = new PurchaseOrderService(poRepo, liRepo, auditRepo, notifService);
});

afterEach(() => {
  cleanDb(db);
  db.close();
});

describe('PO submission workflow (integration)', () => {
  it('creates PO, adds line items, submits with auto-approval, creates audit trail and notification', async () => {
    const po = poService.create({ branchId: 1, supplierId: 10, createdByUserId: 1 });
    expect(po.status).toBe('draft');

    poService.addLineItem(po.id, 1, { productId: 1, quantity: 10, unitPrice: 50 });
    poService.addLineItem(po.id, 1, { productId: 2, quantity: 5, unitPrice: 200 });

    const updatedPo = poService.getPO(po.id)!;
    expect(updatedPo.total_amount).toBe(1500);

    const submitted = await poService.submit(po.id, 1);
    expect(submitted.status).toBe('approved');
    expect(submitted.total_amount).toBe(1500);
    expect(submitted.submitted_at).not.toBeNull();
    expect(submitted.approved_at).not.toBeNull();

    const auditEntries = auditRepo.findByPO(po.id);
    expect(auditEntries.length).toBeGreaterThanOrEqual(2);
    expect(auditEntries.some((e) => e.to_status === 'draft')).toBe(true);
    expect(auditEntries.some((e) => e.to_status === 'approved')).toBe(true);

    const notifications = notifRepo.findByPO(po.id);
    expect(notifications.length).toBeGreaterThanOrEqual(1);
    const approvedNotif = notifications.find((n) => n.event_type === 'approved-confirmed');
    expect(approvedNotif).toBeDefined();
    expect(approvedNotif?.recipient_type).toBe('supplier');
    expect(approvedNotif?.recipient_id).toBe(10);
  });

  it('places high-value PO in submitted status with pending notification', async () => {
    const po = poService.create({ branchId: 1, supplierId: 20, createdByUserId: 1 });
    poService.addLineItem(po.id, 1, { productId: 3, quantity: 1, unitPrice: 15000 });

    const submitted = await poService.submit(po.id, 1);
    expect(submitted.status).toBe('submitted');
    expect(submitted.approved_at).toBeNull();

    const notifications = notifRepo.findByPO(po.id);
    const pendingNotif = notifications.find((n) => n.event_type === 'submitted-pending');
    expect(pendingNotif).toBeDefined();
    expect(pendingNotif?.recipient_type).toBe('supplier');
  });
});
