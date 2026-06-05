import {
  PurchaseOrderRepository,
  type PurchaseOrder,
  type POStatus,
} from '../repositories/purchase-order.repository';
import { LineItemRepository, type LineItem, type LineItemInput } from '../repositories/line-item.repository';
import { AuditRepository } from '../repositories/audit.repository';
import { FulfilmentRepository, type FulfilmentRecord } from '../repositories/fulfilment.repository';
import { NotificationService } from './notification.service';
import {
  validateSubmission,
  getSubmissionStatus,
  assertEditable,
  canCancel,
} from '../lib/purchase-orders/po.lib';
import { assertCanApprove } from '../lib/approval/approval.lib';
import { validateShipment, computePOStatus, canRecordShipment } from '../lib/partial-fulfilment/fulfilment.lib';
import { ConflictError, NotFoundError, ValidationError, AuthError } from '../api/middleware/error';

export interface CreatePOInput {
  branchId: number;
  supplierId: number;
  createdByUserId: number;
}

export interface AddLineItemInput {
  productId: number;
  quantity: number;
  unitPrice: number;
}

export class PurchaseOrderService {
  constructor(
    private poRepo: PurchaseOrderRepository,
    private liRepo: LineItemRepository,
    private auditRepo: AuditRepository,
    private notifService: NotificationService,
    private fulfilRepo?: FulfilmentRepository,
  ) {}

  create(input: CreatePOInput): PurchaseOrder {
    const po = this.poRepo.create({
      branch_id: input.branchId,
      supplier_id: input.supplierId,
      created_by_user_id: input.createdByUserId,
    });
    this.auditRepo.append({
      purchase_order_id: po.id,
      actor_user_id: input.createdByUserId,
      from_status: null,
      to_status: 'draft',
    });
    return po;
  }

  getPO(id: number): PurchaseOrder | null {
    return this.poRepo.findById(id);
  }

  getPOWithLineItems(id: number): (PurchaseOrder & { lineItems: LineItem[] }) | null {
    const po = this.poRepo.findById(id);
    if (!po) return null;
    return { ...po, lineItems: this.liRepo.findByPO(id) };
  }

  list(filters: {
    branchId?: number;
    supplierId?: number;
    status?: POStatus;
    limit?: number;
    offset?: number;
    actorUserId: number;
    actorRoles: string[];
    actorBranchId: number | null;
  }): { items: (PurchaseOrder & { lineItems: LineItem[] })[]; total: number } {
    const result = this.poRepo.list({
      branchId: filters.branchId,
      supplierId: filters.supplierId,
      status: filters.status,
      limit: filters.limit,
      offset: filters.offset,
    });
    return {
      items: result.items.map((po) => ({ ...po, lineItems: this.liRepo.findByPO(po.id) })),
      total: result.total,
    };
  }

  addLineItem(poId: number, actorUserId: number, input: AddLineItemInput): LineItem {
    const po = this.poRepo.findById(poId);
    if (!po) throw new NotFoundError(`PO ${poId} not found`);
    assertEditable(po.status);
    return this.liRepo.add(poId, {
      product_id: input.productId,
      quantity: input.quantity,
      unit_price: input.unitPrice,
    });
  }

  updateLineItem(poId: number, lineItemId: number, actorUserId: number, input: AddLineItemInput): LineItem {
    const po = this.poRepo.findById(poId);
    if (!po) throw new NotFoundError(`PO ${poId} not found`);
    assertEditable(po.status);
    const item = this.liRepo.findById(lineItemId);
    if (!item || item.purchase_order_id !== poId) throw new NotFoundError(`Line item ${lineItemId} not found`);
    return this.liRepo.update(lineItemId, poId, {
      product_id: input.productId,
      quantity: input.quantity,
      unit_price: input.unitPrice,
    });
  }

