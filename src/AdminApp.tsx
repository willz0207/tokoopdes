import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ChefHat,
  Clock3,
  Eye,
  LayoutDashboard,
  LogOut,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Store,
  TrendingUp,
  X,
} from 'lucide-react'
import { adminApi, storefrontApi } from './api'
import { defaultCategories, formatRupiah } from './data'
import { useFranchiseSettings } from './franchise'
import { readProductImageFile } from './productImage'
import type { DashboardStats, MenuCategory, Order, OrderStatus, Product } from './types'
import './admin.css'

const statusOptions: Array<{ value: OrderStatus; label: string }> = [
  { value: 'new', label: 'Pesanan baru' },
  { value: 'preparing', label: 'Sedang dimasak' },
  { value: 'ready', label: 'Siap diambil' },
  { value: 'delivering', label: 'Sedang diantar' },
  { value: 'completed', label: 'Selesai' },
  { value: 'cancelled', label: 'Dibatalkan' },
]

const statusLabel = (status: OrderStatus) => statusOptions.find((item) => item.value === status)?.label || status

function AdminApp() {
  const [authenticated, setAuthenticated] = useState(Boolean(localStorage.getItem('franchise-admin-token')))

  if (!authenticated) {
    return <AdminLogin onSuccess={() => setAuthenticated(true)} />
  }

  return <AdminDashboard onLogout={() => {
    localStorage.removeItem('franchise-admin-token')
    setAuthenticated(false)
  }} />
}

