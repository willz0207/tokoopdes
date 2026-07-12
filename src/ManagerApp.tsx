import { useCallback, useEffect, useRef, useState } from 'react'
import { BadgePercent, BarChart3, Building2, Check, ExternalLink, MapPin, Package, Pencil, Plus, RefreshCw, Settings, ShieldCheck, ShoppingBag, Tags, Trash2, UserPlus, UsersRound, Warehouse, X } from 'lucide-react'
import { managerApi } from './api'
import { defaultCategories, formatRupiah } from './data'
import { useFranchiseSettings } from './franchise'
import { readProductImageFile } from './productImage'
import { homePathForRole } from './roleRoutes'
import type { FranchiseSettings, MenuCategory, Outlet, PermissionModule, PermissionRole, Product, ProductAddonInput, Promotion, RolePermissionMatrix, User } from './types'
import ProfileMenu from './ProfileMenu'
import InventoryModule from './InventoryModule'
import ReportsModule from './ReportsModule'
import './manager.css'

type ManagerTab = 'products' | 'categories' | 'promotions' | 'cashiers' | 'inventory' | 'reports' | 'outlets' | 'settings' | 'rbac'

const tabModules: Record<ManagerTab, PermissionModule> = {
  products: 'products',
  categories: 'categories',
  promotions: 'promotions',
  cashiers: 'cashiers',
  inventory: 'inventory',
  reports: 'reports',
  outlets: 'outlets',
  settings: 'settings',
  rbac: 'rbac',
}

