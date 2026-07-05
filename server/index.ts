import 'dotenv/config'
import express, { type NextFunction, type Request, type Response } from 'express'
import helmet from 'helmet'
import jwt from 'jsonwebtoken'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  authenticateUser,
  changeUserPassword,
  createMenuCategory,
  createOrder,
  createInventoryItem,
  createPromotion,
  createProduct,
  createStockMovement,
  createFinancialEntry,
  createUser,
  databasePath,
  deleteCashier,
  deleteInventoryItem,
  deleteMenuCategory,
  deleteProduct,
  deletePromotion,
  deleteFinancialEntry,
  getFranchiseSettings,
  getCustomerOrders,
  getDashboardStats,
  getCashiers,
  getInventorySnapshot,
  getMenuCategories,
  getOrders,
  getProducts,
  getPromotions,
  getReportData,
  getRolePermissionMatrix,
  getRolePermissions,
  getUserById,
  hasModuleAccess,
  menuCategoryExists,
  setMenuCategoryActive,
  setProductActive,
  updateCashier,
  updateInventoryItem,
  updateMenuCategory,
  updateOrderStatus,
  updateUserProfile,
  updateFranchiseSettings,
  updatePromotion,
  updateProduct,
  updateRolePermissions,
  type FranchiseSettingsRecord,
  type MenuCategoryRecord,
  type NewOrderInput,
  type PermissionModule,
  type ProductRecord,
  type ProductAddonInput,
  type ProductInput,
  type PromotionRecord,
  type StockMovementType,
  type FinancialEntryType,
  type PaymentMethod,
  type UserRole,
} from './db.js'

const app = express()
const port = Number(process.env.PORT || 3001)
const isProduction = process.env.NODE_ENV === 'production'
const adminPassword = process.env.APP_ADMIN_PASSWORD || (isProduction ? '' : 'admin123')
const jwtSecret = process.env.APP_JWT_SECRET || (isProduction ? '' : 'franchise-local-secret')
const allowedTones = ['gold', 'cream', 'red', 'orange', 'yellow', 'pink', 'peach', 'blue']
const allowedStatuses = ['new', 'preparing', 'ready', 'delivering', 'completed', 'cancelled']
const allowedPaymentMethods: PaymentMethod[] = ['cash', 'qris', 'bank_transfer', 'ewallet']

if (!adminPassword || !jwtSecret) {
  throw new Error('APP_ADMIN_PASSWORD dan APP_JWT_SECRET wajib diisi untuk mode production.')
}

app.use(helmet({ contentSecurityPolicy: false }))
app.use(express.json({ limit: '6mb' }))

type AppRole = UserRole
interface AuthPayload {
  role: AppRole
  userId?: number
  name?: string
  email?: string
}
interface AuthenticatedRequest extends Request {
  auth?: AuthPayload
}

const requireRoles = (...roles: AppRole[]) => (request: Request, response: Response, next: NextFunction) => {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return response.status(401).json({ message: 'Silakan login untuk melanjutkan.' })
  try {
    const payload = jwt.verify(token, jwtSecret) as AuthPayload
    if (!roles.includes(payload.role)) return response.status(403).json({ message: 'Anda tidak memiliki akses ke halaman ini.' })
    if (payload.userId) {
      const user = getUserById(payload.userId)
      if (!user || !user.active || user.role !== payload.role) return response.status(401).json({ message: 'Akun sudah tidak aktif. Silakan hubungi manager.' })
    } else if (payload.role !== 'admin') {
      return response.status(401).json({ message: 'Sesi login tidak valid.' })
    }
    ;(request as AuthenticatedRequest).auth = payload
    next()
  } catch {
    response.status(401).json({ message: 'Sesi login sudah berakhir.' })
  }
}

const requireModuleAccess = (module: PermissionModule, ...roles: AppRole[]) => [
  requireRoles(...roles),
  (request: Request, response: Response, next: NextFunction) => {
    const auth = (request as AuthenticatedRequest).auth
    if (!auth || !hasModuleAccess(auth.role, module)) {
      return response.status(403).json({ message: `Role ${auth?.role || 'ini'} tidak memiliki akses ke modul ini.` })
    }
    next()
  },
]
const requireAnyModuleAccess = (modules: PermissionModule[], ...roles: AppRole[]) => [
  requireRoles(...roles),
  (request: Request, response: Response, next: NextFunction) => {
    const auth = (request as AuthenticatedRequest).auth
    if (!auth || !modules.some((module) => hasModuleAccess(auth.role, module))) {
      return response.status(403).json({ message: `Role ${auth?.role || 'ini'} tidak memiliki akses ke modul ini.` })
    }
    next()
  },
]

