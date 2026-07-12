import 'dotenv/config'
import pg, { type PoolClient, type QueryResultRow } from 'pg'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import type {
  FinancialEntryRecord,
  FinancialEntryType,
  FranchiseSettingsRecord,
  InventoryItemRecord,
  MenuCategoryRecord,
  NewOrderInput,
  OrderRecord,
  OutletRecord,
  PaymentMethod,
  PaymentSessionRecord,
  PaymentStatus,
  PermissionModule,
  PermissionModuleMeta,
  PermissionRole,
  ProductAddonInput,
  ProductAddonRecord,
  ProductInput,
  ProductOutletAssignmentInput,
  ProductRecord,
  PromotionRecord,
  RolePermissionMatrix,
  StockMovementRecord,
  StockMovementType,
  UserRecord,
  UserRole,
} from './contracts.js'

export const databaseLabel = 'local-postgres'

const redactConnectionString = (connectionString: string) => {
  try {
    const url = new URL(connectionString)
    if (url.username) url.username = '***'
    if (url.password) url.password = '***'
    return url.toString()
  } catch {
    return 'postgres://***'
  }
}

const normalizeConnectionString = (connectionString: string) => {
  if (connectionString.includes('@')) return connectionString
  if (connectionString.startsWith('postgres://')) return connectionString.replace('postgres://', 'postgres://postgres@')
  if (connectionString.startsWith('postgresql://')) return connectionString.replace('postgresql://', 'postgresql://postgres@')
  return connectionString
}

const resolveConnectionString = () => {
  const explicitConnectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.LOCAL_DATABASE_URL
  if (explicitConnectionString) {
    return normalizeConnectionString(explicitConnectionString)
  }

  return 'postgres://postgres@127.0.0.1:5432/postgres'
}

const shouldUseSsl = (connectionString: string) =>
  /sslmode=(require|verify-ca|verify-full)|netlify\.com|neon\.tech|amazonaws\.com/i.test(connectionString)

let activePoolInstance: pg.Pool | null = null
let currentConnectionString: string | null = null

const getPool = (): pg.Pool => {
  const conn = resolveConnectionString()
  if (!activePoolInstance || currentConnectionString !== conn) {
    if (activePoolInstance) {
      console.log('Membuat ulang koneksi database:', redactConnectionString(conn))
      const oldPool = activePoolInstance
      activePoolInstance = null
      void oldPool.end().catch(() => {})
    } else {
      console.log('Database aktif:', redactConnectionString(conn))
    }
    currentConnectionString = conn
    activePoolInstance = new pg.Pool({
      connectionString: conn,
      max: 10,
      ssl: shouldUseSsl(conn) ? { rejectUnauthorized: false } : false,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
    })
  }
  return activePoolInstance
}

const pool = new Proxy({} as any, {
  get: (target, prop) => {
    const activePool = getPool()
    const value = (activePool as any)[prop]
    if (typeof value === 'function') {
      return value.bind(activePool)
    }
    return value
  }
}) as unknown as pg.Pool

type Queryable = Pick<pg.Pool, 'query'> | Pick<PoolClient, 'query'>
const rows = async <T extends QueryResultRow = QueryResultRow>(database: Queryable, text: string, values: unknown[] = []) =>
  (await database.query<T>(text, values)).rows
const first = async <T extends QueryResultRow = QueryResultRow>(database: Queryable, text: string, values: unknown[] = []) =>
  (await rows<T>(database, text, values))[0]
const numberValue = (value: unknown) => Number(value ?? 0)
const isoValue = (value: unknown) => value instanceof Date ? value.toISOString() : String(value)
const dateValue = (value: unknown) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)

const transaction = async <T>(callback: (client: PoolClient) => Promise<T>) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

const verifyPassword = (password: string, storedHash: string) => {
  const [salt, key] = storedHash.split(':')
  if (!salt || !key) return false
  const storedKey = Buffer.from(key, 'hex')
  const suppliedKey = scryptSync(password, salt, 64)
  return storedKey.length === suppliedKey.length && timingSafeEqual(storedKey, suppliedKey)
}

export const permissionRoles: PermissionRole[] = ['cashier', 'manager', 'admin']
export const permissionModules: PermissionModuleMeta[] = [
  { key: 'cashier_station', label: 'Stasiun Cashier', description: 'Melihat pesanan, ringkasan order, dan mengubah status pesanan.' },
  { key: 'categories', label: 'Kategori Menu', description: 'CRUD kategori menu yang tampil sebagai filter storefront.' },
  { key: 'products', label: 'Produk & Add-on', description: 'CRUD produk, foto produk, status produk, dan add-on.' },
  { key: 'promotions', label: 'Promosi', description: 'CRUD kode promo, periode promo, nilai diskon, dan status promo.' },
  { key: 'cashiers', label: 'Akun Cashier', description: 'CRUD akun cashier, reset password, dan status aktif/nonaktif.' },
  { key: 'inventory', label: 'Inventory', description: 'CRUD item stok, batas minimum, tautan produk, dan stock movement.' },
  { key: 'reports', label: 'Report', description: 'Laporan operasional, laporan keuangan, ekspor CSV, dan transaksi biaya/modal.' },
  { key: 'outlets', label: 'Outlet', description: 'CRUD cabang, alamat, status operasional, dan pemisahan data per outlet.' },
  { key: 'settings', label: 'Franchise', description: 'Pengaturan identitas brand, warna, gambar, kontak, dan konten halaman publik.' },
  { key: 'rbac', label: 'RBAC', description: 'Mengatur hak akses role cashier, manager, dan admin untuk setiap modul.' },
]

const defaultRolePermissions: Record<PermissionRole, PermissionModule[]> = {
  cashier: ['cashier_station'],
  manager: ['cashier_station', 'categories', 'products', 'promotions', 'cashiers', 'inventory', 'reports', 'outlets', 'settings'],
  admin: permissionModules.map((module) => module.key),
}

export const defaultFranchiseSettings: FranchiseSettingsRecord = {
  businessName: 'Franchise Store',
  shortName: 'FS',
  tagline: 'Fresh. Fast. Favorit.',
  heroEyebrow: 'Pesan cepat, makan nikmat',
  heroTitle: 'Lagi lapar?',
  heroHighlight: 'Gas, makan enak!',
  heroDescription: 'Menu favorit siap dipesan cepat, dibuat fresh, dan cocok untuk semua pelanggan.',
  heroImageUrl: '',
  storyImageUrl: '',
  deliveryEstimate: '± 25 menit',
  deliveryNote: 'langsung ke pintumu',
  locationLabel: 'Outlet terdekat',
  locationTitle: 'Makin dekat denganmu.',
  locationDescription: 'Temukan outlet terdekat dan nikmati menu favoritmu langsung di tempat.',
  footerDescription: 'Produk enak, cepat, dan selalu bikin balik lagi.',
  contactEmail: 'halo@franchise.local',
  whatsappNumber: '',
  orderPrefix: 'ORD',
  primaryColor: '#c61d23',
  accentColor: '#ffc83d',
  menuKicker: 'Menu andalan',
  menuTitle: 'Mau pesan apa hari ini?',
  menuDescription: 'Dari menu klasik sampai menu promo, semua bisa kamu atur sesuai franchise.',
  aboutKicker: 'Kenapa kami?',
  aboutTitle: 'Bukan sekadar produk cepat saji.',
  aboutDescription: 'Kami membantu pelanggan memesan dengan cepat, sementara tim toko bisa mengelola produk, promo, dan pesanan dari satu dashboard.',
  aboutReviewQuote: 'Rasanya enak dan prosesnya cepat!',
  aboutReviewAuthor: 'Pelanggan setia',
}

const franchiseSettingKeys = Object.keys(defaultFranchiseSettings) as Array<keyof FranchiseSettingsRecord>

let initializationPromise: Promise<void> | undefined
const initialize = () => {
  if (!initializationPromise) {
    initializationPromise = seedDatabase().catch((error) => {
      initializationPromise = undefined
      throw error
    })
  }
  return initializationPromise
}