function ManagerApp() {
  const { settings, setSettings } = useFranchiseSettings()
  const loadedRef = useRef(false)
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(localStorage.getItem('franchise-user') || 'null') as User | null } catch { return null }
  })
  const [tab, setTab] = useState<ManagerTab>('products')
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [cashiers, setCashiers] = useState<User[]>([])
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [selectedOutletId, setSelectedOutletId] = useState<number | undefined>(() => {
    const value = Number(localStorage.getItem('franchise-outlet-id'))
    return Number.isInteger(value) && value > 0 ? value : undefined
  })
  const [permissions, setPermissions] = useState<Record<PermissionModule, boolean> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [productModal, setProductModal] = useState<Product | 'new' | null>(null)
  const [productOutletModal, setProductOutletModal] = useState<Product | null>(null)
  const [categoryModal, setCategoryModal] = useState<MenuCategory | 'new' | null>(null)
  const [promotionModal, setPromotionModal] = useState<Promotion | 'new' | null>(null)
  const [cashierModal, setCashierModal] = useState<User | 'new' | null>(null)
  const [outletModal, setOutletModal] = useState<Outlet | 'new' | null>(null)

  const logout = useCallback(() => {
    localStorage.removeItem('franchise-user-token')
    localStorage.removeItem('franchise-user')
    window.location.href = '/login'
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const activeOutlets = await managerApi.availableOutlets()
      const savedOutletId = Number(localStorage.getItem('franchise-outlet-id'))
      const selectedOutlet = activeOutlets.find((outlet) => outlet.id === savedOutletId) || activeOutlets.find((outlet) => outlet.isDefault) || activeOutlets[0]
      if (!selectedOutlet) throw new Error('Belum ada outlet aktif. Buat atau aktifkan outlet terlebih dahulu.')
      localStorage.setItem('franchise-outlet-id', String(selectedOutlet.id))
      setSelectedOutletId(selectedOutlet.id)
      const nextPermissions = await managerApi.myPermissions()
      setPermissions(nextPermissions.modules)
      const [nextProducts, nextCategories, nextPromotions, nextCashiers] = await Promise.all([
        nextPermissions.modules.products ? managerApi.products() : Promise.resolve([]),
        nextPermissions.modules.categories || nextPermissions.modules.products ? managerApi.categories() : Promise.resolve([]),
        nextPermissions.modules.promotions ? managerApi.promotions() : Promise.resolve([]),
        nextPermissions.modules.cashiers ? managerApi.cashiers() : Promise.resolve([]),
      ])
      setProducts(nextProducts)
      setCategories(nextCategories)
      setPromotions(nextPromotions)
      setCashiers(nextCashiers)
      setOutlets(nextPermissions.modules.outlets ? await managerApi.outlets() : activeOutlets)
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Data manager gagal dimuat.'
      setError(message)
      if (message.toLowerCase().includes('sesi') || message.toLowerCase().includes('login') || message.toLowerCase().includes('akses')) logout()
    } finally { setLoading(false) }
  }, [logout])

  useEffect(() => {
    if (!user || !['manager', 'admin'].includes(user.role) || !localStorage.getItem('franchise-user-token')) {
      window.location.replace('/login')
      return
    }
    const roleHomePath = homePathForRole(user.role)
    if (window.location.pathname !== roleHomePath) {
      window.location.replace(roleHomePath)
      return
    }
    if (loadedRef.current) return
    loadedRef.current = true
    void loadData()
  }, [loadData, user])

  useEffect(() => {
    if (!permissions || permissions[tabModules[tab]]) return
    const fallback = (Object.keys(tabModules) as ManagerTab[]).find((candidate) => permissions[tabModules[candidate]])
    if (fallback) setTab(fallback)
  }, [permissions, tab])

  const toggleProduct = async (product: Product) => {
    try {
      await managerApi.setProductActive(product.id, !product.active)
      await loadData()
    } catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'Produk gagal diperbarui.') }
  }

  const removeProduct = async (product: Product) => {
    if (!window.confirm(`Hapus ${product.name}? Produk yang pernah dipesan akan diarsipkan.`)) return
    try { await managerApi.deleteProduct(product.id); await loadData() }
    catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'Produk gagal dihapus.') }
  }

  const toggleCategory = async (category: MenuCategory) => {
    try {
      const updated = await managerApi.setCategoryActive(category.id, !category.active)
      setCategories((current) => current.map((item) => item.id === category.id ? updated : item))
    } catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'Kategori gagal diperbarui. Pastikan login sebagai Manager.') }
  }

  const removeCategory = async (category: MenuCategory) => {
    if (!window.confirm(`Hapus kategori ${category.label}? Kategori yang masih dipakai produk akan dinonaktifkan.`)) return
    try { await managerApi.deleteCategory(category.id); await loadData() }
    catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'Kategori gagal dihapus. Pastikan login sebagai Manager.') }
  }

  const removePromotion = async (promotion: Promotion) => {
    if (!window.confirm(`Hapus promosi ${promotion.title}?`)) return
    try { await managerApi.deletePromotion(promotion.id); await loadData() }
    catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'Promosi gagal dihapus.') }
  }

  const removeCashier = async (cashier: User) => {
    if (!window.confirm(`Hapus akun cashier ${cashier.name}? Akun ini tidak akan bisa login lagi.`)) return
    try { await managerApi.deleteCashier(cashier.id); await loadData() }
    catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'Cashier gagal dihapus.') }
  }

  const removeOutlet = async (outlet: Outlet) => {
    if (!window.confirm(`Hapus outlet ${outlet.name}? Outlet yang sudah memiliki transaksi akan diarsipkan.`)) return
    try { await managerApi.deleteOutlet(outlet.id); await loadData() }
    catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'Outlet gagal dihapus.') }
  }

  const changeOutlet = (outletId: number) => {
    localStorage.setItem('franchise-outlet-id', String(outletId))
    setSelectedOutletId(outletId)
    void loadData()
  }

  const canAccess = (module: PermissionModule) => Boolean(permissions?.[module])
  const navigationTabs: Array<{ tab: ManagerTab; module: PermissionModule; label: string; Icon: typeof Package }> = [
    { tab: 'products', module: 'products', label: 'Produk', Icon: Package },
    { tab: 'categories', module: 'categories', label: 'Kategori', Icon: Tags },
    { tab: 'promotions', module: 'promotions', label: 'Promosi', Icon: BadgePercent },
    { tab: 'cashiers', module: 'cashiers', label: 'Cashier', Icon: UsersRound },
    { tab: 'inventory', module: 'inventory', label: 'Inventory', Icon: Warehouse },
    { tab: 'reports', module: 'reports', label: 'Report', Icon: BarChart3 },
    { tab: 'outlets', module: 'outlets', label: 'Outlet', Icon: Building2 },
    { tab: 'settings', module: 'settings', label: 'Franchise', Icon: Settings },
    { tab: 'rbac', module: 'rbac', label: 'RBAC', Icon: ShieldCheck },
  ]
  const pageTitle = tab === 'products' ? 'Kelola produk' : tab === 'categories' ? 'Kelola kategori menu' : tab === 'promotions' ? 'Kelola promosi' : tab === 'cashiers' ? 'Kelola cashier' : tab === 'inventory' ? 'Kelola inventory' : tab === 'reports' ? 'Report bisnis' : tab === 'outlets' ? 'Kelola outlet' : tab === 'rbac' ? 'Kontrol akses modul' : 'Pengaturan franchise'
  const panelTitle = tab === 'products' ? 'Katalog menu' : tab === 'categories' ? 'Kategori menu' : tab === 'promotions' ? 'Daftar promosi' : tab === 'cashiers' ? 'Daftar cashier' : tab === 'inventory' ? 'Stock control' : tab === 'reports' ? 'Laporan operasional & keuangan' : tab === 'outlets' ? 'Jaringan outlet' : tab === 'rbac' ? 'Role-Based Access Control' : 'Identitas franchise'
  const panelDescription = tab === 'products' ? 'Kelola master produk, add-on, serta ketersediaannya pada outlet aktif.' : tab === 'categories' ? 'Tambah, ubah, urutkan, aktifkan, atau nonaktifkan kategori yang tampil di storefront.' : tab === 'promotions' ? 'Atur kode, nilai diskon, periode, dan status promosi.' : tab === 'cashiers' ? 'Tambah, ubah, aktifkan, nonaktifkan, atau hapus akun cashier pada outlet terpilih.' : tab === 'inventory' ? 'Pantau stok dan pergerakan barang khusus outlet terpilih.' : tab === 'reports' ? 'Pantau penjualan dan keuangan outlet terpilih.' : tab === 'outlets' ? 'Tambah cabang, atur alamat, status operasional, dan outlet utama.' : tab === 'rbac' ? 'Admin dapat mengatur modul mana saja yang boleh diakses oleh cashier, manager, dan admin.' : 'Ubah nama usaha, logo teks, warna, halaman depan, kontak, dan prefix pesanan.'
  const addButtonLabel = tab === 'products' ? 'produk' : tab === 'categories' ? 'kategori' : tab === 'promotions' ? 'promosi' : tab === 'outlets' ? 'outlet' : 'cashier'
  const showCreateButton = ['products', 'categories', 'promotions', 'cashiers', 'outlets'].includes(tab)
  const openCreateModal = () => {
    if (tab === 'products') setProductModal('new')
    if (tab === 'categories') setCategoryModal('new')
    if (tab === 'promotions') setPromotionModal('new')
    if (tab === 'cashiers') setCashierModal('new')
    if (tab === 'outlets') setOutletModal('new')
  }

  return <div className="manager-shell">
    <aside className="manager-sidebar">
      <a className="manager-logo" href={user ? homePathForRole(user.role) : '/manager'}><span>{settings.shortName}</span><div><b>{user?.role === 'admin' ? 'Admin Hub' : 'Manager Hub'}</b><small>{settings.businessName}</small></div></a>
      <nav>{navigationTabs.filter((item) => canAccess(item.module) && (item.module !== 'rbac' || user?.role === 'admin')).map((item) => <button key={item.tab} className={tab === item.tab ? 'active' : ''} onClick={() => setTab(item.tab)}><item.Icon size={18} /> {item.label}</button>)}</nav>
      {canAccess('cashier_station') && <div className="manager-side-bottom"><a href="/cashier"><ShoppingBag size={17} /> Stasiun cashier <ExternalLink size={13} /></a></div>}
    </aside>
    <main className="manager-main">
      <header className="manager-header"><div><span>{user?.role === 'admin' ? 'ADMIN DASHBOARD' : 'MANAGER DASHBOARD'}</span><h1>{pageTitle}</h1></div><div className="manager-header-actions"><label className="outlet-switcher"><Building2 size={16} /><span><small>OUTLET AKTIF</small><select value={selectedOutletId || ''} onChange={(event) => changeOutlet(Number(event.target.value))}>{outlets.filter((outlet) => outlet.active).map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}</select></span></label>{user && <ProfileMenu user={user} onLogout={logout} onUserUpdate={setUser} />}</div></header>
      <div className="manager-content">
        {error && <div className="manager-error">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}
        <section className="manager-summary"><article><span className="red"><Package /></span><div><small>Master produk</small><b>{products.length}</b></div></article><article><span className="green"><Check /></span><div><small>Dijual di outlet</small><b>{products.filter((item) => item.active && item.outletAssignment?.assigned && item.outletAssignment.active && item.outletAssignment.available).length}</b></div></article><article><span className="orange"><BadgePercent /></span><div><small>Promosi aktif</small><b>{promotions.filter((item) => item.active).length}</b></div></article><article><span className="blue"><UsersRound /></span><div><small>Akun cashier</small><b>{cashiers.length}</b></div></article></section>
        <section className={`manager-panel${tab === 'reports' ? ' report-panel' : ''}`}><div className="manager-panel-head"><div><h2>{panelTitle}</h2><p>{panelDescription}</p></div><div>{showCreateButton && <button className="manager-refresh" onClick={() => void loadData()} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} /> Perbarui</button>}{showCreateButton && <button className="manager-add" onClick={openCreateModal}><Plus size={16} /> Tambah {addButtonLabel}</button>}</div></div>
          {tab === 'settings' ? <SettingsEditor settings={settings} saved={setSettings} /> : tab === 'inventory' ? <InventoryModule /> : tab === 'reports' ? <ReportsModule /> : tab === 'rbac' ? <RbacModule onSaved={() => void loadData()} /> : loading ? <div className="manager-empty"><RefreshCw className="spin" /> Memuat data...</div> : tab === 'products' ? <ProductGrid products={products} edit={setProductModal} configureOutlet={setProductOutletModal} toggle={toggleProduct} remove={removeProduct} /> : tab === 'categories' ? <CategoryGrid categories={categories} edit={setCategoryModal} toggle={toggleCategory} remove={removeCategory} /> : tab === 'promotions' ? <PromotionGrid promotions={promotions} edit={setPromotionModal} remove={removePromotion} /> : tab === 'outlets' ? <OutletGrid outlets={outlets} edit={setOutletModal} remove={removeOutlet} select={changeOutlet} selectedOutletId={selectedOutletId} /> : <CashierGrid cashiers={cashiers} edit={setCashierModal} remove={removeCashier} />}
        </section>
      </div>
    </main>
    {productModal && <ProductEditor product={productModal === 'new' ? null : productModal} categories={categories} close={() => setProductModal(null)} saved={() => { setProductModal(null); void loadData() }} />}
    {productOutletModal && selectedOutletId && <ProductOutletEditor product={productOutletModal} outletName={outlets.find((outlet) => outlet.id === selectedOutletId)?.name || 'Outlet aktif'} close={() => setProductOutletModal(null)} saved={() => { setProductOutletModal(null); void loadData() }} />}
    {categoryModal && <CategoryEditor category={categoryModal === 'new' ? null : categoryModal} close={() => setCategoryModal(null)} saved={() => { setCategoryModal(null); void loadData() }} />}
    {promotionModal && <PromotionEditor promotion={promotionModal === 'new' ? null : promotionModal} close={() => setPromotionModal(null)} saved={() => { setPromotionModal(null); void loadData() }} />}
    {cashierModal && <CashierEditor cashier={cashierModal === 'new' ? null : cashierModal} outlets={outlets.filter((outlet) => outlet.active)} selectedOutletId={selectedOutletId} close={() => setCashierModal(null)} saved={() => { setCashierModal(null); void loadData() }} />}
    {outletModal && <OutletEditor outlet={outletModal === 'new' ? null : outletModal} close={() => setOutletModal(null)} saved={() => { setOutletModal(null); void loadData() }} />}
  </div>
}

