import 'dotenv/config'
import Database from 'better-sqlite3'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(currentDirectory, '..')
const databasePath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(projectRoot, 'data', 'franchise.db')

mkdirSync(path.dirname(databasePath), { recursive: true })

export const db = new Database(databasePath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('customer', 'cashier', 'manager', 'admin')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price INTEGER NOT NULL CHECK(price >= 0),
    original_price INTEGER,
    category TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '🍗',
    image_url TEXT,
    tone TEXT NOT NULL DEFAULT 'gold',
    badge TEXT,
    spicy INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS menu_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL UNIQUE COLLATE NOCASE,
    emoji TEXT NOT NULL DEFAULT '🍽️',
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS promotions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE COLLATE NOCASE,
    discount_type TEXT NOT NULL CHECK(discount_type IN ('percentage', 'fixed')),
    discount_value INTEGER NOT NULL CHECK(discount_value > 0),
    min_order INTEGER NOT NULL DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS role_permissions (
    role TEXT NOT NULL CHECK(role IN ('cashier', 'manager', 'admin')),
    module TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role, module)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_id INTEGER REFERENCES users(id),
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    note TEXT,
    delivery_method TEXT NOT NULL CHECK(delivery_method IN ('delivery', 'pickup')),
    payment_method TEXT NOT NULL DEFAULT 'cash' CHECK(payment_method IN ('cash', 'qris', 'bank_transfer', 'ewallet')),
    status TEXT NOT NULL DEFAULT 'new',
    subtotal INTEGER NOT NULL,
    discount_amount INTEGER NOT NULL DEFAULT 0,
    promo_code TEXT,
    delivery_fee INTEGER NOT NULL,
    total INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    unit_price INTEGER NOT NULL,
    addons_json TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS product_addons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price INTEGER NOT NULL DEFAULT 0 CHECK(price >= 0),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS inventory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE COLLATE NOCASE,
    unit TEXT NOT NULL,
    current_stock REAL NOT NULL DEFAULT 0 CHECK(current_stock >= 0),
    minimum_stock REAL NOT NULL DEFAULT 0 CHECK(minimum_stock >= 0),
    unit_cost INTEGER NOT NULL DEFAULT 0 CHECK(unit_cost >= 0),
    linked_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    usage_per_sale REAL NOT NULL DEFAULT 1 CHECK(usage_per_sale > 0),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    type TEXT NOT NULL CHECK(type IN ('in', 'out', 'adjustment_add', 'adjustment_subtract')),
    quantity REAL NOT NULL CHECK(quantity > 0),
    stock_before REAL NOT NULL,
    stock_after REAL NOT NULL,
    note TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS financial_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('expense', 'capital_in', 'capital_out')),
    category TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK(amount > 0),
    payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'qris', 'bank_transfer', 'ewallet')),
    note TEXT,
    entry_date TEXT NOT NULL DEFAULT (date('now')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
  CREATE INDEX IF NOT EXISTS idx_menu_categories_sort ON menu_categories(active DESC, sort_order ASC, label ASC);
  CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
  CREATE INDEX IF NOT EXISTS idx_product_addons_product_id ON product_addons(product_id);
  CREATE INDEX IF NOT EXISTS idx_stock_movements_item_id ON stock_movements(item_id);
  CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_financial_entries_date ON financial_entries(entry_date DESC);
`)

const userTable = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get() as { sql: string }
if (!userTable.sql.includes("'admin'")) {
  db.pragma('foreign_keys = OFF')
  db.exec(`
    CREATE TABLE users_with_admin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('customer', 'cashier', 'manager', 'admin')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO users_with_admin (id, name, email, password_hash, role, active, created_at)
      SELECT id, name, email, password_hash, role, active, created_at FROM users;
    DROP TABLE users;
    ALTER TABLE users_with_admin RENAME TO users;
  `)
  db.pragma('foreign_keys = ON')
}

const orderColumns = db.prepare('PRAGMA table_info(orders)').all() as Array<{ name: string }>
if (!orderColumns.some((column) => column.name === 'customer_id')) {
  db.exec('ALTER TABLE orders ADD COLUMN customer_id INTEGER REFERENCES users(id)')
}
if (!orderColumns.some((column) => column.name === 'payment_method')) {
  db.exec("ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash'")
}
if (!orderColumns.some((column) => column.name === 'discount_amount')) {
  db.exec('ALTER TABLE orders ADD COLUMN discount_amount INTEGER NOT NULL DEFAULT 0')
}
if (!orderColumns.some((column) => column.name === 'promo_code')) {
  db.exec('ALTER TABLE orders ADD COLUMN promo_code TEXT')
}
db.exec('CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id)')

const productColumns = db.prepare('PRAGMA table_info(products)').all() as Array<{ name: string }>
if (!productColumns.some((column) => column.name === 'image_url')) {
  db.exec('ALTER TABLE products ADD COLUMN image_url TEXT')
}

const inventoryColumns = db.prepare('PRAGMA table_info(inventory_items)').all() as Array<{ name: string }>
if (!inventoryColumns.some((column) => column.name === 'unit_cost')) {
  db.exec('ALTER TABLE inventory_items ADD COLUMN unit_cost INTEGER NOT NULL DEFAULT 0')
}
if (!inventoryColumns.some((column) => column.name === 'linked_product_id')) {
  db.exec('ALTER TABLE inventory_items ADD COLUMN linked_product_id INTEGER REFERENCES products(id)')
}
if (!inventoryColumns.some((column) => column.name === 'usage_per_sale')) {
  db.exec('ALTER TABLE inventory_items ADD COLUMN usage_per_sale REAL NOT NULL DEFAULT 1')
}

const orderItemColumns = db.prepare('PRAGMA table_info(order_items)').all() as Array<{ name: string }>
if (!orderItemColumns.some((column) => column.name === 'addons_json')) {
  db.exec("ALTER TABLE order_items ADD COLUMN addons_json TEXT NOT NULL DEFAULT '[]'")
}

export type UserRole = 'customer' | 'cashier' | 'manager' | 'admin'
export type PermissionRole = Extract<UserRole, 'cashier' | 'manager' | 'admin'>
export type PermissionModule =
  | 'cashier_station'
  | 'categories'
  | 'products'
  | 'promotions'
  | 'cashiers'
  | 'inventory'
  | 'reports'
  | 'settings'
  | 'rbac'

export interface PermissionModuleMeta {
  key: PermissionModule
  label: string
  description: string
}

export interface RolePermissionMatrix {
  roles: PermissionRole[]
  modules: PermissionModuleMeta[]
  permissions: Record<PermissionRole, Record<PermissionModule, boolean>>
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

export interface UserRecord {
  id: number
  name: string
  email: string
  role: UserRole
  active: boolean
}

interface UserRow extends Omit<UserRecord, 'active'> {
  active: number
  passwordHash: string
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

const mapUser = (row: UserRow): UserRecord => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  active: Boolean(row.active),
})

export function createUser(input: { name: string; email: string; password: string; role?: UserRole }) {
  const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, ?)
  `).run(input.name, input.email.toLowerCase(), hashPassword(input.password), input.role || 'customer')
  return getUserById(Number(result.lastInsertRowid))!
}

