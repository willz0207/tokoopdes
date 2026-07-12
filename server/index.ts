import 'dotenv/config'
import express, { type NextFunction, type Request, type Response } from 'express'
import helmet from 'helmet'
import jwt from 'jsonwebtoken'
import { existsSync } from 'node:fs'
import path from 'node:path'
import * as storage from './postgres-db.js'
import { createPaymentSession, paymentMode, paymentStatusFromMidtrans, verifyMidtransNotification, type MidtransNotification } from './payments.js'
import type {
  FranchiseSettingsRecord,
  MenuCategoryRecord,
  NewOrderInput,
  OutletRecord,
  PermissionModule,
  ProductRecord,
  ProductAddonInput,
  ProductInput,
  ProductOutletAssignmentInput,
  PromotionRecord,
  StockMovementType,
  FinancialEntryType,
  PaymentMethod,
  UserRole,
} from './contracts.js'

const {
  authenticateUser,
  changeUserPassword,
  createMenuCategory,
  createOrder,
  createInventoryItem,
  createPromotion,
  createProduct,
  createStockMovement,
  createFinancialEntry,
  createOutlet,
  createUser,
  deleteCashier,
  deleteInventoryItem,
  deleteMenuCategory,
  deleteProduct,
  deletePromotion,
  deleteFinancialEntry,
  deleteOutlet,
  getFranchiseSettings,
  getCustomerOrders,
  getDashboardStats,
  getCashiers,
  getInventorySnapshot,
  getMenuCategories,
  getOrders,
  getOrderById,
  getOutlets,
  getOutletById,
  getDefaultOutlet,
  getOrderPaymentTarget,
  getPaymentSession,
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
  setProductOutletAssignment,
  savePaymentSession,
  updateCashier,
  updateInventoryItem,
  updateMenuCategory,
  updateOrderStatus,
  updateOutlet,
  updatePaymentStatus,
  updateUserProfile,
  updateFranchiseSettings,
  updatePromotion,
  updateProduct,
  updateRolePermissions,
  checkAndLogPaymentNotification,
} = storage

export const app = express()
const isProduction = process.env.NODE_ENV === 'production'
const adminPassword = process.env.APP_ADMIN_PASSWORD || (isProduction ? '' : 'admin123')
const jwtSecret = process.env.APP_JWT_SECRET || (isProduction ? '' : 'franchise-local-secret')
const allowedTones = ['gold', 'cream', 'red', 'orange', 'yellow', 'pink', 'peach', 'blue']
const allowedStatuses = ['new', 'preparing', 'ready', 'delivering', 'completed', 'cancelled']
const allowedPaymentMethods: PaymentMethod[] = ['cash', 'qris', 'bank_transfer', 'ewallet']
const isUniqueError = (error: unknown) => (error as { code?: string })?.code === '23505' || (error instanceof Error && /UNIQUE|duplicate key/i.test(error.message))

if (!adminPassword || !jwtSecret) {
  throw new Error('APP_ADMIN_PASSWORD dan APP_JWT_SECRET wajib diisi untuk mode production.')
}

const mobileOrigins = new Set([
  'capacitor://localhost',
  'https://localhost',
  'http://localhost',
  ...String(process.env.MOBILE_ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean),
])

app.use((request, response, next) => {
  const origin = request.headers.origin
  if (origin && mobileOrigins.has(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Outlet-Id')
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  }
  if (request.method === 'OPTIONS') return response.sendStatus(204)
  next()
})

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://app.sandbox.midtrans.com", "https://app.midtrans.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:*", "http:*"],
      frameSrc: ["'self'", "https://app.sandbox.midtrans.com", "https://app.midtrans.com"],
      connectSrc: ["'self'", "https://app.sandbox.midtrans.com", "https://app.midtrans.com"],
    }
  }
}))

