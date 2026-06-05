import { describe, it, expect } from 'vitest';
import { validateSubmission, getSubmissionStatus, isEditable, canCancel } from './po.lib';

describe('validateSubmission', () => {
  it('throws when line items array is empty', () => {
    expect(() => validateSubmission([])).toThrow('at least one line item');
  });

  it('throws when any line item has quantity < 1', () => {
    expect(() => validateSubmission([{ quantity: 0, unit_price: 10 }])).toThrow('quantity');
  });

  it('throws when any line item has unit_price <= 0', () => {
    expect(() => validateSubmission([{ quantity: 1, unit_price: 0 }])).toThrow('price');
  });

  it('does not throw for valid line items', () => {
    expect(() => validateSubmission([{ quantity: 2, unit_price: 50.5 }])).not.toThrow();
  });
});

describe('getSubmissionStatus', () => {
  it('returns approved for totals below $10,000', () => {
    expect(getSubmissionStatus(9999.99)).toBe('approved');
  });

  it('returns submitted for totals exactly $10,000', () => {
    expect(getSubmissionStatus(10000)).toBe('submitted');
  });

  it('returns submitted for totals above $10,000', () => {
    expect(getSubmissionStatus(15000)).toBe('submitted');
  });
});

describe('isEditable', () => {
  it('returns true for draft status', () => {
    expect(isEditable('draft')).toBe(true);
  });

  it('returns false for non-draft statuses', () => {
    expect(isEditable('submitted')).toBe(false);
    expect(isEditable('approved')).toBe(false);
    expect(isEditable('fulfilled')).toBe(false);
    expect(isEditable('cancelled')).toBe(false);
  });
});

describe('canCancel', () => {
  it('buyer can cancel draft', () => {
    expect(canCancel('draft', 'buyer')).toBe(true);
  });

  it('buyer can cancel submitted', () => {
    expect(canCancel('submitted', 'buyer')).toBe(true);
  });

  it('buyer cannot cancel approved', () => {
    expect(canCancel('approved', 'buyer')).toBe(false);
  });

  it('approver can cancel draft, submitted, and approved', () => {
    expect(canCancel('draft', 'approver')).toBe(true);
    expect(canCancel('submitted', 'approver')).toBe(true);
    expect(canCancel('approved', 'approver')).toBe(true);
  });

  it('nobody can cancel fulfilled or cancelled', () => {
    expect(canCancel('fulfilled', 'buyer')).toBe(false);
    expect(canCancel('fulfilled', 'approver')).toBe(false);
    expect(canCancel('cancelled', 'buyer')).toBe(false);
  });
});
