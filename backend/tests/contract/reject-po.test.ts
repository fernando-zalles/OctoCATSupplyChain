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

describe('POST /api/v1/purchase-orders/:id/reject', () => {
  it('rejects a submitted PO and returns it to draft', async () => {
    const po = poRepo.create({ branch_id: 1, supplier_id: 10, created_by_user_id: 1 });
    liRepo.add(po.id, { product_id: 1, quantity: 1, unit_price: 12000 });
    await poService.submit(po.id, 1);

    const res = await request(app)
      .post(`/api/v1/purchase-orders/${po.id}/reject`)
      .set('Authorization', `Bearer ${APPROVER_TOKEN}`)
      .send({ reason: 'Budget exceeded' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('draft');
    expect(res.body.rejectionReason).toBe('Budget exceeded');
  });

  it('returns 400 when reason is missing', async () => {
    const po = poRepo.create({ branch_id: 1, supplier_id: 10, created_by_user_id: 1 });
    liRepo.add(po.id, { product_id: 1, quantity: 1, unit_price: 12000 });
    await poService.submit(po.id, 1);

    const res = await request(app)
      .post(`/api/v1/purchase-orders/${po.id}/reject`)
      .set('Authorization', `Bearer ${APPROVER_TOKEN}`)
      .send({});
    expect(res.status).toBe(400);
  });
});
