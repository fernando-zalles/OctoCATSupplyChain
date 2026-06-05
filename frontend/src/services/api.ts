const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api/v1';

// ─── Shared types ─────────────────────────────────────────────────────────────

export type POStatus = 'draft' | 'submitted' | 'approved' | 'fulfilled' | 'cancelled';

export interface LineItem {
  id: number;
  productId: number;
  productName?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PurchaseOrderSummary {
  id: number;
  branchId: number;
  branchName?: string;
  supplierId: number;
  supplierName?: string;
  status: POStatus;
  totalAmount: number;
  createdByUserId: number;
  createdByUserName?: string;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  rejectionReason: string | null;
}

export interface PurchaseOrderDetail extends PurchaseOrderSummary {
  lineItems: LineItem[];
}

export interface POListResponse {
  items: PurchaseOrderSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditEntry {
  id: number;
  purchaseOrderId: number;
  actorUserId: number;
  actorUserName?: string;
  fromStatus: POStatus | null;
  toStatus: POStatus;
  reason: string | null;
  createdAt: string;
}

// ─── Client ───────────────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit & { token?: string },
): Promise<T> {
  const { token, ...rest } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: res.statusText }))) as { error: string };
    throw new Error(body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listPOs: (token: string, params?: { status?: POStatus; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.limit != null) qs.set('limit', String(params.limit));
    if (params?.offset != null) qs.set('offset', String(params.offset));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return request<POListResponse>(`/purchase-orders${query}`, { method: 'GET', token });
  },

  getPO: (token: string, id: number) =>
    request<PurchaseOrderDetail>(`/purchase-orders/${id}`, { method: 'GET', token }),

  createPO: (token: string, supplierId: number) =>
    request<PurchaseOrderDetail>('/purchase-orders', {
      method: 'POST',
      token,
      body: JSON.stringify({ supplierId }),
    }),

  updatePO: (token: string, id: number, supplierId: number) =>
    request<PurchaseOrderDetail>(`/purchase-orders/${id}`, {
      method: 'PUT',
      token,
      body: JSON.stringify({ supplierId }),
    }),

  addLineItem: (token: string, poId: number, item: { productId: number; quantity: number; unitPrice: number }) =>
    request<PurchaseOrderDetail>(`/purchase-orders/${poId}/line-items`, {
      method: 'POST',
      token,
      body: JSON.stringify({ productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice }),
    }),

  updateLineItem: (token: string, poId: number, lineItemId: number, item: { productId: number; quantity: number; unitPrice: number }) =>
    request<PurchaseOrderDetail>(`/purchase-orders/${poId}/line-items/${lineItemId}`, {
      method: 'PUT',
      token,
      body: JSON.stringify({ productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice }),
    }),

  removeLineItem: (token: string, poId: number, lineItemId: number) =>
    request<PurchaseOrderDetail>(`/purchase-orders/${poId}/line-items/${lineItemId}`, {
      method: 'DELETE',
      token,
    }),

  submitPO: (token: string, id: number) =>
    request<PurchaseOrderDetail>(`/purchase-orders/${id}/submit`, { method: 'POST', token }),

  approvePO: (token: string, id: number) =>
    request<PurchaseOrderDetail>(`/purchase-orders/${id}/approve`, { method: 'POST', token }),

  rejectPO: (token: string, id: number, reason: string) =>
    request<PurchaseOrderDetail>(`/purchase-orders/${id}/reject`, {
      method: 'POST',
      token,
      body: JSON.stringify({ reason }),
    }),

  fulfilPO: (token: string, id: number) =>
    request<PurchaseOrderDetail>(`/purchase-orders/${id}/fulfil`, { method: 'POST', token }),

  cancelPO: (token: string, id: number, reason: string) =>
    request<PurchaseOrderDetail>(`/purchase-orders/${id}/cancel`, {
      method: 'POST',
      token,
      body: JSON.stringify({ reason }),
    }),

  getAuditTrail: (token: string, id: number) =>
    request<{ entries: AuditEntry[] }>(`/purchase-orders/${id}/audit`, { method: 'GET', token }),
};
