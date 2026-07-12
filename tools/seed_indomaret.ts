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

    console.log('Clearing transaction and product tables...')
    await client.query('DELETE FROM order_items')
    await client.query('DELETE FROM orders')
    await client.query('DELETE FROM financial_entries')
    await client.query('DELETE FROM stock_movements')
    await client.query('DELETE FROM inventory_items')
    await client.query('DELETE FROM outlet_products')
    await client.query('DELETE FROM product_addons')
    await client.query('DELETE FROM products')
    await client.query('DELETE FROM menu_categories')
    await client.query('DELETE FROM promotions')

    console.log('Inserting Indomaret categories...')
    const categories = [
      ['Makanan', '🍱', 10],
      ['Minuman', '🥤', 20],
      ['Snack', '🍿', 30],
      ['Roti & Kue', '🍞', 40],
      ['Ice Cream', '🍦', 50],
      ['Kebutuhan Harian', '🧼', 60]
    ]
    for (const [label, emoji, sortOrder] of categories) {
      await client.query(`
        INSERT INTO menu_categories (label, emoji, sort_order)
        VALUES ($1, $2, $3)
      `, [label, emoji, sortOrder])
    }

    console.log('Inserting Indomaret products...')
    const products = [
      ['Indomie Goreng Spesial', 'Mie instan goreng rasa spesial dari Indomie.', 3500, 3800, 'Makanan', '🍱', 'yellow', 'Terlaris', false],
      ['Pop Mie Goreng Pedas', 'Mie instan cup rasa pedas gledek, praktis tinggal seduh.', 5500, null, 'Makanan', '🍜', 'red', 'Baru', true],
      ['Sari Roti Roti Tawar', 'Roti tawar lembut dan bergizi dari Sari Roti.', 14500, 15500, 'Roti & Kue', '🍞', 'cream', 'Favorit', false],
      ['Sari Roti Kasur Cokelat', 'Roti kasur isi cokelat manis isi 4 bulatan.', 12500, null, 'Roti & Kue', '🍞', 'cream', null, false],
      ['Chitato Sapi Panggang 68g', 'Keripik kentang renyah rasa sapi panggang khas Chitato.', 11500, 12500, 'Snack', '🥔', 'orange', 'Paling Dicari', false],
      ['Oreo Vanilla 119g', 'Biskuit hitam dengan krim rasa vanilla yang lezat.', 9800, null, 'Snack', '🍪', 'blue', null, false],
      ['Beng-Beng Share It 9.5g x 10', 'Beng-beng wafer cokelat renyah isi 10 bungkus kecil.', 13900, null, 'Snack', '🍫', 'red', 'Ekstra Puas', false],
      ['Aqua Air Mineral 600ml', 'Air mineral alami Aqua kemasan botol sedang 600ml.', 3500, null, 'Minuman', '💧', 'blue', null, false],
      ['Teh Botol Sosro Kotak 250ml', 'Minuman teh manis khas Sosro kemasan kotak 250ml.', 3500, null, 'Minuman', '🧃', 'orange', null, false],
      ['Pocari Sweat Can 330ml', 'Minuman isotonik dingin kemasan kaleng 330ml.', 8900, 9500, 'Minuman', '🥤', 'blue', 'Segar', false],
      ['Kopi Golda Cappuccino 200ml', 'Kopi susu cappuccino dingin kemasan botol 200ml.', 3000, null, 'Minuman', '☕', 'peach', null, false],
      ['Wall\'s Magnum Classic 80ml', 'Es krim cokelat tebal dengan isi vanila premium.', 15000, 16500, 'Ice Cream', '🍦', 'gold', 'Premium', false],
      ['Glico Wings Haku Matcha', 'Es krim rasa matcha jepang yang lembut dengan cone krispi.', 8000, null, 'Ice Cream', '🍨', 'green', 'Baru', false],
      ['Biore Body Wash Cool 450ml', 'Sabun mandi cair Biore Active Cool isi ulang 450ml.', 26500, 29900, 'Kebutuhan Harian', '🧴', 'blue', null, false],
      ['Pepsodent Pencegah Gigi 190g', 'Pasta gigi Pepsodent 190g pencegah gigi berlubang.', 12500, null, 'Kebutuhan Harian', '🪥', 'cream', null, false],
      ['Tissue Indomaret 220s', 'Tisu wajah kemasan lembut dari Indomaret isi 220 lembar.', 14500, null, 'Kebutuhan Harian', '🧻', 'pink', 'Hemat', false]
    ]

    const productIds: number[] = []
    for (const [name, desc, price, origPrice, category, emoji, tone, badge, spicy] of products) {
      const res = await client.query(`
        INSERT INTO products (name, description, price, original_price, category, emoji, tone, badge, spicy)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [name, desc, price, origPrice, category, emoji, tone, badge, spicy])
      productIds.push(res.rows[0].id)
    }

    console.log('Inserting default addons for some products...')
    const tawarId = productIds[2]
    const addons = [
      ['Selai Cokelat', 3000],
      ['Selai Stroberi', 2500],
      ['Mentega Margarin', 1500]
    ]
    for (const [name, price] of addons) {
      await client.query(`
        INSERT INTO product_addons (product_id, name, price, active)
        VALUES ($1, $2, $3, TRUE)
      `, [tawarId, name, price])
    }

    console.log('Assigning new products to all existing outlets...')
    const outletsRes = await client.query('SELECT id FROM outlets')
    const outletIds = outletsRes.rows.map(r => r.id)
    for (const pid of productIds) {
      for (const oid of outletIds) {
        await client.query(`
          INSERT INTO outlet_products (outlet_id, product_id, active, available)
          VALUES ($1, $2, TRUE, TRUE)
          ON CONFLICT (outlet_id, product_id) DO NOTHING
        `, [oid, pid])
      }
    }

    console.log('Inserting promotion...')
    await client.query(`
      INSERT INTO promotions (title, description, code, discount_type, discount_value, min_order, active)
      VALUES ('Promo JSM Indomaret', 'Belanja hemat akhir pekan di Indomaret terdekat.', 'JSMHEBAT', 'percentage', 10, 30000, TRUE)
    `)

    console.log('Updating brand settings to Indomaret...')
    const settings = {
      businessName: 'Indomaret',
      shortName: 'IDM',
      tagline: 'Mudah & Hemat',
      heroEyebrow: 'Belanja kebutuhanmu di sini',
      heroTitle: 'Mudah & Hemat',
      heroHighlight: 'Belanja Nyaman!',
      heroDescription: 'Semua kebutuhan harianmu ada di Indomaret. Praktis, murah, dan selalu dekat denganmu.',
      deliveryEstimate: '± 15 menit',
      deliveryNote: 'diantar ke tempatmu',
      locationLabel: 'Gerai Indomaret',
      locationTitle: 'Selalu dekat dengan Anda',
      locationDescription: 'Temukan gerai Indomaret terdekat di kota Anda dan nikmati promo menarik setiap hari.',
      footerDescription: 'Indomaret - Jaringan minimarket waralaba terbesar di Indonesia.',
      contactEmail: 'kontak@indomaret.co.id',
      orderPrefix: 'IDM',
      primaryColor: '#005ca9',
      accentColor: '#ed1c24',
      menuKicker: 'Pilihan Produk',
      menuTitle: 'Mau belanja apa hari ini?',
      menuDescription: 'Pilih produk kebutuhan harianmu dari kategori makanan, snack, minuman segar, hingga kebutuhan mandi.',
      aboutKicker: 'Tentang Indomaret',
      aboutTitle: 'Mudah & Hemat di Indomaret',
      aboutDescription: 'Indomaret berkomitmen menyediakan berbagai macam produk kebutuhan pokok sehari-hari dengan pelayanan terbaik dan promo hemat setiap minggunya.',
      aboutReviewQuote: 'Belanja bulanan jadi praktis dan hemat banget pakai website Indomaret ini!',
      aboutReviewAuthor: 'Ibu Rumah Tangga'
    }

    for (const [key, value] of Object.entries(settings)) {
      await client.query(`
        INSERT INTO app_settings (key, value)
        VALUES ($1, $2)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `, [key, value])
    }

    await client.query('COMMIT')
    console.log('Seeding completed successfully!')
  } catch (error) {
    console.error('Seeding failed! Rolling back...')
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
