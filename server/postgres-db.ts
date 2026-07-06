import 'dotenv/config'
import { getConnectionString } from '@netlify/database'
import pg, { type PoolClient, type QueryResultRow } from 'pg'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type {
  FinancialEntryRecord,
  FinancialEntryType,
  FranchiseSettingsRecord,
  InventoryItemRecord,
  MenuCategoryRecord,
  NewOrderInput,
  OrderRecord,
  PaymentMethod,
  PermissionModule,
  PermissionModuleMeta,
  PermissionRole,
  ProductAddonInput,
  ProductAddonRecord,
  ProductInput,
  ProductRecord,
  PromotionRecord,
  RolePermissionMatrix,
  StockMovementRecord,
  StockMovementType,
  UserRecord,
  UserRole,
} from './contracts.js'

export const databaseLabel = 'netlify-postgres'

const pool = new pg.Pool({
  connectionString: getConnectionString(),
  max: 5,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 10_000,
})

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
  { key: 'settings', label: 'Franchise', description: 'Pengaturan identitas brand, warna, gambar, kontak, dan konten halaman publik.' },
  { key: 'rbac', label: 'RBAC', description: 'Mengatur hak akses role cashier, manager, dan admin untuk setiap modul.' },
]

const defaultRolePermissions: Record<PermissionRole, PermissionModule[]> = {
  cashier: ['cashier_station'],
  manager: ['cashier_station', 'categories', 'products', 'promotions', 'cashiers', 'inventory', 'reports', 'settings'],
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
    await client.query(await readFile(migrationPath, 'utf8'))
  }

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
})

export async function createUser(input: { name: string; email: string; password: string; role?: UserRole }) {
  await initialize()
  const row = await first(pool, `
    INSERT INTO users (name, email, password_hash, role)
    VALUES ($1, $2, $3, $4)
    RETURNING id, name, email, role, active
  `, [input.name, input.email.toLowerCase(), hashPassword(input.password), input.role || 'customer'])
  return mapUser(row)
}

export async function authenticateUser(email: string, password: string, expectedRole?: UserRole) {
  await initialize()
  const row = await first(pool, `
    SELECT id, name, email, password_hash AS "passwordHash", role, active
    FROM users WHERE LOWER(email) = LOWER($1)
  `, [email])
  if (!row || !row.active || (expectedRole && row.role !== expectedRole) || !verifyPassword(password, String(row.passwordHash))) return undefined
  return mapUser(row)
}

export async function getUserById(id: number) {
  await initialize()
  const row = await first(pool, 'SELECT id, name, email, role, active FROM users WHERE id = $1', [id])
  return row ? mapUser(row) : undefined
}

export async function getCashiers() {
  await initialize()
  return (await rows(pool, "SELECT id, name, email, role, active FROM users WHERE role = 'cashier' ORDER BY id DESC")).map(mapUser)
}

export async function updateCashier(id: number, input: { name: string; email: string; password?: string; active: boolean }) {
  await initialize()
  const row = input.password
    ? await first(pool, `UPDATE users SET name=$1, email=$2, password_hash=$3, active=$4 WHERE id=$5 AND role='cashier' RETURNING id, name, email, role, active`, [input.name, input.email.toLowerCase(), hashPassword(input.password), input.active, id])
    : await first(pool, `UPDATE users SET name=$1, email=$2, active=$3 WHERE id=$4 AND role='cashier' RETURNING id, name, email, role, active`, [input.name, input.email.toLowerCase(), input.active, id])
  return row ? mapUser(row) : undefined
}

export async function deleteCashier(id: number) {
  await initialize()
  return (await pool.query("DELETE FROM users WHERE id = $1 AND role = 'cashier'", [id])).rowCount! > 0
}