  removeLineItem(poId: number, lineItemId: number, actorUserId: number): void {
    const po = this.poRepo.findById(poId);
    if (!po) throw new NotFoundError(`PO ${poId} not found`);
    assertEditable(po.status);
    const item = this.liRepo.findById(lineItemId);
    if (!item || item.purchase_order_id !== poId) throw new NotFoundError(`Line item ${lineItemId} not found`);
    this.liRepo.remove(lineItemId, poId);
  }

  async submit(poId: number, actorUserId: number): Promise<PurchaseOrder> {
    const po = this.poRepo.findById(poId);
    if (!po) throw new NotFoundError(`PO ${poId} not found`);
    if (po.status !== 'draft') throw new ConflictError(`Cannot submit a PO in status: ${po.status}`);

    const lineItems = this.liRepo.findByPO(poId);
    validateSubmission(lineItems.map((li) => ({ quantity: li.quantity, unit_price: li.unit_price })));

    const now = new Date().toISOString();
    const targetStatus = getSubmissionStatus(po.total_amount);

    if (targetStatus === 'approved') {
      // Auto-approve: transition directly to approved
      const updated = this.poRepo.updateStatus({
        id: poId,
        status: 'approved',
        actorUserId,
        submittedAt: now,
        approvedAt: now,
        approvedByUserId: undefined, // system auto-approved
      });
      this.auditRepo.append({ purchase_order_id: poId, actor_user_id: actorUserId, from_status: 'draft', to_status: 'approved' });
      // Combined submitted+approved notification
      await this.notifService.dispatch(poId, 'supplier', po.supplier_id, 'approved-confirmed');
      return updated;
    } else {
      // High-value: move to submitted, send pending notification
      const updated = this.poRepo.updateStatus({
        id: poId,
        status: 'submitted',
        actorUserId,
        submittedAt: now,
      });
      this.auditRepo.append({ purchase_order_id: poId, actor_user_id: actorUserId, from_status: 'draft', to_status: 'submitted' });
      await this.notifService.dispatch(poId, 'supplier', po.supplier_id, 'submitted-pending');
      return updated;
    }
  }

  async approve(poId: number, actorUserId: number, actorRoles: string[]): Promise<PurchaseOrder> {
    const po = this.poRepo.findById(poId);
    if (!po) throw new NotFoundError(`PO ${poId} not found`);
    if (po.status !== 'submitted') throw new ConflictError(`Cannot approve a PO in status: ${po.status}`);
    assertCanApprove(actorUserId, po.created_by_user_id, actorRoles);

    const now = new Date().toISOString();
    const updated = this.poRepo.updateStatus({
      id: poId,
      status: 'approved',
      actorUserId,
      approvedAt: now,
      approvedByUserId: actorUserId,
    });
    this.auditRepo.append({ purchase_order_id: poId, actor_user_id: actorUserId, from_status: 'submitted', to_status: 'approved' });
    await this.notifService.dispatch(poId, 'supplier', po.supplier_id, 'approved-confirmed');
    return updated;
  }

  async reject(poId: number, actorUserId: number, actorRoles: string[], reason: string): Promise<PurchaseOrder> {
    const po = this.poRepo.findById(poId);
    if (!po) throw new NotFoundError(`PO ${poId} not found`);
    if (po.status !== 'submitted') throw new ConflictError(`Cannot reject a PO in status: ${po.status}`);
    assertCanApprove(actorUserId, po.created_by_user_id, actorRoles);

    const updated = this.poRepo.updateStatus({
      id: poId,
      status: 'draft',
      actorUserId,
      rejectionReason: reason,
    });
    this.auditRepo.append({ purchase_order_id: poId, actor_user_id: actorUserId, from_status: 'submitted', to_status: 'draft', reason });
    await this.notifService.dispatch(poId, 'buyer', po.created_by_user_id, 'rejected');
    return updated;
  }

