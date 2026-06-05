import { Router, Request, Response, NextFunction } from 'express';
import { PurchaseOrderService } from '../../services/purchase-order.service';
import type { POStatus } from '../../repositories/purchase-order.repository';
import type { LineItem, PurchaseOrder } from '../../repositories/purchase-order.repository';

function toApiPO(po: PurchaseOrder & { lineItems?: import('../../repositories/line-item.repository').LineItem[] }) {
  return {
    id: po.id,
    branchId: po.branch_id,
    supplierId: po.supplier_id,
    status: po.status,
    totalAmount: po.total_amount,
    createdByUserId: po.created_by_user_id,
    createdAt: po.created_at,
    submittedAt: po.submitted_at,
    approvedAt: po.approved_at,
    fulfilledAt: po.fulfilled_at,
    cancelledAt: po.cancelled_at,
    cancellationReason: po.cancellation_reason,
    rejectionReason: po.rejection_reason,
    lineItems: (po.lineItems ?? []).map((li) => ({
      id: li.id,
      productId: li.product_id,
      quantity: li.quantity,
      unitPrice: li.unit_price,
      lineTotal: li.line_total,
    })),
  };
}

export function createPurchaseOrdersRouter(poService: PurchaseOrderService): Router {
  const router = Router();

  // List POs
  router.get('/', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, limit, offset } = req.query as Record<string, string>;
      const result = poService.list({
        status: status as POStatus | undefined,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
        actorUserId: req.user!.userId,
        actorRoles: req.user!.roles,
        actorBranchId: req.user!.branchId,
        branchId: req.user!.roles.includes('buyer') && !req.user!.roles.includes('approver')
          ? (req.user!.branchId ?? undefined)
          : undefined,
      });
      res.json({ items: result.items.map(toApiPO), total: result.total, limit: limit ? parseInt(limit) : 50, offset: offset ? parseInt(offset) : 0 });
    } catch (err) { next(err); }
  });

  // Create PO
  router.post('/', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { supplierId } = req.body as { supplierId: number };
      const po = poService.create({
        branchId: req.user!.branchId ?? 0,
        supplierId,
        createdByUserId: req.user!.userId,
      });
      const full = poService.getPOWithLineItems(po.id)!;
      res.status(201).json(toApiPO(full));
    } catch (err) { next(err); }
  });

  // Get PO
  router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const po = poService.getPOWithLineItems(parseInt(req.params['id']));
      if (!po) { res.status(404).json({ error: 'PO not found' }); return; }
      res.json(toApiPO(po));
    } catch (err) { next(err); }
  });

  // Update PO (supplier change on draft)
  router.put('/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const poId = parseInt(req.params['id']);
      const po = poService.getPOWithLineItems(poId);
      if (!po) { res.status(404).json({ error: 'PO not found' }); return; }
      res.json(toApiPO(po));
    } catch (err) { next(err); }
  });

  // Add line item
  router.post('/:id/line-items', (req: Request, res: Response, next: NextFunction) => {
    try {
      const poId = parseInt(req.params['id']);
      const { productId, quantity, unitPrice } = req.body as { productId: number; quantity: number; unitPrice: number };
      poService.addLineItem(poId, req.user!.userId, { productId, quantity, unitPrice });
      const po = poService.getPOWithLineItems(poId)!;
      res.status(201).json(toApiPO(po));
    } catch (err) { next(err); }
  });

  // Update line item
  router.put('/:id/line-items/:lineItemId', (req: Request, res: Response, next: NextFunction) => {
    try {
      const poId = parseInt(req.params['id']);
      const lineItemId = parseInt(req.params['lineItemId']);
      const { productId, quantity, unitPrice } = req.body as { productId: number; quantity: number; unitPrice: number };
      poService.updateLineItem(poId, lineItemId, req.user!.userId, { productId, quantity, unitPrice });
      const po = poService.getPOWithLineItems(poId)!;
      res.json(toApiPO(po));
    } catch (err) { next(err); }
  });

  // Delete line item
  router.delete('/:id/line-items/:lineItemId', (req: Request, res: Response, next: NextFunction) => {
    try {
      const poId = parseInt(req.params['id']);
      const lineItemId = parseInt(req.params['lineItemId']);
      poService.removeLineItem(poId, lineItemId, req.user!.userId);
      const po = poService.getPOWithLineItems(poId)!;
      res.json(toApiPO(po));
    } catch (err) { next(err); }
  });

  // Submit
  router.post('/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const po = await poService.submit(parseInt(req.params['id']), req.user!.userId);
      const full = poService.getPOWithLineItems(po.id)!;
      res.json(toApiPO(full));
    } catch (err) { next(err); }
  });

  // Approve
  router.post('/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const po = await poService.approve(parseInt(req.params['id']), req.user!.userId, req.user!.roles);
      const full = poService.getPOWithLineItems(po.id)!;
      res.json(toApiPO(full));
    } catch (err) { next(err); }
  });

  // Reject
  router.post('/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason } = req.body as { reason: string };
      const po = await poService.reject(parseInt(req.params['id']), req.user!.userId, req.user!.roles, reason);
      const full = poService.getPOWithLineItems(po.id)!;
      res.json(toApiPO(full));
    } catch (err) { next(err); }
  });

  // Fulfil
  router.post('/:id/fulfil', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const po = await poService.fulfil(parseInt(req.params['id']), req.user!.userId, req.user!.roles);
      const full = poService.getPOWithLineItems(po.id)!;
      res.json(toApiPO(full));
    } catch (err) { next(err); }
  });

  // Cancel
  router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason } = req.body as { reason: string };
      const po = await poService.cancel(parseInt(req.params['id']), req.user!.userId, req.user!.roles, reason);
      const full = poService.getPOWithLineItems(po.id)!;
      res.json(toApiPO(full));
    } catch (err) { next(err); }
  });

  // Audit trail
  router.get('/:id/audit', (req: Request, res: Response, next: NextFunction) => {
    try {
      const entries = poService.getAuditTrail(parseInt(req.params['id']));
      res.json({
        entries: entries.map((e) => ({
          id: e.id,
          purchaseOrderId: e.purchase_order_id,
          actorUserId: e.actor_user_id,
          fromStatus: e.from_status,
          toStatus: e.to_status,
          reason: e.reason,
          createdAt: e.created_at,
        })),
      });
    } catch (err) { next(err); }
  });

  return router;
}
