#!/usr/bin/env node
/**
 * Generates the k6 CSV data files from the SAME deterministic generator the API
 * uses to seed the database. Run after building the API:
 *
 *   npm run build && node scripts/generate-k6-data.js [count]
 *
 * Keeping a single source of truth means the load-test data can never drift
 * from what is actually stored.
 */
const fs = require('node:fs');
const path = require('node:path');
const {
  generateDataset,
  PLANS,
} = require('../apps/api/dist/database/synthetic.js');

const count = Number(process.argv[2] ?? 100);
const dataset = generateDataset(count);
const outDir = path.join(__dirname, '..', 'tests', 'k6', 'data');
fs.mkdirSync(outDir, { recursive: true });

const write = (file, header, rows) => {
  fs.writeFileSync(
    path.join(outDir, file),
    [header, ...rows].join('\n') + '\n',
  );
  console.log(`wrote ${file} (${rows.length} rows)`);
};

write(
  'users.csv',
  'username,password,customerId',
  dataset.map((c) => `${c.username},${c.password},${c.customerId}`),
);

write(
  'customers.csv',
  'customerId,name,segment,planId',
  dataset.map((c) => `${c.customerId},${c.name},${c.segment},${c.planId}`),
);

write(
  'invoices.csv',
  'invoiceId,customerId,amount,status,dueDate',
  dataset.flatMap((c) =>
    c.invoices.map(
      (i) => `${i.id},${i.customerId},${i.amount},${i.status},${i.dueDate}`,
    ),
  ),
);

write(
  'plans.csv',
  'planId,name,type,speedMbps,monthlyPrice',
  PLANS.map((p) => `${p.id},${p.name},${p.type},${p.speed_mbps},${p.monthly_price}`),
);