function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const { settings } = useFranchiseSettings()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await adminApi.login(password)
      localStorage.setItem('franchise-admin-token', result.token)
      onSuccess()
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Login gagal.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="admin-login-page">
      <a className="admin-back-store" href="/"><ArrowLeft size={17} /> Kembali ke toko</a>
      <section className="admin-login-card">
        <div className="admin-login-brand"><span>{settings.shortName}</span><div><b>Control Center</b><small>{settings.businessName}</small></div></div>
        <div className="admin-login-icon"><ChefHat size={31} /></div>
        <h1>Selamat datang, Admin</h1>
        <p>Masuk untuk mengelola pesanan dan menu toko.</p>
        <form onSubmit={submit}>
          <label>Password admin<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Masukkan password" required autoFocus /></label>
          {error && <div className="admin-form-error">{error}</div>}
          <button type="submit" disabled={loading}>{loading ? 'Memeriksa...' : 'Masuk ke dashboard'}</button>
        </form>
        <small className="admin-login-hint">Untuk penggunaan lokal pertama, password bawaan adalah <b>admin123</b>.</small>
      </section>
    </main>
  )
}

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const { settings } = useFranchiseSettings()
  const [tab, setTab] = useState<'orders' | 'products'>('orders')
  const [stats, setStats] = useState<DashboardStats>({ totalOrders: 0, revenue: 0, activeOrders: 0, activeProducts: 0 })
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [editedProduct, setEditedProduct] = useState<Product | null | 'new'>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextStats, nextOrders, nextProducts] = await Promise.all([
        adminApi.stats(), adminApi.orders(), adminApi.products(),
      ])
      setStats(nextStats)
      setOrders(nextOrders)
      setProducts(nextProducts)
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Data admin gagal dimuat.'
      setError(message)
      if (message.toLowerCase().includes('sesi') || message.toLowerCase().includes('login')) onLogout()
    } finally {
      setLoading(false)
    }
  }, [onLogout])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredOrders = useMemo(() => {
    const value = query.toLowerCase().trim()
    return orders.filter((order) => !value || `${order.id} ${order.customerName} ${order.phone}`.toLowerCase().includes(value))
  }, [orders, query])

  const filteredProducts = useMemo(() => {
    const value = query.toLowerCase().trim()
    return products.filter((product) => !value || `${product.name} ${product.category}`.toLowerCase().includes(value))
  }, [products, query])

  const changeStatus = async (id: string, status: OrderStatus) => {
    try {
      const updated = await adminApi.updateOrderStatus(id, status)
      setOrders((current) => current.map((order) => order.id === id ? updated : order))
      setSelectedOrder((current) => current?.id === id ? updated : current)
      const nextStats = await adminApi.stats()
      setStats(nextStats)
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Status gagal diperbarui.')
    }
  }

  const toggleProduct = async (product: Product) => {
    try {
      const updated = await adminApi.setProductActive(product.id, !product.active)
      setProducts((current) => current.map((item) => item.id === product.id ? updated : item))
      setStats(await adminApi.stats())
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Produk gagal diperbarui.')
    }
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a className="admin-logo" href="/"><span>{settings.shortName}</span><div><b>Control Center</b><small>{settings.businessName}</small></div></a>
        <nav>
          <button className={tab === 'orders' ? 'active' : ''} onClick={() => { setTab('orders'); setQuery('') }}><ShoppingBag size={19} /> Pesanan</button>
          <button className={tab === 'products' ? 'active' : ''} onClick={() => { setTab('products'); setQuery('') }}><Package size={19} /> Produk</button>
        </nav>
        <div className="admin-sidebar-bottom">
          <a href="/"><Store size={18} /> Lihat toko</a>
          <button onClick={onLogout}><LogOut size={18} /> Keluar</button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div><span>Dashboard toko</span><h1>{tab === 'orders' ? 'Kelola pesanan' : 'Kelola produk'}</h1></div>
          <div className="admin-top-actions">
            <button className="admin-refresh" onClick={() => void loadData()} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} /> Muat ulang</button>
            <div className="admin-avatar">A</div>
          </div>
        </header>

        <div className="admin-content">
          {error && <div className="admin-alert"><span>{error}</span><button onClick={() => setError('')}><X size={16} /></button></div>}
          <section className="admin-stats">
            <StatCard icon={<ShoppingBag />} label="Total pesanan" value={String(stats.totalOrders)} tone="red" />
            <StatCard icon={<Clock3 />} label="Perlu diproses" value={String(stats.activeOrders)} tone="yellow" />
            <StatCard icon={<TrendingUp />} label="Total penjualan" value={formatRupiah(stats.revenue)} tone="green" />
            <StatCard icon={<Package />} label="Produk aktif" value={String(stats.activeProducts)} tone="blue" />
          </section>

          <section className="admin-panel">
            <div className="admin-panel-head">
              <div><h2>{tab === 'orders' ? 'Pesanan terbaru' : 'Daftar produk'}</h2><p>{tab === 'orders' ? 'Pantau dan perbarui pesanan pelanggan.' : 'Atur menu yang tampil di halaman toko.'}</p></div>
              <div className="admin-panel-tools">
                <label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === 'orders' ? 'Cari pesanan...' : 'Cari produk...'} /></label>
                {tab === 'products' && <button className="admin-add-button" onClick={() => setEditedProduct('new')}><Plus size={17} /> Tambah produk</button>}
              </div>
            </div>

            {loading ? <div className="admin-loading"><RefreshCw className="spin" /> Memuat data...</div> : tab === 'orders' ? (
              <OrdersTable orders={filteredOrders} onStatusChange={changeStatus} onView={setSelectedOrder} />
            ) : (
              <ProductsTable products={filteredProducts} onEdit={setEditedProduct} onToggle={toggleProduct} />
            )}
          </section>
        </div>
      </main>

      {selectedOrder && <OrderDrawer order={selectedOrder} close={() => setSelectedOrder(null)} onStatusChange={changeStatus} />}
      {editedProduct && <ProductModal product={editedProduct === 'new' ? null : editedProduct} close={() => setEditedProduct(null)} saved={() => { setEditedProduct(null); void loadData() }} />}
    </div>
  )
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return <article className="admin-stat"><span className={tone}>{icon}</span><div><small>{label}</small><b>{value}</b></div></article>
}

