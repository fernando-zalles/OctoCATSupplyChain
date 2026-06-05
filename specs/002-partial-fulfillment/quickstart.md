# Quickstart: Partial Fulfilment

**Branch**: `002-partial-fulfillment` | **Date**: 2026-06-04

## What Changed

This feature extends the existing backend and frontend from feature 001. Before
running, ensure migration 002 has been applied to your database.

## Apply the Migration

```bash
# Stop the dev server if running, then:
cd backend

# Delete the old dev DB so migration 002 runs fresh
rm data/octocat.db          # Linux/Mac
# or on Windows PowerShell:
Remove-Item data\octocat.db

# Restart — migrations run automatically on startup
npm run dev
```

You should see:
```
[DB] Applied migration: 001_initial_schema.sql
[DB] Applied migration: 002_partial_fulfilment.sql
[Server] OctoCAT Supply Chain API running on port 3001
```

## Key Workflow Changes

### Old flow (removed):
```
POST /api/v1/purchase-orders/:id/fulfil   ← GONE
```

### New flow:
```
# Record a partial shipment against line item 3 on PO 1
POST /api/v1/purchase-orders/1/line-items/3/shipments
  { "quantityFulfilled": 4, "shipmentReference": "TRACK-001" }

# View fulfilment history
GET /api/v1/purchase-orders/1/fulfilment-history
```

## Testing the Partial Fulfilment Flow

### 1. Create and submit an Approved PO

```bash
# Buyer token (userId=1, branchId=1, roles=['buyer'])
BUYER="eyJhbGciOiJub25lIn0.eyJ1c2VySWQiOjEsInJvbGVzIjpbImJ1eWVyIl0sImJyYW5jaElkIjoxfQ."

# Create PO
curl -s -X POST http://localhost:3001/api/v1/purchase-orders \
  -H "Authorization: Bearer $BUYER" \
  -H "Content-Type: application/json" \
  -d '{"supplierId": 1}' | jq '{id, status}'

# Add two line items (5 units each)
curl -s -X POST http://localhost:3001/api/v1/purchase-orders/1/line-items \
  -H "Authorization: Bearer $BUYER" \
  -H "Content-Type: application/json" \
  -d '{"productId": 1, "quantity": 5, "unitPrice": 100}' | jq .totalAmount

curl -s -X POST http://localhost:3001/api/v1/purchase-orders/1/line-items \
  -H "Authorization: Bearer $BUYER" \
  -H "Content-Type: application/json" \
  -d '{"productId": 2, "quantity": 5, "unitPrice": 200}' | jq .totalAmount

# Submit (total $1,500 → auto-approved)
curl -s -X POST http://localhost:3001/api/v1/purchase-orders/1/submit \
  -H "Authorization: Bearer $BUYER" | jq .status
# Expected: "approved"
```

### 2. Record a partial shipment as supplier

```bash
SUPPLIER="eyJhbGciOiJub25lIn0.eyJ1c2VySWQiOjMsInJvbGVzIjpbInN1cHBsaWVyIl0sImJyYW5jaElkIjpudWxsfQ."

# Ship 3 of 5 units on line item 1
curl -s -X POST http://localhost:3001/api/v1/purchase-orders/1/line-items/1/shipments \
  -H "Authorization: Bearer $SUPPLIER" \
  -H "Content-Type: application/json" \
  -d '{"quantityFulfilled": 3, "shipmentReference": "TRACK-001"}' | jq .status
# Expected: "partially-fulfilled"
```

### 3. Complete all quantities → Fulfilled

```bash
# Remaining 2 units on line item 1
curl -s -X POST http://localhost:3001/api/v1/purchase-orders/1/line-items/1/shipments \
  -H "Authorization: Bearer $SUPPLIER" \
  -H "Content-Type: application/json" \
  -d '{"quantityFulfilled": 2, "shipmentReference": "TRACK-002"}' | jq .status
# Expected: "partially-fulfilled" (line item 2 still outstanding)

# All 5 units on line item 2
curl -s -X POST http://localhost:3001/api/v1/purchase-orders/1/line-items/2/shipments \
  -H "Authorization: Bearer $SUPPLIER" \
  -H "Content-Type: application/json" \
  -d '{"quantityFulfilled": 5, "shipmentReference": "TRACK-003"}' | jq .status
# Expected: "fulfilled"
```

### 4. View fulfilment history

```bash
curl -s http://localhost:3001/api/v1/purchase-orders/1/fulfilment-history \
  -H "Authorization: Bearer $BUYER" | jq '.records | length'
# Expected: 3
```

### 5. Verify over-delivery is rejected

```bash
# Attempt to ship 1 more unit on a completed line item
curl -s -X POST http://localhost:3001/api/v1/purchase-orders/1/line-items/1/shipments \
  -H "Authorization: Bearer $SUPPLIER" \
  -H "Content-Type: application/json" \
  -d '{"quantityFulfilled": 1}' | jq .error
# Expected: over-delivery error (409)
```

## Common Issues

| Problem | Solution |
|---------|----------|
| Migration 001 runs but 002 fails | Check `db/migrations/002_partial_fulfilment.sql` exists and has no syntax errors |
| PO stuck in `approved` after shipment | Verify migration 002 applied; `partially-fulfilled` may not be a valid status yet |
| 404 on shipment endpoint | Confirm `openapi.yaml` has the new route; restart backend after editing |
| Over-delivery accepted | Ensure `fulfilment.lib.ts` validation is called before the repository insert |