const seedDatabase = () => transaction(async (client) => {
  await client.query('SELECT pg_advisory_xact_lock($1)', [734_020_202])
  const schema = await first<{ usersTable: string | null }>(client, `SELECT to_regclass('public.users') AS "usersTable"`)
  if (!schema?.usersTable) {
    const migrationPath = path.resolve(process.cwd(), 'netlify', 'database', 'migrations', '0001_initial_schema.sql')
    if (!existsSync(migrationPath)) throw new Error(`File migration tidak ditemukan: ${migrationPath}`)
    await client.query(await readFile(migrationPath, 'utf8'))
  }

  const multiOutletMigration = path.resolve(process.cwd(), 'netlify', 'database', 'migrations', '0002_multi_outlet_payments.sql')
  if (!existsSync(multiOutletMigration)) throw new Error(`File migration tidak ditemukan: ${multiOutletMigration}`)
  await client.query(await readFile(multiOutletMigration, 'utf8'))

  const outletProductsMigration = path.resolve(process.cwd(), 'netlify', 'database', 'migrations', '0003_outlet_products.sql')
  if (!existsSync(outletProductsMigration)) throw new Error(`File migration tidak ditemukan: ${outletProductsMigration}`)
  await client.query(await readFile(outletProductsMigration, 'utf8'))

  for (const role of permissionRoles) {
    for (const module of permissionModules) {
      await client.query(`
        INSERT INTO role_permissions (role, module, enabled)
        VALUES ($1, $2, $3)
        ON CONFLICT (role, module) DO NOTHING
      `, [role, module.key, defaultRolePermissions[role].includes(module.key)])
    }
  }
  await client.query("UPDATE role_permissions SET enabled = (role = 'admin'), updated_at = CURRENT_TIMESTAMP WHERE module = 'rbac'")

  for (const key of franchiseSettingKeys) {
    await client.query('INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [key, defaultFranchiseSettings[key] ?? ''])
  }

  const seedUsers: Array<{ name: string; email: string; password: string; role: UserRole }> = [
    { name: 'Cashier Store', email: (process.env.APP_CASHIER_EMAIL || 'cashier@franchise.local').toLowerCase(), password: process.env.APP_CASHIER_PASSWORD || 'cashier123', role: 'cashier' },
    { name: 'Manager Store', email: (process.env.APP_MANAGER_EMAIL || 'manager@franchise.local').toLowerCase(), password: process.env.APP_MANAGER_PASSWORD || 'manager123', role: 'manager' },
    { name: 'Admin Store', email: (process.env.APP_ADMIN_EMAIL || 'admin@franchise.local').toLowerCase(), password: process.env.APP_ADMIN_PASSWORD || 'admin123', role: 'admin' },
  ]
  for (const user of seedUsers) {
    await client.query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (LOWER(email)) DO NOTHING
    `, [user.name, user.email, hashPassword(user.password), user.role])
  }
  await client.query(`UPDATE users SET outlet_id=(SELECT id FROM outlets WHERE is_default=TRUE LIMIT 1) WHERE outlet_id IS NULL AND role IN ('cashier','manager')`)

  const categories = [
    ['Paket', '🍱', 10], ['Ayam', '🍗', 20], ['Burger', '🍔', 30], ['Snack', '🍟', 40], ['Minuman', '🥤', 50],
  ] as const
  for (const category of categories) {
    await client.query(`
      INSERT INTO menu_categories (label, emoji, sort_order)
      VALUES ($1, $2, $3) ON CONFLICT (LOWER(label)) DO NOTHING
    `, [...category])
  }

  const productCount = await first<{ count: string }>(client, 'SELECT COUNT(*) AS count FROM products')
  if (numberValue(productCount?.count) === 0) {
    const products = [
      ['Paket Andalan', '2 menu utama, nasi hangat, dan minuman segar.', 43900, 51900, 'Paket', '🍱', 'gold', 'Paling laris', false],
      ['Menu Original', 'Menu favorit dengan rasa khas dan tekstur renyah.', 18900, null, 'Ayam', '🍗', 'cream', 'Favorit', false],
      ['Menu Pedas Spesial', 'Menu pedas manis yang cocok untuk pencinta rasa kuat.', 23900, null, 'Ayam', '🌶️', 'red', 'Baru', true],
      ['Burger Spesial', 'Burger isi protein, sayuran, dan saus creamy.', 28900, null, 'Burger', '🍔', 'orange', null, false],
      ['Double Crunch Burger', 'Dua lapis ayam krispi untuk lapar yang serius.', 36900, null, 'Burger', '🍔', 'yellow', 'Extra puas', false],
      ['Kentang Bumbu', 'Kentang renyah dengan pilihan bumbu gurih.', 15900, null, 'Snack', '🍟', 'pink', null, false],
      ['Bites Sharing', 'Potongan menu praktis, pas buat sharing.', 24900, null, 'Snack', '🍿', 'peach', null, false],
      ['Minuman Dingin', 'Minuman dingin dan menyegarkan.', 9900, null, 'Minuman', '🥤', 'blue', null, false],
    ] as const
    for (const product of products) {
      await client.query(`
        INSERT INTO products (name, description, price, original_price, category, emoji, tone, badge, spicy)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [...product])
    }
  }

  const promotionCount = await first<{ count: string }>(client, 'SELECT COUNT(*) AS count FROM promotions')
  if (numberValue(promotionCount?.count) === 0) {
    await client.query(`
      INSERT INTO promotions (title, description, code, discount_type, discount_value, min_order, active)
      VALUES ('Berdua Lebih Hemat', 'Nikmati paket pilihan untuk makan berdua dengan harga spesial.', 'HEMAT25', 'percentage', 25, 50000, TRUE)
    `)
  }
})

const mapUser = (row: Record<string, unknown>): UserRecord => ({
  id: numberValue(row.id),
  name: String(row.name),
  email: String(row.email),
  role: row.role as UserRole,
  active: Boolean(row.active),
  outletId: row.outletId === null || row.outletId === undefined ? undefined : numberValue(row.outletId),
  outletName: row.outletName ? String(row.outletName) : undefined,
})

const userSelect = `SELECT users.id,users.name,users.email,users.role,users.active,users.outlet_id AS "outletId",outlets.name AS "outletName"
  FROM users LEFT JOIN outlets ON outlets.id=users.outlet_id`

export async function createUser(input: { name: string; email: string; password: string; role?: UserRole; outletId?: number }) {
  await initialize()
  const row = await first(pool, `
    INSERT INTO users (name, email, password_hash, role, outlet_id)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
  `, [input.name, input.email.toLowerCase(), hashPassword(input.password), input.role || 'customer', input.outletId ?? null])
  return (await getUserById(numberValue(row.id)))!
}

export async function authenticateUser(email: string, password: string, expectedRole?: UserRole) {
  await initialize()
  const row = await first(pool, `
    SELECT users.id,users.name,users.email,users.password_hash AS "passwordHash",users.role,users.active,
      users.outlet_id AS "outletId",outlets.name AS "outletName"
    FROM users LEFT JOIN outlets ON outlets.id=users.outlet_id WHERE LOWER(users.email) = LOWER($1)
  `, [email])
  if (!row || !row.active || (expectedRole && row.role !== expectedRole) || !verifyPassword(password, String(row.passwordHash))) return undefined
  return mapUser(row)
}

export async function getUserById(id: number) {
  await initialize()
  const row = await first(pool, `${userSelect} WHERE users.id=$1`, [id])
  return row ? mapUser(row) : undefined
}

export async function getCashiers(outletId?: number) {
  await initialize()
  return (await rows(pool, `${userSelect} WHERE users.role='cashier' ${outletId ? 'AND users.outlet_id=$1' : ''} ORDER BY users.id DESC`, outletId ? [outletId] : [])).map(mapUser)
}

export async function updateCashier(id: number, input: { name: string; email: string; password?: string; active: boolean; outletId: number }) {
  await initialize()
  const row = input.password
    ? await first(pool, `UPDATE users SET name=$1,email=$2,password_hash=$3,active=$4,outlet_id=$5 WHERE id=$6 AND role='cashier' RETURNING id`, [input.name, input.email.toLowerCase(), hashPassword(input.password), input.active, input.outletId, id])
    : await first(pool, `UPDATE users SET name=$1,email=$2,active=$3,outlet_id=$4 WHERE id=$5 AND role='cashier' RETURNING id`, [input.name, input.email.toLowerCase(), input.active, input.outletId, id])
  return row ? getUserById(id) : undefined
}

export async function deleteCashier(id: number) {
  await initialize()
  return (await pool.query("DELETE FROM users WHERE id = $1 AND role = 'cashier'", [id])).rowCount! > 0
}

export async function updateUserProfile(id: number, input: { name: string; email: string }) {
  await initialize()
  const row = await first(pool, 'UPDATE users SET name=$1,email=$2 WHERE id=$3 RETURNING id', [input.name, input.email.toLowerCase(), id])
  return row ? getUserById(id) : undefined
}

export async function changeUserPassword(id: number, currentPassword: string, newPassword: string) {
  await initialize()
  const row = await first(pool, 'SELECT password_hash AS "passwordHash" FROM users WHERE id=$1', [id])
  if (!row || !verifyPassword(currentPassword, String(row.passwordHash))) return false
  await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hashPassword(newPassword), id])
  return true
}

const isPermissionRole = (role: string): role is PermissionRole => permissionRoles.includes(role as PermissionRole)
const isPermissionModule = (module: string): module is PermissionModule => permissionModules.some((item) => item.key === module)

export async function ensureDefaultRolePermissions() {
  await initialize()
}

export async function getRolePermissions(role: UserRole): Promise<Record<PermissionModule, boolean>> {
  await initialize()
  const defaults = isPermissionRole(role) ? defaultRolePermissions[role] : []
  const permissions = Object.fromEntries(permissionModules.map((module) => [module.key, defaults.includes(module.key)])) as Record<PermissionModule, boolean>
  if (!isPermissionRole(role)) return permissions
  const stored = await rows(pool, 'SELECT module, enabled FROM role_permissions WHERE role=$1', [role])
  stored.forEach((row) => { if (isPermissionModule(String(row.module))) permissions[String(row.module) as PermissionModule] = Boolean(row.enabled) })
  if (role === 'admin') permissions.rbac = true
  return permissions
}

export async function hasModuleAccess(role: UserRole, module: PermissionModule) {
  return Boolean((await getRolePermissions(role))[module])
}

export async function getRolePermissionMatrix(): Promise<RolePermissionMatrix> {
  const permissionRows = await Promise.all(permissionRoles.map(async (role) => [role, await getRolePermissions(role)] as const))
  return { roles: permissionRoles, modules: permissionModules, permissions: Object.fromEntries(permissionRows) as RolePermissionMatrix['permissions'] }
}

export async function updateRolePermissions(input: Partial<Record<PermissionRole, Partial<Record<PermissionModule, boolean>>>>) {
  await initialize()
  await transaction(async (client) => {
    for (const [role, modules] of Object.entries(input)) {
      if (!isPermissionRole(role) || !modules) continue
      for (const [module, enabled] of Object.entries(modules)) {
        if (!isPermissionModule(module)) continue
        const forcedValue = module === 'rbac' ? role === 'admin' : Boolean(enabled)
        await client.query(`
          INSERT INTO role_permissions (role, module, enabled, updated_at)
          VALUES ($1,$2,$3,CURRENT_TIMESTAMP)
          ON CONFLICT (role,module) DO UPDATE SET enabled=EXCLUDED.enabled, updated_at=CURRENT_TIMESTAMP
        `, [role, module, forcedValue])
      }
    }
    await client.query("UPDATE role_permissions SET enabled=(role='admin'), updated_at=CURRENT_TIMESTAMP WHERE module='rbac'")
  })
  return getRolePermissionMatrix()
}

const mapOutlet = (row: Record<string, unknown>): OutletRecord => ({
  id: numberValue(row.id),
  code: String(row.code),
  name: String(row.name),
  address: String(row.address || ''),
  phone: String(row.phone || ''),
  active: Boolean(row.active),
  isDefault: Boolean(row.isDefault),
})

const outletSelect = `SELECT id,code,name,address,phone,active,is_default AS "isDefault" FROM outlets`

