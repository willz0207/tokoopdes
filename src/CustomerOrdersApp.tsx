import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, ChefHat, Clock3, MapPin, PackageCheck, RefreshCw, ShoppingBag, Store, Truck } from 'lucide-react'
import { authApi } from './api'
import { formatRupiah } from './data'
import { useFranchiseSettings } from './franchise'
import { openExternalUrl } from './mobile'
import type { Order, OrderStatus, User } from './types'
import ProfileMenu from './ProfileMenu'
import './customer-orders.css'

const statusCopy: Record<OrderStatus, { label: string; message: string }> = {
  new: { label: 'Pesanan masuk', message: 'Pesananmu sudah diterima dan menunggu diproses.' },
  preparing: { label: 'Sedang dimasak', message: 'Tim dapur sedang menyiapkan pesananmu.' },
  ready: { label: 'Pesanan siap', message: 'Pesananmu sudah selesai dimasak.' },
  delivering: { label: 'Sedang diantar', message: 'Kurir sedang menuju ke alamatmu.' },
  completed: { label: 'Pesanan selesai', message: 'Pesanan telah diterima. Selamat menikmati!' },
  cancelled: { label: 'Dibatalkan', message: 'Pesanan ini telah dibatalkan.' },
}

function CustomerOrdersApp() {
  const { settings } = useFranchiseSettings()
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(localStorage.getItem('franchise-user') || 'null') as User | null } catch { return null }
  })
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [filter, setFilter] = useState<'active' | 'history'>('active')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const logout = useCallback(() => {
    localStorage.removeItem('franchise-user-token')
    localStorage.removeItem('franchise-user')
    window.location.href = '/login'
  }, [])

  const loadOrders = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    setError('')
    try {
      const result = await authApi.customerOrders()
      setOrders(result)
      setSelectedId((current) => current && result.some((order) => order.id === current) ? current : result[0]?.id || '')
      setLastUpdated(new Date())
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Pesanan gagal dimuat.'
      setError(message)
      if (message.toLowerCase().includes('sesi') || message.toLowerCase().includes('login') || message.toLowerCase().includes('akses')) logout()
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [logout])

  useEffect(() => {
    if (!user || user.role !== 'customer' || !localStorage.getItem('franchise-user-token')) {
      window.location.replace('/login')
      return
    }
    void loadOrders()
    const interval = window.setInterval(() => void loadOrders(true), 15000)
    return () => window.clearInterval(interval)
  }, [loadOrders, user])

  const visibleOrders = useMemo(() => orders.filter((order) => filter === 'active'
    ? !['completed', 'cancelled'].includes(order.status)
    : ['completed', 'cancelled'].includes(order.status)), [filter, orders])
  const selectedOrder = visibleOrders.find((order) => order.id === selectedId) || visibleOrders[0]

  return (
    <div className="tracking-shell">
      <header className="tracking-header">
        <a href="/" className="tracking-brand"><span>{settings.shortName}</span><div><b>Pesanan Saya</b><small>{settings.businessName}</small></div></a>
        {user && <ProfileMenu user={user} onLogout={logout} onUserUpdate={setUser} />}
      </header>

      <main className="tracking-main">
        <a className="tracking-back" href="/"><ArrowLeft size={16} /> Kembali ke toko</a>
        <section className="tracking-title">
          <div><span>ORDER TRACKING</span><h1>Lacak pesananmu</h1><p>Status akan diperbarui otomatis setiap 15 detik.</p></div>
          <button type="button" onClick={() => void loadOrders()} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} /> Perbarui status</button>
        </section>

        {error && <div className="tracking-error">{error}</div>}

        <section className="tracking-layout">
          <aside className="tracking-list-panel">
            <div className="tracking-tabs"><button className={filter === 'active' ? 'active' : ''} onClick={() => setFilter('active')}>Aktif <b>{orders.filter((order) => !['completed', 'cancelled'].includes(order.status)).length}</b></button><button className={filter === 'history' ? 'active' : ''} onClick={() => setFilter('history')}>Riwayat</button></div>
            <div className="tracking-list">
              {loading ? <div className="tracking-list-empty"><RefreshCw className="spin" /> Memuat pesanan...</div> : visibleOrders.length === 0 ? <div className="tracking-list-empty"><ShoppingBag size={31} /><b>{filter === 'active' ? 'Belum ada pesanan aktif' : 'Belum ada riwayat'}</b><p>{filter === 'active' ? 'Pesan menu favoritmu sekarang.' : 'Pesanan selesai akan muncul di sini.'}</p>{filter === 'active' && <a href="/#menu">Lihat menu</a>}</div> : visibleOrders.map((order) => <button key={order.id} className={selectedOrder?.id === order.id ? 'tracking-order-row selected' : 'tracking-order-row'} onClick={() => setSelectedId(order.id)}><div><span className={`tracking-status-dot ${order.status}`} /><p><b>{order.id}</b><small>{new Date(`${order.createdAt}Z`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} · {order.items.reduce((sum, item) => sum + item.quantity, 0)} item</small></p></div><strong>{statusCopy[order.status].label}</strong><small>{formatRupiah(order.total)}</small></button>)}
            </div>
          </aside>

          <section className="tracking-detail-panel">
            {!selectedOrder ? <div className="tracking-detail-empty"><PackageCheck size={48} /><h2>Pilih pesanan</h2><p>Detail pelacakan pesanan akan muncul di sini.</p></div> : <OrderTrackingDetail order={selectedOrder} lastUpdated={lastUpdated} />}
          </section>
        </section>
      </main>
    </div>
  )
}

