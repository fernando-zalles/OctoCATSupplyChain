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

// Buyer: userId=1, branchId=1
const BUYER_TOKEN = 'eyJhbGciOiJub25lIn0.eyJ1c2VySWQiOjEsInJvbGVzIjpbImJ1eWVyIl0sImJyYW5jaElkIjoxfQ.';
// Approver: userId=2, branchId=null
const APPROVER_TOKEN = 'eyJhbGciOiJub25lIn0.eyJ1c2VySWQiOjIsInJvbGVzIjpbImFwcHJvdmVyIl0sImJyYW5jaElkIjpudWxsfQ.';
// Dual-role buyer+approver: userId=1 (same as buyer — self-approval attempt)
const DUAL_ROLE_SELF_TOKEN = 'eyJhbGciOiJub25lIn0.eyJ1c2VySWQiOjEsInJvbGVzIjpbImJ1eWVyIiwiYXBwcm92ZXIiXSwiYnJhbmNoSWQiOjF9.';

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

async function createSubmittedHighValuePO(): Promise<number> {
  const po = poRepo.create({ branch_id: 1, supplier_id: 10, created_by_user_id: 1 });
  liRepo.add(po.id, { product_id: 1, quantity: 1, unit_price: 15000 });
  await poService.submit(po.id, 1);
  return po.id;
}

describe('POST /api/v1/purchase-orders/:id/approve', () => {
  it('approves a submitted PO as a different approver', async () => {
    const poId = await createSubmittedHighValuePO();
    const res = await request(app)
      .post(`/api/v1/purchase-orders/${poId}/approve`)
      .set('Authorization', `Bearer ${APPROVER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
  });

  it('returns 403 when user lacks approver role', async () => {
    const poId = await createSubmittedHighValuePO();
    const res = await request(app)
      .post(`/api/v1/purchase-orders/${poId}/approve`)
      .set('Authorization', `Bearer ${BUYER_TOKEN}`);
    expect(res.status).toBe(403);
  });

  it('returns 403 when dual-role user tries to approve their own PO', async () => {
    const poId = await createSubmittedHighValuePO();
    const res = await request(app)
      .post(`/api/v1/purchase-orders/${poId}/approve`)
      .set('Authorization', `Bearer ${DUAL_ROLE_SELF_TOKEN}`);
    expect(res.status).toBe(403);
  });

  it('returns 409 when PO is not in submitted status', async () => {
    const po = poRepo.create({ branch_id: 1, supplier_id: 10, created_by_user_id: 1 });
    const res = await request(app)
      .post(`/api/v1/purchase-orders/${po.id}/approve`)
      .set('Authorization', `Bearer ${APPROVER_TOKEN}`);
    expect(res.status).toBe(409);
  });
});
