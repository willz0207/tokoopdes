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

export interface UserRecord {
  id: number
  name: string
  email: string
  role: UserRole
  active: boolean
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

export interface MenuCategoryRecord {
  id: number
  label: string
  emoji: string
  sortOrder: number
  active: boolean
  productCount?: number
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