const isStrongPassword = (password: string): boolean => {
  return password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[!@#$%^&*(),.?":{}|<>_+\-=\[\]\\\/]/.test(password)
}

const rateLimits = new Map<string, { count: number; resetTime: number }>()
const rateLimiter = (limit: number, windowMs: number) => (req: Request, res: Response, next: NextFunction) => {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim()
  const now = Date.now()
  const limitInfo = rateLimits.get(ip) || { count: 0, resetTime: now + windowMs }
  if (now > limitInfo.resetTime) {
    limitInfo.count = 1
    limitInfo.resetTime = now + windowMs
  } else {
    limitInfo.count++
  }
  rateLimits.set(ip, limitInfo)
  if (limitInfo.count > limit) {
    const remainingTime = Math.ceil((limitInfo.resetTime - now) / 1000)
    return res.status(429).json({ message: `Terlalu banyak percobaan akses. Silakan coba lagi dalam ${remainingTime} detik.` })
  }
  next()
}
app.use(express.json({ limit: '6mb' }))

type AppRole = UserRole
interface AuthPayload {
  role: AppRole
  userId?: number
  name?: string
  email?: string
  outletId?: number
}
interface AuthenticatedRequest extends Request {
  auth?: AuthPayload
  user?: any
}

const requireRoles = (...roles: AppRole[]) => async (request: Request, response: Response, next: NextFunction) => {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return response.status(401).json({ message: 'Silakan login untuk melanjutkan.' })
  try {
    const payload = jwt.verify(token, jwtSecret) as AuthPayload
    if (!roles.includes(payload.role)) return response.status(403).json({ message: 'Anda tidak memiliki akses ke halaman ini.' })
    if (payload.userId) {
      const user = await getUserById(payload.userId)
      if (!user || !user.active || user.role !== payload.role) return response.status(401).json({ message: 'Akun sudah tidak aktif. Silakan hubungi manager.' })
      ;(request as AuthenticatedRequest).user = user
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
  async (request: Request, response: Response, next: NextFunction) => {
    const auth = (request as AuthenticatedRequest).auth
    if (!auth || !(await hasModuleAccess(auth.role, module))) {
      return response.status(403).json({ message: `Role ${auth?.role || 'ini'} tidak memiliki akses ke modul ini.` })
    }
    next()
  },
]
const requireAnyModuleAccess = (modules: PermissionModule[], ...roles: AppRole[]) => [
  requireRoles(...roles),
  async (request: Request, response: Response, next: NextFunction) => {
    const auth = (request as AuthenticatedRequest).auth
    if (!auth || !(await Promise.all(modules.map((module) => hasModuleAccess(auth.role, module)))).some(Boolean)) {
      return response.status(403).json({ message: `Role ${auth?.role || 'ini'} tidak memiliki akses ke modul ini.` })
    }
    next()
  },
]

const resolveOutletId = async (request: Request) => {
  const auth = (request as AuthenticatedRequest).auth
  const cachedUser = (request as AuthenticatedRequest).user
  const requested = Number(request.headers['x-outlet-id'] || request.query.outletId)
  if (auth?.role === 'cashier' && auth.userId) {
    const user = cachedUser || await getUserById(auth.userId)
    if (!user?.outletId) throw new Error('Akun cashier belum ditempatkan pada outlet.')
    return user.outletId
  }
  if (Number.isInteger(requested) && requested > 0) {
    const outlet = await getOutletById(requested)
    if (!outlet) throw new Error('Outlet tidak ditemukan atau sedang nonaktif.')
    return outlet.id
  }
  if (auth?.userId) {
    const user = cachedUser || await getUserById(auth.userId)
    if (user?.outletId && await getOutletById(user.outletId)) return user.outletId
  }
  return (await getDefaultOutlet()).id
}

const normalizeOutlet = (body: Partial<OutletRecord>): Omit<OutletRecord, 'id'> => {
  const code = String(body.code || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20)
  const name = String(body.name || '').trim().slice(0, 80)
  const address = String(body.address || '').trim().slice(0, 300)
  const phone = String(body.phone || '').replace(/[^\d+]/g, '').slice(0, 20)
  if (code.length < 2) throw new Error('Kode outlet minimal 2 karakter.')
  if (name.length < 2) throw new Error('Nama outlet minimal 2 karakter.')
  return { code, name, address, phone, active: body.active !== false, isDefault: Boolean(body.isDefault) }
}

const normalizeProduct = async (body: Partial<ProductRecord>): Promise<ProductInput> => {
  const price = Number(body.price)
  const originalPrice = body.originalPrice ? Number(body.originalPrice) : undefined
  const imageUrl = body.imageUrl?.trim()
  const category = String(body.category || '').trim()
  if (!body.name?.trim() || !body.description?.trim()) throw new Error('Nama dan deskripsi produk wajib diisi.')
  if (!Number.isFinite(price) || price < 0) throw new Error('Harga produk tidak valid.')
  if (!category || !(await menuCategoryExists(category))) throw new Error('Kategori produk tidak valid. Tambahkan kategori lewat menu Manager terlebih dahulu.')
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

const normalizeProductOutletAssignment = (body: Partial<ProductOutletAssignmentInput>): ProductOutletAssignmentInput => {
  const assigned = Boolean(body.assigned)
  const rawPriceOverride = (body as Record<string, unknown>).priceOverride
  const priceOverride = rawPriceOverride === undefined || rawPriceOverride === null || rawPriceOverride === ''
    ? undefined
    : Number(rawPriceOverride)
  if (priceOverride !== undefined && (!Number.isInteger(priceOverride) || priceOverride < 0 || priceOverride > 100_000_000)) {
    throw new Error('Harga khusus outlet harus berupa angka 0-100.000.000.')
  }
  return {
    assigned,
    active: assigned && body.active !== false,
    available: assigned && body.available !== false,
    priceOverride,
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

app.get('/api/health', async (_request, response) => {
  try {
    await getFranchiseSettings()
    response.json({ ok: true, database: storage.databaseLabel })
  } catch (error) {
    console.error('Error in /api/health:', error)
    response.status(500).json({ message: 'Database offline.' })
  }
})

app.get('/api/outlets', async (_request, response) => {
  try { response.json(await getOutlets(false)) }
  catch (error) { response.status(500).json({ message: error instanceof Error ? error.message : 'Outlet gagal dimuat.' }) }
})

app.get('/api/settings', async (_request, response) => {
  try {
    response.json(await getFranchiseSettings())
  } catch (error) {
    console.error('Error in /api/settings:', error)
    response.status(500).json({ message: 'Gagal mengambil pengaturan.' })
  }
})

app.get('/api/categories', async (request, response) => {
  try {
    response.json(await getMenuCategories(false, false, undefined, await resolveOutletId(request)))
  } catch (error) {
    console.error('Error in /api/categories:', error)
    response.status(500).json({ message: 'Gagal mengambil kategori.' })
  }
})

app.get('/api/products', async (request, response) => {
  try {
    response.json(await getProducts(false, undefined, await resolveOutletId(request)))
  } catch (error) {
    console.error('Error in /api/products:', error)
    response.status(500).json({ message: 'Gagal mengambil produk.' })
  }
})

app.get('/api/promotions', async (_request, response) => {
  try {
    response.json(await getPromotions())
  } catch (error) {
    console.error('Error in /api/promotions:', error)
    response.status(500).json({ message: 'Gagal mengambil promosi.' })
  }
})

app.post('/api/orders', requireRoles('customer'), async (request, response) => {
  try {
    const input = request.body as Partial<NewOrderInput>
    if (!input.customerName?.trim()) throw new Error('Nama pemesan wajib diisi.')
    if (!input.phone || input.phone.replace(/\D/g, '').length < 8) throw new Error('Nomor WhatsApp tidak valid.')
    if (!['delivery', 'pickup'].includes(String(input.deliveryMethod))) throw new Error('Metode pesanan tidak valid.')
    if (!allowedPaymentMethods.includes(input.paymentMethod as PaymentMethod)) throw new Error('Metode pembayaran tidak valid.')
    if (input.deliveryMethod === 'delivery' && !input.address?.trim()) throw new Error('Alamat pengantaran wajib diisi.')
    if (!Array.isArray(input.items) || input.items.length === 0) throw new Error('Keranjang masih kosong.')
    const outletId = Number(input.outletId)
    if (!Number.isInteger(outletId) || outletId < 1 || !(await getOutletById(outletId))) throw new Error('Pilih outlet aktif sebelum checkout.')
    if (input.items.some((item) => !Number.isInteger(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20
      || (item.addonIds !== undefined && (!Array.isArray(item.addonIds) || item.addonIds.length > 20 || item.addonIds.some((id) => !Number.isInteger(id)))))) {
      throw new Error('Jumlah produk tidak valid.')
    }
    const order = await createOrder({
      customerId: (request as AuthenticatedRequest).auth!.userId!,
      outletId,
      customerName: input.customerName.trim(),
      phone: input.phone.trim(),
      address: input.address?.trim(),
      note: input.note?.trim(),
      deliveryMethod: input.deliveryMethod as 'delivery' | 'pickup',
      paymentMethod: input.paymentMethod as PaymentMethod,
      promoCode: input.promoCode?.trim() || undefined,
      items: input.items,
    })
    if (!order) throw new Error('Pesanan gagal dibuat.')
    try {
      const target = await getOrderPaymentTarget(order.id, order.customerId)
      const payment = await createPaymentSession({
        id: order.id,
        total: order.total,
        customerName: order.customerName,
        email: target?.email ? String(target.email) : undefined,
        phone: order.phone,
        paymentMethod: order.paymentMethod,
      })
      await savePaymentSession(payment)
      response.status(201).json(await getOrderById(order.id))
    } catch (paymentError) {
      await updateOrderStatus(order.id, 'cancelled')
      throw new Error(paymentError instanceof Error ? paymentError.message : 'Sesi pembayaran gagal dibuat.')
    }
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Pesanan gagal dibuat.' })
  }
})

app.get('/api/payments/:orderId/status', requireRoles('customer'), async (request, response) => {
  const payment = await getPaymentSession(String(request.params.orderId), (request as AuthenticatedRequest).auth!.userId!)
  if (!payment) return response.status(404).json({ message: 'Pembayaran tidak ditemukan.' })
  response.json(payment)
})

app.post('/api/payments/:orderId/simulate', requireRoles('customer'), async (request, response) => {
  if (paymentMode() !== 'local-simulator') return response.status(403).json({ message: 'Simulator pembayaran hanya tersedia saat Midtrans belum dikonfigurasi.' })
  const orderId = String(request.params.orderId)
  const current = await getPaymentSession(orderId, (request as AuthenticatedRequest).auth!.userId!)
  if (!current || current.provider !== 'simulator') return response.status(404).json({ message: 'Pembayaran simulator tidak ditemukan.' })
  const result = request.body?.result === 'paid' ? 'paid' : 'failed'
  response.json(await updatePaymentStatus(orderId, result, { paymentType: 'local_simulator', rawResponse: { result } }))
})

app.post('/api/payments/midtrans/notification', async (request, response) => {
  const notification = request.body as MidtransNotification
  if (!verifyMidtransNotification(notification)) return response.status(401).json({ message: 'Signature notifikasi Midtrans tidak valid.' })

  const transactionId = notification.transaction_id || ''
  const transactionStatus = notification.transaction_status || ''
  if (transactionId && transactionStatus) {
    const idempotencyKey = `${transactionId}:${transactionStatus}`
    const isProcessed = await checkAndLogPaymentNotification(idempotencyKey, notification)
    if (isProcessed) {
      return response.json({ status: 'already_processed' })
    }
  }

  const orderId = String(notification.order_id || '')
  const target = await getOrderPaymentTarget(orderId)
  if (!target) return response.status(404).json({ message: 'Pesanan tidak ditemukan.' })
  if (Math.round(Number(notification.gross_amount)) !== Number(target.total)) return response.status(400).json({ message: 'Nominal pembayaran tidak sesuai dengan pesanan.' })
  const payment = await updatePaymentStatus(orderId, paymentStatusFromMidtrans(notification), {
    transactionId: notification.transaction_id ? String(notification.transaction_id) : undefined,
    paymentType: notification.payment_type ? String(notification.payment_type) : undefined,
    rawResponse: notification,
  })
  response.json(payment || { received: true })
})

app.post('/api/auth/register', rateLimiter(5, 15 * 60 * 1000), async (request, response) => {
  try {
    const name = String(request.body?.name || '').trim()
    const email = String(request.body?.email || '').trim().toLowerCase()
    const password = String(request.body?.password || '')
    if (name.length < 2) throw new Error('Nama minimal 2 karakter.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Alamat email tidak valid.')
    if (!isStrongPassword(password)) throw new Error('Kata sandi harus minimal 8 karakter dan mengandung kombinasi huruf besar, huruf kecil, angka, serta karakter khusus (simbol).')
    const user = await createUser({ name, email, password, role: 'customer' })
    const token = jwt.sign({ role: user.role, userId: user.id, name: user.name, email: user.email, outletId: user.outletId }, jwtSecret, { expiresIn: '7d' })
    response.status(201).json({ token, user })
  } catch (error) {
    const message = isUniqueError(error)
      ? 'Email sudah terdaftar.'
      : error instanceof Error ? error.message : 'Pendaftaran gagal.'
    response.status(400).json({ message })
  }
})

app.post('/api/auth/login', rateLimiter(5, 15 * 60 * 1000), async (request, response) => {
  const email = String(request.body?.email || '').trim().toLowerCase()
  const password = String(request.body?.password || '')
  const role = String(request.body?.role || '') as UserRole
  if (!['customer', 'cashier', 'manager', 'admin'].includes(role)) return response.status(400).json({ message: 'Tipe pengguna tidak valid.' })
  const user = await authenticateUser(email, password, role)
  if (!user) return response.status(401).json({ message: 'Email atau password salah.' })
  const token = jwt.sign({ role: user.role, userId: user.id, name: user.name, email: user.email, outletId: user.outletId }, jwtSecret, { expiresIn: '7d' })
  response.json({ token, user })
})

app.get('/api/auth/me', requireRoles('customer', 'cashier', 'manager', 'admin'), async (request, response) => {
  const user = await getUserById((request as AuthenticatedRequest).auth!.userId!)
  if (!user) return response.status(404).json({ message: 'Pengguna tidak ditemukan.' })
  response.json(user)
})

app.get('/api/permissions/me', requireRoles('cashier', 'manager', 'admin'), async (request, response) => {
  try {
    const auth = (request as AuthenticatedRequest).auth!
    response.json({ role: auth.role, modules: await getRolePermissions(auth.role) })
  } catch (error) {
    console.error('Error in /api/permissions/me:', error)
    response.status(500).json({ message: error instanceof Error ? error.message : 'Terjadi kesalahan internal pada server.' })
  }
})

app.get('/api/admin/rbac', ...requireModuleAccess('rbac', 'admin'), async (_request, response) => {
  response.json(await getRolePermissionMatrix())
})

app.put('/api/admin/rbac', ...requireModuleAccess('rbac', 'admin'), async (request, response) => {
  response.json(await updateRolePermissions(request.body?.permissions || request.body || {}))
})

app.put('/api/profile', requireRoles('customer', 'cashier', 'manager', 'admin'), async (request, response) => {
  try {
    const name = String(request.body?.name || '').trim()
    const email = String(request.body?.email || '').trim().toLowerCase()
    if (name.length < 2) throw new Error('Nama minimal 2 karakter.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Alamat email tidak valid.')
    const user = await updateUserProfile((request as AuthenticatedRequest).auth!.userId!, { name, email })
    if (!user) return response.status(404).json({ message: 'Pengguna tidak ditemukan.' })
    response.json(user)
  } catch (error) {
    const message = isUniqueError(error) ? 'Email sudah digunakan.' : error instanceof Error ? error.message : 'Profil gagal diperbarui.'
    response.status(400).json({ message })
  }
})

app.put('/api/profile/password', requireRoles('customer', 'cashier', 'manager', 'admin'), async (request, response) => {
  const currentPassword = String(request.body?.currentPassword || '')
  const newPassword = String(request.body?.newPassword || '')
  if (!isStrongPassword(newPassword)) return response.status(400).json({ message: 'Kata sandi harus minimal 8 karakter dan mengandung kombinasi huruf besar, huruf kecil, angka, serta karakter khusus (simbol).' })
  const changed = await changeUserPassword((request as AuthenticatedRequest).auth!.userId!, currentPassword, newPassword)
  if (!changed) return response.status(400).json({ message: 'Password saat ini salah.' })
  response.json({ changed: true })
})

app.post('/api/auth/admin', rateLimiter(5, 15 * 60 * 1000), (request, response) => {
  if (typeof request.body?.password !== 'string' || request.body.password !== adminPassword) {
    return response.status(401).json({ message: 'Password admin salah.' })
  }
  const token = jwt.sign({ role: 'admin' }, jwtSecret, { expiresIn: '12h' })
  response.json({ token })
})

app.get('/api/customer/orders', requireRoles('customer'), async (request, response) => {
  response.json(await getCustomerOrders((request as AuthenticatedRequest).auth!.userId!))
})

app.get('/api/staff/outlets', requireRoles('cashier', 'manager', 'admin'), async (request, response) => {
  const auth = (request as AuthenticatedRequest).auth!
  if (auth.role === 'cashier') {
    const user = await getUserById(auth.userId!)
    const outlet = user?.outletId ? await getOutletById(user.outletId) : undefined
    return response.json(outlet ? [outlet] : [])
  }
  response.json(await getOutlets(false))
})

app.get('/api/cashier/stats', ...requireModuleAccess('cashier_station', 'cashier', 'manager', 'admin'), async (request, response) => {
  response.json(await getDashboardStats(await resolveOutletId(request)))
})

app.get('/api/cashier/orders', ...requireModuleAccess('cashier_station', 'cashier', 'manager', 'admin'), async (request, response) => {
  response.json(await getOrders(await resolveOutletId(request)))
})

app.patch('/api/cashier/orders/:id/status', ...requireModuleAccess('cashier_station', 'cashier', 'manager', 'admin'), async (request, response) => {
  try {
    const status = String(request.body?.status || '')
    if (!allowedStatuses.includes(status)) return response.status(400).json({ message: 'Status tidak valid.' })
    const order = await updateOrderStatus(String(request.params.id), status, await resolveOutletId(request))
    if (!order) return response.status(404).json({ message: 'Pesanan tidak ditemukan.' })
    response.json(order)
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Gagal memperbarui status.' })
  }
})

app.get('/api/manager/outlets', ...requireModuleAccess('outlets', 'manager', 'admin'), async (_request, response) => {
  response.json(await getOutlets(true))
})

app.post('/api/manager/outlets', ...requireModuleAccess('outlets', 'manager', 'admin'), async (request, response) => {
  try { response.status(201).json(await createOutlet(normalizeOutlet(request.body))) }
  catch (error) { response.status(400).json({ message: isUniqueError(error) ? 'Kode outlet sudah digunakan.' : error instanceof Error ? error.message : 'Outlet gagal dibuat.' }) }
})

app.put('/api/manager/outlets/:id', ...requireModuleAccess('outlets', 'manager', 'admin'), async (request, response) => {
  try {
    const outlet = await updateOutlet(Number(request.params.id), normalizeOutlet(request.body))
    if (!outlet) return response.status(404).json({ message: 'Outlet tidak ditemukan.' })
    response.json(outlet)
  } catch (error) { response.status(400).json({ message: isUniqueError(error) ? 'Kode outlet sudah digunakan.' : error instanceof Error ? error.message : 'Outlet gagal diperbarui.' }) }
})

app.delete('/api/manager/outlets/:id', ...requireModuleAccess('outlets', 'manager', 'admin'), async (request, response) => {
  try {
    const result = await deleteOutlet(Number(request.params.id))
    if (!result.deleted && !result.archived) return response.status(404).json({ message: 'Outlet tidak ditemukan.' })
    response.json(result)
  } catch (error) { response.status(400).json({ message: error instanceof Error ? error.message : 'Outlet gagal dihapus.' }) }
})

app.get('/api/manager/categories', ...requireAnyModuleAccess(['categories', 'products'], 'manager', 'admin'), async (_request, response) => {
  response.json(await getMenuCategories(true, true))
})

app.post('/api/manager/categories', ...requireModuleAccess('categories', 'manager', 'admin'), async (request, response) => {
  try {
    response.status(201).json(await createMenuCategory(normalizeMenuCategory(request.body)))
  } catch (error) {
    const message = isUniqueError(error)
      ? 'Nama kategori sudah digunakan.'
      : error instanceof Error ? error.message : 'Kategori gagal dibuat.'
    response.status(400).json({ message })
  }
})

app.put('/api/manager/categories/:id', ...requireModuleAccess('categories', 'manager', 'admin'), async (request, response) => {
  try {
    const category = await updateMenuCategory(Number(request.params.id), normalizeMenuCategory(request.body))
    if (!category) return response.status(404).json({ message: 'Kategori tidak ditemukan.' })
    response.json(category)
  } catch (error) {
    const message = isUniqueError(error)
      ? 'Nama kategori sudah digunakan.'
      : error instanceof Error ? error.message : 'Kategori gagal diperbarui.'
    response.status(400).json({ message })
  }
})

app.patch('/api/manager/categories/:id/active', ...requireModuleAccess('categories', 'manager', 'admin'), async (request, response) => {
  const category = await setMenuCategoryActive(Number(request.params.id), Boolean(request.body?.active))
  if (!category) return response.status(404).json({ message: 'Kategori tidak ditemukan.' })
  response.json(category)
})

app.delete('/api/manager/categories/:id', ...requireModuleAccess('categories', 'manager', 'admin'), async (request, response) => {
  const result = await deleteMenuCategory(Number(request.params.id))
  if (!result.deleted && !result.archived) return response.status(404).json({ message: 'Kategori tidak ditemukan.' })
  response.json(result)
})

app.get('/api/manager/products', ...requireAnyModuleAccess(['products', 'inventory'], 'manager', 'admin'), async (request, response) => {
  response.json(await getProducts(true, undefined, await resolveOutletId(request)))
})

app.post('/api/manager/products', ...requireModuleAccess('products', 'manager', 'admin'), async (request, response) => {
  try { response.status(201).json(await createProduct(await normalizeProduct(request.body), await resolveOutletId(request))) }
  catch (error) { response.status(400).json({ message: error instanceof Error ? error.message : 'Produk gagal dibuat.' }) }
})

app.put('/api/manager/products/:id', ...requireModuleAccess('products', 'manager', 'admin'), async (request, response) => {
  try {
    const product = await updateProduct(Number(request.params.id), await normalizeProduct(request.body))
    if (!product) return response.status(404).json({ message: 'Produk tidak ditemukan.' })
    response.json(product)
  } catch (error) { response.status(400).json({ message: error instanceof Error ? error.message : 'Produk gagal diperbarui.' }) }
})

app.patch('/api/manager/products/:id/active', ...requireModuleAccess('products', 'manager', 'admin'), async (request, response) => {
  const product = await setProductActive(Number(request.params.id), Boolean(request.body?.active))
  if (!product) return response.status(404).json({ message: 'Produk tidak ditemukan.' })
  response.json(product)
})

app.put('/api/manager/products/:id/outlet-assignment', ...requireModuleAccess('products', 'manager', 'admin'), async (request, response) => {
  try {
    const product = await setProductOutletAssignment(
      await resolveOutletId(request),
      Number(request.params.id),
      normalizeProductOutletAssignment(request.body || {}),
    )
    if (!product) return response.status(404).json({ message: 'Produk tidak ditemukan.' })
    response.json(product)
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Assignment produk outlet gagal disimpan.' })
  }
})

app.delete('/api/manager/products/:id', ...requireModuleAccess('products', 'manager', 'admin'), async (request, response) => {
  const result = await deleteProduct(Number(request.params.id))
  if (!result.deleted && !result.archived) return response.status(404).json({ message: 'Produk tidak ditemukan.' })
  response.json(result)
})

app.get('/api/manager/settings', ...requireModuleAccess('settings', 'manager', 'admin'), async (_request, response) => {
  response.json(await getFranchiseSettings())
})

app.put('/api/manager/settings', ...requireModuleAccess('settings', 'manager', 'admin'), async (request, response) => {
  try {
    response.json(await updateFranchiseSettings(request.body as Partial<FranchiseSettingsRecord>))
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Pengaturan franchise gagal disimpan.' })
  }
})

app.get('/api/manager/cashiers', ...requireModuleAccess('cashiers', 'manager', 'admin'), async (request, response) => {
  response.json(await getCashiers(await resolveOutletId(request)))
})

app.post('/api/manager/cashiers', ...requireModuleAccess('cashiers', 'manager', 'admin'), async (request, response) => {
  try {
    const name = String(request.body?.name || '').trim()
    const email = String(request.body?.email || '').trim().toLowerCase()
    const password = String(request.body?.password || '')
    const outletId = Number(request.body?.outletId || await resolveOutletId(request))
    if (name.length < 2) throw new Error('Nama cashier minimal 2 karakter.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Alamat email cashier tidak valid.')
    if (!isStrongPassword(password)) throw new Error('Kata sandi harus minimal 8 karakter dan mengandung kombinasi huruf besar, huruf kecil, angka, serta karakter khusus (simbol).')
    if (!Number.isInteger(outletId) || !(await getOutletById(outletId))) throw new Error('Outlet cashier tidak valid.')
    response.status(201).json(await createUser({ name, email, password, role: 'cashier', outletId }))
  } catch (error) {
    const message = isUniqueError(error)
      ? 'Email cashier sudah terdaftar.'
      : error instanceof Error ? error.message : 'Cashier gagal dibuat.'
    response.status(400).json({ message })
  }
})

app.put('/api/manager/cashiers/:id', ...requireModuleAccess('cashiers', 'manager', 'admin'), async (request, response) => {
  try {
    const id = Number(request.params.id)
    const name = String(request.body?.name || '').trim()
    const email = String(request.body?.email || '').trim().toLowerCase()
    const password = String(request.body?.password || '')
    const active = request.body?.active !== false
    const outletId = Number(request.body?.outletId || await resolveOutletId(request))
    if (!Number.isInteger(id) || id < 1) throw new Error('ID cashier tidak valid.')
    if (name.length < 2) throw new Error('Nama cashier minimal 2 karakter.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Alamat email cashier tidak valid.')
    if (password && !isStrongPassword(password)) throw new Error('Kata sandi harus minimal 8 karakter dan mengandung kombinasi huruf besar, huruf kecil, angka, serta karakter khusus (simbol).')
    if (!Number.isInteger(outletId) || !(await getOutletById(outletId))) throw new Error('Outlet cashier tidak valid.')
    const cashier = await updateCashier(id, { name, email, password: password || undefined, active, outletId })
    if (!cashier) return response.status(404).json({ message: 'Cashier tidak ditemukan.' })
    response.json(cashier)
  } catch (error) {
    const message = isUniqueError(error)
      ? 'Email cashier sudah terdaftar.'
      : error instanceof Error ? error.message : 'Cashier gagal diperbarui.'
    response.status(400).json({ message })
  }
})

app.delete('/api/manager/cashiers/:id', ...requireModuleAccess('cashiers', 'manager', 'admin'), async (request, response) => {
  try {
    const id = Number(request.params.id)
    if (!Number.isInteger(id) || id < 1) return response.status(400).json({ message: 'ID cashier tidak valid.' })
    if (!(await deleteCashier(id))) return response.status(404).json({ message: 'Cashier tidak ditemukan.' })
    response.json({ deleted: true })
  } catch {
    response.status(400).json({ message: 'Cashier tidak dapat dihapus.' })
  }
})

app.get('/api/manager/promotions', ...requireModuleAccess('promotions', 'manager', 'admin'), async (_request, response) => {
  response.json(await getPromotions(true))
})

app.post('/api/manager/promotions', ...requireModuleAccess('promotions', 'manager', 'admin'), async (request, response) => {
  try { response.status(201).json(await createPromotion(normalizePromotion(request.body))) }
  catch (error) { response.status(400).json({ message: isUniqueError(error) ? 'Kode promo sudah digunakan.' : error instanceof Error ? error.message : 'Promosi gagal dibuat.' }) }
})

app.put('/api/manager/promotions/:id', ...requireModuleAccess('promotions', 'manager', 'admin'), async (request, response) => {
  try {
    const promotion = await updatePromotion(Number(request.params.id), normalizePromotion(request.body))
    if (!promotion) return response.status(404).json({ message: 'Promosi tidak ditemukan.' })
    response.json(promotion)
  } catch (error) { response.status(400).json({ message: isUniqueError(error) ? 'Kode promo sudah digunakan.' : error instanceof Error ? error.message : 'Promosi gagal diperbarui.' }) }
})

app.delete('/api/manager/promotions/:id', ...requireModuleAccess('promotions', 'manager', 'admin'), async (request, response) => {
  if (!(await deletePromotion(Number(request.params.id)))) return response.status(404).json({ message: 'Promosi tidak ditemukan.' })
  response.json({ deleted: true })
})

app.get('/api/manager/inventory', ...requireModuleAccess('inventory', 'manager', 'admin'), async (request, response) => {
  response.json(await getInventorySnapshot(await resolveOutletId(request)))
})

app.post('/api/manager/inventory/items', ...requireModuleAccess('inventory', 'manager', 'admin'), async (request, response) => {
  try {
    const item = await createInventoryItem(await resolveOutletId(request), normalizeInventoryItem(request.body as Record<string, unknown>, true), (request as AuthenticatedRequest).auth?.userId)
    response.status(201).json(item)
  } catch (error) {
    const message = isUniqueError(error)
      ? 'SKU inventory sudah digunakan.'
      : error instanceof Error ? error.message : 'Item inventory gagal dibuat.'
    response.status(400).json({ message })
  }
})

app.put('/api/manager/inventory/items/:id', ...requireModuleAccess('inventory', 'manager', 'admin'), async (request, response) => {
  try {
    const id = Number(request.params.id)
    if (!Number.isInteger(id) || id < 1) throw new Error('ID inventory tidak valid.')
    const input = normalizeInventoryItem(request.body as Record<string, unknown>, false)
    const item = await updateInventoryItem(await resolveOutletId(request), id, input)
    if (!item) return response.status(404).json({ message: 'Item inventory tidak ditemukan.' })
    response.json(item)
  } catch (error) {
    const message = isUniqueError(error)
      ? 'SKU inventory sudah digunakan.'
      : error instanceof Error ? error.message : 'Item inventory gagal diperbarui.'
    response.status(400).json({ message })
  }
})

app.delete('/api/manager/inventory/items/:id', ...requireModuleAccess('inventory', 'manager', 'admin'), async (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isInteger(id) || id < 1) return response.status(400).json({ message: 'ID inventory tidak valid.' })
  const result = await deleteInventoryItem(await resolveOutletId(request), id)
  if (!result.deleted && !result.archived) return response.status(404).json({ message: 'Item inventory tidak ditemukan.' })
  response.json(result)
})

app.post('/api/manager/inventory/movements', ...requireModuleAccess('inventory', 'manager', 'admin'), async (request, response) => {
  try {
    const movement = await createStockMovement(await resolveOutletId(request), normalizeStockMovement(request.body as Record<string, unknown>), (request as AuthenticatedRequest).auth?.userId)
    response.status(201).json(movement)
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Pergerakan stok gagal dicatat.' })
  }
})

app.get('/api/manager/reports', ...requireModuleAccess('reports', 'manager', 'admin'), async (request, response) => {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const from = normalizeDate(request.query.from || `${today.slice(0, 8)}01`, 'Tanggal awal')
    const to = normalizeDate(request.query.to || today, 'Tanggal akhir')
    if (from > to) throw new Error('Tanggal awal tidak boleh setelah tanggal akhir.')
    response.json(await getReportData(await resolveOutletId(request), from, to))
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Laporan gagal dibuat.' })
  }
})

app.post('/api/manager/financial-entries', ...requireModuleAccess('reports', 'manager', 'admin'), async (request, response) => {
  try {
    response.status(201).json(await createFinancialEntry(
      await resolveOutletId(request), normalizeFinancialEntry(request.body as Record<string, unknown>),
      (request as AuthenticatedRequest).auth?.userId,
    ))
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Transaksi keuangan gagal dicatat.' })
  }
})

app.delete('/api/manager/financial-entries/:id', ...requireModuleAccess('reports', 'manager', 'admin'), async (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isInteger(id) || id < 1) return response.status(400).json({ message: 'ID transaksi tidak valid.' })
  if (!(await deleteFinancialEntry(await resolveOutletId(request), id))) return response.status(404).json({ message: 'Transaksi keuangan tidak ditemukan.' })
  response.json({ deleted: true })
})

app.get('/api/admin/stats', ...requireModuleAccess('cashier_station', 'admin'), async (request, response) => {
  response.json(await getDashboardStats(await resolveOutletId(request)))
})

app.get('/api/admin/orders', ...requireModuleAccess('cashier_station', 'admin'), async (request, response) => {
  response.json(await getOrders(await resolveOutletId(request)))
})

app.patch('/api/admin/orders/:id/status', ...requireModuleAccess('cashier_station', 'admin'), async (request, response) => {
  try {
    const status = String(request.body?.status || '')
    if (!allowedStatuses.includes(status)) return response.status(400).json({ message: 'Status tidak valid.' })
    const order = await updateOrderStatus(String(request.params.id), status, await resolveOutletId(request))
    if (!order) return response.status(404).json({ message: 'Pesanan tidak ditemukan.' })
    response.json(order)
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Gagal memperbarui status.' })
  }
})

app.get('/api/admin/products', ...requireModuleAccess('products', 'admin'), async (_request, response) => {
  response.json(await getProducts(true))
})

app.post('/api/admin/products', ...requireModuleAccess('products', 'admin'), async (request, response) => {
  try {
    response.status(201).json(await createProduct(await normalizeProduct(request.body)))
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Produk gagal dibuat.' })
  }
})

app.put('/api/admin/products/:id', ...requireModuleAccess('products', 'admin'), async (request, response) => {
  try {
    const product = await updateProduct(Number(request.params.id), await normalizeProduct(request.body))
    if (!product) return response.status(404).json({ message: 'Produk tidak ditemukan.' })
    response.json(product)
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Produk gagal diperbarui.' })
  }
})

app.patch('/api/admin/products/:id/active', ...requireModuleAccess('products', 'admin'), async (request, response) => {
  const product = await setProductActive(Number(request.params.id), Boolean(request.body?.active))
  if (!product) return response.status(404).json({ message: 'Produk tidak ditemukan.' })
  response.json(product)
})

const distDirectory = path.resolve(process.cwd(), 'dist')
if (existsSync(distDirectory)) {
  app.use(express.static(distDirectory))
  app.get(/^(?!\/api).*/, (_request, response) => response.sendFile(path.join(distDirectory, 'index.html')))
}

import { appendFileSync } from 'node:fs'

app.use((error: Error, _request: Request, response: Response, _next: NextFunction) => {
  console.error(error)
  try {
    appendFileSync(
      path.resolve(process.cwd(), 'error-log-temp.txt'),
      `[${new Date().toISOString()}] ${error.stack || error.message}\n\n`
    )
  } catch (e) {
    // ignore
  }
  response.status(500).json({ message: error.message || 'Terjadi masalah pada server.' })
})
