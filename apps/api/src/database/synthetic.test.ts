import { describe, expect, it } from 'vitest';
import { DEMO_PASSWORD, generateDataset } from './synthetic';

describe('synthetic dataset', () => {
  it('generates the requested number of customers', () => {
    expect(generateDataset(10)).toHaveLength(10);
  });

  it('is fully deterministic', () => {
    expect(generateDataset(5)).toEqual(generateDataset(5));
  });

  it('uses zero-padded, predictable identifiers', () => {
    const [first] = generateDataset(1);
    expect(first?.customerId).toBe('customer_001');
    expect(first?.userId).toBe('user_001');
    expect(first?.username).toBe('user_001');
    expect(first?.password).toBe(DEMO_PASSWORD);
  });

  it('gives every customer three invoices in mixed states', () => {
    const dataset = generateDataset(20);
    for (const customer of dataset) {
      expect(customer.invoices).toHaveLength(3);
    }
    const statuses = new Set(
      dataset.flatMap((c) => c.invoices.map((i) => i.status)),
    );
    expect(statuses.has('paid')).toBe(true);
    expect(statuses.has('pending')).toBe(true);
    expect(statuses.has('overdue')).toBe(true);
  });
});
