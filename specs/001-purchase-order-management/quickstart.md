# Quickstart: Purchase Order Management

**Branch**: `001-purchase-order-management` | **Date**: 2026-06-04

## Prerequisites

- Node.js 20 LTS
- npm 10+
- Git

## Project Setup

```bash
# Clone and navigate to repo root
git clone <repo-url> && cd OctoCATSupplyChain
git checkout 001-purchase-order-management

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

## Environment Configuration

Create `backend/.env`:

```env
PORT=3001
DB_PATH=./data/octocat.db
JWT_SECRET=dev-secret-not-for-production
NODE_ENV=development
```

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:3001/api/v1
```

## Database Initialisation

```bash
cd backend
npm run db:migrate        # Runs migrations in db/migrations/ in order
```

On success you should see:
```
[DB] Applied migration: 001_initial_schema.sql
[DB] Database ready at ./data/octocat.db
```

## Running the Application

**Backend** (from `backend/`):
```bash
npm run dev               # ts-node-dev with hot reload on port 3001
```

**Frontend** (from `frontend/`):
```bash
npm run dev               # Vite dev server on port 5173
```

Open `http://localhost:5173` in your browser.

## Running Tests

### Backend Tests (Vitest)

```bash
cd backend

# All tests (contract + integration + unit)
npm test

# Contract tests only (run these first when developing)
npm run test:contract

# Integration tests only (real SQLite)
npm run test:integration

# Watch mode
npm run test:watch
```

### Frontend E2E Tests (Playwright)

```bash
cd frontend

# Requires backend running on port 3001
npm run test:e2e

# Headed mode (see the browser)
npm run test:e2e:headed
```

## API Explorer

With the backend running, open Swagger UI:

```
http://localhost:3001/api-docs
```

This renders `backend/openapi.yaml` — the source of truth for all API contracts.

## Key Workflows to Verify

### 1. Create and auto-approve a low-value PO

```bash
# Create PO
curl -s -X POST http://localhost:3001/api/v1/purchase-orders \
  -H "Authorization: Bearer <buyer-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"supplierId": 1}' | jq .

# Add line item
curl -s -X POST http://localhost:3001/api/v1/purchase-orders/1/line-items \
  -H "Authorization: Bearer <buyer-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"productId": 1, "quantity": 5, "unitPrice": 100}' | jq .

# Submit (total $500 → auto-approved)
curl -s -X POST http://localhost:3001/api/v1/purchase-orders/1/submit \
  -H "Authorization: Bearer <buyer-jwt>" | jq .status
# Expected: "approved"
```

### 2. High-value PO approval workflow

```bash
# Submit a PO totalling $15,000 (≥ $10,000 → submitted)
# Then approve as approver:
curl -s -X POST http://localhost:3001/api/v1/purchase-orders/2/approve \
  -H "Authorization: Bearer <approver-jwt>" | jq .status
# Expected: "approved"
```

### 3. Self-approval blocked

```bash
# Attempt to approve your own PO (buyer-approver dual role)
curl -s -X POST http://localhost:3001/api/v1/purchase-orders/3/approve \
  -H "Authorization: Bearer <buyer-approver-jwt>" | jq .
# Expected: 403 Forbidden
```

## Common Issues

| Problem | Solution |
|---------|----------|
| `SQLITE_CANTOPEN` | Run `npm run db:migrate` first; check `DB_PATH` directory exists |
| 401 on all requests | Ensure `Authorization: Bearer <token>` header is present |
| 403 on approve | Verify JWT `roles` claim includes `"approver"` and user is not the PO creator |
| OpenAPI validation errors | Check request body matches schema in `openapi.yaml` |
| Playwright tests fail | Ensure backend is running on port 3001 before running E2E tests |