const normalizeProduct = (body: Partial<ProductRecord>): ProductInput => {
  const price = Number(body.price)
  const originalPrice = body.originalPrice ? Number(body.originalPrice) : undefined
  const imageUrl = body.imageUrl?.trim()
  const category = String(body.category || '').trim()
  if (!body.name?.trim() || !body.description?.trim()) throw new Error('Nama dan deskripsi produk wajib diisi.')
  if (!Number.isFinite(price) || price < 0) throw new Error('Harga produk tidak valid.')
  if (!category || !menuCategoryExists(category)) throw new Error('Kategori produk tidak valid. Tambahkan kategori lewat menu Manager terlebih dahulu.')
  if (imageUrl && imageUrl.length > 3_000_000) throw new Error('Ukuran foto produk terlalu besar. Maksimal sekitar 2 MB.')
  if (imageUrl && !/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(imageUrl)) throw new Error('Format foto produk tidak valid.')
  const addonRows = Array.isArray(body.addons) ? body.addons : []
  if (addonRows.length > 20) throw new Error('Maksimal 20 add-on untuk satu produk.')
  const addons: ProductAddonInput[] = addonRows.map((rawAddon) => {
    const addon = rawAddon as Partial<ProductAddonInput>
    const name = String(addon.name || '').trim()
    const addonPrice = Number(addon.price)
    if (!name || name.length > 60) throw new Error('Nama add-on wajib diisi dan maksimal 60 karakter.')
    if (!Number.isInteger(addonPrice) || addonPrice < 0 || addonPrice > 10_000_000) throw new Error(`Harga add-on ${name} tidak valid.`)
    return {
      id: Number.isInteger(Number(addon.id)) && Number(addon.id) > 0 ? Number(addon.id) : undefined,
      name,
      price: addonPrice,
      active: addon.active !== false,
    }
  })
  return {
    name: body.name.trim(),
    description: body.description.trim(),
    price,
    originalPrice,
    category,
    emoji: body.emoji?.trim() || '🍗',
    imageUrl: imageUrl || undefined,
    tone: allowedTones.includes(String(body.tone)) ? String(body.tone) : 'gold',
    badge: body.badge?.trim() || undefined,
    spicy: Boolean(body.spicy),
    active: body.active !== false,
    addons,
  }
}

const normalizeMenuCategory = (body: Partial<MenuCategoryRecord>): Omit<MenuCategoryRecord, 'id' | 'productCount'> => {
  const label = String(body.label || '').trim()
  const emoji = String(body.emoji || '🍽️').trim().slice(0, 12) || '🍽️'
  const sortOrder = Number(body.sortOrder ?? 0)
  if (label.length < 2 || label.length > 40) throw new Error('Nama kategori harus 2-40 karakter.')
  if (label.toLowerCase() === 'semua') throw new Error('Kategori "Semua" adalah tab sistem dan tidak dapat dipakai.')
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) throw new Error('Urutan kategori harus angka 0-9999.')
  return { label, emoji, sortOrder, active: body.active !== false }
}

const normalizePromotion = (body: Partial<PromotionRecord>): Omit<PromotionRecord, 'id'> => {
  const discountValue = Number(body.discountValue)
  const minOrder = Number(body.minOrder || 0)
  if (!body.title?.trim() || !body.description?.trim() || !body.code?.trim()) throw new Error('Judul, deskripsi, dan kode promo wajib diisi.')
  if (!['percentage', 'fixed'].includes(String(body.discountType))) throw new Error('Tipe diskon tidak valid.')
  if (!Number.isFinite(discountValue) || discountValue <= 0) throw new Error('Nilai diskon tidak valid.')
  if (body.discountType === 'percentage' && discountValue > 100) throw new Error('Diskon persentase maksimal 100%.')
  if (!Number.isFinite(minOrder) || minOrder < 0) throw new Error('Minimum pesanan tidak valid.')
  if (body.startDate && body.endDate && body.startDate > body.endDate) throw new Error('Tanggal berakhir harus setelah tanggal mulai.')
  return {
    title: body.title.trim(), description: body.description.trim(), code: body.code.trim().toUpperCase(),
    discountType: body.discountType as 'percentage' | 'fixed', discountValue, minOrder,
    startDate: body.startDate || undefined, endDate: body.endDate || undefined, active: body.active !== false,
  }
}

