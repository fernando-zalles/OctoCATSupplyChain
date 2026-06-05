import { describe, it, expect } from 'vitest';
import { requiresApproval, canApprove } from './approval.lib';

describe('requiresApproval', () => {
  it('returns false for totals below $10,000', () => {
    expect(requiresApproval(9999.99)).toBe(false);
  });

  it('returns true for totals exactly $10,000', () => {
    expect(requiresApproval(10000)).toBe(true);
  });

  it('returns true for totals above $10,000', () => {
    expect(requiresApproval(25000)).toBe(true);
  });
});

describe('canApprove', () => {
  it('returns false when actor does not have approver role', () => {
    expect(canApprove(1, 2, ['buyer'])).toBe(false);
  });

  it('returns false when actor is the PO creator (self-approval)', () => {
    expect(canApprove(1, 1, ['approver'])).toBe(false);
  });

  it('returns true when actor has approver role and is not the creator', () => {
    expect(canApprove(2, 1, ['approver'])).toBe(true);
  });

  it('returns true when actor has both buyer and approver roles and is not the creator', () => {
    expect(canApprove(2, 1, ['buyer', 'approver'])).toBe(true);
  });

  it('returns false when dual-role user tries to approve their own PO', () => {
    expect(canApprove(1, 1, ['buyer', 'approver'])).toBe(false);
  });
});
