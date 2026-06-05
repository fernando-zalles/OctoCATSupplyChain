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

const SUPPLIER_TOKEN = 'eyJhbGciOiJub25lIn0.eyJ1c2VySWQiOjMsInJvbGVzIjpbInN1cHBsaWVyIl0sImJyYW5jaElkIjpudWxsfQ.';
const BUYER_TOKEN = 'eyJhbGciOiJub25lIn0.eyJ1c2VySWQiOjEsInJvbGVzIjpbImJ1eWVyIl0sImJyYW5jaElkIjoxfQ.';

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

async function createApprovedPOWithLineItem(qty = 10): Promise<{ poId: number; lineItemId: number }> {
  const po = poRepo.create({ branch_id: 1, supplier_id: 10, created_by_user_id: 1 });
  const li = liRepo.add(po.id, { product_id: 1, quantity: qty, unit_price: 100 });
  await poService.submit(po.id, 1);
  return { poId: po.id, lineItemId: li.id };
}

describe('POST /api/v1/purchase-orders/:id/line-items/:lineItemId/shipments', () => {
  it('records a partial shipment and transitions PO to partially-fulfilled', async () => {
    const { poId, lineItemId } = await createApprovedPOWithLineItem(10);

    const res = await request(app)
      .post(`/api/v1/purchase-orders/${poId}/line-items/${lineItemId}/shipments`)
      .set('Authorization', `Bearer ${SUPPLIER_TOKEN}`)
      .send({ quantityFulfilled: 4 });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('partially-fulfilled');
  });

  it('accepts an optional shipment reference', async () => {
    const { poId, lineItemId } = await createApprovedPOWithLineItem(5);

    const res = await request(app)
      .post(`/api/v1/purchase-orders/${poId}/line-items/${lineItemId}/shipments`)
      .set('Authorization', `Bearer ${SUPPLIER_TOKEN}`)
      .send({ quantityFulfilled: 2, shipmentReference: 'TRACK-XYZ' });

    expect(res.status).toBe(201);
  });

  it('transitions to fulfilled when all quantities are complete', async () => {
    const { poId, lineItemId } = await createApprovedPOWithLineItem(5);

    const res = await request(app)
      .post(`/api/v1/purchase-orders/${poId}/line-items/${lineItemId}/shipments`)
      .set('Authorization', `Bearer ${SUPPLIER_TOKEN}`)
      .send({ quantityFulfilled: 5 });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('fulfilled');
  });

  it('returns 409 on over-delivery', async () => {
    const { poId, lineItemId } = await createApprovedPOWithLineItem(5);

    const res = await request(app)
      .post(`/api/v1/purchase-orders/${poId}/line-items/${lineItemId}/shipments`)
      .set('Authorization', `Bearer ${SUPPLIER_TOKEN}`)
      .send({ quantityFulfilled: 6 });

    expect(res.status).toBe(409);
  });

  it('returns 409 when PO is not approved or partially-fulfilled', async () => {
    const po = poRepo.create({ branch_id: 1, supplier_id: 10, created_by_user_id: 1 });
    const li = liRepo.add(po.id, { product_id: 1, quantity: 5, unit_price: 50 });

    const res = await request(app)
      .post(`/api/v1/purchase-orders/${po.id}/line-items/${li.id}/shipments`)
      .set('Authorization', `Bearer ${SUPPLIER_TOKEN}`)
      .send({ quantityFulfilled: 2 });

    expect(res.status).toBe(409);
  });

  it('returns 403 when user lacks supplier role', async () => {
    const { poId, lineItemId } = await createApprovedPOWithLineItem();

    const res = await request(app)
      .post(`/api/v1/purchase-orders/${poId}/line-items/${lineItemId}/shipments`)
      .set('Authorization', `Bearer ${BUYER_TOKEN}`)
      .send({ quantityFulfilled: 2 });

    expect(res.status).toBe(403);
  });

  it('returns 400 when quantityFulfilled is missing', async () => {
    const { poId, lineItemId } = await createApprovedPOWithLineItem();

    const res = await request(app)
      .post(`/api/v1/purchase-orders/${poId}/line-items/${lineItemId}/shipments`)
      .set('Authorization', `Bearer ${SUPPLIER_TOKEN}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 409 when attempting to ship against a fulfilled PO', async () => {
    const { poId, lineItemId } = await createApprovedPOWithLineItem(3);

    // Complete all quantities
    await request(app)
      .post(`/api/v1/purchase-orders/${poId}/line-items/${lineItemId}/shipments`)
      .set('Authorization', `Bearer ${SUPPLIER_TOKEN}`)
      .send({ quantityFulfilled: 3 });

    // Attempt another shipment
    const res = await request(app)
      .post(`/api/v1/purchase-orders/${poId}/line-items/${lineItemId}/shipments`)
      .set('Authorization', `Bearer ${SUPPLIER_TOKEN}`)
      .send({ quantityFulfilled: 1 });

    expect(res.status).toBe(409);
  });
});
