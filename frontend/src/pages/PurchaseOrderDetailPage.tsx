import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, type PurchaseOrderDetail, type AuditEntry, type FulfilmentRecord } from '../services/api';

interface ShipmentForm {
  lineItemId: number;
  qty: string;
  ref: string;
}

export function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user, hasRole } = useAuth();
  const [po, setPo] = useState<PurchaseOrderDetail | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [history, setHistory] = useState<FulfilmentRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [shipmentForm, setShipmentForm] = useState<ShipmentForm | null>(null);

  const poId = parseInt(id ?? '0');

  const refresh = async () => {
    if (!token || !poId) return;
    const [p, a, h] = await Promise.all([
      api.getPO(token, poId),
      api.getAuditTrail(token, poId),
      api.getFulfilmentHistory(token, poId),
    ]);
    setPo(p);
    setAudit(a.entries);
    setHistory(h.records);
  };

  useEffect(() => {
    setLoading(true);
    refresh().catch((err: Error) => setError(err.message)).finally(() => setLoading(false));
  }, [token, poId]);

  const doAction = async (action: () => Promise<PurchaseOrderDetail>) => {
    try {
      await action();
      await refresh();
      setReason('');
      setShipmentForm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  };

  if (loading) return <p>Loading…</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  if (!po) return null;

  const isCreator = po.createdByUserId === user?.userId;
  const canApprove = hasRole('approver') && !isCreator && po.status === 'submitted';
  const canRecordShipment = hasRole('supplier') && (po.status === 'approved' || po.status === 'partially-fulfilled');
  const canBuyerCancel = hasRole('buyer') && isCreator && ['draft', 'submitted'].includes(po.status);
  const canApproverCancel = hasRole('approver') && ['draft', 'submitted', 'approved', 'partially-fulfilled'].includes(po.status);

  const getFulfilledQty = (lineItemId: number) =>
    history.filter((r) => r.lineItemId === lineItemId).reduce((s, r) => s + r.quantityFulfilled, 0);

  return (
    <div style={{ padding: '1rem', maxWidth: 860 }}>
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
          <thead>
            <tr>
              <th>Product</th><th>Ordered</th><th>Fulfilled</th><th>Outstanding</th>
              <th>Unit Price</th><th>Line Total</th>
              {canRecordShipment && <th>Shipment</th>}
            </tr>
          </thead>
          <tbody>
            {po.lineItems.map((li) => {
              const fulfilled = getFulfilledQty(li.id);
              const outstanding = li.quantity - fulfilled;
              return (
                <tr key={li.id}>
                  <td>{li.productName ?? li.productId}</td>
                  <td>{li.quantity}</td>
                  <td>{fulfilled}</td>
                  <td style={{ color: outstanding > 0 ? '#e08000' : '#007700' }}>{outstanding}</td>
                  <td>${li.unitPrice.toFixed(2)}</td>
                  <td>${li.lineTotal.toFixed(2)}</td>
                  {canRecordShipment && (
                    <td>
                      {outstanding > 0 ? (
                        <button onClick={() => setShipmentForm({ lineItemId: li.id, qty: '1', ref: '' })}>
                          Record Shipment
                        </button>
                      ) : (
                        <span style={{ color: '#007700' }}>Complete</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Shipment recording form */}
      {canRecordShipment && shipmentForm && (
        <section style={{ background: '#f0f8ff', padding: '1rem', marginTop: '1rem', borderRadius: 4 }}>
          <h3>Record Shipment — Line Item #{shipmentForm.lineItemId}</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label>Qty:
              <input
                type="number"
                min={1}
                value={shipmentForm.qty}
                onChange={(e) => setShipmentForm({ ...shipmentForm, qty: e.target.value })}
                style={{ width: 70, marginLeft: 4 }}
              />
            </label>
            <label>Reference (optional):
              <input
                type="text"
                value={shipmentForm.ref}
                onChange={(e) => setShipmentForm({ ...shipmentForm, ref: e.target.value })}
                placeholder="Tracking / delivery note"
                style={{ marginLeft: 4 }}
              />
            </label>
            <button
              onClick={() => doAction(() =>
                api.recordShipment(token!, poId, shipmentForm.lineItemId, {
                  quantityFulfilled: parseInt(shipmentForm.qty),
                  shipmentReference: shipmentForm.ref || undefined,
                })
              )}
              disabled={!shipmentForm.qty || parseInt(shipmentForm.qty) < 1}
            >
              Confirm Shipment
            </button>
            <button onClick={() => setShipmentForm(null)}>Cancel</button>
          </div>
        </section>
      )}

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

      {/* Fulfilment history */}
      <section style={{ marginTop: '2rem' }}>
        <h2>Fulfilment History</h2>
        {history.length === 0 ? (
          <p style={{ color: '#888' }}>No shipments recorded yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr><th>Line Item</th><th>Qty Shipped</th><th>Cumulative</th><th>Reference</th><th>By</th><th>When</th></tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id}>
                  <td>#{r.lineItemId}</td>
                  <td>{r.quantityFulfilled}</td>
                  <td>{r.cumulativeQty}</td>
                  <td>{r.shipmentReference ?? '—'}</td>
                  <td>{r.actorUserName ?? r.actorUserId}</td>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

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
