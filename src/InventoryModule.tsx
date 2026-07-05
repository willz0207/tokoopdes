import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, History, PackagePlus, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { managerApi } from './api'
import type { InventoryItem, InventorySnapshot, Product, StockMovementType } from './types'

const emptySnapshot: InventorySnapshot = {
  items: [],
  movements: [],
  summary: { activeItems: 0, lowStockItems: 0, movementsToday: 0 },
}

const movementLabels: Record<StockMovementType, string> = {
  in: 'Stok masuk',
  out: 'Stok keluar',
  adjustment_add: 'Koreksi tambah',
  adjustment_subtract: 'Koreksi kurang',
}

const formatStock = (value: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value)

export default function InventoryModule() {
  const [snapshot, setSnapshot] = useState<InventorySnapshot>(emptySnapshot)
  const [view, setView] = useState<'items' | 'movements'>('items')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [itemModal, setItemModal] = useState<InventoryItem | 'new' | null>(null)
  const [movementItem, setMovementItem] = useState<InventoryItem | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setSnapshot(await managerApi.inventory()) }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Inventory gagal dimuat.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return snapshot.items.filter((item) => !normalized || `${item.name} ${item.sku} ${item.unit}`.toLowerCase().includes(normalized))
  }, [query, snapshot.items])

  const filteredMovements = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return snapshot.movements.filter((movement) => !normalized || `${movement.itemName} ${movement.sku} ${movement.note || ''}`.toLowerCase().includes(normalized))
  }, [query, snapshot.movements])

  const removeItem = async (item: InventoryItem) => {
    if (!window.confirm(`Hapus item ${item.name}? Item yang sudah memiliki riwayat akan dinonaktifkan.`)) return
    setError('')
    try { await managerApi.deleteInventoryItem(item.id); await loadData() }
    catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : 'Item inventory gagal dihapus.') }
  }

  const saved = () => {
    setItemModal(null)
    setMovementItem(null)
    void loadData()
  }

  return <div className="inventory-module">
    <section className="inventory-summary">
      <article><span className="blue"><Boxes /></span><div><small>Item aktif</small><b>{snapshot.summary.activeItems}</b></div></article>
      <article><span className="warning"><AlertTriangle /></span><div><small>Stok menipis</small><b>{snapshot.summary.lowStockItems}</b></div></article>
      <article><span className="green"><History /></span><div><small>Mutasi hari ini</small><b>{snapshot.summary.movementsToday}</b></div></article>
    </section>

    {error && <div className="inventory-error"><span>{error}</span><button onClick={() => setError('')}><X size={15} /></button></div>}

    <div className="inventory-toolbar">
      <div className="inventory-tabs"><button className={view === 'items' ? 'active' : ''} onClick={() => setView('items')}><Boxes size={15} /> Daftar stok</button><button className={view === 'movements' ? 'active' : ''} onClick={() => setView('movements')}><History size={15} /> Riwayat mutasi</button></div>
      <div className="inventory-actions"><label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari item atau SKU..." /></label><button onClick={() => void loadData()} disabled={loading} aria-label="Perbarui inventory"><RefreshCw size={15} className={loading ? 'spin' : ''} /></button><button className="primary" onClick={() => setItemModal('new')}><PackagePlus size={15} /> Tambah item</button></div>
    </div>

    {loading ? <div className="manager-empty"><RefreshCw className="spin" /> Memuat inventory...</div> : view === 'items' ? (
      filteredItems.length ? <div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Item</th><th>Stok</th><th>Minimum</th><th>Status</th><th /></tr></thead><tbody>{filteredItems.map((item) => <tr className={!item.active ? 'inactive' : item.lowStock ? 'low-stock' : ''} key={item.id}><td><div className="inventory-item-name"><span>{item.name.charAt(0).toUpperCase()}</span><p><b>{item.name}</b><small>{item.sku} · {item.unit}</small></p></div></td><td><strong>{formatStock(item.currentStock)} <small>{item.unit}</small></strong></td><td>{formatStock(item.minimumStock)} {item.unit}</td><td><i className={!item.active ? 'inactive' : item.lowStock ? 'warning' : 'healthy'}>{!item.active ? 'Nonaktif' : item.lowStock ? 'Stok menipis' : 'Aman'}</i></td><td><div className="inventory-row-actions"><button disabled={!item.active} onClick={() => setMovementItem(item)} title="Catat pergerakan"><Plus size={15} /></button><button onClick={() => setItemModal(item)} title="Edit"><Pencil size={15} /></button><button className="danger" onClick={() => void removeItem(item)} title="Hapus"><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div> : <div className="manager-empty"><Boxes size={38} /><h3>Belum ada item inventory</h3><p>Tambahkan bahan atau barang yang ingin dilacak stoknya.</p><button className="inventory-empty-add" onClick={() => setItemModal('new')}><Plus size={15} /> Tambah item pertama</button></div>
    ) : filteredMovements.length ? <div className="inventory-table-wrap"><table className="inventory-table movement-table"><thead><tr><th>Waktu</th><th>Item</th><th>Tipe</th><th>Jumlah</th><th>Perubahan stok</th><th>Catatan</th></tr></thead><tbody>{filteredMovements.map((movement) => <tr key={movement.id}><td><span className="movement-date">{new Date(`${movement.createdAt}Z`).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></td><td><b>{movement.itemName}</b><small className="table-subtext">{movement.sku}</small></td><td><i className={`movement-type ${movement.type}`}>{movement.type === 'in' || movement.type === 'adjustment_add' ? <ArrowDownToLine /> : <ArrowUpFromLine />}{movementLabels[movement.type]}</i></td><td><strong>{formatStock(movement.quantity)} {movement.unit}</strong></td><td>{formatStock(movement.stockBefore)} → {formatStock(movement.stockAfter)}</td><td><span>{movement.note || '—'}</span><small className="table-subtext">{movement.createdByName || 'Sistem'}</small></td></tr>)}</tbody></table></div> : <div className="manager-empty"><History size={38} /><h3>Belum ada riwayat mutasi</h3><p>Pergerakan stok akan tercatat otomatis di sini.</p></div>}

    {itemModal && <InventoryItemEditor item={itemModal === 'new' ? null : itemModal} close={() => setItemModal(null)} saved={saved} />}
    {movementItem && <StockMovementEditor item={movementItem} close={() => setMovementItem(null)} saved={saved} />}
  </div>
}

function InventoryItemEditor({ item, close, saved }: { item: InventoryItem | null; close: () => void; saved: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  useEffect(() => { void managerApi.products().then(setProducts).catch(() => setProducts([])) }, [])
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setError('')
    const form = new FormData(event.currentTarget)
    const payload = { name: String(form.get('name') || ''), sku: String(form.get('sku') || ''), unit: String(form.get('unit') || ''), minimumStock: Number(form.get('minimumStock') || 0), unitCost: Number(form.get('unitCost') || 0), linkedProductId: Number(form.get('linkedProductId')) || undefined, usagePerSale: Number(form.get('usagePerSale') || 1), active: form.get('active') === 'on' }
    try {
      if (item) await managerApi.updateInventoryItem(item.id, payload)
      else await managerApi.createInventoryItem({ ...payload, initialStock: Number(form.get('initialStock') || 0) })
      saved()
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Item inventory gagal disimpan.') }
    finally { setLoading(false) }
  }
  return <div className="manager-modal-bg"><form className="manager-modal inventory-modal" onSubmit={submit}><header><div><small>INVENTORY</small><h2>{item ? 'Edit item' : 'Tambah item'}</h2></div><button type="button" onClick={close}><X /></button></header><div className="manager-form"><label>Nama item<input name="name" defaultValue={item?.name} placeholder="Contoh: Daging ayam" required autoFocus /></label><div className="manager-form-row"><label>SKU<input name="sku" defaultValue={item?.sku} placeholder="AYAM-001" required /></label><label>Satuan<input name="unit" defaultValue={item?.unit} placeholder="kg, pcs, liter" required /></label></div><div className="manager-form-row">{!item && <label>Stok awal<input name="initialStock" type="number" min="0" step="0.01" defaultValue="0" required /></label>}<label>Minimum stok<input name="minimumStock" type="number" min="0" step="0.01" defaultValue={item?.minimumStock || 0} required /></label></div><label>Harga modal per satuan (Rp)<input name="unitCost" type="number" min="0" step="1" defaultValue={item?.unitCost || 0} required /><small>Dipakai untuk menghitung nilai persediaan di laporan neraca.</small></label><div className="manager-form-row"><label>Produk terkait<select name="linkedProductId" defaultValue={item?.linkedProductId || ''}><option value="">Tidak terkait produk</option>{products.filter((product) => product.active).map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select><small>Stok berkurang otomatis saat produk terjual.</small></label><label>Pemakaian per produk terjual<input name="usagePerSale" type="number" min="0.01" step="0.01" defaultValue={item?.usagePerSale || 1} required /><small>Dalam satuan item inventory ini.</small></label></div><div className="manager-checks"><label><input name="active" type="checkbox" defaultChecked={item?.active ?? true} /> Item aktif</label></div>{error && <p className="manager-form-error">{error}</p>}</div><footer><button type="button" onClick={close}>Batal</button><button className="primary" disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan item'}</button></footer></form></div>
}

function StockMovementEditor({ item, close, saved }: { item: InventoryItem; close: () => void; saved: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setError('')
    const form = new FormData(event.currentTarget)
    try {
      await managerApi.createStockMovement({ itemId: item.id, type: String(form.get('type')) as StockMovementType, quantity: Number(form.get('quantity')), note: String(form.get('note') || '') || undefined })
      saved()
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Pergerakan stok gagal disimpan.') }
    finally { setLoading(false) }
  }
  return <div className="manager-modal-bg"><form className="manager-modal inventory-modal" onSubmit={submit}><header><div><small>STOCK MOVEMENT</small><h2>Catat pergerakan stok</h2></div><button type="button" onClick={close}><X /></button></header><div className="manager-form"><div className="movement-item-summary"><span>{item.name.charAt(0).toUpperCase()}</span><div><b>{item.name}</b><small>{item.sku} · Stok sekarang {formatStock(item.currentStock)} {item.unit}</small></div></div><label>Tipe pergerakan<select name="type" defaultValue="in"><option value="in">Stok masuk</option><option value="out">Stok keluar</option><option value="adjustment_add">Koreksi tambah</option><option value="adjustment_subtract">Koreksi kurang</option></select></label><label>Jumlah ({item.unit})<input name="quantity" type="number" min="0.01" step="0.01" required autoFocus /></label><label>Catatan<textarea name="note" rows={3} placeholder="Contoh: Pembelian supplier / pemakaian dapur" /></label>{error && <p className="manager-form-error">{error}</p>}</div><footer><button type="button" onClick={close}>Batal</button><button className="primary" disabled={loading}>{loading ? 'Menyimpan...' : 'Catat mutasi'}</button></footer></form></div>
}