const normalizeInventoryItem = (body: Record<string, unknown>, includeInitialStock: boolean) => {
  const name = String(body.name || '').trim()
  const sku = String(body.sku || '').trim().toUpperCase()
  const unit = String(body.unit || '').trim()
  const minimumStock = Number(body.minimumStock || 0)
  const initialStock = includeInitialStock ? Number(body.initialStock || 0) : 0
  const unitCost = Number(body.unitCost || 0)
  const linkedProductId = body.linkedProductId ? Number(body.linkedProductId) : undefined
  const usagePerSale = Number(body.usagePerSale || 1)
  if (name.length < 2 || name.length > 80) throw new Error('Nama item inventory harus 2-80 karakter.')
  if (!/^[A-Z0-9][A-Z0-9_-]{1,29}$/.test(sku)) throw new Error('SKU harus 2-30 karakter dan hanya berisi huruf, angka, strip, atau underscore.')
  if (!unit || unit.length > 20) throw new Error('Satuan inventory wajib diisi dan maksimal 20 karakter.')
  if (!Number.isFinite(minimumStock) || minimumStock < 0) throw new Error('Minimum stok tidak valid.')
  if (!Number.isFinite(initialStock) || initialStock < 0) throw new Error('Stok awal tidak valid.')
  if (!Number.isInteger(unitCost) || unitCost < 0) throw new Error('Harga modal per satuan tidak valid.')
  if (linkedProductId !== undefined && (!Number.isInteger(linkedProductId) || linkedProductId < 1)) throw new Error('Produk terkait tidak valid.')
  if (!Number.isFinite(usagePerSale) || usagePerSale <= 0) throw new Error('Pemakaian stok per penjualan harus lebih dari nol.')
  return { name, sku, unit, minimumStock, initialStock, unitCost, linkedProductId, usagePerSale, active: body.active !== false }
}

const normalizeStockMovement = (body: Record<string, unknown>) => {
  const itemId = Number(body.itemId)
  const type = String(body.type || '') as StockMovementType
  const quantity = Number(body.quantity)
  const note = String(body.note || '').trim().slice(0, 180)
  if (!Number.isInteger(itemId) || itemId < 1) throw new Error('Item inventory tidak valid.')
  if (!['in', 'out', 'adjustment_add', 'adjustment_subtract'].includes(type)) throw new Error('Tipe pergerakan stok tidak valid.')
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Jumlah pergerakan stok harus lebih dari nol.')
  return { itemId, type, quantity, note: note || undefined }
}

const normalizeDate = (value: unknown, field: string) => {
  const date = String(value || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) throw new Error(`${field} tidak valid.`)
  return date
}

const normalizeFinancialEntry = (body: Record<string, unknown>) => {
  const type = String(body.type || '') as FinancialEntryType
  const category = String(body.category || '').trim()
  const amount = Number(body.amount)
  const paymentMethod = String(body.paymentMethod || '') as PaymentMethod
  const note = String(body.note || '').trim().slice(0, 180)
  const entryDate = normalizeDate(body.entryDate, 'Tanggal transaksi')
  if (!['expense', 'capital_in', 'capital_out'].includes(type)) throw new Error('Tipe transaksi keuangan tidak valid.')
  if (category.length < 2 || category.length > 60) throw new Error('Kategori harus 2-60 karakter.')
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Nominal harus berupa rupiah bulat dan lebih dari nol.')
  if (!allowedPaymentMethods.includes(paymentMethod)) throw new Error('Metode pembayaran tidak valid.')
  return { type, category, amount, paymentMethod, note: note || undefined, entryDate }
}

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, database: path.basename(databasePath) })
})

app.get('/api/settings', (_request, response) => {
  response.json(getFranchiseSettings())
})

app.get('/api/categories', (_request, response) => {
  response.json(getMenuCategories(false))
})

