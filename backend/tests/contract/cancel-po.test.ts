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
const APPROVER_TOKEN = 'eyJhbGciOiJub25lIn0.eyJ1c2VySWQiOjIsInJvbGVzIjpbImFwcHJvdmVyIl0sImJyYW5jaElkIjpudWxsfQ.';

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
  const notifService = new NotificationService(notifRepo);
  poService = new PurchaseOrderService(poRepo, liRepo, auditRepo, notifService);
  app = createApp(poService);
});

afterEach(() => {
  cleanDb(db);
  db.close();
});

describe('POST /api/v1/purchase-orders/:id/cancel', () => {
  it('buyer can cancel their own Draft PO', async () => {
    const po = poRepo.create({ branch_id: 1, supplier_id: 10, created_by_user_id: 1 });
    const res = await request(app)
      .post(`/api/v1/purchase-orders/${po.id}/cancel`)
      .set('Authorization', `Bearer ${BUYER_TOKEN}`)
      .send({ reason: 'No longer needed' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
    expect(res.body.cancellationReason).toBe('No longer needed');
  });

  it('buyer cannot cancel an Approved PO', async () => {
    const po = poRepo.create({ branch_id: 1, supplier_id: 10, created_by_user_id: 1 });
    liRepo.add(po.id, { product_id: 1, quantity: 1, unit_price: 100 });
    await poService.submit(po.id, 1); // auto-approves
    const res = await request(app)
      .post(`/api/v1/purchase-orders/${po.id}/cancel`)
      .set('Authorization', `Bearer ${BUYER_TOKEN}`)
      .send({ reason: 'Changed mind' });
    expect(res.status).toBe(409);
  });

  it('approver can cancel an Approved PO', async () => {
    const po = poRepo.create({ branch_id: 1, supplier_id: 10, created_by_user_id: 1 });
    liRepo.add(po.id, { product_id: 1, quantity: 1, unit_price: 100 });
    await poService.submit(po.id, 1);
    const res = await request(app)
      .post(`/api/v1/purchase-orders/${po.id}/cancel`)
      .set('Authorization', `Bearer ${APPROVER_TOKEN}`)
      .send({ reason: 'Supplier issue' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
  });

  it('returns 409 when cancelling a Fulfilled PO', async () => {
    const po = poRepo.create({ branch_id: 1, supplier_id: 10, created_by_user_id: 1 });
    liRepo.add(po.id, { product_id: 1, quantity: 1, unit_price: 100 });
    await poService.submit(po.id, 1);
    await poService.fulfil(po.id, 3, ['supplier']);
    const res = await request(app)
      .post(`/api/v1/purchase-orders/${po.id}/cancel`)
      .set('Authorization', `Bearer ${APPROVER_TOKEN}`)
      .send({ reason: 'Too late' });
    expect(res.status).toBe(409);
  });

  it('returns 400 when reason is missing', async () => {
    const po = poRepo.create({ branch_id: 1, supplier_id: 10, created_by_user_id: 1 });
    const res = await request(app)
      .post(`/api/v1/purchase-orders/${po.id}/cancel`)
      .set('Authorization', `Bearer ${BUYER_TOKEN}`)
      .send({});
    expect(res.status).toBe(400);
  });
});