function ProductGrid({ products, edit, configureOutlet, toggle, remove }: { products: Product[]; edit: (value: Product) => void; configureOutlet: (value: Product) => void; toggle: (value: Product) => void; remove: (value: Product) => void }) {
  if (!products.length) return <div className="manager-empty"><Package size={37} /><h3>Belum ada produk</h3><p>Tambah master produk lalu atur ketersediaannya pada outlet aktif.</p></div>
  return <div className="manager-grid">{products.map((product) => {
    const assignment = product.outletAssignment
    const soldHere = Boolean(product.active && assignment?.assigned && assignment.active && assignment.available)
    const status = !assignment?.assigned ? 'Belum ditugaskan' : !assignment.active ? 'Nonaktif di outlet' : !assignment.available ? 'Sedang tidak tersedia' : 'Dijual di outlet'
    return <article className={soldHere ? 'manager-product' : 'manager-product inactive'} key={product.id}>
      <div className={`manager-product-art ${product.tone}${product.imageUrl ? ' has-photo' : ''}`}>{product.imageUrl ? <img className="manager-product-photo" src={product.imageUrl} alt={product.name} /> : product.emoji}{product.badge && <small>{product.badge}</small>}</div>
      <div className="manager-product-body"><span>{product.category}</span><h3>{product.name}</h3><p>{product.description}</p><strong>{formatRupiah(assignment?.effectivePrice ?? product.price)}</strong>{assignment?.priceOverride !== undefined && <small className="product-base-price">Harga master {formatRupiah(product.basePrice ?? product.price)}</small>}<i className={`product-outlet-status ${soldHere ? 'available' : ''}`}><Building2 size={13} /> {status}</i>{product.addons.length > 0 && <i className="product-addon-count">+ {product.addons.filter((addon) => addon.active).length} add-on aktif</i>}</div>
      <footer><label title="Status master produk untuk seluruh outlet"><input type="checkbox" checked={Boolean(product.active)} onChange={() => void toggle(product)} /><i />Master {product.active ? 'aktif' : 'nonaktif'}</label><div><button className="outlet-config-button" onClick={() => configureOutlet(product)} aria-label={`Atur ${product.name} untuk outlet`} title="Atur produk pada outlet"><Building2 size={15} /></button><button onClick={() => edit(product)} aria-label={`Edit ${product.name}`} title="Edit master produk"><Pencil size={15} /></button><button className="danger" onClick={() => void remove(product)} aria-label={`Hapus ${product.name}`} title="Hapus produk"><Trash2 size={15} /></button></div></footer>
    </article>
  })}</div>
}

function CategoryGrid({ categories, edit, toggle, remove }: { categories: MenuCategory[]; edit: (value: MenuCategory) => void; toggle: (value: MenuCategory) => void; remove: (value: MenuCategory) => void }) {
  if (!categories.length) return <div className="manager-empty"><Tags size={37} /><h3>Belum ada kategori</h3><p>Tambah kategori menu sebelum membuat produk.</p></div>
  return <div className="category-manager-grid">{categories.map((category) => <article className={category.active ? 'category-manager-card' : 'category-manager-card inactive'} key={category.id}>
    <div className="category-manager-card-top"><span className="category-manager-icon">{category.emoji}</span><div className="category-manager-info"><span className="category-manager-order">Urutan {category.sortOrder}</span><h3>{category.label}</h3><p>{category.productCount || 0} produk terhubung</p></div></div>
    <div className={category.active ? 'category-manager-visibility visible' : 'category-manager-visibility hidden'}><i /><div><b>{category.active ? 'Tampil di toko' : 'Disembunyikan'}</b><small>{category.active ? 'Pelanggan dapat menemukan kategori ini.' : 'Kategori tidak terlihat oleh pelanggan.'}</small></div></div>
    <footer><label><input type="checkbox" checked={category.active} onChange={() => void toggle(category)} /><i /><span>{category.active ? 'Aktif' : 'Nonaktif'}</span></label><div><button type="button" onClick={() => edit(category)} aria-label={`Edit kategori ${category.label}`} title="Edit kategori"><Pencil size={15} /></button><button type="button" className="danger" onClick={() => void remove(category)} aria-label={`Hapus kategori ${category.label}`} title="Hapus kategori"><Trash2 size={15} /></button></div></footer>
  </article>)}</div>
}