app.get('/api/products', (_request, response) => {
  response.json(getProducts())
})

app.get('/api/promotions', (_request, response) => {
  response.json(getPromotions())
})

app.post('/api/orders', requireRoles('customer'), (request, response) => {
  try {
    const input = request.body as Partial<NewOrderInput>
    if (!input.customerName?.trim()) throw new Error('Nama pemesan wajib diisi.')
    if (!input.phone || input.phone.replace(/\D/g, '').length < 8) throw new Error('Nomor WhatsApp tidak valid.')
    if (!['delivery', 'pickup'].includes(String(input.deliveryMethod))) throw new Error('Metode pesanan tidak valid.')
    if (!allowedPaymentMethods.includes(input.paymentMethod as PaymentMethod)) throw new Error('Metode pembayaran tidak valid.')
    if (input.deliveryMethod === 'delivery' && !input.address?.trim()) throw new Error('Alamat pengantaran wajib diisi.')
    if (!Array.isArray(input.items) || input.items.length === 0) throw new Error('Keranjang masih kosong.')
    if (input.items.some((item) => !Number.isInteger(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20
      || (item.addonIds !== undefined && (!Array.isArray(item.addonIds) || item.addonIds.length > 20 || item.addonIds.some((id) => !Number.isInteger(id)))))) {
      throw new Error('Jumlah produk tidak valid.')
    }
    const order = createOrder({
      customerId: (request as AuthenticatedRequest).auth!.userId!,
      customerName: input.customerName.trim(),
      phone: input.phone.trim(),
      address: input.address?.trim(),
      note: input.note?.trim(),
      deliveryMethod: input.deliveryMethod as 'delivery' | 'pickup',
      paymentMethod: input.paymentMethod as PaymentMethod,
      promoCode: input.promoCode?.trim() || undefined,
      items: input.items,
    })
    response.status(201).json(order)
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Pesanan gagal dibuat.' })
  }
})

app.post('/api/auth/register', (request, response) => {
  try {
    const name = String(request.body?.name || '').trim()
    const email = String(request.body?.email || '').trim().toLowerCase()
    const password = String(request.body?.password || '')
    if (name.length < 2) throw new Error('Nama minimal 2 karakter.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Alamat email tidak valid.')
    if (password.length < 8) throw new Error('Password minimal 8 karakter.')
    const user = createUser({ name, email, password, role: 'customer' })
    const token = jwt.sign({ role: user.role, userId: user.id, name: user.name, email: user.email }, jwtSecret, { expiresIn: '7d' })
    response.status(201).json({ token, user })
  } catch (error) {
    const message = error instanceof Error && error.message.includes('UNIQUE')
      ? 'Email sudah terdaftar.'
      : error instanceof Error ? error.message : 'Pendaftaran gagal.'
    response.status(400).json({ message })
  }
})

app.post('/api/auth/login', (request, response) => {
  const email = String(request.body?.email || '').trim().toLowerCase()
  const password = String(request.body?.password || '')
  const role = String(request.body?.role || '') as UserRole
  if (!['customer', 'cashier', 'manager', 'admin'].includes(role)) return response.status(400).json({ message: 'Tipe pengguna tidak valid.' })
  const user = authenticateUser(email, password, role)
  if (!user) return response.status(401).json({ message: 'Email, password, atau tipe pengguna salah.' })
  const token = jwt.sign({ role: user.role, userId: user.id, name: user.name, email: user.email }, jwtSecret, { expiresIn: '7d' })
  response.json({ token, user })
})

app.get('/api/auth/me', requireRoles('customer', 'cashier', 'manager', 'admin'), (request, response) => {
  const user = getUserById((request as AuthenticatedRequest).auth!.userId!)
  if (!user) return response.status(404).json({ message: 'Pengguna tidak ditemukan.' })
  response.json(user)
})

app.get('/api/permissions/me', requireRoles('cashier', 'manager', 'admin'), (request, response) => {
  const auth = (request as AuthenticatedRequest).auth!
  response.json({ role: auth.role, modules: getRolePermissions(auth.role) })
})

app.get('/api/admin/rbac', ...requireModuleAccess('rbac', 'admin'), (_request, response) => {
  response.json(getRolePermissionMatrix())
})

app.put('/api/admin/rbac', ...requireModuleAccess('rbac', 'admin'), (request, response) => {
  response.json(updateRolePermissions(request.body?.permissions || request.body || {}))
})

app.put('/api/profile', requireRoles('customer', 'cashier', 'manager', 'admin'), (request, response) => {
  try {
    const name = String(request.body?.name || '').trim()
    const email = String(request.body?.email || '').trim().toLowerCase()
    if (name.length < 2) throw new Error('Nama minimal 2 karakter.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Alamat email tidak valid.')
    const user = updateUserProfile((request as AuthenticatedRequest).auth!.userId!, { name, email })
    if (!user) return response.status(404).json({ message: 'Pengguna tidak ditemukan.' })
    response.json(user)
  } catch (error) {
    const message = error instanceof Error && error.message.includes('UNIQUE') ? 'Email sudah digunakan.' : error instanceof Error ? error.message : 'Profil gagal diperbarui.'
    response.status(400).json({ message })
  }
})

app.put('/api/profile/password', requireRoles('customer', 'cashier', 'manager', 'admin'), (request, response) => {
  const currentPassword = String(request.body?.currentPassword || '')
  const newPassword = String(request.body?.newPassword || '')
  if (newPassword.length < 8) return response.status(400).json({ message: 'Password baru minimal 8 karakter.' })
  const changed = changeUserPassword((request as AuthenticatedRequest).auth!.userId!, currentPassword, newPassword)
  if (!changed) return response.status(400).json({ message: 'Password saat ini salah.' })
  response.json({ changed: true })
})

app.post('/api/auth/admin', (request, response) => {
  if (typeof request.body?.password !== 'string' || request.body.password !== adminPassword) {
    return response.status(401).json({ message: 'Password admin salah.' })
  }
  const token = jwt.sign({ role: 'admin' }, jwtSecret, { expiresIn: '12h' })
  response.json({ token })
})

app.get('/api/customer/orders', requireRoles('customer'), (request, response) => {
  response.json(getCustomerOrders((request as AuthenticatedRequest).auth!.userId!))
})

app.get('/api/cashier/stats', ...requireModuleAccess('cashier_station', 'cashier', 'manager', 'admin'), (_request, response) => {
  response.json(getDashboardStats())
})

app.get('/api/cashier/orders', ...requireModuleAccess('cashier_station', 'cashier', 'manager', 'admin'), (_request, response) => {
  response.json(getOrders())
})

app.patch('/api/cashier/orders/:id/status', ...requireModuleAccess('cashier_station', 'cashier', 'manager', 'admin'), (request, response) => {
  const status = String(request.body?.status || '')
  if (!allowedStatuses.includes(status)) return response.status(400).json({ message: 'Status tidak valid.' })
  const order = updateOrderStatus(String(request.params.id), status)
  if (!order) return response.status(404).json({ message: 'Pesanan tidak ditemukan.' })
  response.json(order)
})

app.get('/api/manager/categories', ...requireAnyModuleAccess(['categories', 'products'], 'manager', 'admin'), (_request, response) => {
  response.json(getMenuCategories(true, true))
})

app.post('/api/manager/categories', ...requireModuleAccess('categories', 'manager', 'admin'), (request, response) => {
  try {
    response.status(201).json(createMenuCategory(normalizeMenuCategory(request.body)))
  } catch (error) {
    const message = error instanceof Error && error.message.includes('UNIQUE')
      ? 'Nama kategori sudah digunakan.'
      : error instanceof Error ? error.message : 'Kategori gagal dibuat.'
    response.status(400).json({ message })
  }
})

app.put('/api/manager/categories/:id', ...requireModuleAccess('categories', 'manager', 'admin'), (request, response) => {
  try {
    const category = updateMenuCategory(Number(request.params.id), normalizeMenuCategory(request.body))
    if (!category) return response.status(404).json({ message: 'Kategori tidak ditemukan.' })
    response.json(category)
  } catch (error) {
    const message = error instanceof Error && error.message.includes('UNIQUE')
      ? 'Nama kategori sudah digunakan.'
      : error instanceof Error ? error.message : 'Kategori gagal diperbarui.'
    response.status(400).json({ message })
  }
})

app.patch('/api/manager/categories/:id/active', ...requireModuleAccess('categories', 'manager', 'admin'), (request, response) => {
  const category = setMenuCategoryActive(Number(request.params.id), Boolean(request.body?.active))
  if (!category) return response.status(404).json({ message: 'Kategori tidak ditemukan.' })
  response.json(category)
})

app.delete('/api/manager/categories/:id', ...requireModuleAccess('categories', 'manager', 'admin'), (request, response) => {
  const result = deleteMenuCategory(Number(request.params.id))
  if (!result.deleted && !result.archived) return response.status(404).json({ message: 'Kategori tidak ditemukan.' })
  response.json(result)
})

app.get('/api/manager/products', ...requireAnyModuleAccess(['products', 'inventory'], 'manager', 'admin'), (_request, response) => {
  response.json(getProducts(true))
})

app.post('/api/manager/products', ...requireModuleAccess('products', 'manager', 'admin'), (request, response) => {
  try { response.status(201).json(createProduct(normalizeProduct(request.body))) }
  catch (error) { response.status(400).json({ message: error instanceof Error ? error.message : 'Produk gagal dibuat.' }) }
})

app.put('/api/manager/products/:id', ...requireModuleAccess('products', 'manager', 'admin'), (request, response) => {
  try {
    const product = updateProduct(Number(request.params.id), normalizeProduct(request.body))
    if (!product) return response.status(404).json({ message: 'Produk tidak ditemukan.' })
    response.json(product)
  } catch (error) { response.status(400).json({ message: error instanceof Error ? error.message : 'Produk gagal diperbarui.' }) }
})

app.patch('/api/manager/products/:id/active', ...requireModuleAccess('products', 'manager', 'admin'), (request, response) => {
  const product = setProductActive(Number(request.params.id), Boolean(request.body?.active))
  if (!product) return response.status(404).json({ message: 'Produk tidak ditemukan.' })
  response.json(product)
})

app.delete('/api/manager/products/:id', ...requireModuleAccess('products', 'manager', 'admin'), (request, response) => {
  const result = deleteProduct(Number(request.params.id))
  if (!result.deleted && !result.archived) return response.status(404).json({ message: 'Produk tidak ditemukan.' })
  response.json(result)
})

app.get('/api/manager/settings', ...requireModuleAccess('settings', 'manager', 'admin'), (_request, response) => {
  response.json(getFranchiseSettings())
})

app.put('/api/manager/settings', ...requireModuleAccess('settings', 'manager', 'admin'), (request, response) => {
  try {
    response.json(updateFranchiseSettings(request.body as Partial<FranchiseSettingsRecord>))
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Pengaturan franchise gagal disimpan.' })
  }
})

app.get('/api/manager/cashiers', ...requireModuleAccess('cashiers', 'manager', 'admin'), (_request, response) => {
  response.json(getCashiers())
})

app.post('/api/manager/cashiers', ...requireModuleAccess('cashiers', 'manager', 'admin'), (request, response) => {
  try {
    const name = String(request.body?.name || '').trim()
    const email = String(request.body?.email || '').trim().toLowerCase()
    const password = String(request.body?.password || '')
    if (name.length < 2) throw new Error('Nama cashier minimal 2 karakter.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Alamat email cashier tidak valid.')
    if (password.length < 8) throw new Error('Password cashier minimal 8 karakter.')
    response.status(201).json(createUser({ name, email, password, role: 'cashier' }))
  } catch (error) {
    const message = error instanceof Error && error.message.includes('UNIQUE')
      ? 'Email cashier sudah terdaftar.'
      : error instanceof Error ? error.message : 'Cashier gagal dibuat.'
    response.status(400).json({ message })
  }
})

app.put('/api/manager/cashiers/:id', ...requireModuleAccess('cashiers', 'manager', 'admin'), (request, response) => {
  try {
    const id = Number(request.params.id)
    const name = String(request.body?.name || '').trim()
    const email = String(request.body?.email || '').trim().toLowerCase()
    const password = String(request.body?.password || '')
    const active = request.body?.active !== false
    if (!Number.isInteger(id) || id < 1) throw new Error('ID cashier tidak valid.')
    if (name.length < 2) throw new Error('Nama cashier minimal 2 karakter.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Alamat email cashier tidak valid.')
    if (password && password.length < 8) throw new Error('Password baru minimal 8 karakter.')
    const cashier = updateCashier(id, { name, email, password: password || undefined, active })
    if (!cashier) return response.status(404).json({ message: 'Cashier tidak ditemukan.' })
    response.json(cashier)
  } catch (error) {
    const message = error instanceof Error && error.message.includes('UNIQUE')
      ? 'Email cashier sudah terdaftar.'
      : error instanceof Error ? error.message : 'Cashier gagal diperbarui.'
    response.status(400).json({ message })
  }
})

app.delete('/api/manager/cashiers/:id', ...requireModuleAccess('cashiers', 'manager', 'admin'), (request, response) => {
  try {
    const id = Number(request.params.id)
    if (!Number.isInteger(id) || id < 1) return response.status(400).json({ message: 'ID cashier tidak valid.' })
    if (!deleteCashier(id)) return response.status(404).json({ message: 'Cashier tidak ditemukan.' })
    response.json({ deleted: true })
  } catch {
    response.status(400).json({ message: 'Cashier tidak dapat dihapus.' })
  }
})

app.get('/api/manager/promotions', ...requireModuleAccess('promotions', 'manager', 'admin'), (_request, response) => {
  response.json(getPromotions(true))
})

app.post('/api/manager/promotions', ...requireModuleAccess('promotions', 'manager', 'admin'), (request, response) => {
  try { response.status(201).json(createPromotion(normalizePromotion(request.body))) }
  catch (error) { response.status(400).json({ message: error instanceof Error && error.message.includes('UNIQUE') ? 'Kode promo sudah digunakan.' : error instanceof Error ? error.message : 'Promosi gagal dibuat.' }) }
})

app.put('/api/manager/promotions/:id', ...requireModuleAccess('promotions', 'manager', 'admin'), (request, response) => {
  try {
    const promotion = updatePromotion(Number(request.params.id), normalizePromotion(request.body))
    if (!promotion) return response.status(404).json({ message: 'Promosi tidak ditemukan.' })
    response.json(promotion)
  } catch (error) { response.status(400).json({ message: error instanceof Error && error.message.includes('UNIQUE') ? 'Kode promo sudah digunakan.' : error instanceof Error ? error.message : 'Promosi gagal diperbarui.' }) }
})

app.delete('/api/manager/promotions/:id', ...requireModuleAccess('promotions', 'manager', 'admin'), (request, response) => {
  if (!deletePromotion(Number(request.params.id))) return response.status(404).json({ message: 'Promosi tidak ditemukan.' })
  response.json({ deleted: true })
})

app.get('/api/manager/inventory', ...requireModuleAccess('inventory', 'manager', 'admin'), (_request, response) => {
  response.json(getInventorySnapshot())
})

app.post('/api/manager/inventory/items', ...requireModuleAccess('inventory', 'manager', 'admin'), (request, response) => {
  try {
    const item = createInventoryItem(normalizeInventoryItem(request.body as Record<string, unknown>, true), (request as AuthenticatedRequest).auth?.userId)
    response.status(201).json(item)
  } catch (error) {
    const message = error instanceof Error && error.message.includes('UNIQUE')
      ? 'SKU inventory sudah digunakan.'
      : error instanceof Error ? error.message : 'Item inventory gagal dibuat.'
    response.status(400).json({ message })
  }
})

app.put('/api/manager/inventory/items/:id', ...requireModuleAccess('inventory', 'manager', 'admin'), (request, response) => {
  try {
    const id = Number(request.params.id)
    if (!Number.isInteger(id) || id < 1) throw new Error('ID inventory tidak valid.')
    const input = normalizeInventoryItem(request.body as Record<string, unknown>, false)
    const item = updateInventoryItem(id, input)
    if (!item) return response.status(404).json({ message: 'Item inventory tidak ditemukan.' })
    response.json(item)
  } catch (error) {
    const message = error instanceof Error && error.message.includes('UNIQUE')
      ? 'SKU inventory sudah digunakan.'
      : error instanceof Error ? error.message : 'Item inventory gagal diperbarui.'
    response.status(400).json({ message })
  }
})

app.delete('/api/manager/inventory/items/:id', ...requireModuleAccess('inventory', 'manager', 'admin'), (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isInteger(id) || id < 1) return response.status(400).json({ message: 'ID inventory tidak valid.' })
  const result = deleteInventoryItem(id)
  if (!result.deleted && !result.archived) return response.status(404).json({ message: 'Item inventory tidak ditemukan.' })
  response.json(result)
})

