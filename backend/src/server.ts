import path from 'path';
import fs from 'fs';
import { initDb } from './db/database';
import { PurchaseOrderRepository } from './repositories/purchase-order.repository';
import { LineItemRepository } from './repositories/line-item.repository';
import { AuditRepository } from './repositories/audit.repository';
import { NotificationRepository } from './repositories/notification.repository';
import { FulfilmentRepository } from './repositories/fulfilment.repository';
import { NotificationService } from './services/notification.service';
import { PurchaseOrderService } from './services/purchase-order.service';
import { createApp } from './api/app';

const DB_PATH = process.env['DB_PATH'] ?? path.join(__dirname, '../data/octocat.db');
const MIGRATIONS_DIR = path.join(__dirname, '../db/migrations');
const PORT = parseInt(process.env['PORT'] ?? '3001');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = initDb(DB_PATH, MIGRATIONS_DIR);

const poRepo = new PurchaseOrderRepository(db);
const liRepo = new LineItemRepository(db);
const auditRepo = new AuditRepository(db);
const notifRepo = new NotificationRepository(db);
const fulfilRepo = new FulfilmentRepository(db);
const notifService = new NotificationService(notifRepo);
const poService = new PurchaseOrderService(poRepo, liRepo, auditRepo, notifService, fulfilRepo);

const app = createApp(poService);

app.listen(PORT, () => {
  console.log(`[Server] OctoCAT Supply Chain API running on port ${PORT}`);
  console.log(`[Server] API docs: http://localhost:${PORT}/api-docs`);
});
