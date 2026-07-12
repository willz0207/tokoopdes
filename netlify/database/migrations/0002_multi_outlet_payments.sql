CREATE TABLE IF NOT EXISTS outlets (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS outlets_code_upper_unique ON outlets (UPPER(code));
CREATE UNIQUE INDEX IF NOT EXISTS outlets_single_default ON outlets (is_default) WHERE is_default = TRUE;

INSERT INTO outlets (code, name, address, phone, active, is_default)
SELECT 'PUSAT', 'Outlet Pusat', '', '', TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM outlets);

UPDATE outlets SET is_default = TRUE
WHERE id = (SELECT id FROM outlets ORDER BY id LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM outlets WHERE is_default = TRUE);

ALTER TABLE users ADD COLUMN IF NOT EXISTS outlet_id INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS outlet_id INTEGER;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS outlet_id INTEGER;
ALTER TABLE financial_entries ADD COLUMN IF NOT EXISTS outlet_id INTEGER;

UPDATE users SET outlet_id = (SELECT id FROM outlets WHERE is_default = TRUE LIMIT 1)
WHERE outlet_id IS NULL AND role IN ('cashier', 'manager');
UPDATE orders SET outlet_id = (SELECT id FROM outlets WHERE is_default = TRUE LIMIT 1) WHERE outlet_id IS NULL;
UPDATE inventory_items SET outlet_id = (SELECT id FROM outlets WHERE is_default = TRUE LIMIT 1) WHERE outlet_id IS NULL;
UPDATE financial_entries SET outlet_id = (SELECT id FROM outlets WHERE is_default = TRUE LIMIT 1) WHERE outlet_id IS NULL;

ALTER TABLE orders ALTER COLUMN outlet_id SET NOT NULL;
ALTER TABLE inventory_items ALTER COLUMN outlet_id SET NOT NULL;
ALTER TABLE financial_entries ALTER COLUMN outlet_id SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_outlet_id_fkey') THEN
    ALTER TABLE users ADD CONSTRAINT users_outlet_id_fkey FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_outlet_id_fkey') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_outlet_id_fkey FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_items_outlet_id_fkey') THEN
    ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_outlet_id_fkey FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financial_entries_outlet_id_fkey') THEN
    ALTER TABLE financial_entries ADD CONSTRAINT financial_entries_outlet_id_fkey FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE RESTRICT;
  END IF;
END $$;

DROP INDEX IF EXISTS inventory_items_sku_upper_unique;
CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_outlet_sku_upper_unique ON inventory_items (outlet_id, UPPER(sku));
CREATE INDEX IF NOT EXISTS idx_users_outlet_id ON users(outlet_id);
CREATE INDEX IF NOT EXISTS idx_orders_outlet_created ON orders(outlet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_outlet ON inventory_items(outlet_id, active DESC, name ASC);
CREATE INDEX IF NOT EXISTS idx_financial_entries_outlet_date ON financial_entries(outlet_id, entry_date DESC);

CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('cash', 'midtrans', 'simulator')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('unpaid', 'pending', 'paid', 'failed', 'expired', 'refunded')),
  token TEXT,
  redirect_url TEXT,
  transaction_id TEXT,
  payment_type TEXT,
  gross_amount INTEGER NOT NULL CHECK (gross_amount >= 0),
  raw_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO payments (order_id, provider, status, gross_amount)
SELECT id, CASE WHEN payment_method = 'cash' THEN 'cash' ELSE 'simulator' END,
  CASE WHEN payment_method = 'cash' THEN 'unpaid' ELSE 'paid' END, total
FROM orders
ON CONFLICT (order_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status, updated_at DESC);