app.post('/api/manager/inventory/movements', ...requireModuleAccess('inventory', 'manager', 'admin'), (request, response) => {
  try {
    const movement = createStockMovement(normalizeStockMovement(request.body as Record<string, unknown>), (request as AuthenticatedRequest).auth?.userId)
    response.status(201).json(movement)
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Pergerakan stok gagal dicatat.' })
  }
})

app.get('/api/manager/reports', ...requireModuleAccess('reports', 'manager', 'admin'), (request, response) => {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const from = normalizeDate(request.query.from || `${today.slice(0, 8)}01`, 'Tanggal awal')
    const to = normalizeDate(request.query.to || today, 'Tanggal akhir')
    if (from > to) throw new Error('Tanggal awal tidak boleh setelah tanggal akhir.')
    response.json(getReportData(from, to))
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Laporan gagal dibuat.' })
  }
})

app.post('/api/manager/financial-entries', ...requireModuleAccess('reports', 'manager', 'admin'), (request, response) => {
  try {
    response.status(201).json(createFinancialEntry(
      normalizeFinancialEntry(request.body as Record<string, unknown>),
      (request as AuthenticatedRequest).auth?.userId,
    ))
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Transaksi keuangan gagal dicatat.' })
  }
})

app.delete('/api/manager/financial-entries/:id', ...requireModuleAccess('reports', 'manager', 'admin'), (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isInteger(id) || id < 1) return response.status(400).json({ message: 'ID transaksi tidak valid.' })
  if (!deleteFinancialEntry(id)) return response.status(404).json({ message: 'Transaksi keuangan tidak ditemukan.' })
  response.json({ deleted: true })
})

