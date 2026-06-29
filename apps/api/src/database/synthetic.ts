/**
 * Deterministic synthetic dataset.
 *
 * The same generator feeds both the database seed and the k6 CSV files, so test
 * data and stored data can never drift apart. Everything is derived from the
 * row index, which means the dataset is 100% reproducible and contains zero
 * real personal data.
 */
export const DEMO_PASSWORD = 'password123';

export interface Plan {
  id: string;
  name: string;
  type: 'mobile' | 'fiber';
  speed_mbps: number;
  monthly_price: number;
}

export const PLANS: Plan[] = [
  { id: 'mobile_5gb', name: 'Mobile 5GB', type: 'mobile', speed_mbps: 50, monthly_price: 14999.0 },
  { id: 'mobile_20gb', name: 'Mobile 20GB', type: 'mobile', speed_mbps: 100, monthly_price: 19999.0 },
  { id: 'fiber_300mb', name: 'Fiber 300MB', type: 'fiber', speed_mbps: 300, monthly_price: 22999.0 },
  { id: 'fiber_600mb', name: 'Fiber 600MB', type: 'fiber', speed_mbps: 600, monthly_price: 28999.0 },
  { id: 'fiber_1gb', name: 'Fiber 1GB', type: 'fiber', speed_mbps: 1000, monthly_price: 35999.0 },
];

export interface SyntheticInvoice {
  id: string;
  customerId: string;
  amount: number;
  status: 'pending' | 'overdue' | 'paid';
  dueDate: string;
}

export interface SyntheticCustomer {
  customerId: string;
  userId: string;
  username: string;
  password: string;
  name: string;
  segment: 'consumer' | 'business';
  planId: string;
  invoices: SyntheticInvoice[];
}

const pad = (n: number): string => String(n).padStart(3, '0');
const round2 = (n: number): number => Math.round(n * 100) / 100;

export function generateDataset(count: number): SyntheticCustomer[] {
  const customers: SyntheticCustomer[] = [];

  for (let i = 1; i <= count; i += 1) {
    const idx = pad(i);
    const plan = PLANS[i % PLANS.length] as Plan;
    const baseAmount = 15000 + ((i * 137) % 21000);

    const invoices: SyntheticInvoice[] = [
      {
        id: `invoice_${idx}_1`,
        customerId: `customer_${idx}`,
        amount: round2(baseAmount),
        status: 'paid',
        dueDate: '2026-05-10',
      },
      {
        id: `invoice_${idx}_2`,
        customerId: `customer_${idx}`,
        amount: round2(baseAmount + 999.99),
        status: 'pending',
        dueDate: '2026-07-10',
      },
      {
        id: `invoice_${idx}_3`,
        customerId: `customer_${idx}`,
        amount: round2(baseAmount + 1500.5),
        status: i % 4 === 0 ? 'overdue' : 'pending',
        dueDate: '2026-06-10',
      },
    ];

    customers.push({
      customerId: `customer_${idx}`,
      userId: `user_${idx}`,
      username: `user_${idx}`,
      password: DEMO_PASSWORD,
      name: `Customer ${idx}`,
      segment: i % 5 === 0 ? 'business' : 'consumer',
      planId: plan.id,
      invoices,
    });
  }

  return customers;
}
