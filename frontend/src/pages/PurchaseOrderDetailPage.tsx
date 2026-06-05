import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, type PurchaseOrderDetail, type AuditEntry } from '../services/api';

export function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user, hasRole } = useAuth();
  const [po, setPo] = useState<PurchaseOrderDetail | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const poId = parseInt(id ?? '0');

  useEffect(() => {
    if (!token || !poId) return;
    setLoading(true);
    Promise.all([api.getPO(token, poId), api.getAuditTrail(token, poId)])
      .then(([p, a]) => { setPo(p); setAudit(a.entries); })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token, poId]);

  const doAction = async (action: () => Promise<PurchaseOrderDetail>) => {
    try {
      const updated = await action();
      setPo(updated);
      const a = await api.getAuditTrail(token!, poId);
      setAudit(a.entries);
      setReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  };

  if (loading) return <p>Loading…</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  if (!po) return null;

  const isCreator = po.createdByUserId === user?.userId;
  const canApprove = hasRole('approver') && !isCreator && po.status === 'submitted';
  const canFulfil = hasRole('supplier') && po.status === 'approved';
  const canBuyerCancel = hasRole('buyer') && isCreator && ['draft', 'submitted'].includes(po.status);
  const canApproverCancel = hasRole('approver') && ['draft', 'submitted', 'approved'].includes(po.status);

  return (
    <div style={{ padding: '1rem', maxWidth: 800 }}>
      <Link to="/purchase-orders">← Back</Link>
      <h1>Purchase Order #{po.id}</h1>

      <section>
        <p><strong>Status:</strong> {po.status.toUpperCase()}</p>
        <p><strong>Supplier:</strong> {po.supplierName ?? po.supplierId}</p>
        <p><strong>Branch:</strong> {po.branchName ?? po.branchId}</p>
        <p><strong>Total:</strong> ${po.totalAmount.toFixed(2)}</p>
        {po.rejectionReason && <p><strong>Rejection reason:</strong> {po.rejectionReason}</p>}
        {po.cancellationReason && <p><strong>Cancellation reason:</strong> {po.cancellationReason}</p>}
      </section>

      <section>
        <h2>Line Items</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
          <tbody>
            {po.lineItems.map((li) => (
              <tr key={li.id}>
                <td>{li.productName ?? li.productId}</td>
                <td>{li.quantity}</td>
                <td>${li.unitPrice.toFixed(2)}</td>
                <td>${li.lineTotal.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Approval actions */}
      {canApprove && (
        <section style={{ background: '#fff8e1', padding: '1rem', marginTop: '1rem' }}>
          <h2>Approval</h2>
          <button onClick={() => doAction(() => api.approvePO(token!, poId))}>Approve</button>
          <div style={{ marginTop: '0.5rem' }}>
            <input placeholder="Rejection reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            <button onClick={() => doAction(() => api.rejectPO(token!, poId, reason))} disabled={!reason.trim()}>
              Reject
            </button>
          </div>
        </section>
      )}

      {/* Fulfil action */}
      {canFulfil && (
        <section style={{ marginTop: '1rem' }}>
          <button onClick={() => doAction(() => api.fulfilPO(token!, poId))}>Mark as Fulfilled</button>
        </section>
      )}

      {/* Cancel action */}
      {(canBuyerCancel || canApproverCancel) && (
        <section style={{ marginTop: '1rem' }}>
          <input placeholder="Cancellation reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button
            style={{ color: 'red' }}
            onClick={() => doAction(() => api.cancelPO(token!, poId, reason))}
            disabled={!reason.trim()}
          >
            Cancel PO
          </button>
        </section>
      )}

      {/* Audit trail */}
      <section style={{ marginTop: '2rem' }}>
        <h2>Audit Trail</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th>Actor</th><th>From</th><th>To</th><th>Reason</th><th>When</th></tr></thead>
          <tbody>
            {audit.map((e) => (
              <tr key={e.id}>
                <td>{e.actorUserName ?? e.actorUserId}</td>
                <td>{e.fromStatus ?? '—'}</td>
                <td>{e.toStatus}</td>
                <td>{e.reason ?? '—'}</td>
                <td>{new Date(e.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