export async function getOutlets(includeInactive = false) {
  await initialize()
  const outletRows = await rows(pool, `${outletSelect} ${includeInactive ? '' : 'WHERE active=TRUE'} ORDER BY is_default DESC,active DESC,name ASC`)
  return outletRows.map(mapOutlet)
}

export async function getOutletById(id: number, includeInactive = false) {
  await initialize()
  const row = await first(pool, `${outletSelect} WHERE id=$1 ${includeInactive ? '' : 'AND active=TRUE'}`, [id])
  return row ? mapOutlet(row) : undefined
}

export async function getDefaultOutlet() {
  await initialize()
  const row = await first(pool, `${outletSelect} WHERE active=TRUE ORDER BY is_default DESC,id ASC LIMIT 1`)
  if (!row) throw new Error('Belum ada outlet aktif. Hubungi Admin untuk mengaktifkan outlet.')
  return mapOutlet(row)
}

export async function createOutlet(input: Omit<OutletRecord, 'id'>) {
  await initialize()
  const id = await transaction(async (client) => {
    if (input.isDefault) await client.query('UPDATE outlets SET is_default=FALSE,updated_at=CURRENT_TIMESTAMP WHERE is_default=TRUE')
    const row = await first(client, `INSERT INTO outlets (code,name,address,phone,active,is_default) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [input.code.toUpperCase(), input.name, input.address, input.phone, input.active, input.isDefault])
    const outletId = numberValue(row.id)
    await client.query(`
      INSERT INTO outlet_products (outlet_id,product_id,active,available)
      SELECT $1,id,TRUE,TRUE FROM products
      ON CONFLICT (outlet_id,product_id) DO NOTHING
    `, [outletId])
    return outletId
  })
  return (await getOutletById(id, true))!
}

export async function updateOutlet(id: number, input: Omit<OutletRecord, 'id'>) {
  await initialize()
  const updated = await transaction(async (client) => {
    const current = await first(client, 'SELECT id,is_default AS "isDefault" FROM outlets WHERE id=$1 FOR UPDATE', [id])
    if (!current) return false
    if (input.isDefault) await client.query('UPDATE outlets SET is_default=FALSE,updated_at=CURRENT_TIMESTAMP WHERE id<>$1 AND is_default=TRUE', [id])
    await client.query('UPDATE outlets SET code=$1,name=$2,address=$3,phone=$4,active=$5,is_default=$6,updated_at=CURRENT_TIMESTAMP WHERE id=$7', [input.code.toUpperCase(), input.name, input.address, input.phone, input.active || input.isDefault, input.isDefault, id])
    return true
  })
  return updated ? getOutletById(id, true) : undefined
}

export async function deleteOutlet(id: number) {
  await initialize()
  const outlet = await first(pool, 'SELECT is_default AS "isDefault" FROM outlets WHERE id=$1', [id])
  if (!outlet) return { deleted: false, archived: false }
  if (outlet.isDefault) throw new Error('Outlet utama tidak dapat dihapus atau dinonaktifkan.')
  const usage = await first<{ count: string }>(pool, `SELECT (SELECT COUNT(*) FROM orders WHERE outlet_id=$1)+(SELECT COUNT(*) FROM inventory_items WHERE outlet_id=$1)+(SELECT COUNT(*) FROM users WHERE outlet_id=$1) AS count`, [id])
  if (numberValue(usage.count) > 0) {
    await pool.query('UPDATE outlets SET active=FALSE,updated_at=CURRENT_TIMESTAMP WHERE id=$1', [id])
    return { deleted: false, archived: true }
  }
  return { deleted: (await pool.query('DELETE FROM outlets WHERE id=$1', [id])).rowCount! > 0, archived: false }
}

const normalizeHexColor = (value: string, fallback: string) => /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : fallback
const normalizeOrderPrefix = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || defaultFranchiseSettings.orderPrefix
const normalizeImageDataUrl = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed.length > 3_000_000) throw new Error('Ukuran gambar brand terlalu besar. Maksimal sekitar 2 MB.')
  if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(trimmed)) throw new Error('Format gambar brand harus PNG, JPG, WebP, atau GIF.')
  return trimmed
}

export async function getFranchiseSettings(database: Queryable = pool): Promise<FranchiseSettingsRecord> {
  await initialize()
  const storedRows = await rows(database, 'SELECT key, value FROM app_settings')
  return { ...defaultFranchiseSettings, ...Object.fromEntries(storedRows.map((row) => [row.key, row.value])) }
}

export async function updateFranchiseSettings(input: Partial<FranchiseSettingsRecord>) {
  const current = await getFranchiseSettings()
  const next: FranchiseSettingsRecord = {
    ...current,
    businessName: String(input.businessName ?? current.businessName).trim().slice(0, 80) || defaultFranchiseSettings.businessName,
    shortName: String(input.shortName ?? current.shortName).trim().slice(0, 8) || defaultFranchiseSettings.shortName,
    tagline: String(input.tagline ?? current.tagline).trim().slice(0, 80) || defaultFranchiseSettings.tagline,
    heroEyebrow: String(input.heroEyebrow ?? current.heroEyebrow).trim().slice(0, 90) || defaultFranchiseSettings.heroEyebrow,
    heroTitle: String(input.heroTitle ?? current.heroTitle).trim().slice(0, 90) || defaultFranchiseSettings.heroTitle,
    heroHighlight: String(input.heroHighlight ?? current.heroHighlight).trim().slice(0, 90) || defaultFranchiseSettings.heroHighlight,
    heroDescription: String(input.heroDescription ?? current.heroDescription).trim().slice(0, 220) || defaultFranchiseSettings.heroDescription,
    heroImageUrl: normalizeImageDataUrl(String(input.heroImageUrl ?? current.heroImageUrl ?? '')),
    storyImageUrl: normalizeImageDataUrl(String(input.storyImageUrl ?? current.storyImageUrl ?? '')),
    deliveryEstimate: String(input.deliveryEstimate ?? current.deliveryEstimate).trim().slice(0, 40) || defaultFranchiseSettings.deliveryEstimate,
    deliveryNote: String(input.deliveryNote ?? current.deliveryNote).trim().slice(0, 80) || defaultFranchiseSettings.deliveryNote,
    locationLabel: String(input.locationLabel ?? current.locationLabel).trim().slice(0, 70) || defaultFranchiseSettings.locationLabel,
    locationTitle: String(input.locationTitle ?? current.locationTitle).trim().slice(0, 100) || defaultFranchiseSettings.locationTitle,
    locationDescription: String(input.locationDescription ?? current.locationDescription).trim().slice(0, 180) || defaultFranchiseSettings.locationDescription,
    footerDescription: String(input.footerDescription ?? current.footerDescription).trim().slice(0, 180) || defaultFranchiseSettings.footerDescription,
    contactEmail: String(input.contactEmail ?? current.contactEmail).trim().slice(0, 120) || defaultFranchiseSettings.contactEmail,
    whatsappNumber: String(input.whatsappNumber ?? current.whatsappNumber).replace(/\D/g, '').slice(0, 20),
    orderPrefix: normalizeOrderPrefix(String(input.orderPrefix ?? current.orderPrefix)),
    primaryColor: normalizeHexColor(String(input.primaryColor ?? current.primaryColor), defaultFranchiseSettings.primaryColor),
    accentColor: normalizeHexColor(String(input.accentColor ?? current.accentColor), defaultFranchiseSettings.accentColor),
    menuKicker: String(input.menuKicker ?? current.menuKicker).trim().slice(0, 70) || defaultFranchiseSettings.menuKicker,
    menuTitle: String(input.menuTitle ?? current.menuTitle).trim().slice(0, 100) || defaultFranchiseSettings.menuTitle,
    menuDescription: String(input.menuDescription ?? current.menuDescription).trim().slice(0, 180) || defaultFranchiseSettings.menuDescription,
    aboutKicker: String(input.aboutKicker ?? current.aboutKicker).trim().slice(0, 70) || defaultFranchiseSettings.aboutKicker,
    aboutTitle: String(input.aboutTitle ?? current.aboutTitle).trim().slice(0, 120) || defaultFranchiseSettings.aboutTitle,
    aboutDescription: String(input.aboutDescription ?? current.aboutDescription).trim().slice(0, 260) || defaultFranchiseSettings.aboutDescription,
    aboutReviewQuote: String(input.aboutReviewQuote ?? current.aboutReviewQuote).trim().slice(0, 120) || defaultFranchiseSettings.aboutReviewQuote,
    aboutReviewAuthor: String(input.aboutReviewAuthor ?? current.aboutReviewAuthor).trim().slice(0, 80) || defaultFranchiseSettings.aboutReviewAuthor,
  }
  await transaction(async (client) => {
    for (const key of franchiseSettingKeys) {
      await client.query(`INSERT INTO app_settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [key, next[key] ?? ''])
    }
  })
  return getFranchiseSettings()
}

const mapMenuCategory = (row: Record<string, unknown>): MenuCategoryRecord => ({
  id: numberValue(row.id), label: String(row.label), emoji: String(row.emoji), sortOrder: numberValue(row.sortOrder),
  active: Boolean(row.active), productCount: numberValue(row.productCount),
})

export async function getMenuCategories(includeInactive = false, includeProductCount = false, database: Queryable = pool, outletId?: number) {
  await initialize()
  const conditions: string[] = []
  const values: unknown[] = []
  if (!includeInactive) conditions.push('categories.active=TRUE')
  if (outletId && !includeInactive) {
    values.push(outletId)
    conditions.push(`EXISTS (
      SELECT 1 FROM products outlet_products_master
      JOIN outlet_products assignments ON assignments.product_id=outlet_products_master.id
      WHERE assignments.outlet_id=$${values.length}
        AND assignments.active=TRUE AND assignments.available=TRUE
        AND outlet_products_master.active=TRUE
        AND LOWER(outlet_products_master.category)=LOWER(categories.label)
    )`)
  }
  const result = await rows(database, `
    SELECT categories.id, categories.label, categories.emoji, categories.sort_order AS "sortOrder", categories.active,
      ${includeProductCount ? 'COUNT(products.id)' : '0'} AS "productCount"
    FROM menu_categories categories
    ${includeProductCount ? 'LEFT JOIN products ON LOWER(products.category)=LOWER(categories.label)' : 'LEFT JOIN products ON FALSE'}
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    GROUP BY categories.id
    ORDER BY categories.active DESC, categories.sort_order ASC, categories.label ASC
  `, values)
  return result.map(mapMenuCategory)
}

