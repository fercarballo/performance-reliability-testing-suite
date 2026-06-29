import { query } from '../../database/pool';
import { redis } from '../../redis/client';

export interface InvoiceView {
  invoiceId: string;
  amount: number;
  status: string;
  dueDate: string;
}

interface InvoiceRow {
  id: string;
  amount: string;
  status: string;
  due_date: string;
}

const CACHE_TTL_SECONDS = 30;

/**
 * Read-through cache. A cache hit avoids the database entirely; a miss pays the
 * query cost and warms the cache. This is what makes invoice lookups a good
 * load-test subject: behaviour changes depending on cache state and Redis
 * health, which a single static endpoint would never reveal.
 */
export async function getInvoices(customerId: string): Promise<InvoiceView[]> {
  const cacheKey = `invoices:${customerId}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as InvoiceView[];
  } catch {
    // Cache miss-by-failure: fall through to the database. The API must keep
    // serving even if Redis is degraded.
  }

  const rows = await query<InvoiceRow>(
    `SELECT id, amount, status, to_char(due_date, 'YYYY-MM-DD') AS due_date
       FROM invoices
      WHERE customer_id = $1
      ORDER BY due_date`,
    [customerId],
  );

  const invoices: InvoiceView[] = rows.map((row) => ({
    invoiceId: row.id,
    amount: Number(row.amount),
    status: row.status,
    dueDate: row.due_date,
  }));

  try {
    await redis.set(
      cacheKey,
      JSON.stringify(invoices),
      'EX',
      CACHE_TTL_SECONDS,
    );
  } catch {
    // Non-fatal: serving without caching is acceptable.
  }

  return invoices;
}

export async function invalidateInvoices(customerId: string): Promise<void> {
  try {
    await redis.del(`invoices:${customerId}`);
  } catch {
    // best-effort
  }
}