  async cancel(poId: number, actorUserId: number, actorRoles: string[], reason: string): Promise<PurchaseOrder> {
    const po = this.poRepo.findById(poId);
    if (!po) throw new NotFoundError(`PO ${poId} not found`);

    const isApprover = actorRoles.includes('approver');
    const isBuyer = actorRoles.includes('buyer');
    const effectiveRole = isApprover ? 'approver' : 'buyer';

    if (!canCancel(po.status, effectiveRole)) {
      throw new ConflictError(`Cannot cancel a PO in status: ${po.status} with role: ${effectiveRole}`);
    }
    if (isBuyer && !isApprover && po.created_by_user_id !== actorUserId) {
      throw new AuthError('Buyers can only cancel their own POs');
    }
    if (!reason?.trim()) throw new ValidationError('Cancellation reason is required');

    const now = new Date().toISOString();
    const updated = this.poRepo.updateStatus({
      id: poId,
      status: 'cancelled',
      actorUserId,
      cancelledAt: now,
      cancellationReason: reason,
    });
    this.auditRepo.append({ purchase_order_id: poId, actor_user_id: actorUserId, from_status: po.status, to_status: 'cancelled', reason });
    await this.notifService.dispatch(poId, 'supplier', po.supplier_id, 'cancelled');
    return updated;
  }

  async recordShipment(
    poId: number,
    lineItemId: number,
    actorUserId: number,
    actorRoles: string[],
    input: { quantityFulfilled: number; shipmentReference?: string },
  ): Promise<PurchaseOrder> {
    if (!this.fulfilRepo) throw new Error('FulfilmentRepository not injected');
    if (!actorRoles.includes('supplier')) throw new AuthError('Supplier role required to record a shipment');

    const po = this.poRepo.findById(poId);
    if (!po) throw new NotFoundError(`PO ${poId} not found`);
    if (!canRecordShipment(po.status)) {
      throw new ConflictError(`Cannot record a shipment on a PO in status: ${po.status}`);
    }

    const lineItem = this.liRepo.findById(lineItemId);
    if (!lineItem || lineItem.purchase_order_id !== poId) {
      throw new NotFoundError(`Line item ${lineItemId} not found on PO ${poId}`);
    }

    const currentCumulative = this.fulfilRepo.getCumulativeForLineItem(lineItemId);
    validateShipment(currentCumulative, input.quantityFulfilled, lineItem.quantity);

    const newCumulative = currentCumulative + input.quantityFulfilled;
    this.fulfilRepo.record({
      purchase_order_id: poId,
      line_item_id: lineItemId,
      quantity_fulfilled: input.quantityFulfilled,
      cumulative_qty: newCumulative,
      shipment_reference: input.shipmentReference,
      actor_user_id: actorUserId,
    });

    // Recompute PO status across all line items
    const allLineItems = this.liRepo.findByPO(poId);
    const itemsWithProgress = allLineItems.map((li) => ({
      quantity: li.quantity,
      fulfilledQty: this.fulfilRepo!.getCumulativeForLineItem(li.id),
    }));
    const newStatus = computePOStatus(itemsWithProgress);
    const fromStatus = po.status;

    const now = new Date().toISOString();
    const updated = this.poRepo.updateStatus({
      id: poId,
      status: newStatus,
      actorUserId,
      fulfilledAt: newStatus === 'fulfilled' ? now : undefined,
    });

    this.auditRepo.append({
      purchase_order_id: poId,
      actor_user_id: actorUserId,
      from_status: fromStatus,
      to_status: newStatus,
    });

    return updated;
  }

  getFulfilmentHistory(poId: number): FulfilmentRecord[] {
    if (!this.fulfilRepo) throw new Error('FulfilmentRepository not injected');
    const po = this.poRepo.findById(poId);
    if (!po) throw new NotFoundError(`PO ${poId} not found`);
    return this.fulfilRepo.findByPO(poId);
  }

  getAuditTrail(poId: number) {
    const po = this.poRepo.findById(poId);
    if (!po) throw new NotFoundError(`PO ${poId} not found`);
    return this.auditRepo.findByPO(poId);
  }
}