export async function updateUserProfile(id: number, input: { name: string; email: string }) {
  await initialize()
  const row = await first(pool, 'UPDATE users SET name=$1, email=$2 WHERE id=$3 RETURNING id, name, email, role, active', [input.name, input.email.toLowerCase(), id])
  return row ? mapUser(row) : undefined
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

export async function getMenuCategories(includeInactive = false, includeProductCount = false, database: Queryable = pool) {
  await initialize()
  const result = await rows(database, `
    SELECT categories.id, categories.label, categories.emoji, categories.sort_order AS "sortOrder", categories.active,
      ${includeProductCount ? 'COUNT(products.id)' : '0'} AS "productCount"
    FROM menu_categories categories
    ${includeProductCount ? 'LEFT JOIN products ON LOWER(products.category)=LOWER(categories.label)' : 'LEFT JOIN products ON FALSE'}
    ${includeInactive ? '' : 'WHERE categories.active=TRUE'}
    GROUP BY categories.id
    ORDER BY categories.active DESC, categories.sort_order ASC, categories.label ASC
  `)
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

const mapProduct = async (row: Record<string, unknown>, includeInactiveAddons = false, database: Queryable = pool): Promise<ProductRecord> => ({
  id: numberValue(row.id),
  name: String(row.name),
  description: String(row.description),
  price: numberValue(row.price),
  originalPrice: row.originalPrice === null ? undefined : numberValue(row.originalPrice),
  category: String(row.category),
  emoji: String(row.emoji),
  imageUrl: row.imageUrl ? String(row.imageUrl) : undefined,
  tone: String(row.tone),
  badge: row.badge ? String(row.badge) : undefined,
  spicy: Boolean(row.spicy),
  active: Boolean(row.active),
  addons: await getProductAddons(numberValue(row.id), includeInactiveAddons, database),
})

export async function getProducts(includeInactive = false, database: Queryable = pool) {
  await initialize()
  const productRows = await rows(database, `
    SELECT products.id,products.name,products.description,products.price,products.original_price AS "originalPrice",
      products.category,products.emoji,products.image_url AS "imageUrl",products.tone,products.badge,products.spicy,products.active
    FROM products
    ${includeInactive ? 'LEFT JOIN menu_categories categories ON LOWER(categories.label)=LOWER(products.category)' : 'JOIN menu_categories categories ON LOWER(categories.label)=LOWER(products.category)'}
    ${includeInactive ? '' : 'WHERE products.active=TRUE AND categories.active=TRUE'}
    ORDER BY COALESCE(categories.sort_order,9999) ASC,products.id ASC
  `)
  return Promise.all(productRows.map((row) => mapProduct(row, includeInactive, database)))
}

const getProductById = async (id: number, database: Queryable = pool) => {
  const row = await first(database, `
    SELECT id,name,description,price,original_price AS "originalPrice",category,emoji,image_url AS "imageUrl",tone,badge,spicy,active
    FROM products WHERE id=$1
  `, [id])
  return row ? mapProduct(row, true, database) : undefined
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

export async function createProduct(input: ProductInput) {
  await initialize()
  const id = await transaction(async (client) => {
    const row = await first(client, `
      INSERT INTO products (name,description,price,original_price,category,emoji,image_url,tone,badge,spicy,active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id
    `, [input.name, input.description, input.price, input.originalPrice ?? null, input.category, input.emoji, input.imageUrl ?? null, input.tone, input.badge ?? null, input.spicy, input.active])
    const productId = numberValue(row.id)
    await saveProductAddons(client, productId, input.addons)
    return productId
  })
  return getProductById(id)
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
  id: String(row.id), customerId: row.customerId === null ? undefined : numberValue(row.customerId), customerName: String(row.customerName),
  phone: String(row.phone), address: row.address ? String(row.address) : undefined, note: row.note ? String(row.note) : undefined,
  deliveryMethod: row.deliveryMethod as OrderRecord['deliveryMethod'], paymentMethod: row.paymentMethod as PaymentMethod,
  status: String(row.status), subtotal: numberValue(row.subtotal), discountAmount: numberValue(row.discountAmount),
  promoCode: row.promoCode ? String(row.promoCode) : undefined, deliveryFee: numberValue(row.deliveryFee), total: numberValue(row.total),
  createdAt: isoValue(row.createdAt),
})

const orderSelect = `SELECT id,customer_id AS "customerId",customer_name AS "customerName",phone,address,note,
  delivery_method AS "deliveryMethod",payment_method AS "paymentMethod",status,subtotal,discount_amount AS "discountAmount",
  promo_code AS "promoCode",delivery_fee AS "deliveryFee",total,created_at AS "createdAt" FROM orders`

export async function getOrderById(id: string, database: Queryable = pool) {
  await initialize()
  const orderRow = await first(database, `${orderSelect} WHERE id=$1`, [id])
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
      const product = await getProductById(item.productId, client)
      if (!product?.active) throw new Error(`Produk ${item.productId} tidak tersedia`)
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
      INSERT INTO orders (id,customer_id,customer_name,phone,address,note,delivery_method,payment_method,subtotal,discount_amount,promo_code,delivery_fee,total)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    `, [orderId, input.customerId, input.customerName, input.phone, input.address || null, input.note || null, input.deliveryMethod, input.paymentMethod, subtotal, discountAmount, promotion?.code || null, deliveryFee, total])

    for (const item of selectedProducts) {
      const unitPrice = item.product.price + item.addons.reduce((sum, addon) => sum + addon.price, 0)
      await client.query(`INSERT INTO order_items (order_id,product_id,product_name,quantity,unit_price,addons_json) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`, [orderId, item.product.id, item.product.name, item.quantity, unitPrice, JSON.stringify(item.addons.map(({ id: addonId, name, price }) => ({ id: addonId, name, price })))])
    }

    const soldByProduct = new Map<number, number>()
    selectedProducts.forEach((item) => soldByProduct.set(item.product.id, (soldByProduct.get(item.product.id) || 0) + item.quantity))
    for (const [productId, soldQuantity] of soldByProduct) {
      const inventoryRows = await rows(client, `SELECT id,name,current_stock AS "currentStock",usage_per_sale AS "usagePerSale" FROM inventory_items WHERE linked_product_id=$1 AND active=TRUE FOR UPDATE`, [productId])
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

export async function getOrders() {
  await initialize()
  const orderRows = await rows(pool, `${orderSelect} ORDER BY created_at DESC`)
  return Promise.all(orderRows.map((row) => getOrderById(String(row.id)))) as Promise<OrderRecord[]>
}

export async function getCustomerOrders(customerId: number) {
  await initialize()
  const idRows = await rows(pool, 'SELECT id FROM orders WHERE customer_id=$1 ORDER BY created_at DESC', [customerId])
  return Promise.all(idRows.map((row) => getOrderById(String(row.id)))) as Promise<OrderRecord[]>
}

export async function updateOrderStatus(id: string, status: string) {
  await initialize()
  const result = await pool.query('UPDATE orders SET status=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2', [status, id])
  return result.rowCount ? getOrderById(id) : undefined
}

export async function getDashboardStats() {
  await initialize()
  const totals = await first(pool, `SELECT COUNT(*) AS "totalOrders",COALESCE(SUM(CASE WHEN status!='cancelled' THEN total ELSE 0 END),0) AS revenue,COALESCE(SUM(CASE WHEN status IN ('new','preparing','ready','delivering') THEN 1 ELSE 0 END),0) AS "activeOrders" FROM orders`)
  const products = await first<{ count: string }>(pool, 'SELECT COUNT(*) AS count FROM products WHERE active=TRUE')
  return { totalOrders: numberValue(totals.totalOrders), revenue: numberValue(totals.revenue), activeOrders: numberValue(totals.activeOrders), activeProducts: numberValue(products.count) }
}

const mapInventoryItem = (row: Record<string, unknown>): InventoryItemRecord => ({
  id: numberValue(row.id), name: String(row.name), sku: String(row.sku), unit: String(row.unit),
  currentStock: numberValue(row.currentStock), minimumStock: numberValue(row.minimumStock), unitCost: numberValue(row.unitCost),
  linkedProductId: row.linkedProductId === null ? undefined : numberValue(row.linkedProductId),
  linkedProductName: row.linkedProductName ? String(row.linkedProductName) : undefined,
  usagePerSale: numberValue(row.usagePerSale), active: Boolean(row.active),
  lowStock: numberValue(row.currentStock) <= numberValue(row.minimumStock),
})

export async function getInventoryItems(includeInactive = true, database: Queryable = pool) {
  await initialize()
  const itemRows = await rows(database, `
    SELECT items.id,items.name,items.sku,items.unit,items.current_stock AS "currentStock",items.minimum_stock AS "minimumStock",
      items.unit_cost AS "unitCost",items.linked_product_id AS "linkedProductId",products.name AS "linkedProductName",
      items.usage_per_sale AS "usagePerSale",items.active
    FROM inventory_items items LEFT JOIN products ON products.id=items.linked_product_id
    ${includeInactive ? '' : 'WHERE items.active=TRUE'} ORDER BY items.active DESC,items.name ASC
  `)
  return itemRows.map(mapInventoryItem)
}

const mapStockMovement = (row: Record<string, unknown>): StockMovementRecord => ({
  id: numberValue(row.id), itemId: numberValue(row.itemId), itemName: String(row.itemName), sku: String(row.sku), unit: String(row.unit),
  type: row.type as StockMovementType, quantity: numberValue(row.quantity), stockBefore: numberValue(row.stockBefore), stockAfter: numberValue(row.stockAfter),
  note: row.note ? String(row.note) : undefined, createdByName: row.createdByName ? String(row.createdByName) : undefined, createdAt: isoValue(row.createdAt),
})

export async function getStockMovements(limit = 100, database: Queryable = pool) {
  await initialize()
  const movementRows = await rows(database, `
    SELECT movements.id,movements.item_id AS "itemId",items.name AS "itemName",items.sku,items.unit,movements.type,
      movements.quantity,movements.stock_before AS "stockBefore",movements.stock_after AS "stockAfter",movements.note,
      users.name AS "createdByName",movements.created_at AS "createdAt"
    FROM stock_movements movements JOIN inventory_items items ON items.id=movements.item_id
    LEFT JOIN users ON users.id=movements.created_by ORDER BY movements.id DESC LIMIT $1
  `, [Math.max(1, Math.min(500, limit))])
  return movementRows.map(mapStockMovement)
}

export async function getInventorySnapshot() {
  await initialize()
  const [items, movements, today] = await Promise.all([
    getInventoryItems(true), getStockMovements(),
    first<{ count: string }>(pool, 'SELECT COUNT(*) AS count FROM stock_movements WHERE created_at::date=CURRENT_DATE'),
  ])
  return { items, movements, summary: { activeItems: items.filter((item) => item.active).length, lowStockItems: items.filter((item) => item.active && item.lowStock).length, movementsToday: numberValue(today.count) } }
}

export async function createInventoryItem(input: { name: string; sku: string; unit: string; initialStock: number; minimumStock: number; unitCost: number; linkedProductId?: number; usagePerSale: number; active: boolean }, actorId?: number) {
  await initialize()
  const id = await transaction(async (client) => {
    const row = await first(client, `
      INSERT INTO inventory_items (name,sku,unit,current_stock,minimum_stock,unit_cost,linked_product_id,usage_per_sale,active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id
    `, [input.name, input.sku.toUpperCase(), input.unit, input.initialStock, input.minimumStock, input.unitCost, input.linkedProductId ?? null, input.usagePerSale, input.active])
    const itemId = numberValue(row.id)
    if (input.initialStock > 0) await client.query(`INSERT INTO stock_movements (item_id,type,quantity,stock_before,stock_after,note,created_by) VALUES ($1,'in',$2,0,$2,'Stok awal',$3)`, [itemId, input.initialStock, actorId ?? null])
    return itemId
  })
  return (await getInventoryItems(true)).find((item) => item.id === id)
}

export async function updateInventoryItem(id: number, input: { name: string; sku: string; unit: string; minimumStock: number; unitCost: number; linkedProductId?: number; usagePerSale: number; active: boolean }) {
  await initialize()
  const result = await pool.query(`
    UPDATE inventory_items SET name=$1,sku=$2,unit=$3,minimum_stock=$4,unit_cost=$5,linked_product_id=$6,
      usage_per_sale=$7,active=$8,updated_at=CURRENT_TIMESTAMP WHERE id=$9
  `, [input.name, input.sku.toUpperCase(), input.unit, input.minimumStock, input.unitCost, input.linkedProductId ?? null, input.usagePerSale, input.active, id])
  return result.rowCount ? (await getInventoryItems(true)).find((item) => item.id === id) : undefined
}

export async function deleteInventoryItem(id: number) {
  await initialize()
  const count = await first<{ count: string }>(pool, 'SELECT COUNT(*) AS count FROM stock_movements WHERE item_id=$1', [id])
  if (numberValue(count.count) > 0) return { deleted: false, archived: (await pool.query('UPDATE inventory_items SET active=FALSE,updated_at=CURRENT_TIMESTAMP WHERE id=$1', [id])).rowCount! > 0 }
  return { deleted: (await pool.query('DELETE FROM inventory_items WHERE id=$1', [id])).rowCount! > 0, archived: false }
}

export async function createStockMovement(input: { itemId: number; type: StockMovementType; quantity: number; note?: string }, actorId?: number) {
  await initialize()
  const movementId = await transaction(async (client) => {
    const item = await first(client, 'SELECT id,current_stock AS "currentStock",active FROM inventory_items WHERE id=$1 FOR UPDATE', [input.itemId])
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
  return (await getStockMovements(500)).find((movement) => movement.id === movementId)
}

const mapFinancialEntry = (row: Record<string, unknown>): FinancialEntryRecord => ({
  id: numberValue(row.id), type: row.type as FinancialEntryType, category: String(row.category), amount: numberValue(row.amount),
  paymentMethod: row.paymentMethod as PaymentMethod, note: row.note ? String(row.note) : undefined,
  entryDate: dateValue(row.entryDate), createdByName: row.createdByName ? String(row.createdByName) : undefined, createdAt: isoValue(row.createdAt),
})

export async function getFinancialEntries(from: string, to: string, database: Queryable = pool) {
  await initialize()
  const entryRows = await rows(database, `
    SELECT entries.id,entries.type,entries.category,entries.amount,entries.payment_method AS "paymentMethod",entries.note,
      entries.entry_date AS "entryDate",users.name AS "createdByName",entries.created_at AS "createdAt"
    FROM financial_entries entries LEFT JOIN users ON users.id=entries.created_by
    WHERE entries.entry_date BETWEEN $1 AND $2 ORDER BY entries.entry_date DESC,entries.id DESC
  `, [from, to])
  return entryRows.map(mapFinancialEntry)
}

export async function createFinancialEntry(input: { type: FinancialEntryType; category: string; amount: number; paymentMethod: PaymentMethod; note?: string; entryDate: string }, actorId?: number) {
  await initialize()
  const row = await first(pool, `
    INSERT INTO financial_entries (type,category,amount,payment_method,note,entry_date,created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id
  `, [input.type, input.category, input.amount, input.paymentMethod, input.note || null, input.entryDate, actorId ?? null])
  const entry = await first(pool, `
    SELECT entries.id,entries.type,entries.category,entries.amount,entries.payment_method AS "paymentMethod",entries.note,
      entries.entry_date AS "entryDate",users.name AS "createdByName",entries.created_at AS "createdAt"
    FROM financial_entries entries LEFT JOIN users ON users.id=entries.created_by WHERE entries.id=$1
  `, [row.id])
  return mapFinancialEntry(entry)
}

export async function deleteFinancialEntry(id: number) {
  await initialize()
  return (await pool.query('DELETE FROM financial_entries WHERE id=$1', [id])).rowCount! > 0
}

export async function getReportData(from: string, to: string) {
  await initialize()
  const [summaryRow, itemsSoldRow, dailyRows, topRows, paymentRows, customerRows, entries, expenseRows, allTimeSales, allTimeEntries, inventoryItems] = await Promise.all([
    first(pool, `SELECT COUNT(*) AS transactions,COALESCE(SUM(subtotal),0) AS "grossSales",COALESCE(SUM(discount_amount),0) AS discounts,COALESCE(SUM(total),0) AS "netRevenue",COALESCE(AVG(total),0) AS "averageOrder" FROM orders WHERE status!='cancelled' AND created_at::date BETWEEN $1 AND $2`, [from, to]),
    first(pool, `SELECT COALESCE(SUM(items.quantity),0) AS count FROM order_items items JOIN orders ON orders.id=items.order_id WHERE orders.status!='cancelled' AND orders.created_at::date BETWEEN $1 AND $2`, [from, to]),
    rows(pool, `
      WITH order_daily AS (
        SELECT created_at::date AS date,COUNT(*) AS transactions,SUM(subtotal) AS "grossSales",SUM(discount_amount) AS discounts,SUM(total) AS revenue
        FROM orders WHERE status!='cancelled' AND created_at::date BETWEEN $1 AND $2 GROUP BY created_at::date
      ), item_daily AS (
        SELECT orders.created_at::date AS date,SUM(items.quantity) AS "itemsSold" FROM orders JOIN order_items items ON items.order_id=orders.id
        WHERE orders.status!='cancelled' AND orders.created_at::date BETWEEN $1 AND $2 GROUP BY orders.created_at::date
      )
      SELECT order_daily.*,COALESCE(item_daily."itemsSold",0) AS "itemsSold" FROM order_daily LEFT JOIN item_daily USING(date) ORDER BY date DESC
    `, [from, to]),
    rows(pool, `SELECT items.product_id AS "productId",items.product_name AS "productName",SUM(items.quantity) AS quantity,SUM(items.quantity*items.unit_price) AS revenue FROM order_items items JOIN orders ON orders.id=items.order_id WHERE orders.status!='cancelled' AND orders.created_at::date BETWEEN $1 AND $2 GROUP BY items.product_id,items.product_name ORDER BY quantity DESC,revenue DESC LIMIT 20`, [from, to]),
    rows(pool, `SELECT payment_method AS "paymentMethod",COUNT(*) AS transactions,COALESCE(SUM(total),0) AS revenue FROM orders WHERE status!='cancelled' AND created_at::date BETWEEN $1 AND $2 GROUP BY payment_method ORDER BY revenue DESC`, [from, to]),
    rows(pool, `SELECT users.id AS "customerId",users.name,users.email,COUNT(orders.id) AS "orderCount",COALESCE(SUM(orders.total),0) AS "totalSpent",MAX(orders.created_at) AS "lastOrder" FROM users JOIN orders ON orders.customer_id=users.id WHERE users.role='customer' AND orders.status!='cancelled' AND orders.created_at::date BETWEEN $1 AND $2 GROUP BY users.id,users.name,users.email ORDER BY "totalSpent" DESC`, [from, to]),
    getFinancialEntries(from, to),
    rows(pool, `SELECT category,SUM(amount) AS amount FROM financial_entries WHERE type='expense' AND entry_date BETWEEN $1 AND $2 GROUP BY category ORDER BY amount DESC`, [from, to]),
    first(pool, "SELECT COALESCE(SUM(total),0) AS amount FROM orders WHERE status!='cancelled'"),
    first(pool, `SELECT COALESCE(SUM(CASE WHEN type='capital_in' THEN amount ELSE 0 END),0) AS "capitalIn",COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS expenses,COALESCE(SUM(CASE WHEN type='capital_out' THEN amount ELSE 0 END),0) AS "capitalOut" FROM financial_entries`),
    getInventoryItems(true),
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
  const netProfit = summary.netRevenue - expenseTotal

  return {
    generatedAt: new Date().toISOString(), period: { from, to },
    operational: { summary, dailySales, topProducts, paymentMethods, stockStatus, customers },
    financial: {
      profitLoss: { revenue: summary.netRevenue, expenses: expenseTotal, netProfit },
      cashFlow: { salesInflow: summary.netRevenue, capitalIn, totalInflow: summary.netRevenue + capitalIn, expensesOutflow: expenseTotal, capitalOut, totalOutflow: expenseTotal + capitalOut, netCashFlow: summary.netRevenue + capitalIn - expenseTotal - capitalOut },
      balanceSheet: { cashBalance, inventoryValue, totalAssets: cashBalance + inventoryValue, liabilities: 0, equity: cashBalance + inventoryValue },
      equityChanges: { capitalIn, capitalOut, retainedEarnings: netProfit, netChange: capitalIn + netProfit - capitalOut },
      expensesByCategory, entries,
    },
  }
}
