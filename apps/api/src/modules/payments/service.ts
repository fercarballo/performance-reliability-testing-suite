import { query } from '../../database/pool';
import { newId } from '../../utils/id';
import { withSpan } from '../../observability/tracing';
import { sleep } from '../../utils/sleep';
import { applyFault } from '../faults/service';
import { businessPaymentIdempotencyConflicts } from '../../observability/metrics';
import { HttpError, forbidden, notFound } from '../../errors';

export interface PaymentInput {
  customerId: string;
  invoiceId: string;
  amount: number;
  method: string;
  idempotencyKey?: string;
}

export interface PaymentResult {
  paymentId: string;
  status: string;
  invoiceStatus: string;
  idempotent: boolean;
}

/**
 * The most safety-critical flow in the system. Two properties matter:
 *
 *  1. Idempotency: replaying the same `Idempotency-Key` must NEVER charge the
 *     customer twice. We rely on a UNIQUE constraint + `INSERT ... ON CONFLICT
 *     DO NOTHING`, which is correct even under concurrent duplicate requests:
 *     PostgreSQL serialises the conflicting inserts on the unique index.
 *
 *  2. Observability: the simulated gateway call is its own span, so a payment
 *     degradation is visible as a slow/erroring `payment-gateway-simulator`
 *     span in Tempo.
 */
export async function processPayment(
  input: PaymentInput,
): Promise<PaymentResult> {
  const { customerId, invoiceId, amount, method } = input;
  const idempotencyKey = input.idempotencyKey ?? newId('auto');

  // Fast idempotency path: if this key already produced a payment, return it
  // immediately WITHOUT calling the gateway again. This is the correct
  // semantic (a retry must never re-charge) and also keeps replays cheap.
  if (input.idempotencyKey) {
    const prior = await query<{ id: string; status: string }>(
      'SELECT id, status FROM payments WHERE idempotency_key = $1',
      [idempotencyKey],
    );
    if (prior.length > 0) {
      businessPaymentIdempotencyConflicts.inc();
      return {
        paymentId: prior[0]!.id,
        status: prior[0]!.status,
        invoiceStatus: 'paid',
        idempotent: true,
      };
    }
  }

  const invoice = await query<{ customer_id: string; status: string }>(
    'SELECT customer_id, status FROM invoices WHERE id = $1',
    [invoiceId],
  );
  if (invoice.length === 0) throw notFound('invoice not found');
  if (invoice[0]?.customer_id !== customerId) {
    throw forbidden('invoice does not belong to customer');
  }

  const faulted = await withSpan(
    'payment-gateway-simulator',
    async (span) => {
      span.setAttributes({ 'payment.method': method, 'gateway.provider': 'mock' });
      await sleep(20); // baseline gateway latency
      return applyFault('payments');
    },
    { 'payment.invoice_id': invoiceId },
  );

  if (faulted === 'error') {
    throw new HttpError(500, 'payment gateway error', 'injected_fault');
  }

  const inserted = await query<{ id: string; status: string }>(
    `INSERT INTO payments
       (id, customer_id, invoice_id, amount, method, status, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, 'approved', $6)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id, status`,
    [newId('payment'), customerId, invoiceId, amount, method, idempotencyKey],
  );

  if (inserted.length === 0) {
    // The key already produced a payment: return the original, do not re-charge.
    businessPaymentIdempotencyConflicts.inc();
    const existing = await query<{ id: string; status: string }>(
      'SELECT id, status FROM payments WHERE idempotency_key = $1',
      [idempotencyKey],
    );
    return {
      paymentId: existing[0]?.id ?? 'unknown',
      status: existing[0]?.status ?? 'approved',
      invoiceStatus: 'paid',
      idempotent: true,
    };
  }

  await query("UPDATE invoices SET status = 'paid' WHERE id = $1", [invoiceId]);

  return {
    paymentId: inserted[0]!.id,
    status: inserted[0]!.status,
    invoiceStatus: 'paid',
    idempotent: false,
  };
}
