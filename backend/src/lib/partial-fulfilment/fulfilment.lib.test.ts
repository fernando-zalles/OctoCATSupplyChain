import { describe, it, expect } from 'vitest';
import { validateShipment, computePOStatus } from './fulfilment.lib';

describe('validateShipment', () => {
  it('throws when incoming quantity is 0', () => {
    expect(() => validateShipment(0, 0, 10)).toThrow();
  });

  it('throws when incoming quantity is negative', () => {
    expect(() => validateShipment(0, -1, 10)).toThrow();
  });

  it('throws when cumulative would exceed ordered quantity', () => {
    expect(() => validateShipment(8, 3, 10)).toThrow('over-delivery');
  });

  it('throws when cumulative exactly equals but incoming pushes past ordered', () => {
    expect(() => validateShipment(10, 1, 10)).toThrow('over-delivery');
  });

  it('does not throw when cumulative exactly equals ordered quantity', () => {
    expect(() => validateShipment(7, 3, 10)).not.toThrow();
  });

  it('does not throw for first partial shipment', () => {
    expect(() => validateShipment(0, 5, 10)).not.toThrow();
  });
});

describe('computePOStatus', () => {
  it('returns partially-fulfilled when any item has outstanding quantity', () => {
    const items = [
      { quantity: 10, fulfilledQty: 5 },
      { quantity: 10, fulfilledQty: 0 },
    ];
    expect(computePOStatus(items)).toBe('partially-fulfilled');
  });

  it('returns partially-fulfilled when only some items are complete', () => {
    const items = [
      { quantity: 10, fulfilledQty: 10 },
      { quantity: 5, fulfilledQty: 3 },
    ];
    expect(computePOStatus(items)).toBe('partially-fulfilled');
  });

  it('returns fulfilled when all items are complete', () => {
    const items = [
      { quantity: 10, fulfilledQty: 10 },
      { quantity: 5, fulfilledQty: 5 },
    ];
    expect(computePOStatus(items)).toBe('fulfilled');
  });

  it('returns fulfilled for a single fully-complete item', () => {
    const items = [{ quantity: 3, fulfilledQty: 3 }];
    expect(computePOStatus(items)).toBe('fulfilled');
  });
});
