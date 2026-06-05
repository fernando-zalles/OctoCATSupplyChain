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
let fulfilRepo: FulfilmentRepository;

beforeEach(() => {
  db = createTestDb();
  const poRepo = new PurchaseOrderRepository(db);
  const liRepo = new LineItemRepository(db);
  auditRepo = new AuditRepository(db);
  const notifRepo = new NotificationRepository(db);
  fulfilRepo = new FulfilmentRepository(db);
  const notifService = new NotificationService(notifRepo);
  poService = new PurchaseOrderService(poRepo, liRepo, auditRepo, notifService, fulfilRepo);
});

afterEach(() => {
  cleanDb(db);
  db.close();
});

describe('Partial fulfilment workflow (integration)', () => {
  it('records a partial shipment, creates fulfilment record, transitions PO to partially-fulfilled', async () => {
    const po = poService.create({ branchId: 1, supplierId: 10, createdByUserId: 1 });
    const li1 = poService.addLineItem(po.id, 1, { productId: 1, quantity: 10, unitPrice: 50 });
    poService.addLineItem(po.id, 1, { productId: 2, quantity: 5, unitPrice: 100 });
    await poService.submit(po.id, 1);

    const updated = await poService.recordShipment(po.id, li1.id, 3, ['supplier'], { quantityFulfilled: 3, shipmentReference: 'TRACK-001' });

    expect(updated.status).toBe('partially-fulfilled');

    const records = fulfilRepo.findByPO(po.id);
    expect(records).toHaveLength(1);
    expect(records[0].quantity_fulfilled).toBe(3);
    expect(records[0].cumulative_qty).toBe(3);
    expect(records[0].shipment_reference).toBe('TRACK-001');
    expect(records[0].line_item_id).toBe(li1.id);
  });

  it('transitions to fulfilled when all line items are complete', async () => {
    const po = poService.create({ branchId: 1, supplierId: 10, createdByUserId: 1 });
    const li1 = poService.addLineItem(po.id, 1, { productId: 1, quantity: 5, unitPrice: 50 });
    const li2 = poService.addLineItem(po.id, 1, { productId: 2, quantity: 3, unitPrice: 100 });
    await poService.submit(po.id, 1);

    await poService.recordShipment(po.id, li1.id, 3, ['supplier'], { quantityFulfilled: 5 });
    const final = await poService.recordShipment(po.id, li2.id, 3, ['supplier'], { quantityFulfilled: 3 });

    expect(final.status).toBe('fulfilled');

    const audit = auditRepo.findByPO(po.id);
    expect(audit.some((e) => e.from_status === 'partially-fulfilled' && e.to_status === 'fulfilled')).toBe(true);
  });

  it('blocks over-delivery', async () => {
    const po = poService.create({ branchId: 1, supplierId: 10, createdByUserId: 1 });
    const li = poService.addLineItem(po.id, 1, { productId: 1, quantity: 5, unitPrice: 50 });
    await poService.submit(po.id, 1);

    await expect(
      poService.recordShipment(po.id, li.id, 3, ['supplier'], { quantityFulfilled: 6 })
    ).rejects.toThrow('over-delivery');
  });

  it('blocks shipment on fulfilled PO', async () => {
    const po = poService.create({ branchId: 1, supplierId: 10, createdByUserId: 1 });
    const li = poService.addLineItem(po.id, 1, { productId: 1, quantity: 3, unitPrice: 50 });
    await poService.submit(po.id, 1);
    await poService.recordShipment(po.id, li.id, 3, ['supplier'], { quantityFulfilled: 3 });

    await expect(
      poService.recordShipment(po.id, li.id, 3, ['supplier'], { quantityFulfilled: 1 })
    ).rejects.toThrow();
  });

  it('returns fulfilment history in chronological order', async () => {
    const po = poService.create({ branchId: 1, supplierId: 10, createdByUserId: 1 });
    const li = poService.addLineItem(po.id, 1, { productId: 1, quantity: 10, unitPrice: 50 });
    await poService.submit(po.id, 1);

    await poService.recordShipment(po.id, li.id, 3, ['supplier'], { quantityFulfilled: 3, shipmentReference: 'A' });
    await poService.recordShipment(po.id, li.id, 3, ['supplier'], { quantityFulfilled: 4, shipmentReference: 'B' });

    const history = poService.getFulfilmentHistory(po.id);
    expect(history).toHaveLength(2);
    expect(history[0].shipment_reference).toBe('A');
    expect(history[0].cumulative_qty).toBe(3);
    expect(history[1].shipment_reference).toBe('B');
    expect(history[1].cumulative_qty).toBe(7);
  });
});
