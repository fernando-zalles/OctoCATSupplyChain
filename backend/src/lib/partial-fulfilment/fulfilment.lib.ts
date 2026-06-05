import { ConflictError, ValidationError } from '../../api/middleware/error';
import type { POStatus } from '../../repositories/purchase-order.repository';

export function validateShipment(
  currentCumulativeQty: number,
  incomingQty: number,
  orderedQty: number,
): void {
  if (incomingQty < 1) {
    throw new ValidationError('Quantity fulfilled must be at least 1');
  }
  if (currentCumulativeQty + incomingQty > orderedQty) {
    throw new ConflictError(
      `Shipment would cause over-delivery: ${currentCumulativeQty + incomingQty} > ${orderedQty}`,
    );
  }
}

export function computePOStatus(
  items: Array<{ quantity: number; fulfilledQty: number }>,
): Extract<POStatus, 'partially-fulfilled' | 'fulfilled'> {
  const allComplete = items.every((item) => item.fulfilledQty >= item.quantity);
  return allComplete ? 'fulfilled' : 'partially-fulfilled';
}

export function canRecordShipment(status: POStatus): boolean {
  return status === 'approved' || status === 'partially-fulfilled';
}