app.get('/api/admin/stats', ...requireModuleAccess('cashier_station', 'admin'), (_request, response) => {
  response.json(getDashboardStats())
})

app.get('/api/admin/orders', ...requireModuleAccess('cashier_station', 'admin'), (_request, response) => {
  response.json(getOrders())
})

app.patch('/api/admin/orders/:id/status', ...requireModuleAccess('cashier_station', 'admin'), (request, response) => {
  const status = String(request.body?.status || '')
  if (!allowedStatuses.includes(status)) return response.status(400).json({ message: 'Status tidak valid.' })
  const order = updateOrderStatus(String(request.params.id), status)
  if (!order) return response.status(404).json({ message: 'Pesanan tidak ditemukan.' })
  response.json(order)
})

app.get('/api/admin/products', ...requireModuleAccess('products', 'admin'), (_request, response) => {
  response.json(getProducts(true))
})

app.post('/api/admin/products', ...requireModuleAccess('products', 'admin'), (request, response) => {
  try {
    response.status(201).json(createProduct(normalizeProduct(request.body)))
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Produk gagal dibuat.' })
  }
})

app.put('/api/admin/products/:id', ...requireModuleAccess('products', 'admin'), (request, response) => {
  try {
    const product = updateProduct(Number(request.params.id), normalizeProduct(request.body))
    if (!product) return response.status(404).json({ message: 'Produk tidak ditemukan.' })
    response.json(product)
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Produk gagal diperbarui.' })
  }
})

app.patch('/api/admin/products/:id/active', ...requireModuleAccess('products', 'admin'), (request, response) => {
  const product = setProductActive(Number(request.params.id), Boolean(request.body?.active))
  if (!product) return response.status(404).json({ message: 'Produk tidak ditemukan.' })
  response.json(product)
})

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const distDirectory = path.resolve(currentDirectory, '..', 'dist')
if (existsSync(distDirectory)) {
  app.use(express.static(distDirectory))
  app.get(/^(?!\/api).*/, (_request, response) => response.sendFile(path.join(distDirectory, 'index.html')))
}

app.use((error: Error, _request: Request, response: Response, _next: NextFunction) => {
  console.error(error)
  response.status(500).json({ message: 'Terjadi masalah pada server.' })
})

app.listen(port, '0.0.0.0', () => {
  console.log(`Franchise API aktif di http://localhost:${port}`)
  console.log(`Database: ${databasePath}`)
})
