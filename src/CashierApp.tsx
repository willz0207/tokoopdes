import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChefHat, Clock3, RefreshCw, Search, ShoppingBag, Store, Truck, X } from 'lucide-react'
import { cashierApi } from './api'
import { formatRupiah } from './data'
import { useFranchiseSettings } from './franchise'
import type { DashboardStats, Order, OrderStatus, User } from './types'
import ProfileMenu from './ProfileMenu'
import './cashier.css'

const statuses: Array<{ value: OrderStatus; label: string }> = [
  { value: 'new', label: 'Pesanan baru' },
  { value: 'preparing', label: 'Sedang dimasak' },
  { value: 'ready', label: 'Siap diambil' },
  { value: 'delivering', label: 'Sedang diantar' },
  { value: 'completed', label: 'Selesai' },
  { value: 'cancelled', label: 'Dibatalkan' },
]

function CashierApp() {
  const { settings } = useFranchiseSettings()
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(localStorage.getItem('franchise-user') || 'null') as User | null } catch { return null }
  })
  const [stats, setStats] = useState<DashboardStats>({ totalOrders: 0, revenue: 0, activeOrders: 0, activeProducts: 0 })
  const [orders, setOrders] = useState<Order[]>([])
  const [filter, setFilter] = useState<'active' | 'all' | OrderStatus>('active')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  const logout = useCallback(() => {
    localStorage.removeItem('franchise-user-token')
    localStorage.removeItem('franchise-user')
    window.location.href = '/login'
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextStats, nextOrders] = await Promise.all([cashierApi.stats(), cashierApi.orders()])
      setStats(nextStats)
      setOrders(nextOrders)
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Data gagal dimuat.'
      setError(message)
      if (message.toLowerCase().includes('sesi') || message.toLowerCase().includes('login') || message.toLowerCase().includes('akses')) logout()
    } finally {
      setLoading(false)
    }
  }, [logout])

  useEffect(() => {
    if (!user || !['cashier', 'manager', 'admin'].includes(user.role) || !localStorage.getItem('franchise-user-token')) {
      window.location.replace('/login')
      return
    }
    void loadData()
  }, [loadData, user])

  const filteredOrders = useMemo(() => {
    const normalized = query.toLowerCase().trim()
    return orders.filter((order) => {
      const matchesQuery = !normalized || `${order.id} ${order.customerName} ${order.phone}`.toLowerCase().includes(normalized)
      const matchesFilter = filter === 'all' || (filter === 'active'
        ? ['new', 'preparing', 'ready', 'delivering'].includes(order.status)
        : order.status === filter)
      return matchesQuery && matchesFilter
    })
  }, [filter, orders, query])

  const changeStatus = async (order: Order, status: OrderStatus) => {
    try {
      const updated = await cashierApi.updateOrderStatus(order.id, status)
      setOrders((current) => current.map((item) => item.id === order.id ? updated : item))
      setSelectedOrder((current) => current?.id === order.id ? updated : current)
      setStats(await cashierApi.stats())
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Status gagal diperbarui.')
    }
  }

  return (
    <div className="cashier-shell">
      <header className="cashier-header">
        <a className="cashier-brand" href="/cashier"><span>{settings.shortName}</span><div><b>Cashier Station</b><small>{settings.businessName}</small></div></a>
        <div className="cashier-user">{user && ['manager', 'admin'].includes(user.role) && <a className="manager-return" href="/manager">Dashboard {user.role}</a>}{user && <ProfileMenu user={user} onLogout={logout} onUserUpdate={setUser} />}</div>
      </header>

      <main className="cashier-main">
        <section className="cashier-welcome"><div><span>LIVE ORDER</span><h1>Halo, {user?.name?.split(' ')[0] || 'Cashier'}!</h1><p>Kelola pesanan yang masuk dan pastikan pelanggan tidak menunggu lama.</p></div><button type="button" onClick={() => void loadData()} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} /> Perbarui</button></section>

        {error && <div className="cashier-alert"><span>{error}</span><button onClick={() => setError('')}><X size={16} /></button></div>}

        <section className="cashier-stats">
          <CashierStat icon={<ShoppingBag />} label="Total pesanan" value={String(stats.totalOrders)} tone="red" />
          <CashierStat icon={<Clock3 />} label="Perlu diproses" value={String(stats.activeOrders)} tone="yellow" />
          <CashierStat icon={<CheckCircle2 />} label="Pesanan selesai" value={String(orders.filter((order) => order.status === 'completed').length)} tone="green" />
          <CashierStat icon={<Store />} label="Total penjualan" value={formatRupiah(stats.revenue)} tone="blue" />
        </section>

        <section className="cashier-orders-panel">
          <div className="cashier-tools">
            <div className="cashier-filters">
              {([
                ['active', 'Aktif'], ['new', 'Baru'], ['preparing', 'Dimasak'], ['ready', 'Siap'], ['all', 'Semua'],
              ] as Array<[typeof filter, string]>).map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}{value === 'new' && orders.filter((order) => order.status === 'new').length > 0 && <b>{orders.filter((order) => order.status === 'new').length}</b>}</button>)}
            </div>
            <label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari ID atau pelanggan..." /></label>
          </div>

          {loading ? <div className="cashier-empty"><RefreshCw className="spin" /> Memuat pesanan...</div> : filteredOrders.length === 0 ? <div className="cashier-empty"><ChefHat size={40} /><h3>Tidak ada pesanan</h3><p>Pesanan yang sesuai filter akan muncul di sini.</p></div> : (
            <div className="cashier-order-grid">{filteredOrders.map((order) => <OrderCard key={order.id} order={order} onChange={changeStatus} onOpen={setSelectedOrder} />)}</div>
          )}
        </section>
      </main>

      {selectedOrder && <CashierOrderDetail order={selectedOrder} close={() => setSelectedOrder(null)} onChange={changeStatus} />}
    </div>
  )
}

function CashierStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return <article className="cashier-stat"><span className={tone}>{icon}</span><div><small>{label}</small><b>{value}</b></div></article>
}

function OrderCard({ order, onChange, onOpen }: { order: Order; onChange: (order: Order, status: OrderStatus) => void; onOpen: (order: Order) => void }) {
  const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = { new: 'preparing', preparing: 'ready', ready: order.deliveryMethod === 'delivery' ? 'delivering' : 'completed', delivering: 'completed' }
  const nextLabel: Partial<Record<OrderStatus, string>> = { new: 'Mulai masak', preparing: 'Tandai siap', ready: order.deliveryMethod === 'delivery' ? 'Mulai antar' : 'Selesaikan', delivering: 'Selesaikan' }
  return <article className={`cashier-order-card ${order.status}`}><header><div><small>{new Date(`${order.createdAt}Z`).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</small><b>{order.id}</b></div><span>{statuses.find((item) => item.value === order.status)?.label}</span></header><div className="cashier-order-customer"><div>{order.customerName.charAt(0)}</div><p><b>{order.customerName}</b><small>{order.deliveryMethod === 'delivery' ? '🛵 Diantar' : '🏪 Ambil sendiri'} · {order.phone}</small></p></div><div className="cashier-order-items">{order.items.slice(0, 3).map((item) => <div key={`${item.productId}-${item.productName}-${item.addons.map((addon) => addon.id).join('-')}`}><span>{item.quantity}×</span><b>{item.productName}{item.addons.length > 0 && ` + ${item.addons.map((addon) => addon.name).join(', ')}`}</b></div>)}{order.items.length > 3 && <small>+{order.items.length - 3} item lainnya</small>}</div><footer><button type="button" onClick={() => onOpen(order)}>Detail</button><strong>{formatRupiah(order.total)}</strong>{nextStatus[order.status] && <button className="cashier-next" type="button" onClick={() => void onChange(order, nextStatus[order.status]!)}>{nextLabel[order.status]}</button>}</footer></article>
}

function CashierOrderDetail({ order, close, onChange }: { order: Order; close: () => void; onChange: (order: Order, status: OrderStatus) => void }) {
  return <div className="cashier-overlay" onMouseDown={(event) => event.target === event.currentTarget && close()}><aside className="cashier-detail"><header><div><small>DETAIL PESANAN</small><h2>{order.id}</h2></div><button onClick={close}><X /></button></header><div className="cashier-detail-body"><label>Status<select value={order.status} className={order.status} onChange={(event) => void onChange(order, event.target.value as OrderStatus)}>{statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label><section><h3>Item pesanan</h3>{order.items.map((item) => <div className="cashier-detail-item" key={`${item.productId}-${item.productName}-${item.addons.map((addon) => addon.id).join('-')}`}><span>{item.quantity}×</span><div><b>{item.productName}</b><small>{item.addons.length > 0 && `${item.addons.map((addon) => addon.name).join(', ')} · `}{formatRupiah(item.unitPrice)} / item</small></div><strong>{formatRupiah(item.unitPrice * item.quantity)}</strong></div>)}</section><section><h3>Pelanggan</h3><dl><div><dt>Nama</dt><dd>{order.customerName}</dd></div><div><dt>WhatsApp</dt><dd>{order.phone}</dd></div>{order.address && <div><dt>Alamat</dt><dd>{order.address}</dd></div>}{order.note && <div><dt>Catatan</dt><dd>{order.note}</dd></div>}</dl></section></div><footer><span>Total pembayaran</span><b>{formatRupiah(order.total)}</b></footer></aside></div>
}

export default CashierApp
