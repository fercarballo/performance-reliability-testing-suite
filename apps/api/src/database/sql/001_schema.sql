-- Telco self-care schema. Text primary keys (customer_001, invoice_004, ...)
-- are intentional: they make logs, traces and k6 data files human-readable,
-- which matters a lot when the whole point is diagnosability.

CREATE TABLE IF NOT EXISTS plans (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  type          text NOT NULL,            -- mobile | fiber
  speed_mbps    integer NOT NULL,
  monthly_price numeric(10, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  segment         text NOT NULL DEFAULT 'consumer',
  current_plan_id text REFERENCES plans (id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id            text PRIMARY KEY,
  username      text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  customer_id   text NOT NULL REFERENCES customers (id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id          text PRIMARY KEY,
  customer_id text NOT NULL REFERENCES customers (id),
  amount      numeric(10, 2) NOT NULL,
  status      text NOT NULL DEFAULT 'pending',   -- pending | overdue | paid
  due_date    date NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices (customer_id);

CREATE TABLE IF NOT EXISTS plan_changes (
  id             text PRIMARY KEY,
  customer_id    text NOT NULL REFERENCES customers (id),
  from_plan_id   text REFERENCES plans (id),
  target_plan_id text NOT NULL REFERENCES plans (id),
  status         text NOT NULL DEFAULT 'scheduled', -- scheduled | applied | rejected
  effective_date date NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plan_changes_customer ON plan_changes (customer_id);

CREATE TABLE IF NOT EXISTS payments (
  id              text PRIMARY KEY,
  customer_id     text NOT NULL REFERENCES customers (id),
  invoice_id      text NOT NULL REFERENCES invoices (id),
  amount          numeric(10, 2) NOT NULL,
  method          text NOT NULL,
  status          text NOT NULL,                  -- approved | declined
  idempotency_key text UNIQUE,                     -- the heart of the idempotency test
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments (invoice_id);
