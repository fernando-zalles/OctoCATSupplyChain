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
let poRepo: PurchaseOrderRepository;
let liRepo: LineItemRepository;

beforeEach(() => {
  db = createTestDb();
  poRepo = new PurchaseOrderRepository(db);
  liRepo = new LineItemRepository(db);
  const auditRepo = new AuditRepository(db);
  const notifRepo = new NotificationRepository(db);
  const notifService = new NotificationService(notifRepo);
  const poService = new PurchaseOrderService(poRepo, liRepo, auditRepo, notifService);
  app = createApp(poService);
});

afterEach(() => {
  cleanDb(db);
  db.close();
});

function createPoWithTotal(total: number): number {
  const po = poRepo.create({ branch_id: 1, supplier_id: 10, created_by_user_id: 1 });
  liRepo.add(po.id, { product_id: 1, quantity: 1, unit_price: total });
  return po.id;
}

describe('POST /api/v1/purchase-orders/:id/submit', () => {
  it('auto-approves POs with total < $10,000', async () => {
    const poId = createPoWithTotal(5000);
    const res = await request(app)
      .post(`/api/v1/purchase-orders/${poId}/submit`)
      .set('Authorization', `Bearer ${BUYER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
  });

  it('places POs with total >= $10,000 in submitted status', async () => {
    const poId = createPoWithTotal(10000);
    const res = await request(app)
      .post(`/api/v1/purchase-orders/${poId}/submit`)
      .set('Authorization', `Bearer ${BUYER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('submitted');
  });

  it('returns 400 when PO has no line items', async () => {
    const po = poRepo.create({ branch_id: 1, supplier_id: 10, created_by_user_id: 1 });
    const res = await request(app)
      .post(`/api/v1/purchase-orders/${po.id}/submit`)
      .set('Authorization', `Bearer ${BUYER_TOKEN}`);
    expect(res.status).toBe(400);
  });

  it('returns 409 when submitting a non-draft PO', async () => {
    const poId = createPoWithTotal(500);
    await request(app)
      .post(`/api/v1/purchase-orders/${poId}/submit`)
      .set('Authorization', `Bearer ${BUYER_TOKEN}`);
    const res = await request(app)
      .post(`/api/v1/purchase-orders/${poId}/submit`)
      .set('Authorization', `Bearer ${BUYER_TOKEN}`);
    expect(res.status).toBe(409);
  });
});