export async function menuCategoryExists(label: string) {
  await initialize()
  return Boolean(await first(pool, 'SELECT id FROM menu_categories WHERE LOWER(label)=LOWER($1)', [label]))
}

export async function createMenuCategory(input: Omit<MenuCategoryRecord, 'id' | 'productCount'>) {
  await initialize()
  const row = await first(pool, `INSERT INTO menu_categories (label,emoji,sort_order,active) VALUES ($1,$2,$3,$4) RETURNING id,label,emoji,sort_order AS "sortOrder",active,0 AS "productCount"`, [input.label, input.emoji, input.sortOrder, input.active])
  return mapMenuCategory(row)
}

export async function updateMenuCategory(id: number, input: Omit<MenuCategoryRecord, 'id' | 'productCount'>) {
  await initialize()
  const updated = await transaction(async (client) => {
    const current = await first(client, 'SELECT label FROM menu_categories WHERE id=$1 FOR UPDATE', [id])
    if (!current) return false
    await client.query('UPDATE menu_categories SET label=$1,emoji=$2,sort_order=$3,active=$4,updated_at=CURRENT_TIMESTAMP WHERE id=$5', [input.label, input.emoji, input.sortOrder, input.active, id])
    if (String(current.label).toLowerCase() !== input.label.toLowerCase()) await client.query('UPDATE products SET category=$1,updated_at=CURRENT_TIMESTAMP WHERE LOWER(category)=LOWER($2)', [input.label, current.label])
    return true
  })
  return updated ? (await getMenuCategories(true, true)).find((category) => category.id === id) : undefined
}

export async function setMenuCategoryActive(id: number, active: boolean) {
  await initialize()
  const result = await pool.query('UPDATE menu_categories SET active=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2', [active, id])
  return result.rowCount ? (await getMenuCategories(true, true)).find((category) => category.id === id) : undefined
}

export async function deleteMenuCategory(id: number) {
  await initialize()
  const category = await first(pool, 'SELECT label FROM menu_categories WHERE id=$1', [id])
  if (!category) return { deleted: false, archived: false }
  const usage = await first<{ count: string }>(pool, 'SELECT COUNT(*) AS count FROM products WHERE LOWER(category)=LOWER($1)', [category.label])
  if (numberValue(usage.count) > 0) {
    await setMenuCategoryActive(id, false)
    return { deleted: false, archived: true }
  }
  return { deleted: (await pool.query('DELETE FROM menu_categories WHERE id=$1', [id])).rowCount! > 0, archived: false }
}

const getProductAddons = async (productId: number, includeInactive = false, database: Queryable = pool): Promise<ProductAddonRecord[]> => {
  await initialize()
  const addonRows = await rows(database, `SELECT id,name,price,active FROM product_addons WHERE product_id=$1 ${includeInactive ? '' : 'AND active=TRUE'} ORDER BY id ASC`, [productId])
  return addonRows.map((row) => ({ id: numberValue(row.id), name: String(row.name), price: numberValue(row.price), active: Boolean(row.active) }))
}

const mapProduct = async (row: Record<string, unknown>, includeInactiveAddons = false, database: Queryable = pool, useEffectivePrice = false): Promise<ProductRecord> => {
  const basePrice = numberValue(row.basePrice ?? row.price)
  const effectivePrice = numberValue(row.effectivePrice ?? basePrice)
  const outletId = row.outletId === null || row.outletId === undefined ? undefined : numberValue(row.outletId)
  return {
    id: numberValue(row.id),
    name: String(row.name),
    description: String(row.description),
    price: useEffectivePrice ? effectivePrice : basePrice,
    basePrice,
    originalPrice: row.originalPrice === null ? undefined : numberValue(row.originalPrice),
    category: String(row.category),
    emoji: String(row.emoji),
    imageUrl: row.imageUrl ? String(row.imageUrl) : undefined,
    tone: String(row.tone),
    badge: row.badge ? String(row.badge) : undefined,
    spicy: Boolean(row.spicy),
    active: Boolean(row.active),
    addons: await getProductAddons(numberValue(row.id), includeInactiveAddons, database),
    outletAssignment: outletId ? {
      outletId,
      assigned: Boolean(row.outletAssigned),
      active: Boolean(row.outletActive),
      available: Boolean(row.outletAvailable),
      priceOverride: row.priceOverride === null || row.priceOverride === undefined ? undefined : numberValue(row.priceOverride),
      effectivePrice,
    } : undefined,
  }
}

export async function getProducts(includeInactive = false, database: Queryable = pool, outletId?: number) {
  await initialize()
  const assignmentJoin = outletId
    ? `${includeInactive ? 'LEFT JOIN' : 'JOIN'} outlet_products assignments ON assignments.product_id=products.id AND assignments.outlet_id=$1`
    : 'LEFT JOIN outlet_products assignments ON FALSE'
  const values = outletId ? [outletId] : []
  const activeFilter = includeInactive
    ? ''
    : `WHERE products.active=TRUE AND categories.active=TRUE${outletId ? ' AND assignments.active=TRUE AND assignments.available=TRUE' : ''}`
  const productRows = await rows(database, `
    SELECT products.id,products.name,products.description,products.price AS "basePrice",
      COALESCE(assignments.price_override,products.price) AS "effectivePrice",products.original_price AS "originalPrice",
      products.category,products.emoji,products.image_url AS "imageUrl",products.tone,products.badge,products.spicy,products.active,
      ${outletId ? '$1::integer' : 'NULL::integer'} AS "outletId",assignments.product_id IS NOT NULL AS "outletAssigned",
      COALESCE(assignments.active,FALSE) AS "outletActive",COALESCE(assignments.available,FALSE) AS "outletAvailable",
      assignments.price_override AS "priceOverride"
    FROM products
    ${includeInactive ? 'LEFT JOIN menu_categories categories ON LOWER(categories.label)=LOWER(products.category)' : 'JOIN menu_categories categories ON LOWER(categories.label)=LOWER(products.category)'}
    ${assignmentJoin}
    ${activeFilter}
    ORDER BY COALESCE(categories.sort_order,9999) ASC,products.id ASC
  `, values)
  return Promise.all(productRows.map((row) => mapProduct(row, includeInactive, database, !includeInactive)))
}

const getProductById = async (id: number, database: Queryable = pool, outletId?: number, useEffectivePrice = false) => {
  const assignmentJoin = outletId
    ? 'LEFT JOIN outlet_products assignments ON assignments.product_id=products.id AND assignments.outlet_id=$2'
    : 'LEFT JOIN outlet_products assignments ON FALSE'
  const values = outletId ? [id, outletId] : [id]
  const row = await first(database, `
    SELECT products.id,products.name,products.description,products.price AS "basePrice",
      COALESCE(assignments.price_override,products.price) AS "effectivePrice",products.original_price AS "originalPrice",
      products.category,products.emoji,products.image_url AS "imageUrl",products.tone,products.badge,products.spicy,products.active,
      ${outletId ? '$2::integer' : 'NULL::integer'} AS "outletId",assignments.product_id IS NOT NULL AS "outletAssigned",
      COALESCE(assignments.active,FALSE) AS "outletActive",COALESCE(assignments.available,FALSE) AS "outletAvailable",
      assignments.price_override AS "priceOverride"
    FROM products ${assignmentJoin} WHERE products.id=$1
  `, values)
  return row ? mapProduct(row, true, database, useEffectivePrice) : undefined
}

const saveProductAddons = async (database: Queryable, productId: number, addons: ProductAddonInput[]) => {
  const existing = await rows(database, 'SELECT id FROM product_addons WHERE product_id=$1', [productId])
  const existingIds = new Set(existing.map((row) => numberValue(row.id)))
  const keptIds: number[] = []
  for (const addon of addons) {
    if (addon.id && existingIds.has(addon.id)) {
      const row = await first(database, `UPDATE product_addons SET name=$1,price=$2,active=$3,updated_at=CURRENT_TIMESTAMP WHERE id=$4 AND product_id=$5 RETURNING id`, [addon.name, addon.price, addon.active, addon.id, productId])
      if (row) keptIds.push(numberValue(row.id))
    } else {
      const row = await first(database, 'INSERT INTO product_addons (product_id,name,price,active) VALUES ($1,$2,$3,$4) RETURNING id', [productId, addon.name, addon.price, addon.active])
      keptIds.push(numberValue(row.id))
    }
  }
  if (keptIds.length) await database.query('DELETE FROM product_addons WHERE product_id=$1 AND NOT (id=ANY($2::int[]))', [productId, keptIds])
  else await database.query('DELETE FROM product_addons WHERE product_id=$1', [productId])
}

export async function createProduct(input: ProductInput, outletId?: number) {
  await initialize()
  const id = await transaction(async (client) => {
    const row = await first(client, `
      INSERT INTO products (name,description,price,original_price,category,emoji,image_url,tone,badge,spicy,active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id
    `, [input.name, input.description, input.price, input.originalPrice ?? null, input.category, input.emoji, input.imageUrl ?? null, input.tone, input.badge ?? null, input.spicy, input.active])
    const productId = numberValue(row.id)
    await saveProductAddons(client, productId, input.addons)
    if (outletId) {
      await client.query('INSERT INTO outlet_products (outlet_id,product_id,active,available) VALUES ($1,$2,TRUE,TRUE) ON CONFLICT (outlet_id,product_id) DO NOTHING', [outletId, productId])
    }
    return productId
  })
  return getProductById(id, pool, outletId)
}

