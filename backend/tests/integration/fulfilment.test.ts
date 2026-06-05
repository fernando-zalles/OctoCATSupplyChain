import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, cleanDb } from '../helpers/db';
import type { Db } from '../../src/db/database';
import { PurchaseOrderRepository } from '../../src/repositories/purchase-order.repository';
import { LineItemRepository } from '../../src/repositories/line-item.repository';
import { AuditRepository } from '../../src/repositories/audit.repository';
import { NotificationRepository } from '../../src/repositories/notification.repository';
import { FulfilmentRepository } from '../../src/repositories/fulfilment.repository';
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
  const fulfilRepo = new FulfilmentRepository(db);
  const notifService = new NotificationService(notifRepo);
  poService = new PurchaseOrderService(poRepo, liRepo, auditRepo, notifService, fulfilRepo);
});

afterEach(() => {
  cleanDb(db);
  db.close();
});

describe('Supplier fulfilment (integration)', () => {
  it('marks an approved PO as fulfilled via shipment records', async () => {
    const po = poService.create({ branchId: 1, supplierId: 10, createdByUserId: 1 });
    const li = poService.addLineItem(po.id, 1, { productId: 1, quantity: 3, unitPrice: 50 });
    await poService.submit(po.id, 1);

    const fulfilled = await poService.recordShipment(po.id, li.id, 3, ['supplier'], { quantityFulfilled: 3 });
    expect(fulfilled.status).toBe('fulfilled');
    expect(fulfilled.fulfilled_at).not.toBeNull();

    const audit = auditRepo.findByPO(po.id);
    expect(audit.some((e) => e.to_status === 'fulfilled')).toBe(true);
  });

  it('rejects fulfilment attempt on a draft PO', async () => {
    const po = poService.create({ branchId: 1, supplierId: 10, createdByUserId: 1 });
    const li = poService.addLineItem(po.id, 1, { productId: 1, quantity: 3, unitPrice: 50 });
    await expect(
      poService.recordShipment(po.id, li.id, 3, ['supplier'], { quantityFulfilled: 1 })
    ).rejects.toThrow();
  });
});
