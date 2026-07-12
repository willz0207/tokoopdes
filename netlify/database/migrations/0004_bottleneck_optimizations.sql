CREATE TABLE IF NOT EXISTS payment_notifications (
  idempotency_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_outlet_products_outlet_available ON outlet_products(outlet_id, available);
CREATE INDEX IF NOT EXISTS idx_products_category_active ON products(category, active);
CREATE INDEX IF NOT EXISTS idx_payments_order_status ON payments(order_id, status);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