export async function updateProduct(id: number, input: ProductInput) {
  await initialize()
  const updated = await transaction(async (client) => {
    const result = await client.query(`
      UPDATE products SET name=$1,description=$2,price=$3,original_price=$4,category=$5,emoji=$6,image_url=$7,
        tone=$8,badge=$9,spicy=$10,active=$11,updated_at=CURRENT_TIMESTAMP WHERE id=$12
    `, [input.name, input.description, input.price, input.originalPrice ?? null, input.category, input.emoji, input.imageUrl ?? null, input.tone, input.badge ?? null, input.spicy, input.active, id])
    if (!result.rowCount) return false
    await saveProductAddons(client, id, input.addons)
    return true
  })
  return updated ? getProductById(id) : undefined
}

export async function setProductActive(id: number, active: boolean) {
  await initialize()
  const result = await pool.query('UPDATE products SET active=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2', [active, id])
  return result.rowCount ? getProductById(id) : undefined
}

export async function setProductOutletAssignment(outletId: number, productId: number, input: ProductOutletAssignmentInput) {
  await initialize()
  const product = await first(pool, 'SELECT id FROM products WHERE id=$1', [productId])
  if (!product) return undefined
  if (!input.assigned) {
    await pool.query('DELETE FROM outlet_products WHERE outlet_id=$1 AND product_id=$2', [outletId, productId])
    return getProductById(productId, pool, outletId)
  }
  await pool.query(`
    INSERT INTO outlet_products (outlet_id,product_id,price_override,active,available,updated_at)
    VALUES ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP)
    ON CONFLICT (outlet_id,product_id) DO UPDATE SET
      price_override=EXCLUDED.price_override,active=EXCLUDED.active,available=EXCLUDED.available,updated_at=CURRENT_TIMESTAMP
  `, [outletId, productId, input.priceOverride ?? null, input.active, input.available])
  return getProductById(productId, pool, outletId)
}

export async function deleteProduct(id: number) {
  await initialize()
  const usage = await first<{ count: string }>(pool, 'SELECT COUNT(*) AS count FROM order_items WHERE product_id=$1', [id])
  if (numberValue(usage.count) > 0) {
    await setProductActive(id, false)
    return { deleted: false, archived: true }
  }
  return { deleted: (await pool.query('DELETE FROM products WHERE id=$1', [id])).rowCount! > 0, archived: false }
}

const mapPromotion = (row: Record<string, unknown>): PromotionRecord => ({
  id: numberValue(row.id), title: String(row.title), description: String(row.description), code: String(row.code),
  discountType: row.discountType as PromotionRecord['discountType'], discountValue: numberValue(row.discountValue),
  minOrder: numberValue(row.minOrder), startDate: row.startDate ? dateValue(row.startDate) : undefined,
  endDate: row.endDate ? dateValue(row.endDate) : undefined, active: Boolean(row.active),
})

export async function getPromotions(includeInactive = false, database: Queryable = pool) {
  await initialize()
  const promotionRows = await rows(database, `
    SELECT id,title,description,code,discount_type AS "discountType",discount_value AS "discountValue",
      min_order AS "minOrder",start_date AS "startDate",end_date AS "endDate",active
    FROM promotions
    ${includeInactive ? '' : 'WHERE active=TRUE AND (start_date IS NULL OR start_date<=CURRENT_DATE) AND (end_date IS NULL OR end_date>=CURRENT_DATE)'}
    ORDER BY active DESC,id DESC
  `)
  return promotionRows.map(mapPromotion)
}

const getPromotionById = async (id: number, database: Queryable = pool) => {
  const row = await first(database, `SELECT id,title,description,code,discount_type AS "discountType",discount_value AS "discountValue",min_order AS "minOrder",start_date AS "startDate",end_date AS "endDate",active FROM promotions WHERE id=$1`, [id])
  return row ? mapPromotion(row) : undefined
}

const getActivePromotionByCode = async (code: string, database: Queryable = pool) => {
  const row = await first(database, `
    SELECT id,title,description,code,discount_type AS "discountType",discount_value AS "discountValue",min_order AS "minOrder",start_date AS "startDate",end_date AS "endDate",active
    FROM promotions WHERE UPPER(code)=UPPER($1) AND active=TRUE
      AND (start_date IS NULL OR start_date<=CURRENT_DATE) AND (end_date IS NULL OR end_date>=CURRENT_DATE)
  `, [code])
  return row ? mapPromotion(row) : undefined
}

export async function createPromotion(input: Omit<PromotionRecord, 'id'>) {
  await initialize()
  const row = await first(pool, `
    INSERT INTO promotions (title,description,code,discount_type,discount_value,min_order,start_date,end_date,active)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id
  `, [input.title, input.description, input.code.toUpperCase(), input.discountType, input.discountValue, input.minOrder, input.startDate || null, input.endDate || null, input.active])
  return (await getPromotionById(numberValue(row.id)))!
}

export async function updatePromotion(id: number, input: Omit<PromotionRecord, 'id'>) {
  await initialize()
  const result = await pool.query(`
    UPDATE promotions SET title=$1,description=$2,code=$3,discount_type=$4,discount_value=$5,min_order=$6,
      start_date=$7,end_date=$8,active=$9,updated_at=CURRENT_TIMESTAMP WHERE id=$10
  `, [input.title, input.description, input.code.toUpperCase(), input.discountType, input.discountValue, input.minOrder, input.startDate || null, input.endDate || null, input.active, id])
  return result.rowCount ? getPromotionById(id) : undefined
}

export async function deletePromotion(id: number) {
  await initialize()
  return (await pool.query('DELETE FROM promotions WHERE id=$1', [id])).rowCount! > 0
}

const mapOrderRow = (row: Record<string, unknown>): Omit<OrderRecord, 'items'> => ({
  id: String(row.id), customerId: row.customerId === null ? undefined : numberValue(row.customerId), outletId: numberValue(row.outletId), outletName: String(row.outletName), customerName: String(row.customerName),
  phone: String(row.phone), address: row.address ? String(row.address) : undefined, note: row.note ? String(row.note) : undefined,
  deliveryMethod: row.deliveryMethod as OrderRecord['deliveryMethod'], paymentMethod: row.paymentMethod as PaymentMethod,
  paymentStatus: (row.paymentStatus || 'unpaid') as PaymentStatus,
  paymentProvider: row.paymentProvider ? String(row.paymentProvider) : undefined,
  paymentRedirectUrl: row.paymentRedirectUrl ? String(row.paymentRedirectUrl) : undefined,
  status: String(row.status), subtotal: numberValue(row.subtotal), discountAmount: numberValue(row.discountAmount),
  promoCode: row.promoCode ? String(row.promoCode) : undefined, deliveryFee: numberValue(row.deliveryFee), total: numberValue(row.total),
  createdAt: isoValue(row.createdAt),
})

const orderSelect = `SELECT orders.id,orders.customer_id AS "customerId",orders.outlet_id AS "outletId",outlets.name AS "outletName",
  orders.customer_name AS "customerName",orders.phone,orders.address,orders.note,orders.delivery_method AS "deliveryMethod",
  orders.payment_method AS "paymentMethod",orders.status,orders.subtotal,orders.discount_amount AS "discountAmount",
  orders.promo_code AS "promoCode",orders.delivery_fee AS "deliveryFee",orders.total,orders.created_at AS "createdAt",
  payments.status AS "paymentStatus",payments.provider AS "paymentProvider",payments.redirect_url AS "paymentRedirectUrl"
  FROM orders JOIN outlets ON outlets.id=orders.outlet_id LEFT JOIN payments ON payments.order_id=orders.id`

export async function getOrderById(id: string, database: Queryable = pool) {
  await initialize()
  const orderRow = await first(database, `${orderSelect} WHERE orders.id=$1`, [id])
  if (!orderRow) return undefined
  const itemRows = await rows(database, `SELECT product_id AS "productId",product_name AS "productName",quantity,unit_price AS "unitPrice",addons_json AS addons FROM order_items WHERE order_id=$1 ORDER BY id ASC`, [id])
  const items = itemRows.map((item) => ({
    productId: numberValue(item.productId), productName: String(item.productName), quantity: numberValue(item.quantity),
    unitPrice: numberValue(item.unitPrice), addons: Array.isArray(item.addons) ? item.addons as OrderRecord['items'][number]['addons'] : [],
  }))
  return { ...mapOrderRow(orderRow), items }
}