function PromotionGrid({ promotions, edit, remove }: { promotions: Promotion[]; edit: (value: Promotion) => void; remove: (value: Promotion) => void }) {
  if (!promotions.length) return <div className="manager-empty"><BadgePercent size={37} /><h3>Belum ada promosi</h3></div>
  return <div className="promotion-grid">{promotions.map((promotion) => <article className={promotion.active ? 'promotion-card' : 'promotion-card inactive'} key={promotion.id}><header><span>{promotion.active ? 'Aktif' : 'Nonaktif'}</span><b>{promotion.code}</b></header><div><small>{promotion.discountType === 'percentage' ? 'DISKON PERSENTASE' : 'POTONGAN HARGA'}</small><h3>{promotion.title}</h3><p>{promotion.description}</p><strong>{promotion.discountType === 'percentage' ? `${promotion.discountValue}%` : formatRupiah(promotion.discountValue)}</strong><dl><div><dt>Minimum</dt><dd>{formatRupiah(promotion.minOrder)}</dd></div><div><dt>Periode</dt><dd>{promotion.startDate || 'Sekarang'} — {promotion.endDate || 'Tanpa batas'}</dd></div></dl></div><footer><button onClick={() => edit(promotion)}><Pencil size={15} /> Edit</button><button className="danger" onClick={() => void remove(promotion)}><Trash2 size={15} /> Hapus</button></footer></article>)}</div>
}

function CashierGrid({ cashiers, edit, remove }: { cashiers: User[]; edit: (value: User) => void; remove: (value: User) => void }) {
  if (!cashiers.length) return <div className="manager-empty"><UsersRound size={37} /><h3>Belum ada cashier</h3><p>Tambah cashier agar tim outlet bisa memproses pesanan.</p></div>
  return <div className="cashier-grid">{cashiers.map((cashier) => <article className={cashier.active ? 'cashier-card' : 'cashier-card inactive'} key={cashier.id}>
    <div className="cashier-card-top"><span className="cashier-card-avatar">{cashier.name.charAt(0).toUpperCase()}</span><div className="cashier-card-info"><span className="cashier-card-role">Akun cashier</span><h3>{cashier.name}</h3><p>{cashier.email}</p><small className="cashier-outlet-name"><Building2 size={12} /> {cashier.outletName || 'Belum ditempatkan'}</small></div></div>
    <div className={cashier.active ? 'cashier-card-status active' : 'cashier-card-status disabled'}><i /><div><b>{cashier.active ? 'Siap digunakan' : 'Akses dinonaktifkan'}</b><small>{cashier.active ? 'Akun dapat masuk ke stasiun cashier.' : 'Akun tidak dapat login untuk sementara.'}</small></div></div>
    <footer><button type="button" onClick={() => edit(cashier)} aria-label={`Edit ${cashier.name}`}><Pencil size={15} /> Edit</button><button type="button" className="danger" onClick={() => void remove(cashier)} aria-label={`Hapus ${cashier.name}`}><Trash2 size={15} /> Hapus</button></footer>
  </article>)}</div>
}

function OutletGrid({ outlets, edit, remove, select, selectedOutletId }: { outlets: Outlet[]; edit: (value: Outlet) => void; remove: (value: Outlet) => void; select: (id: number) => void; selectedOutletId?: number }) {
  if (!outlets.length) return <div className="manager-empty"><Building2 size={37} /><h3>Belum ada outlet</h3><p>Tambahkan cabang pertama untuk memulai operasional multi-outlet.</p></div>
  return <div className="outlet-grid">{outlets.map((outlet) => <article className={outlet.active ? 'outlet-card' : 'outlet-card inactive'} key={outlet.id}>
    <header><span><Building2 /></span><div><small>{outlet.code}</small><h3>{outlet.name}</h3></div>{outlet.isDefault && <b>Outlet utama</b>}</header>
    <div className="outlet-address"><MapPin size={16} /><p>{outlet.address || 'Alamat belum diisi'}<small>{outlet.phone || 'Nomor telepon belum diisi'}</small></p></div>
    <div className={outlet.active ? 'outlet-state active' : 'outlet-state inactive'}><i /><span>{outlet.active ? 'Menerima pesanan' : 'Operasional dinonaktifkan'}</span></div>
    <footer><button type="button" className={selectedOutletId === outlet.id ? 'selected-outlet' : ''} disabled={!outlet.active || selectedOutletId === outlet.id} onClick={() => select(outlet.id)}>{selectedOutletId === outlet.id ? 'Sedang dipilih' : 'Pilih outlet'}</button><div><button type="button" onClick={() => edit(outlet)}><Pencil size={15} /> Edit</button><button type="button" className="danger" disabled={outlet.isDefault} onClick={() => void remove(outlet)}><Trash2 size={15} /> Hapus</button></div></footer>
  </article>)}</div>
}

