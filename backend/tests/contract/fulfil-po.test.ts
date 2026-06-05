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
  const notifService = new NotificationService(notifRepo);
  poService = new PurchaseOrderService(poRepo, liRepo, auditRepo, notifService);
  app = createApp(poService);
});

afterEach(() => {
  cleanDb(db);
  db.close();
});

async function createApprovedPO(): Promise<number> {
  const po = poRepo.create({ branch_id: 1, supplier_id: 10, created_by_user_id: 1 });
  liRepo.add(po.id, { product_id: 1, quantity: 2, unit_price: 100 });
  await poService.submit(po.id, 1);
  return po.id;
}

describe('POST /api/v1/purchase-orders/:id/fulfil', () => {
  it('marks an approved PO as fulfilled', async () => {
    const poId = await createApprovedPO();
    const res = await request(app)
      .post(`/api/v1/purchase-orders/${poId}/fulfil`)
      .set('Authorization', `Bearer ${SUPPLIER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('fulfilled');
    expect(res.body.fulfilledAt).not.toBeNull();
  });

  it('returns 403 when user lacks supplier role', async () => {
    const poId = await createApprovedPO();
    const res = await request(app)
      .post(`/api/v1/purchase-orders/${poId}/fulfil`)
      .set('Authorization', `Bearer ${BUYER_TOKEN}`);
    expect(res.status).toBe(403);
  });

  it('returns 409 when PO is not in approved status', async () => {
    const po = poRepo.create({ branch_id: 1, supplier_id: 10, created_by_user_id: 1 });
    const res = await request(app)
      .post(`/api/v1/purchase-orders/${po.id}/fulfil`)
      .set('Authorization', `Bearer ${SUPPLIER_TOKEN}`);
    expect(res.status).toBe(409);
  });
});
