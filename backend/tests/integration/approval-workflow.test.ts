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

describe('Approval workflow (integration)', () => {
  it('approves a high-value PO and notifies supplier', async () => {
    const po = poService.create({ branchId: 1, supplierId: 10, createdByUserId: 1 });
    poService.addLineItem(po.id, 1, { productId: 1, quantity: 1, unitPrice: 15000 });
    await poService.submit(po.id, 1);

    const approved = await poService.approve(po.id, 2, ['approver']);
    expect(approved.status).toBe('approved');
    expect(approved.approved_by_user_id).toBe(2);

    const auditEntries = auditRepo.findByPO(po.id);
    expect(auditEntries.some((e) => e.from_status === 'submitted' && e.to_status === 'approved')).toBe(true);

    const notifications = notifRepo.findByPO(po.id);
    const approvedNotif = notifications.find((n) => n.event_type === 'approved-confirmed');
    expect(approvedNotif).toBeDefined();
  });

  it('rejects a high-value PO and returns to draft with reason', async () => {
    const po = poService.create({ branchId: 1, supplierId: 10, createdByUserId: 1 });
    poService.addLineItem(po.id, 1, { productId: 1, quantity: 1, unitPrice: 20000 });
    await poService.submit(po.id, 1);

    const rejected = await poService.reject(po.id, 2, ['approver'], 'Over budget');
    expect(rejected.status).toBe('draft');
    expect(rejected.rejection_reason).toBe('Over budget');

    const auditEntries = auditRepo.findByPO(po.id);
    expect(auditEntries.some((e) => e.from_status === 'submitted' && e.to_status === 'draft' && e.reason === 'Over budget')).toBe(true);

    const notifications = notifRepo.findByPO(po.id);
    const rejectedNotif = notifications.find((n) => n.event_type === 'rejected');
    expect(rejectedNotif).toBeDefined();
    expect(rejectedNotif?.recipient_type).toBe('buyer');
  });

  it('blocks self-approval', async () => {
    const po = poService.create({ branchId: 1, supplierId: 10, createdByUserId: 1 });
    poService.addLineItem(po.id, 1, { productId: 1, quantity: 1, unitPrice: 12000 });
    await poService.submit(po.id, 1);

    await expect(poService.approve(po.id, 1, ['approver', 'buyer'])).rejects.toThrow('own PO');
  });
});
