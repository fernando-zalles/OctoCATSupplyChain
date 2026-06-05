import Database from 'better-sqlite3';
import path from 'path';
import { runMigrations, type Db } from '../../src/db/database';

const MIGRATIONS_DIR = path.join(__dirname, '../../db/migrations');

export function createTestDb(): Db {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db, MIGRATIONS_DIR);
  return db;
}

export function cleanDb(db: Db): void {
  db.exec(`
    DELETE FROM notifications;
    DELETE FROM po_audit_entries;
    DELETE FROM po_line_items;
    DELETE FROM purchase_orders;
  `);
}