function OrderTrackingDetail({ order, lastUpdated }: { order: Order; lastUpdated: Date | null }) {
  const steps = order.deliveryMethod === 'delivery'
    ? [
      { status: 'new', label: 'Pesanan masuk', icon: <ShoppingBag /> },
      { status: 'preparing', label: 'Dimasak', icon: <ChefHat /> },
      { status: 'ready', label: 'Siap', icon: <PackageCheck /> },
      { status: 'delivering', label: 'Diantar', icon: <Truck /> },
      { status: 'completed', label: 'Selesai', icon: <Check /> },
    ]
    : [
      { status: 'new', label: 'Pesanan masuk', icon: <ShoppingBag /> },
      { status: 'preparing', label: 'Dimasak', icon: <ChefHat /> },
      { status: 'ready', label: 'Siap diambil', icon: <PackageCheck /> },
      { status: 'completed', label: 'Selesai', icon: <Check /> },
    ]
  const statusIndex = steps.findIndex((step) => step.status === order.status)

  return <div className="tracking-detail">
    <header><div><small>NOMOR PESANAN</small><h2>{order.id}</h2></div><span className={order.status}>{statusCopy[order.status].label}</span></header>
    <div className={`tracking-payment ${order.paymentStatus}`}><div><small>PEMBAYARAN · {order.outletName}</small><b>{order.paymentMethod === 'cash' ? 'Tunai saat pesanan diterima' : order.paymentStatus === 'paid' ? 'Pembayaran online berhasil' : order.paymentStatus === 'pending' ? 'Menunggu pembayaran online' : 'Pembayaran tidak berhasil'}</b></div>{order.paymentStatus === 'pending' && order.paymentRedirectUrl && <button type="button" onClick={() => void openExternalUrl(order.paymentRedirectUrl!)}>Bayar sekarang</button>}</div>
    {order.status === 'cancelled' ? <div className="tracking-cancelled"><span>×</span><div><b>Pesanan dibatalkan</b><p>{statusCopy.cancelled.message}</p></div></div> : <>
      <div className={`tracking-current ${order.status}`}><span>{order.status === 'new' ? <Clock3 /> : order.status === 'preparing' ? <ChefHat /> : order.status === 'ready' ? <PackageCheck /> : order.status === 'delivering' ? <Truck /> : <Check />}</span><div><small>STATUS SEKARANG</small><h3>{statusCopy[order.status].label}</h3><p>{statusCopy[order.status].message}</p></div></div>
      <div className="tracking-timeline">{steps.map((step, index) => { const complete = statusIndex >= index; const current = statusIndex === index; return <div className={complete ? current ? 'timeline-step current complete' : 'timeline-step complete' : 'timeline-step'} key={step.status}><div className="timeline-marker"><i>{complete && !current ? <Check /> : step.icon}</i>{index < steps.length - 1 && <span className={statusIndex > index ? 'complete' : ''} />}</div><b>{step.label}</b></div> })}</div>
    </>}
    <div className="tracking-meta"><div><span>{order.deliveryMethod === 'delivery' ? <Truck /> : <Store />}</span><p><small>METODE</small><b>{order.deliveryMethod === 'delivery' ? 'Diantar ke alamat' : 'Ambil di outlet'}</b></p></div>{order.address && <div><span><MapPin /></span><p><small>ALAMAT</small><b>{order.address}</b></p></div>}</div>
    <section className="tracking-items"><h3>Rincian pesanan</h3>{order.items.map((item) => <div key={`${item.productId}-${item.productName}-${item.addons.map((addon) => addon.id).join('-')}`}><span>{item.quantity}×</span><p><b>{item.productName}</b><small>{item.addons.length > 0 && `${item.addons.map((addon) => addon.name).join(', ')} · `}{formatRupiah(item.unitPrice)} / item</small></p><strong>{formatRupiah(item.unitPrice * item.quantity)}</strong></div>)}</section>
    <footer><div><span>Total pembayaran</span><b>{formatRupiah(order.total)}</b></div><small>Terakhir diperbarui {lastUpdated?.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) || '-'}</small></footer>
  </div>
}

export default CustomerOrdersApp