function RbacModule({ onSaved }: { onSaved: () => void }) {
  const [matrix, setMatrix] = useState<RolePermissionMatrix | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const roleLabels: Record<PermissionRole, string> = { cashier: 'Cashier', manager: 'Manager', admin: 'Admin' }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setMatrix(await managerApi.rbac()) }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'RBAC gagal dimuat.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const toggle = (role: PermissionRole, module: PermissionModule) => {
    if (module === 'rbac') return
    setMatrix((current) => current ? ({
      ...current,
      permissions: {
        ...current.permissions,
        [role]: {
          ...current.permissions[role],
          [module]: !current.permissions[role][module],
        },
      },
    }) : current)
  }

  const save = async () => {
    if (!matrix) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const updated = await managerApi.updateRbac(matrix.permissions)
      setMatrix(updated)
      setMessage('Hak akses modul berhasil disimpan.')
      onSaved()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'RBAC gagal disimpan.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="manager-empty"><RefreshCw className="spin" /> Memuat pengaturan RBAC...</div>
  if (!matrix) return <div className="manager-empty"><ShieldCheck size={37} /><h3>RBAC belum tersedia</h3><p>{error || 'Coba muat ulang halaman.'}</p></div>

  return <div className="rbac-module">
    <div className="rbac-intro"><span><ShieldCheck /></span><div><h3>Kontrol akses berbasis role</h3><p>Centang modul yang boleh dibuka setiap role. Perubahan ini berlaku di menu dashboard dan dijaga lagi oleh API backend.</p></div></div>
    {error && <p className="manager-form-error">{error}</p>}
    {message && <p className="manager-form-success">{message}</p>}
    <div className="rbac-table-wrap"><table className="rbac-table"><thead><tr><th>Modul</th>{matrix.roles.map((role) => <th key={role}>{roleLabels[role]}</th>)}</tr></thead><tbody>{matrix.modules.map((module) => <tr key={module.key}><td><b>{module.label}</b><small>{module.description}</small></td>{matrix.roles.map((role) => {
      const locked = module.key === 'rbac'
      const checked = role === 'admin' && module.key === 'rbac' ? true : matrix.permissions[role][module.key]
      return <td key={`${role}-${module.key}`}><label className={locked ? 'rbac-toggle locked' : 'rbac-toggle'}><input type="checkbox" checked={checked} disabled={locked} onChange={() => toggle(role, module.key)} /><i />{module.key === 'rbac' ? role === 'admin' ? 'Wajib aktif' : 'Admin saja' : matrix.permissions[role][module.key] ? 'Aktif' : 'Nonaktif'}</label></td>
    })}</tr>)}</tbody></table></div>
    <div className="rbac-actions"><div className="rbac-actions-copy"><b>Simpan pengaturan akses</b><small>Pastikan setiap role hanya memperoleh modul yang memang dibutuhkan.</small></div><div className="rbac-action-buttons"><button type="button" className="manager-refresh" onClick={() => void load()} disabled={saving}><RefreshCw size={15} /> Reset tampilan</button><button type="button" className="manager-add" onClick={() => void save()} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan RBAC'}</button></div></div>
  </div>
}

function SettingsEditor({ settings, saved }: { settings: FranchiseSettings; saved: (settings: FranchiseSettings) => void }) {
  const [draft, setDraft] = useState(settings)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => setDraft(settings), [settings])

  const chooseBrandImage = async (field: 'heroImageUrl' | 'storyImageUrl', event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (!file) return
    setError('')
    setMessage('')
    try {
      const imageUrl = await readProductImageFile(file)
      setDraft((current) => ({ ...current, [field]: imageUrl }))
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : 'Gambar gagal dipilih.')
      event.currentTarget.value = ''
    }
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    const form = new FormData(event.currentTarget)
    const nextSettings: FranchiseSettings = {
      ...draft,
      businessName: String(form.get('businessName') || ''),
      shortName: String(form.get('shortName') || ''),
      tagline: String(form.get('tagline') || ''),
      primaryColor: String(form.get('primaryColor') || ''),
      accentColor: String(form.get('accentColor') || ''),
      whatsappNumber: String(form.get('whatsappNumber') || ''),
      contactEmail: String(form.get('contactEmail') || ''),
      orderPrefix: String(form.get('orderPrefix') || ''),
      heroEyebrow: String(form.get('heroEyebrow') || ''),
      heroTitle: String(form.get('heroTitle') || ''),
      heroHighlight: String(form.get('heroHighlight') || ''),
      heroDescription: String(form.get('heroDescription') || ''),
      deliveryEstimate: String(form.get('deliveryEstimate') || ''),
      deliveryNote: String(form.get('deliveryNote') || ''),
      menuKicker: String(form.get('menuKicker') || ''),
      menuTitle: String(form.get('menuTitle') || ''),
      menuDescription: String(form.get('menuDescription') || ''),
      aboutKicker: String(form.get('aboutKicker') || ''),
      aboutTitle: String(form.get('aboutTitle') || ''),
      aboutDescription: String(form.get('aboutDescription') || ''),
      aboutReviewQuote: String(form.get('aboutReviewQuote') || ''),
      aboutReviewAuthor: String(form.get('aboutReviewAuthor') || ''),
      locationLabel: String(form.get('locationLabel') || ''),
      locationTitle: String(form.get('locationTitle') || ''),
      locationDescription: String(form.get('locationDescription') || ''),
      footerDescription: String(form.get('footerDescription') || ''),
    }
    try {
      const updated = await managerApi.updateSettings(nextSettings)
      saved(updated)
      setDraft(updated)
      setMessage('Pengaturan franchise berhasil disimpan.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Pengaturan gagal disimpan.')
    } finally {
      setSaving(false)
    }
  }

  return <form className="manager-settings-form manager-form" onSubmit={submit}>
    <section><h3>Identitas brand</h3><div className="manager-form-row"><label>Nama usaha<input name="businessName" defaultValue={draft.businessName} required /></label><label>Logo singkat<input name="shortName" defaultValue={draft.shortName} maxLength={8} required /></label></div><label>Tagline<input name="tagline" defaultValue={draft.tagline} required /></label><div className="manager-form-row"><label>Warna utama<input type="color" name="primaryColor" defaultValue={draft.primaryColor} /></label><label>Warna aksen<input type="color" name="accentColor" defaultValue={draft.accentColor} /></label></div></section>
    <section><h3>Kontak & pesanan</h3><div className="manager-form-row"><label>Nomor WhatsApp toko<input name="whatsappNumber" defaultValue={draft.whatsappNumber} placeholder="62812..." /></label><label>Email kontak<input name="contactEmail" type="email" defaultValue={draft.contactEmail} /></label></div><label>Prefix nomor pesanan<input name="orderPrefix" defaultValue={draft.orderPrefix} maxLength={8} required /></label></section>
    <section><h3>Halaman depan</h3><div className="brand-image-row"><div className="brand-image-preview">{draft.heroImageUrl ? <img src={draft.heroImageUrl} alt="Hero brand" /> : <span>Hero</span>}</div><label>Gambar hero<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => void chooseBrandImage('heroImageUrl', event)} /></label>{draft.heroImageUrl && <button type="button" className="manager-link-button" onClick={() => setDraft((current) => ({ ...current, heroImageUrl: '' }))}>Hapus gambar hero</button>}</div><label>Label kecil hero<input name="heroEyebrow" defaultValue={draft.heroEyebrow} /></label><div className="manager-form-row"><label>Judul hero<input name="heroTitle" defaultValue={draft.heroTitle} /></label><label>Highlight hero<input name="heroHighlight" defaultValue={draft.heroHighlight} /></label></div><label>Deskripsi hero<textarea name="heroDescription" defaultValue={draft.heroDescription} rows={3} /></label><div className="manager-form-row"><label>Estimasi delivery<input name="deliveryEstimate" defaultValue={draft.deliveryEstimate} /></label><label>Catatan delivery<input name="deliveryNote" defaultValue={draft.deliveryNote} /></label></div></section>
    <section><h3>Menu, tentang, lokasi</h3><div className="manager-form-row"><label>Kicker menu<input name="menuKicker" defaultValue={draft.menuKicker} /></label><label>Judul menu<input name="menuTitle" defaultValue={draft.menuTitle} /></label></div><label>Deskripsi menu<textarea name="menuDescription" defaultValue={draft.menuDescription} rows={2} /></label><div className="brand-image-row"><div className="brand-image-preview">{draft.storyImageUrl ? <img src={draft.storyImageUrl} alt="Tentang brand" /> : <span>Tentang</span>}</div><label>Gambar tentang<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => void chooseBrandImage('storyImageUrl', event)} /></label>{draft.storyImageUrl && <button type="button" className="manager-link-button" onClick={() => setDraft((current) => ({ ...current, storyImageUrl: '' }))}>Hapus gambar tentang</button>}</div><div className="manager-form-row"><label>Kicker tentang<input name="aboutKicker" defaultValue={draft.aboutKicker} /></label><label>Judul tentang<input name="aboutTitle" defaultValue={draft.aboutTitle} /></label></div><label>Deskripsi tentang<textarea name="aboutDescription" defaultValue={draft.aboutDescription} rows={3} /></label><div className="manager-form-row"><label>Review singkat<input name="aboutReviewQuote" defaultValue={draft.aboutReviewQuote} /></label><label>Nama reviewer<input name="aboutReviewAuthor" defaultValue={draft.aboutReviewAuthor} /></label></div><div className="manager-form-row"><label>Label lokasi<input name="locationLabel" defaultValue={draft.locationLabel} /></label><label>Judul lokasi<input name="locationTitle" defaultValue={draft.locationTitle} /></label></div><label>Deskripsi lokasi<textarea name="locationDescription" defaultValue={draft.locationDescription} rows={2} /></label><label>Deskripsi footer<textarea name="footerDescription" defaultValue={draft.footerDescription} rows={2} /></label></section>
    {error && <p className="manager-form-error">{error}</p>}
    {message && <p className="manager-form-success">{message}</p>}
    <footer><button className="primary" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan pengaturan franchise'}</button></footer>
  </form>
}

