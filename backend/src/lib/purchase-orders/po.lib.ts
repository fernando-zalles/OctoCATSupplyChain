import { ValidationError, ConflictError } from '../../api/middleware/error';
import type { POStatus } from '../../repositories/purchase-order.repository';

export interface LineItemInput {
  quantity: number;
  unit_price: number;
}

export function validateSubmission(lineItems: LineItemInput[]): void {
  if (lineItems.length === 0) {
    throw new ValidationError('PO must have at least one line item before submission');
  }
  for (const item of lineItems) {
    if (item.quantity < 1) {
      throw new ValidationError('All line items must have quantity >= 1', [
        `Invalid quantity: ${item.quantity}`,
      ]);
    }
    if (item.unit_price <= 0) {
      throw new ValidationError('All line items must have price > 0', [
        `Invalid price: ${item.unit_price}`,
      ]);
    }
  }
}

export function getSubmissionStatus(total: number): 'approved' | 'submitted' {
  return total >= 10000 ? 'submitted' : 'approved';
}

export function isEditable(status: POStatus): boolean {
  return status === 'draft';
}

export function assertEditable(status: POStatus): void {
  if (!isEditable(status)) {
    throw new ConflictError(`PO cannot be edited in status: ${status}`);
  }
}

export function canCancel(status: POStatus, role: string): boolean {
  if (status === 'fulfilled' || status === 'cancelled') return false;
  if (role === 'approver') return ['draft', 'submitted', 'approved'].includes(status);
  if (role === 'buyer') return ['draft', 'submitted'].includes(status);
  return false;
}