export async function createOrder(input: NewOrderInput) {
  await initialize()
  const id = await transaction(async (client) => {
    const selectedProducts = [] as Array<NewOrderInput['items'][number] & { product: ProductRecord; addons: ProductAddonRecord[] }>
    for (const item of input.items) {
      const product = await getProductById(item.productId, client, input.outletId, true)
      if (!product?.active) throw new Error(`Produk ${item.productId} tidak tersedia`)
      if (!product.outletAssignment?.assigned || !product.outletAssignment.active || !product.outletAssignment.available) {
        throw new Error(`Produk ${product.name} tidak tersedia di outlet yang dipilih.`)
      }
      const categoryRow = await first(client, 'SELECT active FROM menu_categories WHERE LOWER(label) = LOWER($1)', [product.category])
      if (!categoryRow || !categoryRow.active) throw new Error(`Produk ${product.name} tidak tersedia karena kategorinya nonaktif.`)
      const addonIds = [...new Set(item.addonIds || [])]
      const addons = addonIds.map((addonId) => product.addons.find((addon) => addon.id === addonId && addon.active))
      if (addons.some((addon) => !addon)) throw new Error(`Add-on untuk ${product.name} sudah tidak tersedia`)
      selectedProducts.push({ ...item, product, addons: addons as ProductAddonRecord[] })
    }
    const subtotal = selectedProducts.reduce((sum, item) => sum + (item.product.price + item.addons.reduce((addonSum, addon) => addonSum + addon.price, 0)) * item.quantity, 0)
    const promotion = input.promoCode ? await getActivePromotionByCode(input.promoCode, client) : undefined
    if (input.promoCode && !promotion) throw new Error('Kode promo tidak tersedia atau sudah berakhir.')
    if (promotion && subtotal < promotion.minOrder) throw new Error(`Minimum belanja untuk promo ${promotion.code} belum terpenuhi.`)
    const discountAmount = promotion ? promotion.discountType === 'percentage' ? Math.floor(subtotal * promotion.discountValue / 100) : Math.min(subtotal, promotion.discountValue) : 0
    const deliveryFee = input.deliveryMethod === 'delivery' && subtotal < 75000 ? 9000 : 0
    const total = Math.max(0, subtotal - discountAmount) + deliveryFee
    const prefix = (await getFranchiseSettings(client)).orderPrefix
    const orderId = `${prefix}-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`

    await client.query(`
      INSERT INTO orders (id,customer_id,outlet_id,customer_name,phone,address,note,delivery_method,payment_method,subtotal,discount_amount,promo_code,delivery_fee,total)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    `, [orderId, input.customerId, input.outletId, input.customerName, input.phone, input.address || null, input.note || null, input.deliveryMethod, input.paymentMethod, subtotal, discountAmount, promotion?.code || null, deliveryFee, total])

    for (const item of selectedProducts) {
      const unitPrice = item.product.price + item.addons.reduce((sum, addon) => sum + addon.price, 0)
      await client.query(`INSERT INTO order_items (order_id,product_id,product_name,quantity,unit_price,addons_json) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`, [orderId, item.product.id, item.product.name, item.quantity, unitPrice, JSON.stringify(item.addons.map(({ id: addonId, name, price }) => ({ id: addonId, name, price })))])
    }

    const soldByProduct = new Map<number, number>()
    selectedProducts.forEach((item) => soldByProduct.set(item.product.id, (soldByProduct.get(item.product.id) || 0) + item.quantity))
    for (const [productId, soldQuantity] of soldByProduct) {
      const inventoryRows = await rows(client, `SELECT id,name,current_stock AS "currentStock",usage_per_sale AS "usagePerSale" FROM inventory_items WHERE linked_product_id=$1 AND outlet_id=$2 AND active=TRUE FOR UPDATE`, [productId, input.outletId])
      for (const inventory of inventoryRows) {
        const usedQuantity = soldQuantity * numberValue(inventory.usagePerSale)
        const currentStock = numberValue(inventory.currentStock)
        const nextStock = currentStock - usedQuantity
        if (nextStock < 0) throw new Error(`Stok ${inventory.name} tidak mencukupi untuk pesanan ini.`)
        await client.query('UPDATE inventory_items SET current_stock=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2', [nextStock, inventory.id])
        await client.query(`INSERT INTO stock_movements (item_id,type,quantity,stock_before,stock_after,note,created_by) VALUES ($1,'out',$2,$3,$4,$5,NULL)`, [inventory.id, usedQuantity, currentStock, nextStock, `Otomatis dari pesanan ${orderId}`])
      }
    }
    return orderId
  })
  return getOrderById(id)
}

export async function getOrders(outletId: number) {
  await initialize()
  const orderRows = await rows(pool, `${orderSelect} WHERE orders.outlet_id=$1 ORDER BY orders.created_at DESC`, [outletId])
  return Promise.all(orderRows.map((row) => getOrderById(String(row.id)))) as Promise<OrderRecord[]>
}

export async function getCustomerOrders(customerId: number) {
  await initialize()
  const idRows = await rows(pool, 'SELECT id FROM orders WHERE customer_id=$1 ORDER BY created_at DESC', [customerId])
  return Promise.all(idRows.map((row) => getOrderById(String(row.id)))) as Promise<OrderRecord[]>
}

export async function getOrderPaymentTarget(orderId: string, customerId?: number) {
  await initialize()
  return first(pool, `SELECT orders.id,orders.customer_id AS "customerId",orders.customer_name AS "customerName",users.email,
    orders.phone,orders.total,orders.payment_method AS "paymentMethod",orders.status
    FROM orders LEFT JOIN users ON users.id=orders.customer_id
    WHERE orders.id=$1 ${customerId ? 'AND orders.customer_id=$2' : ''}`, customerId ? [orderId, customerId] : [orderId])
}

export async function savePaymentSession(input: PaymentSessionRecord & { grossAmount: number; rawResponse?: unknown }) {
  await initialize()
  await pool.query(`
    INSERT INTO payments (order_id,provider,status,token,redirect_url,gross_amount,raw_response)
    VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
    ON CONFLICT (order_id) DO UPDATE SET provider=EXCLUDED.provider,status=EXCLUDED.status,token=EXCLUDED.token,
      redirect_url=EXCLUDED.redirect_url,gross_amount=EXCLUDED.gross_amount,raw_response=EXCLUDED.raw_response,updated_at=CURRENT_TIMESTAMP
  `, [input.orderId, input.provider, input.status, input.token || null, input.redirectUrl || null, input.grossAmount, JSON.stringify(input.rawResponse || {})])
  return getPaymentSession(input.orderId)
}

export async function getPaymentSession(orderId: string, customerId?: number): Promise<PaymentSessionRecord | undefined> {
  await initialize()
  const row = await first(pool, `SELECT payments.order_id AS "orderId",payments.provider,payments.status,payments.redirect_url AS "redirectUrl",payments.token
    FROM payments JOIN orders ON orders.id=payments.order_id WHERE payments.order_id=$1 ${customerId ? 'AND orders.customer_id=$2' : ''}`, customerId ? [orderId, customerId] : [orderId])
  return row ? { orderId: String(row.orderId), provider: row.provider as PaymentSessionRecord['provider'], status: row.status as PaymentStatus, redirectUrl: row.redirectUrl ? String(row.redirectUrl) : undefined, token: row.token ? String(row.token) : undefined } : undefined
}

export async function updatePaymentStatus(orderId: string, status: PaymentStatus, detail: { transactionId?: string; paymentType?: string; rawResponse?: unknown } = {}) {
  await initialize()
  const row = await first(pool, `UPDATE payments SET status=$1,transaction_id=COALESCE($2,transaction_id),payment_type=COALESCE($3,payment_type),
    raw_response=$4::jsonb,paid_at=CASE WHEN $1='paid' THEN COALESCE(paid_at,CURRENT_TIMESTAMP) ELSE paid_at END,updated_at=CURRENT_TIMESTAMP
    WHERE order_id=$5 RETURNING order_id AS "orderId"`, [status, detail.transactionId || null, detail.paymentType || null, JSON.stringify(detail.rawResponse || {}), orderId])
  if (!row) return undefined
  if (status === 'failed' || status === 'expired') await updateOrderStatus(orderId, 'cancelled')
  return getPaymentSession(orderId)
}

export async function updateOrderStatus(id: string, status: string, outletId?: number) {
  await initialize()
  const resultOrder = await transaction(async (client) => {
    const order = await first(client, `SELECT orders.status,orders.outlet_id AS "outletId",orders.payment_method AS "paymentMethod",payments.status AS "paymentStatus" FROM orders LEFT JOIN payments ON payments.order_id=orders.id WHERE orders.id=$1 ${outletId ? 'AND orders.outlet_id=$2' : ''} FOR UPDATE OF orders`, outletId ? [id, outletId] : [id])
    if (!order) return undefined
    const oldStatus = String(order.status)
    if (status !== 'cancelled' && order.paymentMethod !== 'cash' && order.paymentStatus !== 'paid') throw new Error('Pesanan online belum dibayar dan belum dapat diproses.')
    if (oldStatus === status) {
      return getOrderById(id, client)
    }

    await client.query('UPDATE orders SET status=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2', [status, id])

    if (oldStatus !== 'cancelled' && status === 'cancelled') {
      const orderItems = await rows(client, 'SELECT product_id AS "productId", quantity FROM order_items WHERE order_id=$1', [id])
      for (const item of orderItems) {
        const productId = numberValue(item.productId)
        const quantity = numberValue(item.quantity)
        if (!productId) continue
        const inventoryItems = await rows(client, 'SELECT id, name, current_stock AS "currentStock", usage_per_sale AS "usagePerSale" FROM inventory_items WHERE linked_product_id=$1 AND outlet_id=$2 AND active=TRUE FOR UPDATE', [productId, order.outletId])
        for (const inv of inventoryItems) {
          const refundQty = quantity * numberValue(inv.usagePerSale)
          const currentStock = numberValue(inv.currentStock)
          const nextStock = currentStock + refundQty
          await client.query('UPDATE inventory_items SET current_stock=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2', [nextStock, inv.id])
          await client.query(`INSERT INTO stock_movements (item_id,type,quantity,stock_before,stock_after,note,created_by) VALUES ($1,'in',$2,$3,$4,$5,NULL)`, [inv.id, refundQty, currentStock, nextStock, `Pengembalian otomatis dari pembatalan pesanan ${id}`])
        }
      }
    } else if (oldStatus === 'cancelled' && status !== 'cancelled') {
      const orderItems = await rows(client, 'SELECT product_id AS "productId", quantity FROM order_items WHERE order_id=$1', [id])
      for (const item of orderItems) {
        const productId = numberValue(item.productId)
        const quantity = numberValue(item.quantity)
        if (!productId) continue
        const inventoryItems = await rows(client, 'SELECT id, name, current_stock AS "currentStock", usage_per_sale AS "usagePerSale" FROM inventory_items WHERE linked_product_id=$1 AND outlet_id=$2 AND active=TRUE FOR UPDATE', [productId, order.outletId])
        for (const inv of inventoryItems) {
          const deductQty = quantity * numberValue(inv.usagePerSale)
          const currentStock = numberValue(inv.currentStock)
          const nextStock = currentStock - deductQty
          if (nextStock < 0) {
            throw new Error(`Stok ${inv.name} tidak mencukupi untuk memulihkan pesanan ini.`)
          }
          await client.query('UPDATE inventory_items SET current_stock=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2', [nextStock, inv.id])
          await client.query(`INSERT INTO stock_movements (item_id,type,quantity,stock_before,stock_after,note,created_by) VALUES ($1,'out',$2,$3,$4,$5,NULL)`, [inv.id, deductQty, currentStock, nextStock, `Pengurangan otomatis dari pemulihan pesanan ${id}`])
        }
      }
    }
    return getOrderById(id, client)
  })
  return resultOrder
}