function CashierEditor({ cashier, outlets, selectedOutletId, close, saved }: { cashier: User | null; outlets: Outlet[]; selectedOutletId?: number; close: () => void; saved: () => void }) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      const payload = {
        name: String(form.get('name') || ''),
        email: String(form.get('email') || ''),
        password: String(form.get('password') || ''),
        active: form.get('active') === 'on',
        outletId: Number(form.get('outletId')),
      }
      if (cashier) await managerApi.updateCashier(cashier.id, { ...payload, password: payload.password || undefined })
      else await managerApi.createCashier({ name: payload.name, email: payload.email, password: payload.password, outletId: payload.outletId })
      saved()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Cashier gagal disimpan.')
    } finally {
      setLoading(false)
    }
  }
  return <div className="manager-modal-bg"><form className="manager-modal cashier-modal" onSubmit={submit}><header><div><small>CASHIER</small><h2>{cashier ? 'Edit cashier' : 'Tambah cashier'}</h2></div><button type="button" onClick={close}><X /></button></header><div className="manager-form"><div className="cashier-modal-intro"><span><UserPlus /></span><div><b>{cashier ? 'Perbarui akun operasional' : 'Buat akun operasional'}</b><p>{cashier ? 'Ubah identitas, outlet, password, atau akses login cashier.' : 'Akun ini hanya melihat dan memproses pesanan dari outlet yang dipilih.'}</p></div></div><label>Outlet penempatan<select name="outletId" defaultValue={cashier?.outletId || selectedOutletId} required>{outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}</select></label><label>Nama cashier<input name="name" defaultValue={cashier?.name} placeholder="Contoh: Kasir Outlet 1" required autoFocus /></label><label>Email cashier<input name="email" type="email" defaultValue={cashier?.email} placeholder="cashier.outlet@email.com" required /></label><label>{cashier ? 'Password baru (opsional)' : 'Password awal'}<input name="password" type="password" placeholder={cashier ? 'Kosongkan jika tidak diubah' : 'Minimal 8 karakter'} minLength={8} required={!cashier} /></label>{cashier && <div className="manager-checks"><label><input type="checkbox" name="active" defaultChecked={cashier.active} /> Akun aktif</label></div>}{error && <p className="manager-form-error">{error}</p>}</div><footer><button type="button" onClick={close}>Batal</button><button className="primary" disabled={loading}>{loading ? 'Menyimpan...' : cashier ? 'Simpan perubahan' : 'Buat cashier'}</button></footer></form></div>
}

function OutletEditor({ outlet, close, saved }: { outlet: Outlet | null; close: () => void; saved: () => void }) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setError('')
    const form = new FormData(event.currentTarget)
    try {
      await managerApi.saveOutlet({ id: outlet?.id, code: String(form.get('code') || ''), name: String(form.get('name') || ''), address: String(form.get('address') || ''), phone: String(form.get('phone') || ''), active: form.get('active') === 'on', isDefault: form.get('isDefault') === 'on' })
      saved()
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Outlet gagal disimpan.') }
    finally { setLoading(false) }
  }
  return <div className="manager-modal-bg"><form className="manager-modal outlet-modal" onSubmit={submit}><header><div><small>OUTLET</small><h2>{outlet ? 'Edit outlet' : 'Tambah outlet'}</h2></div><button type="button" onClick={close}><X /></button></header><div className="manager-form"><div className="cashier-modal-intro"><span><Building2 /></span><div><b>Identitas cabang</b><p>Pesanan, cashier, stok, dan laporan operasional akan dipisahkan berdasarkan outlet.</p></div></div><div className="manager-form-row"><label>Kode outlet<input name="code" defaultValue={outlet?.code} placeholder="Contoh: JKT-01" required /></label><label>Nama outlet<input name="name" defaultValue={outlet?.name} placeholder="Outlet Jakarta Pusat" required /></label></div><label>Alamat<textarea name="address" defaultValue={outlet?.address} rows={3} placeholder="Alamat lengkap outlet" /></label><label>Nomor telepon<input name="phone" defaultValue={outlet?.phone} placeholder="021... atau 628..." /></label><div className="manager-checks"><label><input type="checkbox" name="active" defaultChecked={outlet?.active ?? true} /> Outlet aktif</label><label><input type="checkbox" name="isDefault" defaultChecked={outlet?.isDefault} /> Jadikan outlet utama</label></div>{error && <p className="manager-form-error">{error}</p>}</div><footer><button type="button" onClick={close}>Batal</button><button className="primary" disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan outlet'}</button></footer></form></div>
}

