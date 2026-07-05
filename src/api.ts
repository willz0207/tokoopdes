import type { CurrentPermissions, DashboardStats, FinancialEntry, FinancialEntryType, FranchiseSettings, InventoryItem, InventorySnapshot, MenuCategory, Order, OrderStatus, PaymentMethod, Product, ProductAddonInput, Promotion, ReportData, RolePermissionMatrix, StockMovement, StockMovementType, User, UserRole } from './types'

async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'Server tidak dapat memproses permintaan.')
  return data as T
}

const adminHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('franchise-admin-token') || ''}`,
})

const userHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('franchise-user-token') || ''}`,
})

export const storefrontApi = {
  settings: () => apiRequest<FranchiseSettings>('/api/settings'),
  categories: () => apiRequest<MenuCategory[]>('/api/categories'),
  products: () => apiRequest<Product[]>('/api/products'),
  promotions: () => apiRequest<Promotion[]>('/api/promotions'),
  createOrder: (payload: {
    customerName: string
    phone: string
    address?: string
    note?: string
    deliveryMethod: 'delivery' | 'pickup'
    paymentMethod: PaymentMethod
    promoCode?: string
    items: Array<{ productId: number; quantity: number; addonIds?: number[] }>
  }) => apiRequest<Order>('/api/orders', { method: 'POST', headers: userHeaders(), body: JSON.stringify(payload) }),
}

export const authApi = {
  register: (payload: { name: string; email: string; password: string }) => apiRequest<{ token: string; user: User }>('/api/auth/register', {
    method: 'POST', body: JSON.stringify(payload),
  }),
  login: (payload: { email: string; password: string; role: UserRole }) => apiRequest<{ token: string; user: User }>('/api/auth/login', {
    method: 'POST', body: JSON.stringify(payload),
  }),
  me: () => apiRequest<User>('/api/auth/me', { headers: userHeaders() }),
  updateProfile: (payload: { name: string; email: string }) => apiRequest<User>('/api/profile', {
    method: 'PUT', headers: userHeaders(), body: JSON.stringify(payload),
  }),
  changePassword: (payload: { currentPassword: string; newPassword: string }) => apiRequest<{ changed: boolean }>('/api/profile/password', {
    method: 'PUT', headers: userHeaders(), body: JSON.stringify(payload),
  }),
  customerOrders: () => apiRequest<Order[]>('/api/customer/orders', { headers: userHeaders() }),
}

export const adminApi = {
  login: (password: string) => apiRequest<{ token: string }>('/api/auth/admin', {
    method: 'POST', body: JSON.stringify({ password }),
  }),
  stats: () => apiRequest<DashboardStats>('/api/admin/stats', { headers: adminHeaders() }),
  orders: () => apiRequest<Order[]>('/api/admin/orders', { headers: adminHeaders() }),
  updateOrderStatus: (id: string, status: OrderStatus) => apiRequest<Order>(`/api/admin/orders/${id}/status`, {
    method: 'PATCH', headers: adminHeaders(), body: JSON.stringify({ status }),
  }),
  products: () => apiRequest<Product[]>('/api/admin/products', { headers: adminHeaders() }),
  saveProduct: (product: Omit<Product, 'id' | 'addons'> & { id?: number; addons?: ProductAddonInput[] }) => {
    const method = product.id ? 'PUT' : 'POST'
    const url = product.id ? `/api/admin/products/${product.id}` : '/api/admin/products'
    return apiRequest<Product>(url, { method, headers: adminHeaders(), body: JSON.stringify(product) })
  },
  setProductActive: (id: number, active: boolean) => apiRequest<Product>(`/api/admin/products/${id}/active`, {
    method: 'PATCH', headers: adminHeaders(), body: JSON.stringify({ active }),
  }),
}

export const cashierApi = {
  stats: () => apiRequest<DashboardStats>('/api/cashier/stats', { headers: userHeaders() }),
  orders: () => apiRequest<Order[]>('/api/cashier/orders', { headers: userHeaders() }),
  updateOrderStatus: (id: string, status: OrderStatus) => apiRequest<Order>(`/api/cashier/orders/${id}/status`, {
    method: 'PATCH', headers: userHeaders(), body: JSON.stringify({ status }),
  }),
}

