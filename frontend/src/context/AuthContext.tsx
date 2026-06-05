import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface AuthUser {
  userId: number;
  roles: string[];
  branchId: number | null;
  name?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  hasRole: (role: string) => boolean;
}

function decodePayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');
  const payload = parts[1];
  const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
  return JSON.parse(atob(padded)) as Record<string, unknown>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  login: () => undefined,
  logout: () => undefined,
  hasRole: () => false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'));
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (!token) { setUser(null); return; }
    try {
      const claims = decodePayload(token);
      setUser({
        userId: Number(claims['userId'] ?? claims['sub']),
        roles: Array.isArray(claims['roles']) ? (claims['roles'] as string[]) : [],
        branchId: claims['branchId'] != null ? Number(claims['branchId']) : null,
        name: typeof claims['name'] === 'string' ? claims['name'] : undefined,
      });
    } catch {
      setUser(null);
    }
  }, [token]);

  const login = (newToken: string) => {
    localStorage.setItem('auth_token', newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
  };

  const hasRole = (role: string) => user?.roles.includes(role) ?? false;

  return (
    <AuthContext.Provider value={{ user, token, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
