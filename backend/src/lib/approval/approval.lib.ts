import { AuthError } from '../../api/middleware/error';

export function requiresApproval(total: number): boolean {
  return total >= 10000;
}

export function canApprove(actorId: number, creatorId: number, roles: string[]): boolean {
  if (!roles.includes('approver')) return false;
  if (actorId === creatorId) return false;
  return true;
}

export function assertCanApprove(actorId: number, creatorId: number, roles: string[]): void {
  if (!roles.includes('approver')) {
    throw new AuthError('Approver role required to approve or reject a PO');
  }
  if (actorId === creatorId) {
    throw new AuthError('Cannot approve or reject your own PO');
  }
}
