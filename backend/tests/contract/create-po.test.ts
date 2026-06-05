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

// Buyer JWT with userId=1, branchId=1, roles=['buyer']
const BUYER_TOKEN = 'eyJhbGciOiJub25lIn0.eyJ1c2VySWQiOjEsInJvbGVzIjpbImJ1eWVyIl0sImJyYW5jaElkIjoxfQ.';

let db: Db;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = createTestDb();
  const poRepo = new PurchaseOrderRepository(db);
  const liRepo = new LineItemRepository(db);
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

describe('POST /api/v1/purchase-orders', () => {
  it('creates a PO in draft status', async () => {
    const res = await request(app)
      .post('/api/v1/purchase-orders')
      .set('Authorization', `Bearer ${BUYER_TOKEN}`)
      .send({ supplierId: 10 });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('draft');
    expect(res.body.supplierId).toBe(10);
    expect(res.body.branchId).toBe(1);
    expect(res.body.totalAmount).toBe(0);
    expect(res.body.lineItems).toEqual([]);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/v1/purchase-orders').send({ supplierId: 10 });
    expect(res.status).toBe(401);
  });

  it('returns 400 when supplierId is missing', async () => {
    const res = await request(app)
      .post('/api/v1/purchase-orders')
      .set('Authorization', `Bearer ${BUYER_TOKEN}`)
      .send({});
    expect(res.status).toBe(400);
  });
});
