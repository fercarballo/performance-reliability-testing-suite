import { pool, withTransaction } from './pool';
import { generateDataset, PLANS } from './synthetic';
import { hashPassword } from '../security/password';
import { logger } from '../observability/logger';

/**
 * Idempotent seed: only runs when the database is empty. This lets the API
 * bootstrap itself on `docker compose up` while staying safe to restart.
 */
export async function seedIfEmpty(count: number): Promise<void> {
  const existing = await pool.query<{ c: number }>(
    'SELECT COUNT(*)::int AS c FROM customers',
  );
  const current = existing.rows[0]?.c ?? 0;
  if (current > 0) {
    logger.info({ customers: current }, 'seed skipped (data already present)');
    return;
  }

  const dataset = generateDataset(count);

  await withTransaction(async (client) => {
    for (const plan of PLANS) {
      await client.query(
        `INSERT INTO plans (id, name, type, speed_mbps, monthly_price)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [plan.id, plan.name, plan.type, plan.speed_mbps, plan.monthly_price],
      );
    }

    for (const customer of dataset) {
      await client.query(
        `INSERT INTO customers (id, name, segment, current_plan_id)
         VALUES ($1, $2, $3, $4)`,
        [customer.customerId, customer.name, customer.segment, customer.planId],
      );
      await client.query(
        `INSERT INTO users (id, username, password_hash, customer_id)
         VALUES ($1, $2, $3, $4)`,
        [
          customer.userId,
          customer.username,
          hashPassword(customer.password),
          customer.customerId,
        ],
      );
      for (const invoice of customer.invoices) {
        await client.query(
          `INSERT INTO invoices (id, customer_id, amount, status, due_date)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            invoice.id,
            invoice.customerId,
            invoice.amount,
            invoice.status,
            invoice.dueDate,
          ],
        );
      }
    }
  });

  logger.info(
    { customers: dataset.length, plans: PLANS.length },
    'seed complete',
  );
}