export function authenticateUser(email: string, password: string, expectedRole?: UserRole) {
  const row = db.prepare(`
    SELECT id, name, email, password_hash AS passwordHash, role, active
    FROM users WHERE email = ?
  `).get(email.toLowerCase()) as UserRow | undefined
  if (!row || !row.active || (expectedRole && row.role !== expectedRole) || !verifyPassword(password, row.passwordHash)) return undefined
  return mapUser(row)
}

export function getUserById(id: number) {
  const row = db.prepare(`
    SELECT id, name, email, password_hash AS passwordHash, role, active
    FROM users WHERE id = ?
  `).get(id) as UserRow | undefined
  return row ? mapUser(row) : undefined
}

export function getCashiers() {
  const rows = db.prepare(`
    SELECT id, name, email, password_hash AS passwordHash, role, active
    FROM users
    WHERE role = 'cashier'
    ORDER BY id DESC
  `).all() as UserRow[]
  return rows.map(mapUser)
}

export function updateCashier(id: number, input: { name: string; email: string; password?: string; active: boolean }) {
  const cashier = getUserById(id)
  if (!cashier || cashier.role !== 'cashier') return undefined

  if (input.password) {
    db.prepare(`
      UPDATE users
      SET name = ?, email = ?, password_hash = ?, active = ?
      WHERE id = ? AND role = 'cashier'
    `).run(input.name, input.email.toLowerCase(), hashPassword(input.password), input.active ? 1 : 0, id)
  } else {
    db.prepare(`
      UPDATE users
      SET name = ?, email = ?, active = ?
      WHERE id = ? AND role = 'cashier'
    `).run(input.name, input.email.toLowerCase(), input.active ? 1 : 0, id)
  }

  return getUserById(id)
}

export function deleteCashier(id: number) {
  return db.prepare("DELETE FROM users WHERE id = ? AND role = 'cashier'").run(id).changes > 0
}

export function updateUserProfile(id: number, input: { name: string; email: string }) {
  db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?')
    .run(input.name, input.email.toLowerCase(), id)
  return getUserById(id)
}

export function changeUserPassword(id: number, currentPassword: string, newPassword: string) {
  const row = db.prepare('SELECT password_hash AS passwordHash FROM users WHERE id = ?').get(id) as { passwordHash: string } | undefined
  if (!row || !verifyPassword(currentPassword, row.passwordHash)) return false
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), id)
  return true
}

const isPermissionRole = (role: string): role is PermissionRole => permissionRoles.includes(role as PermissionRole)
const isPermissionModule = (module: string): module is PermissionModule => permissionModules.some((item) => item.key === module)