export async function getDashboardStats(outletId: number) {
  await initialize()
  const totals = await first(pool, `SELECT COUNT(*) AS "totalOrders",COALESCE(SUM(CASE WHEN status!='cancelled' AND (payment_method='cash' OR EXISTS (SELECT 1 FROM payments WHERE payments.order_id=orders.id AND payments.status='paid')) THEN total ELSE 0 END),0) AS revenue,COALESCE(SUM(CASE WHEN status IN ('new','preparing','ready','delivering') THEN 1 ELSE 0 END),0) AS "activeOrders" FROM orders WHERE outlet_id=$1`, [outletId])
  const products = await first<{ count: string }>(pool, `SELECT COUNT(*) AS count FROM outlet_products assignments JOIN products ON products.id=assignments.product_id WHERE assignments.outlet_id=$1 AND assignments.active=TRUE AND assignments.available=TRUE AND products.active=TRUE`, [outletId])
  return { totalOrders: numberValue(totals.totalOrders), revenue: numberValue(totals.revenue), activeOrders: numberValue(totals.activeOrders), activeProducts: numberValue(products.count) }
}

const mapInventoryItem = (row: Record<string, unknown>): InventoryItemRecord => ({
  id: numberValue(row.id), outletId: numberValue(row.outletId), name: String(row.name), sku: String(row.sku), unit: String(row.unit),
  currentStock: numberValue(row.currentStock), minimumStock: numberValue(row.minimumStock), unitCost: numberValue(row.unitCost),
  linkedProductId: row.linkedProductId === null ? undefined : numberValue(row.linkedProductId),
  linkedProductName: row.linkedProductName ? String(row.linkedProductName) : undefined,
  usagePerSale: numberValue(row.usagePerSale), active: Boolean(row.active),
  lowStock: numberValue(row.currentStock) <= numberValue(row.minimumStock),
})

export async function getInventoryItems(outletId: number, includeInactive = true, database: Queryable = pool) {
  await initialize()
  const itemRows = await rows(database, `
    SELECT items.id,items.outlet_id AS "outletId",items.name,items.sku,items.unit,items.current_stock AS "currentStock",items.minimum_stock AS "minimumStock",
      items.unit_cost AS "unitCost",items.linked_product_id AS "linkedProductId",products.name AS "linkedProductName",
      items.usage_per_sale AS "usagePerSale",items.active
    FROM inventory_items items LEFT JOIN products ON products.id=items.linked_product_id
    WHERE items.outlet_id=$1 ${includeInactive ? '' : 'AND items.active=TRUE'} ORDER BY items.active DESC,items.name ASC
  `, [outletId])
  return itemRows.map(mapInventoryItem)
}

const mapStockMovement = (row: Record<string, unknown>): StockMovementRecord => ({
  id: numberValue(row.id), itemId: numberValue(row.itemId), itemName: String(row.itemName), sku: String(row.sku), unit: String(row.unit),
  type: row.type as StockMovementType, quantity: numberValue(row.quantity), stockBefore: numberValue(row.stockBefore), stockAfter: numberValue(row.stockAfter),
  note: row.note ? String(row.note) : undefined, createdByName: row.createdByName ? String(row.createdByName) : undefined, createdAt: isoValue(row.createdAt),
})

export async function getStockMovements(outletId: number, limit = 100, database: Queryable = pool) {
  await initialize()
  const movementRows = await rows(database, `
    SELECT movements.id,movements.item_id AS "itemId",items.name AS "itemName",items.sku,items.unit,movements.type,
      movements.quantity,movements.stock_before AS "stockBefore",movements.stock_after AS "stockAfter",movements.note,
      users.name AS "createdByName",movements.created_at AS "createdAt"
    FROM stock_movements movements JOIN inventory_items items ON items.id=movements.item_id
    LEFT JOIN users ON users.id=movements.created_by WHERE items.outlet_id=$1 ORDER BY movements.id DESC LIMIT $2
  `, [outletId, Math.max(1, Math.min(500, limit))])
  return movementRows.map(mapStockMovement)
}

export async function getInventorySnapshot(outletId: number) {
  await initialize()
  const [items, movements, today] = await Promise.all([
    getInventoryItems(outletId, true), getStockMovements(outletId),
    first<{ count: string }>(pool, 'SELECT COUNT(*) AS count FROM stock_movements movements JOIN inventory_items items ON items.id=movements.item_id WHERE items.outlet_id=$1 AND movements.created_at::date=CURRENT_DATE', [outletId]),
  ])
  return { items, movements, summary: { activeItems: items.filter((item) => item.active).length, lowStockItems: items.filter((item) => item.active && item.lowStock).length, movementsToday: numberValue(today.count) } }
}

export async function createInventoryItem(outletId: number, input: { name: string; sku: string; unit: string; initialStock: number; minimumStock: number; unitCost: number; linkedProductId?: number; usagePerSale: number; active: boolean }, actorId?: number) {
  await initialize()
  const id = await transaction(async (client) => {
    const row = await first(client, `
      INSERT INTO inventory_items (outlet_id,name,sku,unit,current_stock,minimum_stock,unit_cost,linked_product_id,usage_per_sale,active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id
    `, [outletId, input.name, input.sku.toUpperCase(), input.unit, input.initialStock, input.minimumStock, input.unitCost, input.linkedProductId ?? null, input.usagePerSale, input.active])
    const itemId = numberValue(row.id)
    if (input.initialStock > 0) await client.query(`INSERT INTO stock_movements (item_id,type,quantity,stock_before,stock_after,note,created_by) VALUES ($1,'in',$2,0,$2,'Stok awal',$3)`, [itemId, input.initialStock, actorId ?? null])
    return itemId
  })
  return (await getInventoryItems(outletId, true)).find((item) => item.id === id)
}

export async function updateInventoryItem(outletId: number, id: number, input: { name: string; sku: string; unit: string; minimumStock: number; unitCost: number; linkedProductId?: number; usagePerSale: number; active: boolean }) {
  await initialize()
  const result = await pool.query(`
    UPDATE inventory_items SET name=$1,sku=$2,unit=$3,minimum_stock=$4,unit_cost=$5,linked_product_id=$6,
      usage_per_sale=$7,active=$8,updated_at=CURRENT_TIMESTAMP WHERE id=$9 AND outlet_id=$10
  `, [input.name, input.sku.toUpperCase(), input.unit, input.minimumStock, input.unitCost, input.linkedProductId ?? null, input.usagePerSale, input.active, id, outletId])
  return result.rowCount ? (await getInventoryItems(outletId, true)).find((item) => item.id === id) : undefined
}

export async function deleteInventoryItem(outletId: number, id: number) {
  await initialize()
  const count = await first<{ count: string }>(pool, 'SELECT COUNT(*) AS count FROM stock_movements movements JOIN inventory_items items ON items.id=movements.item_id WHERE movements.item_id=$1 AND items.outlet_id=$2', [id, outletId])
  if (numberValue(count.count) > 0) return { deleted: false, archived: (await pool.query('UPDATE inventory_items SET active=FALSE,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND outlet_id=$2', [id, outletId])).rowCount! > 0 }
  return { deleted: (await pool.query('DELETE FROM inventory_items WHERE id=$1 AND outlet_id=$2', [id, outletId])).rowCount! > 0, archived: false }
}

