CREATE TABLE IF NOT EXISTS outlet_products (
  outlet_id INTEGER NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price_override INTEGER CHECK (price_override IS NULL OR price_override >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (outlet_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_outlet_products_product ON outlet_products(product_id);
CREATE INDEX IF NOT EXISTS idx_outlet_products_catalog ON outlet_products(outlet_id, active, available);

-- Menjaga perilaku katalog lama: semua produk yang sudah ada langsung tersedia
-- di semua outlet. Manager/Admin dapat mengubah assignment setelah migrasi.
INSERT INTO outlet_products (outlet_id, product_id, active, available)
SELECT outlets.id, products.id, TRUE, TRUE
FROM outlets
CROSS JOIN products
ON CONFLICT (outlet_id, product_id) DO NOTHING;