function CategoryEditor({ category, close, saved }: { category: MenuCategory | null; close: () => void; saved: () => void }) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      await managerApi.saveCategory({
        id: category?.id,
        label: String(form.get('label') || ''),
        emoji: String(form.get('emoji') || '🍽️'),
        sortOrder: Number(form.get('sortOrder') || 0),
        active: form.get('active') === 'on',
      })
      saved()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Kategori gagal disimpan. Pastikan login sebagai Manager.')
    } finally {
      setLoading(false)
    }
  }

  return <div className="manager-modal-bg"><form className="manager-modal category-modal" onSubmit={submit}><header><div><small>KATEGORI MENU</small><h2>{category ? 'Edit kategori' : 'Tambah kategori'}</h2></div><button type="button" onClick={close}><X /></button></header><div className="manager-form"><div className="category-modal-intro"><span>{category?.emoji || '🍽️'}</span><div><b>Kategori tampil sebagai filter menu pelanggan</b><p>Gunakan nama yang fleksibel untuk franchise apa pun, misalnya Paket Hemat, Minuman, Dessert, Merchandise, atau kategori lain.</p></div></div><div className="manager-form-row category-form-row"><label>Icon/emoji<input name="emoji" defaultValue={category?.emoji || '🍽️'} maxLength={12} required /></label><label>Nama kategori<input name="label" defaultValue={category?.label} placeholder="Contoh: Dessert" minLength={2} maxLength={40} required autoFocus /></label></div><label>Urutan tampil<input name="sortOrder" type="number" defaultValue={category?.sortOrder ?? 100} min="0" max="9999" required /><small>Angka lebih kecil tampil lebih dulu di storefront.</small></label><div className="manager-checks"><label><input type="checkbox" name="active" defaultChecked={category?.active ?? true} /> Tampilkan kategori di storefront</label></div>{category && (category.productCount || 0) > 0 && <p className="manager-form-hint">Kategori ini dipakai oleh {category.productCount} produk. Jika nama kategori diubah, produk terkait ikut diperbarui otomatis.</p>}{error && <p className="manager-form-error">{error}</p>}</div><footer><button type="button" onClick={close}>Batal</button><button className="primary" disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan kategori'}</button></footer></form></div>
}

function ProductOutletEditor({ product, outletName, close, saved }: { product: Product; outletName: string; close: () => void; saved: () => void }) {
  const assignment = product.outletAssignment
  const [assigned, setAssigned] = useState(Boolean(assignment?.assigned))
  const [priceOverride, setPriceOverride] = useState(assignment?.priceOverride === undefined ? '' : String(assignment.priceOverride))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      const priceValue = priceOverride.trim()
      await managerApi.setProductOutletAssignment(product.id, {
        assigned,
        active: assigned && form.get('outletActive') === 'on',
        available: assigned && form.get('available') === 'on',
        priceOverride: assigned && priceValue !== '' ? Number(priceValue) : undefined,
      })
      saved()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Pengaturan produk outlet gagal disimpan.')
    } finally { setLoading(false) }
  }

  return <div className="manager-modal-bg"><form className="manager-modal product-outlet-modal" onSubmit={submit}>
    <header><div><small>PRODUK PER OUTLET</small><h2>{product.name}</h2></div><button type="button" onClick={close}><X /></button></header>
    <div className="manager-form">
      <div className="product-outlet-intro"><span><Building2 /></span><div><b>{outletName}</b><p>Pengaturan ini hanya berlaku untuk outlet aktif. Data master produk dan kategori tetap dipakai bersama oleh seluruh outlet.</p></div></div>
      <label className="product-outlet-assigned"><input type="checkbox" checked={assigned} onChange={(event) => setAssigned(event.target.checked)} /> Jual produk ini di {outletName}</label>
      <div className="manager-form-row">
        <label>Harga khusus outlet<input type="number" name="priceOverride" value={priceOverride} onChange={(event) => setPriceOverride(event.target.value)} min="0" max="100000000" disabled={!assigned} placeholder={String(product.basePrice ?? product.price)} /><small>Kosongkan untuk memakai harga master {formatRupiah(product.basePrice ?? product.price)}.</small></label>
        <div className="product-outlet-flags"><label><input type="checkbox" name="outletActive" defaultChecked={assignment?.active ?? true} disabled={!assigned} /> Konfigurasi outlet aktif</label><label><input type="checkbox" name="available" defaultChecked={assignment?.available ?? true} disabled={!assigned} /> Produk tersedia dijual</label></div>
      </div>
      {!assigned && <p className="manager-form-hint">Produk tidak akan tampil pada katalog {outletName} dan tidak dapat dipesan dari outlet tersebut.</p>}
      {error && <p className="manager-form-error">{error}</p>}
    </div>
    <footer><button type="button" onClick={close}>Batal</button><button className="primary" disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan pengaturan outlet'}</button></footer>
  </form></div>
}

