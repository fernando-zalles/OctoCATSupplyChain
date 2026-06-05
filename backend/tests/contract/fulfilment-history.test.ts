import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/api/app';
import { createTestDb, cleanDb } from '../helpers/db';
import type { Db } from '../../src/db/database';
import { PurchaseOrderRepository } from '../../src/repositories/purchase-order.repository';
import { LineItemRepository } from '../../src/repositories/line-item.repository';
import { AuditRepository } from '../../src/repositories/audit.repository';
import { NotificationRepository } from '../../src/repositories/notification.repository';
import { FulfilmentRepository } from '../../src/repositories/fulfilment.repository';
import { PurchaseOrderService } from '../../src/services/purchase-order.service';
import { NotificationService } from '../../src/services/notification.service';

const BUYER_TOKEN = 'eyJhbGciOiJub25lIn0.eyJ1c2VySWQiOjEsInJvbGVzIjpbImJ1eWVyIl0sImJyYW5jaElkIjoxfQ.';
const SUPPLIER_TOKEN = 'eyJhbGciOiJub25lIn0.eyJ1c2VySWQiOjMsInJvbGVzIjpbInN1cHBsaWVyIl0sImJyYW5jaElkIjpudWxsfQ.';

let db: Db;
let app: ReturnType<typeof createApp>;
let poRepo: PurchaseOrderRepository;
let liRepo: LineItemRepository;
let poService: PurchaseOrderService;

beforeEach(() => {
  db = createTestDb();
  poRepo = new PurchaseOrderRepository(db);
  liRepo = new LineItemRepository(db);
  const auditRepo = new AuditRepository(db);
  const notifRepo = new NotificationRepository(db);
  const fulfilRepo = new FulfilmentRepository(db);
  const notifService = new NotificationService(notifRepo);
  poService = new PurchaseOrderService(poRepo, liRepo, auditRepo, notifService, fulfilRepo);
  app = createApp(poService);
});

afterEach(() => {
  cleanDb(db);
  db.close();
});

describe('GET /api/v1/purchase-orders/:id/fulfilment-history', () => {
  it('returns empty records array for a PO with no shipments', async () => {
    const po = poRepo.create({ branch_id: 1, supplier_id: 10, created_by_user_id: 1 });
    liRepo.add(po.id, { product_id: 1, quantity: 5, unit_price: 50 });
    await poService.submit(po.id, 1);

    const res = await request(app)
      .get(`/api/v1/purchase-orders/${po.id}/fulfilment-history`)
      .set('Authorization', `Bearer ${BUYER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.records).toEqual([]);
  });

  it('returns records in chronological order', async () => {
    const po = poRepo.create({ branch_id: 1, supplier_id: 10, created_by_user_id: 1 });
    const li = liRepo.add(po.id, { product_id: 1, quantity: 10, unit_price: 50 });
    await poService.submit(po.id, 1);

    await poService.recordShipment(po.id, li.id, 3, ['supplier'], { quantityFulfilled: 3, shipmentReference: 'T1' });
    await poService.recordShipment(po.id, li.id, 3, ['supplier'], { quantityFulfilled: 4, shipmentReference: 'T2' });

    const res = await request(app)
      .get(`/api/v1/purchase-orders/${po.id}/fulfilment-history`)
      .set('Authorization', `Bearer ${BUYER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.records).toHaveLength(2);
    expect(res.body.records[0].quantityFulfilled).toBe(3);
    expect(res.body.records[0].cumulativeQty).toBe(3);
    expect(res.body.records[1].quantityFulfilled).toBe(4);
    expect(res.body.records[1].cumulativeQty).toBe(7);
  });

  it('is accessible to the supplier', async () => {
    const po = poRepo.create({ branch_id: 1, supplier_id: 10, created_by_user_id: 1 });
    liRepo.add(po.id, { product_id: 1, quantity: 5, unit_price: 50 });
    await poService.submit(po.id, 1);

    const res = await request(app)
      .get(`/api/v1/purchase-orders/${po.id}/fulfilment-history`)
      .set('Authorization', `Bearer ${SUPPLIER_TOKEN}`);

    expect(res.status).toBe(200);
  });
});
