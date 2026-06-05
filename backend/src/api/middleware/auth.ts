import { Request, Response, NextFunction } from 'express';

export interface AuthUser {
  userId: number;
  roles: string[];
  branchId: number | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const payload = parts[1];
  const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, 'base64url').toString('utf8')) as Record<string, unknown>;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const claims = decodeJwtPayload(token);
    req.user = {
      userId: Number(claims['userId'] ?? claims['sub']),
      roles: Array.isArray(claims['roles']) ? (claims['roles'] as string[]) : [],
      branchId: claims['branchId'] != null ? Number(claims['branchId']) : null,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
