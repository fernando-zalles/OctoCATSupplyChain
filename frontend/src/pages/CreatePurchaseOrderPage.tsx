import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

interface LineItemFormValue {
  productId: string;
  quantity: string;
  unitPrice: string;
}

interface POFormValues {
  supplierId: string;
  lineItems: LineItemFormValue[];
}

export function CreatePurchaseOrderPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<POFormValues>({
    defaultValues: { supplierId: '', lineItems: [{ productId: '', quantity: '1', unitPrice: '' }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });

  const lineItems = watch('lineItems');
  const total = lineItems.reduce((sum, li) => {
    const qty = parseFloat(li.quantity) || 0;
    const price = parseFloat(li.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  const onSubmit = async (data: POFormValues) => {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const po = await api.createPO(token, parseInt(data.supplierId));
      for (const li of data.lineItems) {
        await api.addLineItem(token, po.id, {
          productId: parseInt(li.productId),
          quantity: parseInt(li.quantity),
          unitPrice: parseFloat(li.unitPrice),
        });
      }
      await api.submitPO(token, po.id);
      void navigate(`/purchase-orders/${po.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create PO');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '1rem', maxWidth: 700 }}>
      <h1>Create Purchase Order</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label>Supplier ID</label>
          <input type="number" {...register('supplierId', { required: true })} />
          {errors.supplierId && <span>Required</span>}
        </div>

        <h3>Line Items</h3>
        {fields.map((field, index) => (
          <div key={field.id} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input type="number" placeholder="Product ID" {...register(`lineItems.${index}.productId`, { required: true })} />
            <input type="number" placeholder="Qty" min={1} {...register(`lineItems.${index}.quantity`, { required: true, min: 1 })} />
            <input type="number" placeholder="Unit Price" step="0.01" {...register(`lineItems.${index}.unitPrice`, { required: true, min: 0.01 })} />
            <button type="button" onClick={() => remove(index)}>Remove</button>
          </div>
        ))}
        <button type="button" onClick={() => append({ productId: '', quantity: '1', unitPrice: '' })}>
          + Add Line Item
        </button>

        <p><strong>Total: ${total.toFixed(2)}</strong>{total >= 10000 && ' — requires approval'}</p>

        <div style={{ marginTop: '1rem' }}>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Create & Submit PO'}
          </button>
          <button type="button" onClick={() => void navigate('/purchase-orders')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
