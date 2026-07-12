import 'dotenv/config'
import pg from 'pg'

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.LOCAL_DATABASE_URL || 'postgres://postgres@127.0.0.1:5432/postgres'
const pool = new pg.Pool({ connectionString })

async function run() {
  console.log('Connecting to database...')
  const client = await pool.connect()
  try {
    console.log('Starting transaction...')
    await client.query('BEGIN')

    // 1. Create or get Circle K Outlet
    console.log('Inserting/checking Circle K outlet...')
    let ckOutletId: number
    const outletRes = await client.query(`
      SELECT id FROM outlets WHERE code = 'CK-01'
    `)
    if (outletRes.rows.length > 0) {
      ckOutletId = outletRes.rows[0].id
      console.log(`Outlet Circle K already exists with ID: ${ckOutletId}`)
    } else {
      const newOutletRes = await client.query(`
        INSERT INTO outlets (code, name, address, phone, active, is_default)
        VALUES ('CK-01', 'Circle K Kemang', 'Jl. Kemang Raya No. 10, Jakarta Selatan', '021-7191234', TRUE, FALSE)
        RETURNING id
      `)
      ckOutletId = newOutletRes.rows[0].id
      console.log(`Created Circle K outlet with ID: ${ckOutletId}`)
    }

    // Get Outlet Pusat (Indomaret)
    const indomaretRes = await client.query(`
      SELECT id FROM outlets WHERE code = 'PUSAT'
    `)
    const indomaretOutletId = indomaretRes.rows[0]?.id
    console.log(`Outlet Pusat (Indomaret) ID: ${indomaretOutletId}`)

    // 2. Define Circle K products
    const ckProducts = [
      ['CK Hotdog Classic', 'Roti sosis panggang dengan saus mustard dan saus tomat khas Circle K.', 15000, 'Makanan', '🌭', 'orange', 'Favorit', false],
      ['CK Corndog Mozzarella', 'Sosis berbalut keju mozzarella dengan balutan tepung renyah.', 18000, 'Makanan', '🍢', 'yellow', 'Terlaris', false],
      ['CK Kebab Beef', 'Kebab isi daging sapi panggang iris dengan saus gurih.', 22000, 'Makanan', '🌯', 'red', 'Baru', false],
      ['Froster Bubble Gum 16oz', 'Minuman es serut beku rasa bubble gum yang sangat menyegarkan.', 10000, 'Minuman', '🥤', 'blue', 'CK Khas', false],
      ['Froster Green Apple 16oz', 'Minuman es serut beku rasa apel hijau segar.', 10000, 'Minuman', '🥤', 'green', 'CK Khas', false],
      ['CK Coffee Hot Cappuccino', 'Kopi espresso segar dengan buih susu tebal khas CK.', 12000, 'Minuman', '☕', 'cream', null, false],
      ['CK Coffee Iced Hazelnut Latte', 'Kopi susu dingin aroma hazelnut yang manis dan creamy.', 15000, 'Minuman', '🥤', 'orange', 'Baru', false],
      ['Keripik Kentang CK Sapi Panggang', 'Keripik kentang renyah kemasan khusus Circle K.', 9500, 'Snack', '🥔', 'orange', null, false],
      ['CK Odeng Skewer', 'Sate kue ikan khas Korea disajikan dengan kuah kaldu hangat yang gurih.', 12000, 'Makanan', '🍢', 'peach', 'Hangat', false]
    ]

    // 3. Insert CK products
    console.log('Inserting Circle K products...')
    const ckProductIds: number[] = []
    const ckInventoryData: Array<{ name: string; sku: string; unit: string; stock: number; min: number; cost: number }> = [
      { name: 'CK Hotdog Classic', sku: 'CK-HD-001', unit: 'pcs', stock: 50, min: 5, cost: 10000 },
      { name: 'CK Corndog Mozzarella', sku: 'CK-CD-002', unit: 'pcs', stock: 40, min: 5, cost: 12000 },
      { name: 'CK Kebab Beef', sku: 'CK-KB-003', unit: 'pcs', stock: 35, min: 5, cost: 15000 },
      { name: 'Froster Bubble Gum 16oz', sku: 'CK-FR-004', unit: 'cup', stock: 150, min: 15, cost: 4000 },
      { name: 'Froster Green Apple 16oz', sku: 'CK-FR-005', unit: 'cup', stock: 150, min: 15, cost: 4000 },
      { name: 'CK Coffee Hot Cappuccino', sku: 'CK-CF-006', unit: 'cup', stock: 80, min: 10, cost: 5000 },
      { name: 'CK Coffee Iced Hazelnut Latte', sku: 'CK-CF-007', unit: 'cup', stock: 70, min: 10, cost: 7000 },
      { name: 'Keripik Kentang CK Sapi Panggang', sku: 'CK-SN-008', unit: 'bungkus', stock: 100, min: 10, cost: 6000 },
      { name: 'CK Odeng Skewer', sku: 'CK-OD-009', unit: 'tusuk', stock: 60, min: 5, cost: 7500 }
    ]

    for (let i = 0; i < ckProducts.length; i++) {
      const [name, desc, price, category, emoji, tone, badge, spicy] = ckProducts[i]
      
      // Check if product already exists globally
      let pid: number
      const prodRes = await client.query(`SELECT id FROM products WHERE name = $1`, [name])
      if (prodRes.rows.length > 0) {
        pid = prodRes.rows[0].id
        console.log(`Product "${name}" already exists with ID: ${pid}`)
      } else {
        const insRes = await client.query(`
          INSERT INTO products (name, description, price, category, emoji, tone, badge, spicy)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `, [name, desc, price, category, emoji, tone, badge, spicy])
        pid = insRes.rows[0].id
        console.log(`Created product "${name}" with ID: ${pid}`)
      }
      ckProductIds.push(pid)

      // Assign product specifically to Circle K Outlet (active & available)
      await client.query(`
        INSERT INTO outlet_products (outlet_id, product_id, active, available)
        VALUES ($1, $2, TRUE, TRUE)
        ON CONFLICT (outlet_id, product_id) DO UPDATE SET active = TRUE, available = TRUE
      `, [ckOutletId, pid])

      // Ensure it is NOT assigned or active at Indomaret
      if (indomaretOutletId) {
        await client.query(`
          DELETE FROM outlet_products WHERE outlet_id = $1 AND product_id = $2
        `, [indomaretOutletId, pid])
      }

      // Check/create inventory for this product at Circle K outlet
      const invItem = ckInventoryData[i]
      if (invItem) {
        const invRes = await client.query(`
          SELECT id FROM inventory_items WHERE outlet_id = $1 AND sku = $2
        `, [ckOutletId, invItem.sku])
        
        if (invRes.rows.length === 0) {
          const newInvRes = await client.query(`
            INSERT INTO inventory_items (name, sku, unit, current_stock, minimum_stock, unit_cost, linked_product_id, usage_per_sale, active, outlet_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 1.0, TRUE, $8)
            RETURNING id
          `, [invItem.name, invItem.sku, invItem.unit, invItem.stock, invItem.min, invItem.cost, pid, ckOutletId])
          
          const itemId = newInvRes.rows[0].id
          await client.query(`
            INSERT INTO stock_movements (item_id, type, quantity, stock_before, stock_after, note)
            VALUES ($1, 'in', $2, 0, $3, 'Initial Circle K inventory seed')
          `, [itemId, invItem.stock, invItem.stock])
          console.log(`Created inventory for "${invItem.name}" at Circle K`)
        }
      }
    }

    // Ensure Indomaret products are NOT active at Circle K
    console.log('Deactivating Indomaret products at Circle K outlet...')
    const indomaretProductsRes = await client.query(`
      SELECT id FROM products WHERE name NOT LIKE 'CK %' AND name NOT LIKE 'Froster %' AND name NOT LIKE 'Keripik Kentang CK %'
    `)
    const indomaretProductIds = indomaretProductsRes.rows.map(r => r.id)
    for (const pid of indomaretProductIds) {
      await client.query(`
        DELETE FROM outlet_products WHERE outlet_id = $1 AND product_id = $2
      `, [ckOutletId, pid])
    }

    await client.query('COMMIT')
    console.log('Seeding Circle K completed successfully!')
  } catch (error) {
    console.error('Seeding Circle K failed! Rolling back...')
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
}).then(() => {
  process.exit(0)
})
