import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/api/app';
import { createTestDb, cleanDb } from '../helpers/db';
import type { Db } from '../../src/db/database';
import { PurchaseOrderRepository } from '../../src/repositories/purchase-order.repository';
import { LineItemRepository } from '../../src/repositories/line-item.repository';
import { AuditRepository } from '../../src/repositories/audit.repository';
import { NotificationRepository } from '../../src/repositories/notification.repository';
import { PurchaseOrderService } from '../../src/services/purchase-order.service';
import { NotificationService } from '../../src/services/notification.service';

const BUYER_TOKEN = 'eyJhbGciOiJub25lIn0.eyJ1c2VySWQiOjEsInJvbGVzIjpbImJ1eWVyIl0sImJyYW5jaElkIjoxfQ.';

let db: Db;
let app: ReturnType<typeof createApp>;
let poId: number;

beforeEach(() => {
  db = createTestDb();
  const poRepo = new PurchaseOrderRepository(db);
  const liRepo = new LineItemRepository(db);
  const auditRepo = new AuditRepository(db);
  const notifRepo = new NotificationRepository(db);
  const notifService = new NotificationService(notifRepo);
  const poService = new PurchaseOrderService(poRepo, liRepo, auditRepo, notifService);
  app = createApp(poService);

  const po = poRepo.create({ branch_id: 1, supplier_id: 10, created_by_user_id: 1 });
  poId = po.id;
});

afterEach(() => {
  cleanDb(db);
  db.close();
});

describe('POST /api/v1/purchase-orders/:id/line-items', () => {
  it('adds a line item and updates total_amount', async () => {
    const res = await request(app)
      .post(`/api/v1/purchase-orders/${poId}/line-items`)
      .set('Authorization', `Bearer ${BUYER_TOKEN}`)
      .send({ productId: 5, quantity: 3, unitPrice: 100 });

    expect(res.status).toBe(201);
    expect(res.body.lineItems).toHaveLength(1);
    expect(res.body.lineItems[0].quantity).toBe(3);
    expect(res.body.lineItems[0].unitPrice).toBe(100);
    expect(res.body.lineItems[0].lineTotal).toBe(300);
    expect(res.body.totalAmount).toBe(300);
  });

  it('returns 400 for quantity < 1', async () => {
    const res = await request(app)
      .post(`/api/v1/purchase-orders/${poId}/line-items`)
      .set('Authorization', `Bearer ${BUYER_TOKEN}`)
      .send({ productId: 5, quantity: 0, unitPrice: 100 });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/v1/purchase-orders/:id/line-items/:lineItemId', () => {
  it('removes line item and updates total', async () => {
    const addRes = await request(app)
      .post(`/api/v1/purchase-orders/${poId}/line-items`)
      .set('Authorization', `Bearer ${BUYER_TOKEN}`)
      .send({ productId: 5, quantity: 2, unitPrice: 50 });
    const lineItemId = (addRes.body as { lineItems: { id: number }[] }).lineItems[0].id;

    const delRes = await request(app)
      .delete(`/api/v1/purchase-orders/${poId}/line-items/${lineItemId}`)
      .set('Authorization', `Bearer ${BUYER_TOKEN}`);

    expect(delRes.status).toBe(200);
    expect((delRes.body as { lineItems: unknown[] }).lineItems).toHaveLength(0);
    expect((delRes.body as { totalAmount: number }).totalAmount).toBe(0);
  });
});