export function ensureDefaultRolePermissions() {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO role_permissions (role, module, enabled)
    VALUES (?, ?, ?)
  `)
  db.transaction(() => {
    permissionRoles.forEach((role) => {
      permissionModules.forEach((module) => {
        insert.run(role, module.key, defaultRolePermissions[role].includes(module.key) ? 1 : 0)
      })
    })
    db.prepare(`
      INSERT INTO role_permissions (role, module, enabled)
      VALUES ('admin', 'rbac', 1)
      ON CONFLICT(role, module) DO UPDATE SET enabled = 1, updated_at = CURRENT_TIMESTAMP
    `).run()
    db.prepare("UPDATE role_permissions SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE module = 'rbac' AND role != 'admin'").run()
  })()
}

export function getRolePermissions(role: UserRole): Record<PermissionModule, boolean> {
  const defaults = isPermissionRole(role) ? defaultRolePermissions[role] : []
  const permissions = Object.fromEntries(permissionModules.map((module) => [module.key, defaults.includes(module.key)])) as Record<PermissionModule, boolean>
  if (!isPermissionRole(role)) return permissions

  const rows = db.prepare('SELECT module, enabled FROM role_permissions WHERE role = ?').all(role) as Array<{ module: string; enabled: number }>
  rows.forEach((row) => {
    if (isPermissionModule(row.module)) permissions[row.module] = Boolean(row.enabled)
  })
  if (role === 'admin') permissions.rbac = true
  return permissions
}

export function hasModuleAccess(role: UserRole, module: PermissionModule) {
  return Boolean(getRolePermissions(role)[module])
}

export function getRolePermissionMatrix(): RolePermissionMatrix {
  const permissions = Object.fromEntries(
    permissionRoles.map((role) => [role, getRolePermissions(role)]),
  ) as Record<PermissionRole, Record<PermissionModule, boolean>>
  return {
    roles: permissionRoles,
    modules: permissionModules,
    permissions,
  }
}

export function updateRolePermissions(input: Partial<Record<PermissionRole, Partial<Record<PermissionModule, boolean>>>>) {
  const update = db.prepare(`
    INSERT INTO role_permissions (role, module, enabled, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(role, module) DO UPDATE SET enabled = excluded.enabled, updated_at = CURRENT_TIMESTAMP
  `)
  db.transaction(() => {
    Object.entries(input).forEach(([role, modules]) => {
      if (!isPermissionRole(role) || !modules) return
      Object.entries(modules).forEach(([module, enabled]) => {
        if (!isPermissionModule(module)) return
        const forcedValue = module === 'rbac' ? role === 'admin' : Boolean(enabled)
        update.run(role, module, forcedValue ? 1 : 0)
      })
    })
    update.run('admin', 'rbac', 1)
  })()
  return getRolePermissionMatrix()
}

export interface FranchiseSettingsRecord {
  businessName: string
  shortName: string
  tagline: string
  heroEyebrow: string
  heroTitle: string
  heroHighlight: string
  heroDescription: string
  heroImageUrl?: string
  storyImageUrl?: string
  deliveryEstimate: string
  deliveryNote: string
  locationLabel: string
  locationTitle: string
  locationDescription: string
  footerDescription: string
  contactEmail: string
  whatsappNumber: string
  orderPrefix: string
  primaryColor: string
  accentColor: string
  menuKicker: string
  menuTitle: string
  menuDescription: string
  aboutKicker: string
  aboutTitle: string
  aboutDescription: string
  aboutReviewQuote: string
  aboutReviewAuthor: string
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

const normalizeHexColor = (value: string, fallback: string) => /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : fallback
const normalizeOrderPrefix = (value: string) => {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  return normalized || defaultFranchiseSettings.orderPrefix
}
const normalizeImageDataUrl = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed.length > 3_000_000) throw new Error('Ukuran gambar brand terlalu besar. Maksimal sekitar 2 MB.')
  if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(trimmed)) throw new Error('Format gambar brand harus PNG, JPG, WebP, atau GIF.')
  return trimmed
}

export function getFranchiseSettings(): FranchiseSettingsRecord {
  const rows = db.prepare('SELECT key, value FROM app_settings').all() as Array<{ key: string; value: string }>
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value])) as Partial<Record<keyof FranchiseSettingsRecord, string>>
  return { ...defaultFranchiseSettings, ...stored }
}

export function updateFranchiseSettings(input: Partial<FranchiseSettingsRecord>) {
  const current = getFranchiseSettings()
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
  const statement = db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
  db.transaction(() => franchiseSettingKeys.forEach((key) => statement.run(key, next[key])))()
  return getFranchiseSettings()
}

const settingsCount = db.prepare('SELECT COUNT(*) AS count FROM app_settings').get() as { count: number }
if (settingsCount.count === 0) {
  updateFranchiseSettings(defaultFranchiseSettings)
}

ensureDefaultRolePermissions()

const userCountBeforeSeed = db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }
const cashierEmail = (process.env.APP_CASHIER_EMAIL || 'cashier@franchise.local').toLowerCase()
const cashierExists = db.prepare('SELECT id FROM users WHERE email = ?').get(cashierEmail)
if (!cashierExists && (userCountBeforeSeed.count === 0 || Boolean(process.env.APP_CASHIER_EMAIL))) {
  createUser({
    name: 'Cashier Store',
    email: cashierEmail,
    password: process.env.APP_CASHIER_PASSWORD || 'cashier123',
    role: 'cashier',
  })
} else if (process.env.APP_CASHIER_PASSWORD) {
  db.prepare('UPDATE users SET password_hash = ? WHERE email = ? AND role = ?')
    .run(hashPassword(process.env.APP_CASHIER_PASSWORD), cashierEmail, 'cashier')
}

const managerEmail = (process.env.APP_MANAGER_EMAIL || 'manager@franchise.local').toLowerCase()
const managerExists = db.prepare('SELECT id FROM users WHERE email = ?').get(managerEmail)
if (!managerExists) {
  createUser({
    name: 'Manager Store',
    email: managerEmail,
    password: process.env.APP_MANAGER_PASSWORD || 'manager123',
    role: 'manager',
  })
} else if (process.env.APP_MANAGER_PASSWORD) {
  db.prepare('UPDATE users SET password_hash = ? WHERE email = ? AND role = ?')
    .run(hashPassword(process.env.APP_MANAGER_PASSWORD), managerEmail, 'manager')
}

const adminEmail = (process.env.APP_ADMIN_EMAIL || 'admin@franchise.local').toLowerCase()
const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail)
if (!adminExists) {
  createUser({
    name: 'Admin Store',
    email: adminEmail,
    password: process.env.APP_ADMIN_PASSWORD || 'admin123',
    role: 'admin',
  })
} else if (process.env.APP_ADMIN_PASSWORD) {
  db.prepare('UPDATE users SET password_hash = ? WHERE email = ? AND role = ?')
    .run(hashPassword(process.env.APP_ADMIN_PASSWORD), adminEmail, 'admin')
}

const seedMenuCategories = [
  ['Paket', '🍱', 10],
  ['Ayam', '🍗', 20],
  ['Burger', '🍔', 30],
  ['Snack', '🍟', 40],
  ['Minuman', '🥤', 50],
] as const

const categoryCount = db.prepare('SELECT COUNT(*) AS count FROM menu_categories').get() as { count: number }
if (categoryCount.count === 0) {
  const insertCategory = db.prepare('INSERT INTO menu_categories (label, emoji, sort_order) VALUES (?, ?, ?)')
  db.transaction(() => seedMenuCategories.forEach((category) => insertCategory.run(...category)))()
}

const seedProducts = [
  ['Paket Andalan', '2 menu utama, nasi hangat, dan minuman segar.', 43900, 51900, 'Paket', '🍱', 'gold', 'Paling laris', 0],
  ['Menu Original', 'Menu favorit dengan rasa khas dan tekstur renyah.', 18900, null, 'Ayam', '🍗', 'cream', 'Favorit', 0],
  ['Menu Pedas Spesial', 'Menu pedas manis yang cocok untuk pencinta rasa kuat.', 23900, null, 'Ayam', '🌶️', 'red', 'Baru', 1],
  ['Burger Spesial', 'Burger isi protein, sayuran, dan saus creamy.', 28900, null, 'Burger', '🍔', 'orange', null, 0],
  ['Double Crunch Burger', 'Dua lapis ayam krispi untuk lapar yang serius.', 36900, null, 'Burger', '🍔', 'yellow', 'Extra puas', 0],
  ['Kentang Bumbu', 'Kentang renyah dengan pilihan bumbu gurih.', 15900, null, 'Snack', '🍟', 'pink', null, 0],
  ['Bites Sharing', 'Potongan menu praktis, pas buat sharing.', 24900, null, 'Snack', '🍿', 'peach', null, 0],
  ['Minuman Dingin', 'Minuman dingin dan menyegarkan.', 9900, null, 'Minuman', '🥤', 'blue', null, 0],
] as const

const productCount = db.prepare('SELECT COUNT(*) AS count FROM products').get() as { count: number }
if (productCount.count === 0) {
  const insert = db.prepare(`
    INSERT INTO products (name, description, price, original_price, category, emoji, tone, badge, spicy)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  db.transaction(() => seedProducts.forEach((product) => insert.run(...product)))()
}

const productCategories = db.prepare(`
  SELECT DISTINCT category FROM products
  WHERE TRIM(category) != '' AND category NOT IN (SELECT label FROM menu_categories)
`).all() as Array<{ category: string }>
if (productCategories.length > 0) {
  const insertMissingCategory = db.prepare('INSERT OR IGNORE INTO menu_categories (label, emoji, sort_order) VALUES (?, ?, ?)')
  db.transaction(() => productCategories.forEach((row, index) => insertMissingCategory.run(row.category, '🍽️', 1000 + index)))()
}

export interface MenuCategoryRecord {
  id: number
  label: string
  emoji: string
  sortOrder: number
  active: boolean
  productCount?: number
}

interface MenuCategoryRow extends Omit<MenuCategoryRecord, 'active'> {
  active: number
}

const mapMenuCategory = (row: MenuCategoryRow): MenuCategoryRecord => ({
  ...row,
  active: Boolean(row.active),
})

export function getMenuCategories(includeInactive = false, includeProductCount = false) {
  const rows = db.prepare(`
    SELECT categories.id, categories.label, categories.emoji, categories.sort_order AS sortOrder,
      categories.active,
      ${includeProductCount ? 'COUNT(products.id)' : '0'} AS productCount
    FROM menu_categories categories
    ${includeProductCount ? 'LEFT JOIN products ON products.category = categories.label' : 'LEFT JOIN products ON 0 = 1'}
    ${includeInactive ? '' : 'WHERE categories.active = 1'}
    GROUP BY categories.id
    ORDER BY categories.active DESC, categories.sort_order ASC, categories.label ASC
  `).all() as MenuCategoryRow[]
  return rows.map(mapMenuCategory)
}

export function menuCategoryExists(label: string) {
  const row = db.prepare('SELECT id FROM menu_categories WHERE label = ?').get(label) as { id: number } | undefined
  return Boolean(row)
}

export function createMenuCategory(input: Omit<MenuCategoryRecord, 'id' | 'productCount'>) {
  const result = db.prepare(`
    INSERT INTO menu_categories (label, emoji, sort_order, active)
    VALUES (?, ?, ?, ?)
  `).run(input.label, input.emoji, input.sortOrder, input.active ? 1 : 0)
  return getMenuCategories(true, true).find((category) => category.id === Number(result.lastInsertRowid))
}

export function updateMenuCategory(id: number, input: Omit<MenuCategoryRecord, 'id' | 'productCount'>) {
  const current = db.prepare('SELECT label FROM menu_categories WHERE id = ?').get(id) as { label: string } | undefined
  if (!current) return undefined
  db.transaction(() => {
    db.prepare(`
      UPDATE menu_categories
      SET label = ?, emoji = ?, sort_order = ?, active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(input.label, input.emoji, input.sortOrder, input.active ? 1 : 0, id)
    if (current.label.toLowerCase() !== input.label.toLowerCase()) {
      db.prepare('UPDATE products SET category = ?, updated_at = CURRENT_TIMESTAMP WHERE category = ?').run(input.label, current.label)
    }
  })()
  return getMenuCategories(true, true).find((category) => category.id === id)
}

export function setMenuCategoryActive(id: number, active: boolean) {
  const result = db.prepare('UPDATE menu_categories SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(active ? 1 : 0, id)
  if (!result.changes) return undefined
  return getMenuCategories(true, true).find((category) => category.id === id)
}

export function deleteMenuCategory(id: number) {
  const category = db.prepare('SELECT label FROM menu_categories WHERE id = ?').get(id) as { label: string } | undefined
  if (!category) return { deleted: false, archived: false }
  const usage = db.prepare('SELECT COUNT(*) AS count FROM products WHERE category = ?').get(category.label) as { count: number }
  if (usage.count > 0) {
    setMenuCategoryActive(id, false)
    return { deleted: false, archived: true }
  }
  const result = db.prepare('DELETE FROM menu_categories WHERE id = ?').run(id)
  return { deleted: result.changes > 0, archived: false }
}

export interface ProductAddonRecord {
  id: number
  name: string
  price: number
  active: boolean
}

export interface ProductAddonInput {
  id?: number
  name: string
  price: number
  active: boolean
}

export interface ProductRecord {
  id: number
  name: string
  description: string
  price: number
  originalPrice?: number
  category: string
  emoji: string
  imageUrl?: string
  tone: string
  badge?: string
  spicy: boolean
  active: boolean
  addons: ProductAddonRecord[]
}

export type ProductInput = Omit<ProductRecord, 'id' | 'addons'> & { addons: ProductAddonInput[] }

interface ProductRow extends Omit<ProductRecord, 'spicy' | 'active' | 'imageUrl' | 'addons'> {
  imageUrl: string | null
  spicy: number
  active: number
}

interface ProductAddonRow extends Omit<ProductAddonRecord, 'active'> {
  active: number
}

const getProductAddons = (productId: number, includeInactive = false) => {
  const rows = db.prepare(`
    SELECT id, name, price, active
    FROM product_addons
    WHERE product_id = ? ${includeInactive ? '' : 'AND active = 1'}
    ORDER BY id ASC
  `).all(productId) as ProductAddonRow[]
  return rows.map((row) => ({ ...row, active: Boolean(row.active) }))
}

const mapProduct = (row: ProductRow, includeInactiveAddons = false): ProductRecord => ({
  ...row,
  originalPrice: row.originalPrice ?? undefined,
  badge: row.badge ?? undefined,
  imageUrl: row.imageUrl ?? undefined,
  spicy: Boolean(row.spicy),
  active: Boolean(row.active),
  addons: getProductAddons(row.id, includeInactiveAddons),
})

export function getProducts(includeInactive = false) {
  const rows = db.prepare(`
    SELECT products.id, products.name, products.description, products.price,
      products.original_price AS originalPrice, products.category, products.emoji,
      products.image_url AS imageUrl, products.tone, products.badge, products.spicy, products.active
    FROM products
    ${includeInactive ? 'LEFT JOIN menu_categories categories ON categories.label = products.category COLLATE NOCASE' : 'JOIN menu_categories categories ON categories.label = products.category COLLATE NOCASE'}
    ${includeInactive ? '' : 'WHERE products.active = 1 AND categories.active = 1'}
    ORDER BY COALESCE(categories.sort_order, 9999) ASC, products.id ASC
  `).all() as ProductRow[]
  return rows.map((row) => mapProduct(row, includeInactive))
}

const saveProductAddons = (productId: number, addons: ProductAddonInput[]) => {
  const existingIds = new Set((db.prepare('SELECT id FROM product_addons WHERE product_id = ?').all(productId) as Array<{ id: number }>).map((row) => row.id))
  const keptIds: number[] = []
  const update = db.prepare('UPDATE product_addons SET name = ?, price = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND product_id = ?')
  const insert = db.prepare('INSERT INTO product_addons (product_id, name, price, active) VALUES (?, ?, ?, ?)')

  for (const addon of addons) {
    if (addon.id && existingIds.has(addon.id)) {
      update.run(addon.name, addon.price, addon.active ? 1 : 0, addon.id, productId)
      keptIds.push(addon.id)
    } else {
      const result = insert.run(productId, addon.name, addon.price, addon.active ? 1 : 0)
      keptIds.push(Number(result.lastInsertRowid))
    }
  }

  if (keptIds.length) {
    const placeholders = keptIds.map(() => '?').join(', ')
    db.prepare(`DELETE FROM product_addons WHERE product_id = ? AND id NOT IN (${placeholders})`).run(productId, ...keptIds)
  } else {
    db.prepare('DELETE FROM product_addons WHERE product_id = ?').run(productId)
  }
}

export function createProduct(input: ProductInput) {
  const id = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO products (name, description, price, original_price, category, emoji, image_url, tone, badge, spicy, active)
      VALUES (@name, @description, @price, @originalPrice, @category, @emoji, @imageUrl, @tone, @badge, @spicy, @active)
    `).run({
      ...input,
      originalPrice: input.originalPrice ?? null,
      badge: input.badge ?? null,
      imageUrl: input.imageUrl ?? null,
      spicy: input.spicy ? 1 : 0,
      active: input.active ? 1 : 0,
    })
    const productId = Number(result.lastInsertRowid)
    saveProductAddons(productId, input.addons)
    return productId
  })()
  return getProductById(id)
}

export function updateProduct(id: number, input: ProductInput) {
  const updated = db.transaction(() => {
    const result = db.prepare(`
      UPDATE products SET
        name = @name,
        description = @description,
        price = @price,
        original_price = @originalPrice,
        category = @category,
        emoji = @emoji,
        image_url = @imageUrl,
        tone = @tone,
        badge = @badge,
        spicy = @spicy,
        active = @active,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({
      id,
      ...input,
      originalPrice: input.originalPrice ?? null,
      badge: input.badge ?? null,
      imageUrl: input.imageUrl ?? null,
      spicy: input.spicy ? 1 : 0,
      active: input.active ? 1 : 0,
    })
    if (!result.changes) return false
    saveProductAddons(id, input.addons)
    return true
  })
  return updated() ? getProductById(id) : undefined
}

export function setProductActive(id: number, active: boolean) {
  db.prepare('UPDATE products SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(active ? 1 : 0, id)
  return getProductById(id)
}

export function deleteProduct(id: number) {
  const usage = db.prepare('SELECT COUNT(*) AS count FROM order_items WHERE product_id = ?').get(id) as { count: number }
  if (usage.count > 0) {
    setProductActive(id, false)
    return { deleted: false, archived: true }
  }
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(id)
  return { deleted: result.changes > 0, archived: false }
}

function getProductById(id: number) {
  const row = db.prepare(`
    SELECT id, name, description, price, original_price AS originalPrice, category, emoji, image_url AS imageUrl, tone, badge, spicy, active
    FROM products WHERE id = ?
  `).get(id) as ProductRow | undefined
  return row ? mapProduct(row, true) : undefined
}

export interface PromotionRecord {
  id: number
  title: string
  description: string
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  minOrder: number
  startDate?: string
  endDate?: string
  active: boolean
}

interface PromotionRow extends Omit<PromotionRecord, 'active'> {
  active: number
}

const mapPromotion = (row: PromotionRow): PromotionRecord => ({
  ...row,
  startDate: row.startDate ?? undefined,
  endDate: row.endDate ?? undefined,
  active: Boolean(row.active),
})

export function getPromotions(includeInactive = false) {
  const rows = db.prepare(`
    SELECT id, title, description, code, discount_type AS discountType, discount_value AS discountValue,
      min_order AS minOrder, start_date AS startDate, end_date AS endDate, active
    FROM promotions
    ${includeInactive ? '' : "WHERE active = 1 AND (start_date IS NULL OR start_date <= date('now')) AND (end_date IS NULL OR end_date >= date('now'))"}
    ORDER BY active DESC, id DESC
  `).all() as PromotionRow[]
  return rows.map(mapPromotion)
}

export function createPromotion(input: Omit<PromotionRecord, 'id'>) {
  const result = db.prepare(`
    INSERT INTO promotions (title, description, code, discount_type, discount_value, min_order, start_date, end_date, active)
    VALUES (@title, @description, @code, @discountType, @discountValue, @minOrder, @startDate, @endDate, @active)
  `).run({ ...input, code: input.code.toUpperCase(), startDate: input.startDate || null, endDate: input.endDate || null, active: input.active ? 1 : 0 })
  return getPromotionById(Number(result.lastInsertRowid))!
}

export function updatePromotion(id: number, input: Omit<PromotionRecord, 'id'>) {
  db.prepare(`
    UPDATE promotions SET title=@title, description=@description, code=@code, discount_type=@discountType,
      discount_value=@discountValue, min_order=@minOrder, start_date=@startDate, end_date=@endDate,
      active=@active, updated_at=CURRENT_TIMESTAMP WHERE id=@id
  `).run({ id, ...input, code: input.code.toUpperCase(), startDate: input.startDate || null, endDate: input.endDate || null, active: input.active ? 1 : 0 })
  return getPromotionById(id)
}

export function deletePromotion(id: number) {
  return db.prepare('DELETE FROM promotions WHERE id = ?').run(id).changes > 0
}

function getPromotionById(id: number) {
  const row = db.prepare(`
    SELECT id, title, description, code, discount_type AS discountType, discount_value AS discountValue,
      min_order AS minOrder, start_date AS startDate, end_date AS endDate, active
    FROM promotions WHERE id = ?
  `).get(id) as PromotionRow | undefined
  return row ? mapPromotion(row) : undefined
}

function getActivePromotionByCode(code: string) {
  const row = db.prepare(`
    SELECT id, title, description, code, discount_type AS discountType, discount_value AS discountValue,
      min_order AS minOrder, start_date AS startDate, end_date AS endDate, active
    FROM promotions
    WHERE code = ? AND active = 1
      AND (start_date IS NULL OR start_date <= date('now'))
      AND (end_date IS NULL OR end_date >= date('now'))
  `).get(code.toUpperCase()) as PromotionRow | undefined
  return row ? mapPromotion(row) : undefined
}

const promotionCount = db.prepare('SELECT COUNT(*) AS count FROM promotions').get() as { count: number }
if (promotionCount.count === 0) {
  createPromotion({
    title: 'Berdua Lebih Hemat',
    description: 'Nikmati paket pilihan untuk makan berdua dengan harga spesial.',
    code: 'HEMAT25',
    discountType: 'percentage',
    discountValue: 25,
    minOrder: 50000,
    active: true,
  })
}

export type PaymentMethod = 'cash' | 'qris' | 'bank_transfer' | 'ewallet'

export interface NewOrderInput {
  customerId: number
  customerName: string
  phone: string
  address?: string
  note?: string
  deliveryMethod: 'delivery' | 'pickup'
  paymentMethod: PaymentMethod
  promoCode?: string
  items: Array<{ productId: number; quantity: number; addonIds?: number[] }>
}

export interface OrderRecord {
  id: string
  customerId?: number
  customerName: string
  phone: string
  address?: string
  note?: string
  deliveryMethod: 'delivery' | 'pickup'
  paymentMethod: PaymentMethod
  status: string
  subtotal: number
  discountAmount: number
  promoCode?: string
  deliveryFee: number
  total: number
  createdAt: string
  items: Array<{
    productId: number
    productName: string
    quantity: number
    unitPrice: number
    addons: Array<{ id: number; name: string; price: number }>
  }>
}

interface OrderRow extends Omit<OrderRecord, 'items'> {}

const createOrderTransaction = db.transaction((input: NewOrderInput) => {
  const selectedProducts = input.items.map((item) => {
    const product = getProductById(item.productId)
    if (!product?.active) throw new Error(`Produk ${item.productId} tidak tersedia`)
    const addonIds = [...new Set(item.addonIds || [])]
    const addons = addonIds.map((addonId) => product.addons.find((addon) => addon.id === addonId && addon.active))
    if (addons.some((addon) => !addon)) throw new Error(`Add-on untuk ${product.name} sudah tidak tersedia`)
    return { ...item, product, addons: addons as ProductAddonRecord[] }
  })
  const subtotal = selectedProducts.reduce((sum, item) => {
    const unitPrice = item.product.price + item.addons.reduce((addonSum, addon) => addonSum + addon.price, 0)
    return sum + unitPrice * item.quantity
  }, 0)
  const promotion = input.promoCode ? getActivePromotionByCode(input.promoCode) : undefined
  if (input.promoCode && !promotion) throw new Error('Kode promo tidak tersedia atau sudah berakhir.')
  if (promotion && subtotal < promotion.minOrder) throw new Error(`Minimum belanja untuk promo ${promotion.code} belum terpenuhi.`)
  const discountAmount = promotion
    ? promotion.discountType === 'percentage'
      ? Math.floor(subtotal * promotion.discountValue / 100)
      : Math.min(subtotal, promotion.discountValue)
    : 0
  const deliveryFee = input.deliveryMethod === 'delivery' && subtotal < 75000 ? 9000 : 0
  const total = Math.max(0, subtotal - discountAmount) + deliveryFee
  const prefix = getFranchiseSettings().orderPrefix
  const id = `${prefix}-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`

  db.prepare(`
    INSERT INTO orders (id, customer_id, customer_name, phone, address, note, delivery_method, payment_method, subtotal, discount_amount, promo_code, delivery_fee, total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.customerId,
    input.customerName,
    input.phone,
    input.address || null,
    input.note || null,
    input.deliveryMethod,
    input.paymentMethod,
    subtotal,
    discountAmount,
    promotion?.code || null,
    deliveryFee,
    total,
  )

  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, addons_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  selectedProducts.forEach((item) => {
    const unitPrice = item.product.price + item.addons.reduce((sum, addon) => sum + addon.price, 0)
    const addonsJson = JSON.stringify(item.addons.map((addon) => ({ id: addon.id, name: addon.name, price: addon.price })))
    insertItem.run(id, item.product.id, item.product.name, item.quantity, unitPrice, addonsJson)
  })

  const soldByProduct = new Map<number, number>()
  selectedProducts.forEach((item) => soldByProduct.set(item.product.id, (soldByProduct.get(item.product.id) || 0) + item.quantity))
  const linkedInventory = db.prepare(`
    SELECT id, name, current_stock AS currentStock, usage_per_sale AS usagePerSale
    FROM inventory_items WHERE linked_product_id = ? AND active = 1
  `)
  const updateLinkedStock = db.prepare('UPDATE inventory_items SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
  const insertAutomaticMovement = db.prepare(`
    INSERT INTO stock_movements (item_id, type, quantity, stock_before, stock_after, note, created_by)
    VALUES (?, 'out', ?, ?, ?, ?, ?)
  `)
  soldByProduct.forEach((soldQuantity, productId) => {
    const inventoryRows = linkedInventory.all(productId) as Array<{ id: number; name: string; currentStock: number; usagePerSale: number }>
    inventoryRows.forEach((inventory) => {
      const usedQuantity = soldQuantity * inventory.usagePerSale
      const nextStock = inventory.currentStock - usedQuantity
      if (nextStock < 0) throw new Error(`Stok ${inventory.name} tidak mencukupi untuk pesanan ini.`)
      updateLinkedStock.run(nextStock, inventory.id)
      insertAutomaticMovement.run(inventory.id, usedQuantity, inventory.currentStock, nextStock, `Otomatis dari pesanan ${id}`, null)
    })
  })
  return id
})

export function createOrder(input: NewOrderInput) {
  const id = createOrderTransaction(input)
  return getOrderById(id)
}

export function getOrders() {
  const rows = db.prepare(`
    SELECT
      id,
      customer_id AS customerId,
      customer_name AS customerName,
      phone,
      address,
      note,
      delivery_method AS deliveryMethod,
      payment_method AS paymentMethod,
      status,
      subtotal,
      discount_amount AS discountAmount,
      promo_code AS promoCode,
      delivery_fee AS deliveryFee,
      total,
      created_at AS createdAt
    FROM orders
    ORDER BY created_at DESC
  `).all() as OrderRow[]
  return rows.map((row) => getOrderById(row.id)!)
}

export function getOrderById(id: string) {
  const order = db.prepare(`
    SELECT
      id,
      customer_id AS customerId,
      customer_name AS customerName,
      phone,
      address,
      note,
      delivery_method AS deliveryMethod,
      payment_method AS paymentMethod,
      status,
      subtotal,
      discount_amount AS discountAmount,
      promo_code AS promoCode,
      delivery_fee AS deliveryFee,
      total,
      created_at AS createdAt
    FROM orders WHERE id = ?
  `).get(id) as OrderRow | undefined
  if (!order) return undefined
  const itemRows = db.prepare(`
    SELECT product_id AS productId, product_name AS productName, quantity, unit_price AS unitPrice, addons_json AS addonsJson
    FROM order_items WHERE order_id = ? ORDER BY id ASC
  `).all(id) as Array<Omit<OrderRecord['items'][number], 'addons'> & { addonsJson: string }>
  const items = itemRows.map(({ addonsJson, ...item }) => {
    try { return { ...item, addons: JSON.parse(addonsJson) as OrderRecord['items'][number]['addons'] } }
    catch { return { ...item, addons: [] } }
  })
  return { ...order, address: order.address ?? undefined, note: order.note ?? undefined, promoCode: order.promoCode ?? undefined, items }
}

export function getCustomerOrders(customerId: number) {
  const rows = db.prepare('SELECT id FROM orders WHERE customer_id = ? ORDER BY created_at DESC').all(customerId) as Array<{ id: string }>
  return rows.map((row) => getOrderById(row.id)!)
}

export function updateOrderStatus(id: string, status: string) {
  const result = db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id)
  return result.changes > 0 ? getOrderById(id) : undefined
}

export function getDashboardStats() {
  const totals = db.prepare(`
    SELECT
      COUNT(*) AS totalOrders,
      COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END), 0) AS revenue,
      COALESCE(SUM(CASE WHEN status IN ('new', 'preparing', 'ready', 'delivering') THEN 1 ELSE 0 END), 0) AS activeOrders
    FROM orders
  `).get() as { totalOrders: number; revenue: number; activeOrders: number }
  const productTotal = db.prepare('SELECT COUNT(*) AS count FROM products WHERE active = 1').get() as { count: number }
  return { ...totals, activeProducts: productTotal.count }
}

export type StockMovementType = 'in' | 'out' | 'adjustment_add' | 'adjustment_subtract'

export interface InventoryItemRecord {
  id: number
  name: string
  sku: string
  unit: string
  currentStock: number
  minimumStock: number
  unitCost: number
  linkedProductId?: number
  linkedProductName?: string
  usagePerSale: number
  active: boolean
  lowStock: boolean
}

export interface StockMovementRecord {
  id: number
  itemId: number
  itemName: string
  sku: string
  unit: string
  type: StockMovementType
  quantity: number
  stockBefore: number
  stockAfter: number
  note?: string
  createdByName?: string
  createdAt: string
}

interface InventoryItemRow extends Omit<InventoryItemRecord, 'active' | 'lowStock' | 'linkedProductId' | 'linkedProductName'> {
  linkedProductId: number | null
  linkedProductName: string | null
  active: number
}

const mapInventoryItem = (row: InventoryItemRow): InventoryItemRecord => ({
  ...row,
  linkedProductId: row.linkedProductId ?? undefined,
  linkedProductName: row.linkedProductName ?? undefined,
  active: Boolean(row.active),
  lowStock: row.currentStock <= row.minimumStock,
})

export function getInventoryItems(includeInactive = true) {
  const rows = db.prepare(`
    SELECT items.id, items.name, items.sku, items.unit, items.current_stock AS currentStock,
      items.minimum_stock AS minimumStock, items.unit_cost AS unitCost,
      items.linked_product_id AS linkedProductId, products.name AS linkedProductName,
      items.usage_per_sale AS usagePerSale, items.active
    FROM inventory_items items
    LEFT JOIN products ON products.id = items.linked_product_id
    ${includeInactive ? '' : 'WHERE items.active = 1'}
    ORDER BY items.active DESC, items.name ASC
  `).all() as InventoryItemRow[]
  return rows.map(mapInventoryItem)
}

export function getStockMovements(limit = 100) {
  return db.prepare(`
    SELECT movements.id, movements.item_id AS itemId, items.name AS itemName, items.sku, items.unit,
      movements.type, movements.quantity, movements.stock_before AS stockBefore,
      movements.stock_after AS stockAfter, movements.note, users.name AS createdByName,
      movements.created_at AS createdAt
    FROM stock_movements movements
    JOIN inventory_items items ON items.id = movements.item_id
    LEFT JOIN users ON users.id = movements.created_by
    ORDER BY movements.id DESC
    LIMIT ?
  `).all(Math.max(1, Math.min(500, limit))) as StockMovementRecord[]
}

export function getInventorySnapshot() {
  const items = getInventoryItems(true)
  const movements = getStockMovements()
  const today = db.prepare("SELECT COUNT(*) AS count FROM stock_movements WHERE date(created_at) = date('now')").get() as { count: number }
  return {
    items,
    movements,
    summary: {
      activeItems: items.filter((item) => item.active).length,
      lowStockItems: items.filter((item) => item.active && item.lowStock).length,
      movementsToday: today.count,
    },
  }
}

export function createInventoryItem(input: { name: string; sku: string; unit: string; initialStock: number; minimumStock: number; unitCost: number; linkedProductId?: number; usagePerSale: number; active: boolean }, actorId?: number) {
  const id = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO inventory_items (name, sku, unit, current_stock, minimum_stock, unit_cost, linked_product_id, usage_per_sale, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(input.name, input.sku.toUpperCase(), input.unit, input.initialStock, input.minimumStock, input.unitCost, input.linkedProductId ?? null, input.usagePerSale, input.active ? 1 : 0)
    const itemId = Number(result.lastInsertRowid)
    if (input.initialStock > 0) {
      db.prepare(`
        INSERT INTO stock_movements (item_id, type, quantity, stock_before, stock_after, note, created_by)
        VALUES (?, 'in', ?, 0, ?, 'Stok awal', ?)
      `).run(itemId, input.initialStock, input.initialStock, actorId ?? null)
    }
    return itemId
  })()
  return getInventoryItems(true).find((item) => item.id === id)
}

export function updateInventoryItem(id: number, input: { name: string; sku: string; unit: string; minimumStock: number; unitCost: number; linkedProductId?: number; usagePerSale: number; active: boolean }) {
  const result = db.prepare(`
    UPDATE inventory_items
    SET name = ?, sku = ?, unit = ?, minimum_stock = ?, unit_cost = ?, linked_product_id = ?, usage_per_sale = ?, active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(input.name, input.sku.toUpperCase(), input.unit, input.minimumStock, input.unitCost, input.linkedProductId ?? null, input.usagePerSale, input.active ? 1 : 0, id)
  if (!result.changes) return undefined
  return getInventoryItems(true).find((item) => item.id === id)
}

export function deleteInventoryItem(id: number) {
  const movementCount = db.prepare('SELECT COUNT(*) AS count FROM stock_movements WHERE item_id = ?').get(id) as { count: number }
  if (movementCount.count > 0) {
    const result = db.prepare('UPDATE inventory_items SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id)
    return { deleted: false, archived: result.changes > 0 }
  }
  const result = db.prepare('DELETE FROM inventory_items WHERE id = ?').run(id)
  return { deleted: result.changes > 0, archived: false }
}

export function createStockMovement(input: { itemId: number; type: StockMovementType; quantity: number; note?: string }, actorId?: number) {
  const movementId = db.transaction(() => {
    const row = db.prepare(`
      SELECT id, current_stock AS currentStock, active
      FROM inventory_items WHERE id = ?
    `).get(input.itemId) as { id: number; currentStock: number; active: number } | undefined
    if (!row) throw new Error('Item inventory tidak ditemukan.')
    if (!row.active) throw new Error('Item inventory sedang nonaktif.')
    const subtract = input.type === 'out' || input.type === 'adjustment_subtract'
    const nextStock = row.currentStock + (subtract ? -input.quantity : input.quantity)
    if (nextStock < 0) throw new Error('Stok tidak mencukupi untuk pergerakan ini.')
    db.prepare('UPDATE inventory_items SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nextStock, input.itemId)
    const result = db.prepare(`
      INSERT INTO stock_movements (item_id, type, quantity, stock_before, stock_after, note, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(input.itemId, input.type, input.quantity, row.currentStock, nextStock, input.note || null, actorId ?? null)
    return Number(result.lastInsertRowid)
  })()
  return getStockMovements(500).find((movement) => movement.id === movementId)
}

export type FinancialEntryType = 'expense' | 'capital_in' | 'capital_out'

export interface FinancialEntryRecord {
  id: number
  type: FinancialEntryType
  category: string
  amount: number
  paymentMethod: PaymentMethod
  note?: string
  entryDate: string
  createdByName?: string
  createdAt: string
}

export function getFinancialEntries(from: string, to: string) {
  return db.prepare(`
    SELECT entries.id, entries.type, entries.category, entries.amount,
      entries.payment_method AS paymentMethod, entries.note, entries.entry_date AS entryDate,
      users.name AS createdByName, entries.created_at AS createdAt
    FROM financial_entries entries
    LEFT JOIN users ON users.id = entries.created_by
    WHERE entries.entry_date BETWEEN ? AND ?
    ORDER BY entries.entry_date DESC, entries.id DESC
  `).all(from, to) as FinancialEntryRecord[]
}

export function createFinancialEntry(input: {
  type: FinancialEntryType
  category: string
  amount: number
  paymentMethod: PaymentMethod
  note?: string
  entryDate: string
}, actorId?: number) {
  const result = db.prepare(`
    INSERT INTO financial_entries (type, category, amount, payment_method, note, entry_date, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(input.type, input.category, input.amount, input.paymentMethod, input.note || null, input.entryDate, actorId ?? null)
  return db.prepare(`
    SELECT entries.id, entries.type, entries.category, entries.amount,
      entries.payment_method AS paymentMethod, entries.note, entries.entry_date AS entryDate,
      users.name AS createdByName, entries.created_at AS createdAt
    FROM financial_entries entries
    LEFT JOIN users ON users.id = entries.created_by
    WHERE entries.id = ?
  `).get(Number(result.lastInsertRowid)) as FinancialEntryRecord
}

export function deleteFinancialEntry(id: number) {
  return db.prepare('DELETE FROM financial_entries WHERE id = ?').run(id).changes > 0
}

export function getReportData(from: string, to: string) {
  const orderFilter = "status != 'cancelled' AND date(created_at) BETWEEN ? AND ?"
  const summary = db.prepare(`
    SELECT COUNT(*) AS transactions,
      COALESCE(SUM(subtotal), 0) AS grossSales,
      COALESCE(SUM(discount_amount), 0) AS discounts,
      COALESCE(SUM(total), 0) AS netRevenue,
      COALESCE(AVG(total), 0) AS averageOrder
    FROM orders WHERE ${orderFilter}
  `).get(from, to) as { transactions: number; grossSales: number; discounts: number; netRevenue: number; averageOrder: number }

  const itemsSold = db.prepare(`
    SELECT COALESCE(SUM(items.quantity), 0) AS count
    FROM order_items items JOIN orders ON orders.id = items.order_id
    WHERE orders.status != 'cancelled' AND date(orders.created_at) BETWEEN ? AND ?
  `).get(from, to) as { count: number }

  const dailySales = db.prepare(`
    SELECT date(orders.created_at) AS date, COUNT(DISTINCT orders.id) AS transactions,
      COALESCE(SUM(items.quantity), 0) AS itemsSold,
      MAX(orders.subtotal_total) AS grossSales, MAX(orders.discount_total) AS discounts,
      MAX(orders.revenue_total) AS revenue
    FROM (
      SELECT *, SUM(subtotal) OVER (PARTITION BY date(created_at)) AS subtotal_total,
        SUM(discount_amount) OVER (PARTITION BY date(created_at)) AS discount_total,
        SUM(total) OVER (PARTITION BY date(created_at)) AS revenue_total
      FROM orders WHERE ${orderFilter}
    ) orders
    LEFT JOIN order_items items ON items.order_id = orders.id
    GROUP BY date(orders.created_at)
    ORDER BY date DESC
  `).all(from, to) as Array<{ date: string; transactions: number; itemsSold: number; grossSales: number; discounts: number; revenue: number }>

  const topProducts = db.prepare(`
    SELECT items.product_id AS productId, items.product_name AS productName,
      SUM(items.quantity) AS quantity, SUM(items.quantity * items.unit_price) AS revenue
    FROM order_items items JOIN orders ON orders.id = items.order_id
    WHERE orders.status != 'cancelled' AND date(orders.created_at) BETWEEN ? AND ?
    GROUP BY items.product_id, items.product_name
    ORDER BY quantity DESC, revenue DESC LIMIT 20
  `).all(from, to) as Array<{ productId: number; productName: string; quantity: number; revenue: number }>

  const paymentMethods = db.prepare(`
    SELECT payment_method AS paymentMethod, COUNT(*) AS transactions, COALESCE(SUM(total), 0) AS revenue
    FROM orders WHERE ${orderFilter}
    GROUP BY payment_method ORDER BY revenue DESC
  `).all(from, to) as Array<{ paymentMethod: PaymentMethod; transactions: number; revenue: number }>

  const customers = db.prepare(`
    SELECT users.id AS customerId, users.name, users.email, COUNT(orders.id) AS orderCount,
      COALESCE(SUM(orders.total), 0) AS totalSpent, MAX(orders.created_at) AS lastOrder
    FROM users JOIN orders ON orders.customer_id = users.id
    WHERE users.role = 'customer' AND orders.status != 'cancelled' AND date(orders.created_at) BETWEEN ? AND ?
    GROUP BY users.id, users.name, users.email
    ORDER BY totalSpent DESC
  `).all(from, to) as Array<{ customerId: number; name: string; email: string; orderCount: number; totalSpent: number; lastOrder: string }>

  const entries = getFinancialEntries(from, to)
  const expenseTotal = entries.filter((entry) => entry.type === 'expense').reduce((sum, entry) => sum + entry.amount, 0)
  const capitalIn = entries.filter((entry) => entry.type === 'capital_in').reduce((sum, entry) => sum + entry.amount, 0)
  const capitalOut = entries.filter((entry) => entry.type === 'capital_out').reduce((sum, entry) => sum + entry.amount, 0)
  const expensesByCategory = db.prepare(`
    SELECT category, SUM(amount) AS amount
    FROM financial_entries WHERE type = 'expense' AND entry_date BETWEEN ? AND ?
    GROUP BY category ORDER BY amount DESC
  `).all(from, to) as Array<{ category: string; amount: number }>

  const allTimeSales = db.prepare("SELECT COALESCE(SUM(total), 0) AS amount FROM orders WHERE status != 'cancelled'").get() as { amount: number }
  const allTimeEntries = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN type = 'capital_in' THEN amount ELSE 0 END), 0) AS capitalIn,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expenses,
      COALESCE(SUM(CASE WHEN type = 'capital_out' THEN amount ELSE 0 END), 0) AS capitalOut
    FROM financial_entries
  `).get() as { capitalIn: number; expenses: number; capitalOut: number }
  const stockStatus = getInventoryItems(true).map((item) => ({
    ...item,
    stockValue: item.currentStock * item.unitCost,
  }))
  const inventoryValue = stockStatus.filter((item) => item.active).reduce((sum, item) => sum + item.stockValue, 0)
  const cashBalance = allTimeSales.amount + allTimeEntries.capitalIn - allTimeEntries.expenses - allTimeEntries.capitalOut
  const netProfit = summary.netRevenue - expenseTotal

  return {
    generatedAt: new Date().toISOString(),
    period: { from, to },
    operational: {
      summary: { ...summary, averageOrder: Math.round(summary.averageOrder), itemsSold: itemsSold.count },
      dailySales,
      topProducts,
      paymentMethods,
      stockStatus,
      customers,
    },
    financial: {
      profitLoss: { revenue: summary.netRevenue, expenses: expenseTotal, netProfit },
      cashFlow: {
        salesInflow: summary.netRevenue,
        capitalIn,
        totalInflow: summary.netRevenue + capitalIn,
        expensesOutflow: expenseTotal,
        capitalOut,
        totalOutflow: expenseTotal + capitalOut,
        netCashFlow: summary.netRevenue + capitalIn - expenseTotal - capitalOut,
      },
      balanceSheet: {
        cashBalance,
        inventoryValue,
        totalAssets: cashBalance + inventoryValue,
        liabilities: 0,
        equity: cashBalance + inventoryValue,
      },
      equityChanges: { capitalIn, capitalOut, retainedEarnings: netProfit, netChange: capitalIn + netProfit - capitalOut },
      expensesByCategory,
      entries,
    },
  }
}

export { databasePath }