function ProductEditor({ product, categories, close, saved }: { product: Product | null; categories: MenuCategory[]; close: () => void; saved: () => void }) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [imageUrl, setImageUrl] = useState(product?.imageUrl || '')
  const [addons, setAddons] = useState<ProductAddonInput[]>(() => product?.addons.map((addon) => ({ ...addon })) || [])
  const baseCategoryOptions = categories.length ? categories : defaultCategories
  const categoryOptions = product?.category && !baseCategoryOptions.some((category) => category.label === product.category)
    ? [{ id: -1, label: product.category, emoji: '🍽️', sortOrder: 9999, active: false }, ...baseCategoryOptions]
    : baseCategoryOptions

  const chooseImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (!file) return
    setError('')
    try { setImageUrl(await readProductImageFile(file)) }
    catch (imageError) { setError(imageError instanceof Error ? imageError.message : 'Foto gagal dipilih.'); event.currentTarget.value = '' }
  }

  const updateAddon = (index: number, patch: Partial<ProductAddonInput>) => {
    setAddons((current) => current.map((addon, addonIndex) => addonIndex === index ? { ...addon, ...patch } : addon))
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      await managerApi.saveProduct({
        id: product?.id,
        name: String(form.get('name')),
        description: String(form.get('description')),
        price: Number(form.get('price')),
        originalPrice: Number(form.get('originalPrice')) || undefined,
        category: String(form.get('category')),
        emoji: product?.emoji || '🍗',
        imageUrl: imageUrl || undefined,
        tone: String(form.get('tone')),
        badge: String(form.get('badge')) || undefined,
        spicy: form.get('spicy') === 'on',
        active: form.get('active') === 'on',
        addons: addons.map((addon) => ({ ...addon, name: addon.name.trim(), price: Number(addon.price) })),
      })
      saved()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Produk gagal disimpan.')
    } finally { setLoading(false) }
  }

  return <div className="manager-modal-bg"><form className="manager-modal product-editor-modal" onSubmit={submit}><header><div><small>PRODUK</small><h2>{product ? 'Edit produk' : 'Tambah produk'}</h2></div><button type="button" onClick={close}><X /></button></header><div className="manager-form"><div className="product-image-uploader"><div className={`product-image-preview ${product?.tone || 'gold'}${imageUrl ? ' has-photo' : ''}`}>{imageUrl ? <img src={imageUrl} alt="Preview foto produk" /> : <span>{product?.emoji || '🍗'}</span>}</div><div><label>Foto produk<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => void chooseImage(event)} /></label><small>Pilih foto makanan dari komputer. Maksimal 2 MB.</small>{imageUrl && <button className="manager-link-button" type="button" onClick={() => setImageUrl('')}>Hapus foto</button>}</div></div><label>Nama produk<input name="name" defaultValue={product?.name} required /></label><label>Deskripsi<textarea name="description" defaultValue={product?.description} rows={3} required /></label><div className="manager-form-row"><label>Harga<input type="number" name="price" defaultValue={product?.price} min="0" required /></label><label>Harga asli<input type="number" name="originalPrice" defaultValue={product?.originalPrice} min="0" /></label></div><div className="manager-form-row"><label>Kategori<select name="category" defaultValue={product?.category || categoryOptions[0]?.label || ''} required>{categoryOptions.map((item) => <option key={`${item.id}-${item.label}`} value={item.label}>{item.label}{!item.active ? ' (nonaktif)' : ''}</option>)}</select></label><label>Warna fallback<select name="tone" defaultValue={product?.tone || 'gold'}>{['gold','cream','red','orange','yellow','pink','peach','blue'].map((item) => <option key={item}>{item}</option>)}</select></label></div><label>Label promo<input name="badge" defaultValue={product?.badge} /></label><section className="product-addon-editor"><header><div><b>Pilihan add-on</b><small>Tambahan yang dapat dipilih pelanggan saat memesan.</small></div><button type="button" onClick={() => setAddons((current) => [...current, { name: '', price: 0, active: true }])} disabled={addons.length >= 20}><Plus size={14} /> Tambah add-on</button></header>{addons.length === 0 ? <p>Belum ada add-on untuk produk ini.</p> : <div className="product-addon-rows">{addons.map((addon, index) => <div className="product-addon-row" key={addon.id || `new-${index}`}><label>Nama<input value={addon.name} onChange={(event) => updateAddon(index, { name: event.target.value })} placeholder="Contoh: Extra keju" required /></label><label>Harga<input type="number" min="0" value={addon.price} onChange={(event) => updateAddon(index, { price: Number(event.target.value) })} required /></label><label className="addon-active"><input type="checkbox" checked={addon.active} onChange={(event) => updateAddon(index, { active: event.target.checked })} /> Aktif</label><button type="button" className="addon-remove" onClick={() => setAddons((current) => current.filter((_, addonIndex) => addonIndex !== index))} aria-label={`Hapus add-on ${addon.name || index + 1}`}><Trash2 size={15} /></button></div>)}</div>}</section><div className="manager-checks"><label><input type="checkbox" name="spicy" defaultChecked={product?.spicy} /> Menu pedas</label><label><input type="checkbox" name="active" defaultChecked={product?.active ?? true} /> Aktif</label></div>{error && <p className="manager-form-error">{error}</p>}</div><footer><button type="button" onClick={close}>Batal</button><button className="primary" disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan produk'}</button></footer></form></div>
}

function PromotionEditor({ promotion, close, saved }: { promotion: Promotion | null; close: () => void; saved: () => void }) {
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  const submit = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); setLoading(true); setError(''); const form = new FormData(event.currentTarget); try { await managerApi.savePromotion({ id: promotion?.id, title: String(form.get('title')), description: String(form.get('description')), code: String(form.get('code')), discountType: String(form.get('discountType')) as 'percentage'|'fixed', discountValue: Number(form.get('discountValue')), minOrder: Number(form.get('minOrder')) || 0, startDate: String(form.get('startDate')) || undefined, endDate: String(form.get('endDate')) || undefined, active: form.get('active') === 'on' }); saved() } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Promosi gagal disimpan.') } finally { setLoading(false) } }
  return <div className="manager-modal-bg"><form className="manager-modal" onSubmit={submit}><header><div><small>PROMOSI</small><h2>{promotion ? 'Edit promosi' : 'Tambah promosi'}</h2></div><button type="button" onClick={close}><X /></button></header><div className="manager-form"><label>Judul promosi<input name="title" defaultValue={promotion?.title} required /></label><label>Deskripsi<textarea name="description" defaultValue={promotion?.description} rows={3} required /></label><div className="manager-form-row"><label>Kode promo<input name="code" defaultValue={promotion?.code} placeholder="HEMAT25" required /></label><label>Tipe diskon<select name="discountType" defaultValue={promotion?.discountType || 'percentage'}><option value="percentage">Persentase (%)</option><option value="fixed">Nominal (Rp)</option></select></label></div><div className="manager-form-row"><label>Nilai diskon<input type="number" name="discountValue" defaultValue={promotion?.discountValue} min="1" required /></label><label>Minimum belanja<input type="number" name="minOrder" defaultValue={promotion?.minOrder || 0} min="0" /></label></div><div className="manager-form-row"><label>Mulai<input type="date" name="startDate" defaultValue={promotion?.startDate} /></label><label>Berakhir<input type="date" name="endDate" defaultValue={promotion?.endDate} /></label></div><div className="manager-checks"><label><input type="checkbox" name="active" defaultChecked={promotion?.active ?? true} /> Promosi aktif</label></div>{error && <p className="manager-form-error">{error}</p>}</div><footer><button type="button" onClick={close}>Batal</button><button className="primary" disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan promosi'}</button></footer></form></div>
}

export default ManagerApp