function OrdersTable({ orders, onStatusChange, onView }: { orders: Order[]; onStatusChange: (id: string, status: OrderStatus) => void; onView: (order: Order) => void }) {
  if (!orders.length) return <div className="admin-empty"><ShoppingBag size={36} /><h3>Belum ada pesanan</h3><p>Pesanan baru akan muncul otomatis di sini.</p></div>
  return <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>ID pesanan</th><th>Pelanggan</th><th>Waktu</th><th>Total</th><th>Status</th><th /></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><b>{order.id}</b><small>{order.items.length} jenis produk</small></td><td><b>{order.customerName}</b><small>{order.phone}</small></td><td><span>{new Date(`${order.createdAt}Z`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</span><small>{new Date(`${order.createdAt}Z`).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</small></td><td><strong>{formatRupiah(order.total)}</strong></td><td><select className={`status-select ${order.status}`} value={order.status} onChange={(event) => void onStatusChange(order.id, event.target.value as OrderStatus)}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></td><td><button className="admin-icon-button" onClick={() => onView(order)} aria-label={`Lihat ${order.id}`}><Eye size={17} /></button></td></tr>)}</tbody></table></div>
}

function ProductsTable({ products, onEdit, onToggle }: { products: Product[]; onEdit: (product: Product) => void; onToggle: (product: Product) => void }) {
  return <div className="admin-table-wrap"><table className="admin-table product-admin-table"><thead><tr><th>Produk</th><th>Kategori</th><th>Harga</th><th>Tampil di toko</th><th /></tr></thead><tbody>{products.map((product) => <tr className={product.active ? '' : 'inactive'} key={product.id}><td><div className={`admin-product-art ${product.tone}${product.imageUrl ? ' has-photo' : ''}`}>{product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : product.emoji}</div><div><b>{product.name}</b><small>{product.description}</small></div></td><td><span className="category-pill">{product.category}</span></td><td><strong>{formatRupiah(product.price)}</strong></td><td><button className={product.active ? 'admin-toggle on' : 'admin-toggle'} onClick={() => void onToggle(product)} aria-label={`Ubah status ${product.name}`}><i /></button></td><td><button className="admin-icon-button" onClick={() => onEdit(product)} aria-label={`Edit ${product.name}`}><Pencil size={16} /></button></td></tr>)}</tbody></table></div>
}

function OrderDrawer({ order, close, onStatusChange }: { order: Order; close: () => void; onStatusChange: (id: string, status: OrderStatus) => void }) {
  return <div className="admin-overlay" onMouseDown={(event) => event.target === event.currentTarget && close()}><aside className="admin-order-drawer"><header><div><small>DETAIL PESANAN</small><h2>{order.id}</h2></div><button onClick={close}><X /></button></header><div className="admin-order-body"><div className="order-detail-status"><span>Status pesanan</span><select className={`status-select ${order.status}`} value={order.status} onChange={(event) => void onStatusChange(order.id, event.target.value as OrderStatus)}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div><section><h3>Pesanan</h3>{order.items.map((item) => <div className="admin-order-item" key={`${item.productId}-${item.productName}`}><span>{item.quantity}×</span><div><b>{item.productName}</b><small>{formatRupiah(item.unitPrice)} / item</small></div><strong>{formatRupiah(item.unitPrice * item.quantity)}</strong></div>)}</section><section><h3>Data pelanggan</h3><dl><div><dt>Nama</dt><dd>{order.customerName}</dd></div><div><dt>WhatsApp</dt><dd>{order.phone}</dd></div><div><dt>Metode</dt><dd>{order.deliveryMethod === 'delivery' ? 'Diantar' : 'Ambil sendiri'}</dd></div>{order.address && <div><dt>Alamat</dt><dd>{order.address}</dd></div>}{order.note && <div><dt>Catatan</dt><dd>{order.note}</dd></div>}</dl></section></div><footer><div><span>Subtotal</span><b>{formatRupiah(order.subtotal)}</b></div><div><span>Ongkir</span><b>{order.deliveryFee ? formatRupiah(order.deliveryFee) : 'Gratis'}</b></div><div className="admin-order-total"><span>Total</span><strong>{formatRupiah(order.total)}</strong></div></footer></aside></div>
}

function ProductModal({ product, close, saved }: { product: Product | null; close: () => void; saved: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [imageUrl, setImageUrl] = useState(product?.imageUrl || '')
  const [categories, setCategories] = useState<MenuCategory[]>(defaultCategories)

  useEffect(() => {
    storefrontApi.categories().then(setCategories).catch(() => undefined)
  }, [])

  const categoryOptions = product?.category && !categories.some((category) => category.label === product.category)
    ? [{ id: -1, label: product.category, emoji: '🍽️', sortOrder: 9999, active: false }, ...categories]
    : categories

  const chooseImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (!file) return
    setError('')
    try {
      setImageUrl(await readProductImageFile(file))
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : 'Foto gagal dipilih.')
      event.currentTarget.value = ''
    }
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      await adminApi.saveProduct({
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
        addons: product?.addons || [],
      })
      saved()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Produk gagal disimpan.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-modal-overlay">
      <form className="admin-product-modal" onSubmit={submit}>
        <header>
          <div><small>MENU TOKO</small><h2>{product ? 'Edit produk' : 'Tambah produk'}</h2></div>
          <button type="button" onClick={close}><X /></button>
        </header>
        <div className="admin-product-form">
          <div className="admin-image-uploader">
            <div className={`admin-image-preview ${product?.tone || 'gold'}${imageUrl ? ' has-photo' : ''}`}>
              {imageUrl ? <img src={imageUrl} alt="Preview foto produk" /> : <span>{product?.emoji || '🍗'}</span>}
            </div>
            <div>
              <label>Foto produk<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => void chooseImage(event)} /></label>
              <small>Pilih foto makanan dari komputer. Maksimal 2 MB.</small>
              {imageUrl && <button className="admin-link-button" type="button" onClick={() => setImageUrl('')}>Hapus foto</button>}
            </div>
          </div>
          <label>Nama produk<input name="name" defaultValue={product?.name} placeholder="Contoh: Paket Andalan" required /></label>
          <label>Deskripsi<textarea name="description" defaultValue={product?.description} rows={3} placeholder="Jelaskan isi menu..." required /></label>
          <div className="form-row">
            <label>Harga<input name="price" type="number" defaultValue={product?.price} min="0" required /></label>
            <label>Harga asli <span>(opsional)</span><input name="originalPrice" type="number" defaultValue={product?.originalPrice} min="0" /></label>
          </div>
          <div className="form-row">
            <label>Kategori<select name="category" defaultValue={product?.category || categoryOptions[0]?.label || ''} required>{categoryOptions.map((category) => <option key={`${category.id}-${category.label}`} value={category.label}>{category.label}{!category.active ? ' (nonaktif)' : ''}</option>)}</select></label>
            <label>Warna fallback<select name="tone" defaultValue={product?.tone || 'gold'}>{['gold', 'cream', 'red', 'orange', 'yellow', 'pink', 'peach', 'blue'].map((tone) => <option key={tone}>{tone}</option>)}</select></label>
          </div>
          <label>Label promo <span>(opsional)</span><input name="badge" defaultValue={product?.badge} placeholder="Contoh: Paling laris" /></label>
          <div className="check-row">
            <label><input type="checkbox" name="spicy" defaultChecked={product?.spicy} /> Menu pedas</label>
            <label><input type="checkbox" name="active" defaultChecked={product?.active ?? true} /> Tampilkan di toko</label>
          </div>
          {error && <div className="admin-form-error">{error}</div>}
        </div>
        <footer>
          <button type="button" onClick={close}>Batal</button>
          <button className="save-product" type="submit" disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan produk'}</button>
        </footer>
      </form>
    </div>
  )
}

export default AdminApp