export const managerApi = {
  myPermissions: () => apiRequest<CurrentPermissions>('/api/permissions/me', { headers: userHeaders() }),
  rbac: () => apiRequest<RolePermissionMatrix>('/api/admin/rbac', { headers: userHeaders() }),
  updateRbac: (permissions: RolePermissionMatrix['permissions']) => apiRequest<RolePermissionMatrix>('/api/admin/rbac', {
    method: 'PUT', headers: userHeaders(), body: JSON.stringify({ permissions }),
  }),
  settings: () => apiRequest<FranchiseSettings>('/api/manager/settings', { headers: userHeaders() }),
  updateSettings: (settings: FranchiseSettings) => apiRequest<FranchiseSettings>('/api/manager/settings', {
    method: 'PUT', headers: userHeaders(), body: JSON.stringify(settings),
  }),
  cashiers: () => apiRequest<User[]>('/api/manager/cashiers', { headers: userHeaders() }),
  createCashier: (payload: { name: string; email: string; password: string }) => apiRequest<User>('/api/manager/cashiers', {
    method: 'POST', headers: userHeaders(), body: JSON.stringify(payload),
  }),
  updateCashier: (id: number, payload: { name: string; email: string; password?: string; active: boolean }) => apiRequest<User>(`/api/manager/cashiers/${id}`, {
    method: 'PUT', headers: userHeaders(), body: JSON.stringify(payload),
  }),
  deleteCashier: (id: number) => apiRequest<{ deleted: boolean }>(`/api/manager/cashiers/${id}`, {
    method: 'DELETE', headers: userHeaders(),
  }),
  categories: () => apiRequest<MenuCategory[]>('/api/manager/categories', { headers: userHeaders() }),
  saveCategory: (category: Omit<MenuCategory, 'id' | 'productCount'> & { id?: number }) => apiRequest<MenuCategory>(category.id ? `/api/manager/categories/${category.id}` : '/api/manager/categories', {
    method: category.id ? 'PUT' : 'POST', headers: userHeaders(), body: JSON.stringify(category),
  }),
  setCategoryActive: (id: number, active: boolean) => apiRequest<MenuCategory>(`/api/manager/categories/${id}/active`, {
    method: 'PATCH', headers: userHeaders(), body: JSON.stringify({ active }),
  }),
  deleteCategory: (id: number) => apiRequest<{ deleted: boolean; archived: boolean }>(`/api/manager/categories/${id}`, {
    method: 'DELETE', headers: userHeaders(),
  }),
  products: () => apiRequest<Product[]>('/api/manager/products', { headers: userHeaders() }),
  saveProduct: (product: Omit<Product, 'id' | 'addons'> & { id?: number; addons?: ProductAddonInput[] }) => apiRequest<Product>(product.id ? `/api/manager/products/${product.id}` : '/api/manager/products', {
    method: product.id ? 'PUT' : 'POST', headers: userHeaders(), body: JSON.stringify(product),
  }),
  setProductActive: (id: number, active: boolean) => apiRequest<Product>(`/api/manager/products/${id}/active`, {
    method: 'PATCH', headers: userHeaders(), body: JSON.stringify({ active }),
  }),
  deleteProduct: (id: number) => apiRequest<{ deleted: boolean; archived: boolean }>(`/api/manager/products/${id}`, {
    method: 'DELETE', headers: userHeaders(),
  }),
  promotions: () => apiRequest<Promotion[]>('/api/manager/promotions', { headers: userHeaders() }),
  savePromotion: (promotion: Omit<Promotion, 'id'> & { id?: number }) => apiRequest<Promotion>(promotion.id ? `/api/manager/promotions/${promotion.id}` : '/api/manager/promotions', {
    method: promotion.id ? 'PUT' : 'POST', headers: userHeaders(), body: JSON.stringify(promotion),
  }),
  deletePromotion: (id: number) => apiRequest<{ deleted: boolean }>(`/api/manager/promotions/${id}`, {
    method: 'DELETE', headers: userHeaders(),
  }),
  inventory: () => apiRequest<InventorySnapshot>('/api/manager/inventory', { headers: userHeaders() }),
  createInventoryItem: (payload: { name: string; sku: string; unit: string; initialStock: number; minimumStock: number; unitCost: number; linkedProductId?: number; usagePerSale: number; active: boolean }) => apiRequest<InventoryItem>('/api/manager/inventory/items', {
    method: 'POST', headers: userHeaders(), body: JSON.stringify(payload),
  }),
  updateInventoryItem: (id: number, payload: { name: string; sku: string; unit: string; minimumStock: number; unitCost: number; linkedProductId?: number; usagePerSale: number; active: boolean }) => apiRequest<InventoryItem>(`/api/manager/inventory/items/${id}`, {
    method: 'PUT', headers: userHeaders(), body: JSON.stringify(payload),
  }),
  deleteInventoryItem: (id: number) => apiRequest<{ deleted: boolean; archived: boolean }>(`/api/manager/inventory/items/${id}`, {
    method: 'DELETE', headers: userHeaders(),
  }),
  createStockMovement: (payload: { itemId: number; type: StockMovementType; quantity: number; note?: string }) => apiRequest<StockMovement>('/api/manager/inventory/movements', {
    method: 'POST', headers: userHeaders(), body: JSON.stringify(payload),
  }),
  reports: (from: string, to: string) => apiRequest<ReportData>(`/api/manager/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { headers: userHeaders() }),
  createFinancialEntry: (payload: { type: FinancialEntryType; category: string; amount: number; paymentMethod: PaymentMethod; note?: string; entryDate: string }) => apiRequest<FinancialEntry>('/api/manager/financial-entries', {
    method: 'POST', headers: userHeaders(), body: JSON.stringify(payload),
  }),
  deleteFinancialEntry: (id: number) => apiRequest<{ deleted: boolean }>(`/api/manager/financial-entries/${id}`, {
    method: 'DELETE', headers: userHeaders(),
  }),
}