export async function createStockMovement(outletId: number, input: { itemId: number; type: StockMovementType; quantity: number; note?: string }, actorId?: number) {
  await initialize()
  const movementId = await transaction(async (client) => {
    const item = await first(client, 'SELECT id,current_stock AS "currentStock",active FROM inventory_items WHERE id=$1 AND outlet_id=$2 FOR UPDATE', [input.itemId, outletId])
    if (!item) throw new Error('Item inventory tidak ditemukan.')
    if (!item.active) throw new Error('Item inventory sedang nonaktif.')
    const currentStock = numberValue(item.currentStock)
    const subtract = input.type === 'out' || input.type === 'adjustment_subtract'
    const nextStock = currentStock + (subtract ? -input.quantity : input.quantity)
    if (nextStock < 0) throw new Error('Stok tidak mencukupi untuk pergerakan ini.')
    await client.query('UPDATE inventory_items SET current_stock=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2', [nextStock, input.itemId])
    const row = await first(client, `INSERT INTO stock_movements (item_id,type,quantity,stock_before,stock_after,note,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [input.itemId, input.type, input.quantity, currentStock, nextStock, input.note || null, actorId ?? null])
    return numberValue(row.id)
  })
  return (await getStockMovements(outletId, 500)).find((movement) => movement.id === movementId)
}

const mapFinancialEntry = (row: Record<string, unknown>): FinancialEntryRecord => ({
  id: numberValue(row.id), type: row.type as FinancialEntryType, category: String(row.category), amount: numberValue(row.amount),
  paymentMethod: row.paymentMethod as PaymentMethod, note: row.note ? String(row.note) : undefined,
  entryDate: dateValue(row.entryDate), createdByName: row.createdByName ? String(row.createdByName) : undefined, createdAt: isoValue(row.createdAt),
})

export async function getFinancialEntries(outletId: number, from: string, to: string, database: Queryable = pool) {
  await initialize()
  const entryRows = await rows(database, `
    SELECT entries.id,entries.type,entries.category,entries.amount,entries.payment_method AS "paymentMethod",entries.note,
      entries.entry_date AS "entryDate",users.name AS "createdByName",entries.created_at AS "createdAt"
    FROM financial_entries entries LEFT JOIN users ON users.id=entries.created_by
    WHERE entries.outlet_id=$1 AND entries.entry_date BETWEEN $2 AND $3 ORDER BY entries.entry_date DESC,entries.id DESC
  `, [outletId, from, to])
  return entryRows.map(mapFinancialEntry)
}

export async function createFinancialEntry(outletId: number, input: { type: FinancialEntryType; category: string; amount: number; paymentMethod: PaymentMethod; note?: string; entryDate: string }, actorId?: number) {
  await initialize()
  const row = await first(pool, `
    INSERT INTO financial_entries (outlet_id,type,category,amount,payment_method,note,entry_date,created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id
  `, [outletId, input.type, input.category, input.amount, input.paymentMethod, input.note || null, input.entryDate, actorId ?? null])
  const entry = await first(pool, `
    SELECT entries.id,entries.type,entries.category,entries.amount,entries.payment_method AS "paymentMethod",entries.note,
      entries.entry_date AS "entryDate",users.name AS "createdByName",entries.created_at AS "createdAt"
    FROM financial_entries entries LEFT JOIN users ON users.id=entries.created_by WHERE entries.id=$1 AND entries.outlet_id=$2
  `, [row.id, outletId])
  return mapFinancialEntry(entry)
}

export async function deleteFinancialEntry(outletId: number, id: number) {
  await initialize()
  return (await pool.query('DELETE FROM financial_entries WHERE id=$1 AND outlet_id=$2', [id, outletId])).rowCount! > 0
}

export async function getReportData(outletId: number, from: string, to: string) {
  await initialize()
  const [summaryRow, itemsSoldRow, dailyRows, topRows, paymentRows, customerRows, cogsRow, entries, expenseRows, allTimeSales, allTimeEntries, inventoryItems] = await Promise.all([
    first(pool, `SELECT COUNT(*) AS transactions,COALESCE(SUM(subtotal),0) AS "grossSales",COALESCE(SUM(discount_amount),0) AS discounts,COALESCE(SUM(total),0) AS "netRevenue",COALESCE(AVG(total),0) AS "averageOrder" FROM orders WHERE outlet_id=$1 AND status!='cancelled' AND (payment_method='cash' OR EXISTS (SELECT 1 FROM payments WHERE payments.order_id=orders.id AND payments.status='paid')) AND created_at::date BETWEEN $2 AND $3`, [outletId, from, to]),
    first(pool, `SELECT COALESCE(SUM(items.quantity),0) AS count FROM order_items items JOIN orders ON orders.id=items.order_id WHERE orders.outlet_id=$1 AND orders.status!='cancelled' AND (orders.payment_method='cash' OR EXISTS (SELECT 1 FROM payments WHERE payments.order_id=orders.id AND payments.status='paid')) AND orders.created_at::date BETWEEN $2 AND $3`, [outletId, from, to]),
    rows(pool, `
      WITH order_daily AS (
        SELECT created_at::date AS date,COUNT(*) AS transactions,SUM(subtotal) AS "grossSales",SUM(discount_amount) AS discounts,SUM(total) AS revenue
        FROM orders WHERE outlet_id=$1 AND status!='cancelled' AND (payment_method='cash' OR EXISTS (SELECT 1 FROM payments WHERE payments.order_id=orders.id AND payments.status='paid')) AND created_at::date BETWEEN $2 AND $3 GROUP BY created_at::date
      ), item_daily AS (
        SELECT orders.created_at::date AS date,SUM(items.quantity) AS "itemsSold" FROM orders JOIN order_items items ON items.order_id=orders.id
        WHERE orders.outlet_id=$1 AND orders.status!='cancelled' AND (orders.payment_method='cash' OR EXISTS (SELECT 1 FROM payments WHERE payments.order_id=orders.id AND payments.status='paid')) AND orders.created_at::date BETWEEN $2 AND $3 GROUP BY orders.created_at::date
      )
      SELECT order_daily.*,COALESCE(item_daily."itemsSold",0) AS "itemsSold" FROM order_daily LEFT JOIN item_daily USING(date) ORDER BY date DESC
    `, [outletId, from, to]),
    rows(pool, `SELECT items.product_id AS "productId",items.product_name AS "productName",SUM(items.quantity) AS quantity,SUM(items.quantity*items.unit_price) AS revenue FROM order_items items JOIN orders ON orders.id=items.order_id WHERE orders.outlet_id=$1 AND orders.status!='cancelled' AND (orders.payment_method='cash' OR EXISTS (SELECT 1 FROM payments WHERE payments.order_id=orders.id AND payments.status='paid')) AND orders.created_at::date BETWEEN $2 AND $3 GROUP BY items.product_id,items.product_name ORDER BY quantity DESC,revenue DESC LIMIT 20`, [outletId, from, to]),
    rows(pool, `SELECT payment_method AS "paymentMethod",COUNT(*) AS transactions,COALESCE(SUM(total),0) AS revenue FROM orders WHERE outlet_id=$1 AND status!='cancelled' AND (payment_method='cash' OR EXISTS (SELECT 1 FROM payments WHERE payments.order_id=orders.id AND payments.status='paid')) AND created_at::date BETWEEN $2 AND $3 GROUP BY payment_method ORDER BY revenue DESC`, [outletId, from, to]),
    rows(pool, `SELECT users.id AS "customerId",users.name,users.email,COUNT(orders.id) AS "orderCount",COALESCE(SUM(orders.total),0) AS "totalSpent",MAX(orders.created_at) AS "lastOrder" FROM users JOIN orders ON orders.customer_id=users.id WHERE orders.outlet_id=$1 AND users.role='customer' AND orders.status!='cancelled' AND (orders.payment_method='cash' OR EXISTS (SELECT 1 FROM payments WHERE payments.order_id=orders.id AND payments.status='paid')) AND orders.created_at::date BETWEEN $2 AND $3 GROUP BY users.id,users.name,users.email ORDER BY "totalSpent" DESC`, [outletId, from, to]),
    first(pool, `
      SELECT COALESCE(SUM(items.quantity * inv.usage_per_sale * inv.unit_cost), 0) AS total
      FROM order_items items
      JOIN orders ON orders.id = items.order_id
      JOIN inventory_items inv ON inv.linked_product_id = items.product_id AND inv.outlet_id=orders.outlet_id
      WHERE orders.outlet_id=$1 AND orders.status != 'cancelled' AND (orders.payment_method='cash' OR EXISTS (SELECT 1 FROM payments WHERE payments.order_id=orders.id AND payments.status='paid')) AND orders.created_at::date BETWEEN $2 AND $3
    `, [outletId, from, to]),
    getFinancialEntries(outletId, from, to),
    rows(pool, `SELECT category,SUM(amount) AS amount FROM financial_entries WHERE outlet_id=$1 AND type='expense' AND entry_date BETWEEN $2 AND $3 GROUP BY category ORDER BY amount DESC`, [outletId, from, to]),
    first(pool, "SELECT COALESCE(SUM(total),0) AS amount FROM orders WHERE outlet_id=$1 AND status!='cancelled' AND (payment_method='cash' OR EXISTS (SELECT 1 FROM payments WHERE payments.order_id=orders.id AND payments.status='paid'))", [outletId]),
    first(pool, `SELECT COALESCE(SUM(CASE WHEN type='capital_in' THEN amount ELSE 0 END),0) AS "capitalIn",COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS expenses,COALESCE(SUM(CASE WHEN type='capital_out' THEN amount ELSE 0 END),0) AS "capitalOut" FROM financial_entries WHERE outlet_id=$1`, [outletId]),
    getInventoryItems(outletId, true),
  ])

  const summary = { transactions: numberValue(summaryRow.transactions), grossSales: numberValue(summaryRow.grossSales), discounts: numberValue(summaryRow.discounts), netRevenue: numberValue(summaryRow.netRevenue), averageOrder: Math.round(numberValue(summaryRow.averageOrder)), itemsSold: numberValue(itemsSoldRow.count) }
  const dailySales = dailyRows.map((row) => ({ date: dateValue(row.date), transactions: numberValue(row.transactions), itemsSold: numberValue(row.itemsSold), grossSales: numberValue(row.grossSales), discounts: numberValue(row.discounts), revenue: numberValue(row.revenue) }))
  const topProducts = topRows.map((row) => ({ productId: numberValue(row.productId), productName: String(row.productName), quantity: numberValue(row.quantity), revenue: numberValue(row.revenue) }))
  const paymentMethods = paymentRows.map((row) => ({ paymentMethod: row.paymentMethod as PaymentMethod, transactions: numberValue(row.transactions), revenue: numberValue(row.revenue) }))
  const customers = customerRows.map((row) => ({ customerId: numberValue(row.customerId), name: String(row.name), email: String(row.email), orderCount: numberValue(row.orderCount), totalSpent: numberValue(row.totalSpent), lastOrder: isoValue(row.lastOrder) }))
  const expensesByCategory = expenseRows.map((row) => ({ category: String(row.category), amount: numberValue(row.amount) }))
  const expenseTotal = entries.filter((entry) => entry.type === 'expense').reduce((sum, entry) => sum + entry.amount, 0)
  const capitalIn = entries.filter((entry) => entry.type === 'capital_in').reduce((sum, entry) => sum + entry.amount, 0)
  const capitalOut = entries.filter((entry) => entry.type === 'capital_out').reduce((sum, entry) => sum + entry.amount, 0)
  const stockStatus = inventoryItems.map((item) => ({ ...item, stockValue: item.currentStock * item.unitCost }))
  const inventoryValue = stockStatus.filter((item) => item.active).reduce((sum, item) => sum + item.stockValue, 0)
  const cashBalance = numberValue(allTimeSales.amount) + numberValue(allTimeEntries.capitalIn) - numberValue(allTimeEntries.expenses) - numberValue(allTimeEntries.capitalOut)
  const cogs = numberValue(cogsRow.total)
  const grossProfit = summary.netRevenue - cogs
  const netProfit = grossProfit - expenseTotal

  return {
    generatedAt: new Date().toISOString(), period: { from, to },
    operational: { summary, dailySales, topProducts, paymentMethods, stockStatus, customers },
    financial: {
      profitLoss: { revenue: summary.netRevenue, cogs, grossProfit, expenses: expenseTotal, netProfit },
      cashFlow: { salesInflow: summary.netRevenue, capitalIn, totalInflow: summary.netRevenue + capitalIn, expensesOutflow: expenseTotal, capitalOut, totalOutflow: expenseTotal + capitalOut, netCashFlow: summary.netRevenue + capitalIn - expenseTotal - capitalOut },
      balanceSheet: { cashBalance, inventoryValue, totalAssets: cashBalance + inventoryValue, liabilities: 0, equity: cashBalance + inventoryValue },
      equityChanges: { capitalIn, capitalOut, retainedEarnings: netProfit, netChange: capitalIn + netProfit - capitalOut },
      expensesByCategory, entries,
    },
  }
}
