export interface MenuCategory {
  id: number
  label: string
  emoji: string
  sortOrder: number
  active: boolean
  productCount?: number
}

export interface Product {
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
  spicy?: boolean
  active?: boolean
  addons: ProductAddon[]
}

export interface ProductAddon {
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

export interface CartItem {
  productId: number
  quantity: number
  addonIds?: number[]
}

export type OrderStatus = 'new' | 'preparing' | 'ready' | 'delivering' | 'completed' | 'cancelled'
export type PaymentMethod = 'cash' | 'qris' | 'bank_transfer' | 'ewallet'

export interface Order {
  id: string
  customerId?: number
  customerName: string
  phone: string
  address?: string
  note?: string
  deliveryMethod: 'delivery' | 'pickup'
  paymentMethod: PaymentMethod
  status: OrderStatus
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

export interface DashboardStats {
  totalOrders: number
  revenue: number
  activeOrders: number
  activeProducts: number
}

export type UserRole = 'customer' | 'cashier' | 'manager' | 'admin'

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  active: boolean
}

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

export interface CurrentPermissions {
  role: PermissionRole
  modules: Record<PermissionModule, boolean>
}

export interface RolePermissionMatrix {
  roles: PermissionRole[]
  modules: PermissionModuleMeta[]
  permissions: Record<PermissionRole, Record<PermissionModule, boolean>>
}

export interface Promotion {
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

export interface FranchiseSettings {
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

export type StockMovementType = 'in' | 'out' | 'adjustment_add' | 'adjustment_subtract'

export interface InventoryItem {
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

export interface StockMovement {
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

export interface InventorySnapshot {
  items: InventoryItem[]
  movements: StockMovement[]
  summary: {
    activeItems: number
    lowStockItems: number
    movementsToday: number
  }
}

export type FinancialEntryType = 'expense' | 'capital_in' | 'capital_out'

export interface FinancialEntry {
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

export interface ReportData {
  generatedAt: string
  period: { from: string; to: string }
  operational: {
    summary: {
      transactions: number
      grossSales: number
      discounts: number
      netRevenue: number
      averageOrder: number
      itemsSold: number
    }
    dailySales: Array<{ date: string; transactions: number; itemsSold: number; grossSales: number; discounts: number; revenue: number }>
    topProducts: Array<{ productId: number; productName: string; quantity: number; revenue: number }>
    paymentMethods: Array<{ paymentMethod: PaymentMethod; transactions: number; revenue: number }>
    stockStatus: Array<InventoryItem & { stockValue: number }>
    customers: Array<{ customerId: number; name: string; email: string; orderCount: number; totalSpent: number; lastOrder: string }>
  }
  financial: {
    profitLoss: { revenue: number; expenses: number; netProfit: number }
    cashFlow: { salesInflow: number; capitalIn: number; totalInflow: number; expensesOutflow: number; capitalOut: number; totalOutflow: number; netCashFlow: number }
    balanceSheet: { cashBalance: number; inventoryValue: number; totalAssets: number; liabilities: number; equity: number }
    equityChanges: { capitalIn: number; capitalOut: number; retainedEarnings: number; netChange: number }
    expensesByCategory: Array<{ category: string; amount: number }>
    entries: FinancialEntry[]
  }
}
