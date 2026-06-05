import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, type PurchaseOrderSummary, type POStatus } from '../services/api';

const STATUS_COLOURS: Record<POStatus, string> = {
  draft: '#888',
  submitted: '#e08000',
  approved: '#007700',
  'partially-fulfilled': '#e06000',
  fulfilled: '#004499',
  cancelled: '#cc0000',
};

export function PurchaseOrderListPage() {
  const { token, hasRole } = useAuth();
  const [items, setItems] = useState<PurchaseOrderSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<POStatus | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api.listPOs(token, status ? { status } : undefined)
      .then((res) => { setItems(res.items); setTotal(res.total); })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token, status]);

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Purchase Orders</h1>
        {hasRole('buyer') && <Link to="/purchase-orders/new">+ New PO</Link>}
      </div>

      {hasRole('approver') && (
        <div style={{ background: '#fff8e1', padding: '0.5rem', marginBottom: '1rem', borderRadius: 4 }}>
          <strong>Approval queue</strong> — filter by Submitted to see pending approvals.
        </div>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <label>Filter by status: </label>
        <select value={status} onChange={(e) => setStatus(e.target.value as POStatus | '')}>
          <option value="">All</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="partially-fulfilled">Partially Fulfilled</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {loading && <p>Loading…</p>}

      {!loading && (
        <>
          <p>{total} purchase order(s)</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>ID</th><th>Supplier</th><th>Total</th><th>Status</th><th>Created</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((po) => (
                <tr key={po.id}>
                  <td>{po.id}</td>
                  <td>{po.supplierName ?? po.supplierId}</td>
                  <td>${po.totalAmount.toFixed(2)}</td>
                  <td>
                    <span style={{ color: STATUS_COLOURS[po.status], fontWeight: 'bold' }}>
                      {po.status.toUpperCase()}
                    </span>
                  </td>
                  <td>{new Date(po.createdAt).toLocaleDateString()}</td>
                  <td><Link to={`/purchase-orders/${po.id}`}>View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
