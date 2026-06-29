import { query } from '../../database/pool';
import { newId } from '../../utils/id';
import { withSpan } from '../../observability/tracing';
import { sleep } from '../../utils/sleep';
import { badRequest, notFound } from '../../errors';

export interface PlanView {
  planId: string;
  name: string;
  type: string;
  speedMbps: number;
  monthlyPrice: number;
}

export interface PlanChangeResult {
  changeId: string;
  status: string;
  effectiveDate: string;
}

interface PlanRow {
  id: string;
  name: string;
  type: string;
  speed_mbps: number;
  monthly_price: string;
}

export async function listPlans(): Promise<PlanView[]> {
  const rows = await query<PlanRow>(
    'SELECT id, name, type, speed_mbps, monthly_price FROM plans ORDER BY monthly_price',
  );
  return rows.map((row) => ({
    planId: row.id,
    name: row.name,
    type: row.type,
    speedMbps: row.speed_mbps,
    monthlyPrice: Number(row.monthly_price),
  }));
}

function firstDayOfNextMonth(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toISOString().slice(0, 10);
}

export async function createPlanChange(
  customerId: string,
  targetPlanId: string,
): Promise<PlanChangeResult> {
  // Simulate a dependency on an internal plan catalogue service. This is why a
  // plan change has a looser SLO than a pure read: real business flows fan out
  // to other systems.
  const targetPlan = await withSpan(
    'plan-catalog-lookup',
    async () => {
      await sleep(15);
      const rows = await query<{ id: string }>(
        'SELECT id FROM plans WHERE id = $1',
        [targetPlanId],
      );
      return rows[0];
    },
    { 'catalog.plan_id': targetPlanId },
  );

  if (!targetPlan) throw badRequest('target plan does not exist', 'invalid_plan');

  const current = await query<{ current_plan_id: string | null }>(
    'SELECT current_plan_id FROM customers WHERE id = $1',
    [customerId],
  );
  if (current.length === 0) throw notFound('customer not found');

  const fromPlanId = current[0]?.current_plan_id ?? null;
  if (fromPlanId === targetPlanId) {
    throw badRequest('customer is already on this plan', 'no_op_change');
  }

  const changeId = newId('change');
  const effectiveDate = firstDayOfNextMonth();

  await query(
    `INSERT INTO plan_changes
       (id, customer_id, from_plan_id, target_plan_id, status, effective_date)
     VALUES ($1, $2, $3, $4, 'scheduled', $5)`,
    [changeId, customerId, fromPlanId, targetPlanId, effectiveDate],
  );

  return { changeId, status: 'scheduled', effectiveDate };
}
