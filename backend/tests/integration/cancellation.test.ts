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

beforeEach(() => {
  db = createTestDb();
  const poRepo = new PurchaseOrderRepository(db);
  const liRepo = new LineItemRepository(db);
  auditRepo = new AuditRepository(db);
  const notifRepo = new NotificationRepository(db);
  const notifService = new NotificationService(notifRepo);
  poService = new PurchaseOrderService(poRepo, liRepo, auditRepo, notifService);
});

afterEach(() => {
  cleanDb(db);
  db.close();
});

describe('Cancellation (integration)', () => {
  it('buyer can cancel their own draft PO', async () => {
    const po = poService.create({ branchId: 1, supplierId: 10, createdByUserId: 1 });
    const cancelled = await poService.cancel(po.id, 1, ['buyer'], 'Duplicate order');
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancellation_reason).toBe('Duplicate order');

    const audit = auditRepo.findByPO(po.id);
    expect(audit.some((e) => e.to_status === 'cancelled' && e.reason === 'Duplicate order')).toBe(true);
  });

  it('buyer cannot cancel an approved PO', async () => {
    const po = poService.create({ branchId: 1, supplierId: 10, createdByUserId: 1 });
    poService.addLineItem(po.id, 1, { productId: 1, quantity: 1, unitPrice: 500 });
    await poService.submit(po.id, 1);
    await expect(poService.cancel(po.id, 1, ['buyer'], 'Changed mind')).rejects.toThrow();
  });

  it('approver can cancel an approved PO', async () => {
    const po = poService.create({ branchId: 1, supplierId: 10, createdByUserId: 1 });
    poService.addLineItem(po.id, 1, { productId: 1, quantity: 1, unitPrice: 500 });
    await poService.submit(po.id, 1);
    const cancelled = await poService.cancel(po.id, 2, ['approver'], 'Budget frozen');
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancellation_reason).toBe('Budget frozen');
  });
});
