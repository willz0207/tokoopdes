import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Download, FileBarChart, Plus, RefreshCw, Trash2, TrendingUp, X } from 'lucide-react'
import { managerApi } from './api'
import { formatRupiah } from './data'
import type { FinancialEntryType, PaymentMethod, ReportData } from './types'

const today = () => new Date().toISOString().slice(0, 10)
const firstDayOfMonth = () => `${today().slice(0, 8)}01`
const paymentLabels: Record<PaymentMethod, string> = { cash: 'Tunai', qris: 'QRIS', bank_transfer: 'Transfer bank', ewallet: 'E-wallet' }
const entryLabels: Record<FinancialEntryType, string> = { expense: 'Biaya operasional', capital_in: 'Modal masuk', capital_out: 'Penarikan modal' }
const formatDate = (value: string) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(`${value.slice(0, 10)}T00:00:00`))
const formatNumber = (value: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value)

function ReportsModule() {
  const [from, setFrom] = useState(firstDayOfMonth)
  const [to, setTo] = useState(today)
  const [view, setView] = useState<'operational' | 'financial'>('operational')
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [entryModal, setEntryModal] = useState(false)

  const load = useCallback(async (quiet = false) => {
    if (from > to) { setError('Tanggal awal tidak boleh setelah tanggal akhir.'); return }
    if (!quiet) setLoading(true)
    setError('')
    try { setData(await managerApi.reports(from, to)) }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Laporan gagal dimuat.') }
    finally { if (!quiet) setLoading(false) }
  }, [from, to])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const interval = window.setInterval(() => void load(true), 30_000)
    return () => window.clearInterval(interval)
  }, [load])

  const exportCsv = () => {
    if (!data) return
    const rows: Array<Array<string | number>> = [
      ['LAPORAN OPERASIONAL DAN KEUANGAN'],
      ['Periode', data.period.from, data.period.to],
      [],
      ['PENJUALAN HARIAN'],
      ['Tanggal', 'Transaksi', 'Produk terjual', 'Penjualan bruto', 'Diskon', 'Omzet bersih'],
      ...data.operational.dailySales.map((row) => [row.date, row.transactions, row.itemsSold, row.grossSales, row.discounts, row.revenue]),
      [],
      ['PRODUK TERLARIS'],
      ['Produk', 'Jumlah', 'Nilai penjualan'],
      ...data.operational.topProducts.map((row) => [row.productName, row.quantity, row.revenue]),
      [],
      ['METODE PEMBAYARAN'],
      ['Metode', 'Transaksi', 'Pendapatan'],
      ...data.operational.paymentMethods.map((row) => [paymentLabels[row.paymentMethod], row.transactions, row.revenue]),
      [],
      ['STATUS STOK'],
      ['SKU', 'Item', 'Stok', 'Satuan', 'Minimum', 'Harga modal', 'Nilai stok', 'Status'],
      ...data.operational.stockStatus.map((row) => [row.sku, row.name, row.currentStock, row.unit, row.minimumStock, row.unitCost, row.stockValue, row.lowStock ? 'Menipis' : 'Aman']),
      [],
      ['PELANGGAN'],
      ['Nama', 'Email', 'Jumlah pesanan', 'Total belanja', 'Pesanan terakhir'],
      ...data.operational.customers.map((row) => [row.name, row.email, row.orderCount, row.totalSpent, row.lastOrder]),
      [],
      ['LABA RUGI'],
      ['Pendapatan', data.financial.profitLoss.revenue],
      ['Biaya operasional', data.financial.profitLoss.expenses],
      ['Laba bersih', data.financial.profitLoss.netProfit],
      [],
      ['ARUS KAS'],
      ['Total masuk', data.financial.cashFlow.totalInflow],
      ['Total keluar', data.financial.cashFlow.totalOutflow],
      ['Arus kas bersih', data.financial.cashFlow.netCashFlow],
      [],
      ['TRANSAKSI KEUANGAN'],
      ['Tanggal', 'Tipe', 'Kategori', 'Metode', 'Nominal', 'Catatan'],
      ...data.financial.entries.map((row) => [row.entryDate, entryLabels[row.type], row.category, paymentLabels[row.paymentMethod], row.amount, row.note || '']),
    ]
    const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')}`
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    link.download = `report-${data.period.from}-${data.period.to}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  if (loading && !data) return <div className="report-loading"><RefreshCw className="spin" /> Menyiapkan laporan...</div>

  return <div className="report-module">
    <div className="report-toolbar">
      <div className="report-view-switch"><button className={view === 'operational' ? 'active' : ''} onClick={() => setView('operational')}>Operasional</button><button className={view === 'financial' ? 'active' : ''} onClick={() => setView('financial')}>Keuangan</button></div>
      <div className="report-period"><label>Dari<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>Sampai<input type="date" value={to} max={today()} onChange={(event) => setTo(event.target.value)} /></label></div>
      <button className="manager-refresh" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''} /> Perbarui</button>
      <button className="report-export" onClick={exportCsv} disabled={!data}><Download size={15} /> Ekspor CSV</button>
      {view === 'financial' && <button className="manager-add" onClick={() => setEntryModal(true)}><Plus size={15} /> Catat transaksi</button>}
    </div>
    {error && <div className="manager-error">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}
    {data && (view === 'operational' ? <OperationalReport data={data} /> : <FinancialReport data={data} remove={async (id) => { if (!window.confirm('Hapus transaksi keuangan ini?')) return; try { await managerApi.deleteFinancialEntry(id); await load() } catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'Transaksi gagal dihapus.') } }} />)}
    {entryModal && <FinancialEntryModal close={() => setEntryModal(false)} saved={() => { setEntryModal(false); void load() }} />}
  </div>
}

function OperationalReport({ data }: { data: ReportData }) {
  const summary = data.operational.summary
  const maxProduct = Math.max(1, ...data.operational.topProducts.map((row) => row.quantity))
  return <div className="report-content">
    <div className="report-cards">
      <ReportCard label="Omzet bersih" value={formatRupiah(summary.netRevenue)} detail={`${summary.transactions} transaksi`} tone="red" />
      <ReportCard label="Produk terjual" value={formatNumber(summary.itemsSold)} detail={`Rata-rata ${formatRupiah(summary.averageOrder)}`} tone="blue" />
      <ReportCard label="Penjualan bruto" value={formatRupiah(summary.grossSales)} detail="Sebelum diskon" tone="green" />
      <ReportCard label="Total diskon" value={formatRupiah(summary.discounts)} detail="Promo terpakai" tone="orange" />
    </div>
    <ReportSection title="Penjualan harian / real-time" subtitle={`Terakhir diperbarui ${new Date(data.generatedAt).toLocaleTimeString('id-ID')}`}>
      <DataTable headers={['Tanggal', 'Transaksi', 'Produk', 'Bruto', 'Diskon', 'Omzet']} empty="Belum ada transaksi pada periode ini.">{data.operational.dailySales.map((row) => <tr key={row.date}><td><b>{formatDate(row.date)}</b></td><td>{row.transactions}</td><td>{row.itemsSold}</td><td>{formatRupiah(row.grossSales)}</td><td className="negative">-{formatRupiah(row.discounts)}</td><td><strong>{formatRupiah(row.revenue)}</strong></td></tr>)}</DataTable>
    </ReportSection>
    <div className="report-split">
      <ReportSection title="Produk terlaris" subtitle="Peringkat berdasarkan jumlah terjual">
        {data.operational.topProducts.length ? <div className="top-product-list">{data.operational.topProducts.map((row, index) => <div key={`${row.productId}-${row.productName}`}><span>{index + 1}</span><p><b>{row.productName}</b><small>{formatRupiah(row.revenue)}</small><i><em style={{ width: `${Math.max(5, row.quantity / maxProduct * 100)}%` }} /></i></p><strong>{row.quantity}</strong></div>)}</div> : <EmptyReport />}
      </ReportSection>
      <ReportSection title="Rekap metode pembayaran" subtitle="Membantu rekonsiliasi kas masuk">
        <DataTable headers={['Metode', 'Transaksi', 'Pendapatan']} empty="Belum ada pembayaran.">{data.operational.paymentMethods.map((row) => <tr key={row.paymentMethod}><td><b>{paymentLabels[row.paymentMethod]}</b></td><td>{row.transactions}</td><td><strong>{formatRupiah(row.revenue)}</strong></td></tr>)}</DataTable>
      </ReportSection>
    </div>
    <ReportSection title="Laporan status stok" subtitle="Nilai stok dihitung dari stok tersedia × harga modal per satuan">
      <DataTable headers={['Item / SKU', 'Stok tersedia', 'Minimum', 'Harga modal', 'Nilai stok', 'Status']} empty="Belum ada item inventory.">{data.operational.stockStatus.map((row) => <tr key={row.id}><td><b>{row.name}</b><small className="table-subtext">{row.sku}</small></td><td>{formatNumber(row.currentStock)} {row.unit}</td><td>{formatNumber(row.minimumStock)} {row.unit}</td><td>{formatRupiah(row.unitCost)}</td><td><strong>{formatRupiah(row.stockValue)}</strong></td><td><span className={`report-status ${!row.active ? 'inactive' : row.lowStock ? 'warning' : 'healthy'}`}>{!row.active ? 'Nonaktif' : row.lowStock ? 'Menipis' : 'Aman'}</span></td></tr>)}</DataTable>
    </ReportSection>
    <ReportSection title="Laporan pelanggan" subtitle="Riwayat pembelian untuk evaluasi loyalty program">
      <DataTable headers={['Pelanggan', 'Pesanan', 'Total belanja', 'Terakhir belanja']} empty="Belum ada data pelanggan pada periode ini.">{data.operational.customers.map((row) => <tr key={row.customerId}><td><b>{row.name}</b><small className="table-subtext">{row.email}</small></td><td>{row.orderCount}</td><td><strong>{formatRupiah(row.totalSpent)}</strong></td><td>{formatDate(row.lastOrder)}</td></tr>)}</DataTable>
    </ReportSection>
  </div>
}

function FinancialReport({ data, remove }: { data: ReportData; remove: (id: number) => void }) {
  const { profitLoss, cashFlow, balanceSheet, equityChanges, entries, expensesByCategory } = data.financial
  return <div className="report-content">
    <div className="report-cards">
      <ReportCard label="Laba bersih" value={formatRupiah(profitLoss.netProfit)} detail={`${formatRupiah(profitLoss.revenue)} pendapatan`} tone={profitLoss.netProfit >= 0 ? 'green' : 'red'} />
      <ReportCard label="Arus kas bersih" value={formatRupiah(cashFlow.netCashFlow)} detail={`${formatRupiah(cashFlow.totalOutflow)} keluar`} tone="blue" />
      <ReportCard label="Total aset" value={formatRupiah(balanceSheet.totalAssets)} detail={`${formatRupiah(balanceSheet.inventoryValue)} persediaan`} tone="orange" />
      <ReportCard label="Perubahan modal" value={formatRupiah(equityChanges.netChange)} detail={`Modal masuk ${formatRupiah(equityChanges.capitalIn)}`} tone="purple" />
    </div>
    <div className="finance-grid">
      <FinanceStatement title="Laporan laba rugi" rows={[['Pendapatan penjualan', profitLoss.revenue], ['Biaya operasional', -profitLoss.expenses]]} total={['Laba bersih', profitLoss.netProfit]} />
      <FinanceStatement title="Laporan arus kas" rows={[['Penjualan masuk', cashFlow.salesInflow], ['Modal masuk', cashFlow.capitalIn], ['Biaya keluar', -cashFlow.expensesOutflow], ['Modal keluar', -cashFlow.capitalOut]]} total={['Arus kas bersih', cashFlow.netCashFlow]} />
      <FinanceStatement title="Laporan neraca" rows={[['Kas / setara kas', balanceSheet.cashBalance], ['Nilai persediaan', balanceSheet.inventoryValue], ['Liabilitas tercatat', -balanceSheet.liabilities]]} total={['Ekuitas', balanceSheet.equity]} />
      <FinanceStatement title="Perubahan modal" rows={[['Setoran modal', equityChanges.capitalIn], ['Laba ditahan', equityChanges.retainedEarnings], ['Penarikan modal', -equityChanges.capitalOut]]} total={['Perubahan bersih', equityChanges.netChange]} />
    </div>
    <div className="report-split">
      <ReportSection title="Biaya per kategori" subtitle="Rincian biaya operasional periode terpilih">
        {expensesByCategory.length ? <div className="expense-list">{expensesByCategory.map((row) => <div key={row.category}><span>{row.category}</span><b>{formatRupiah(row.amount)}</b></div>)}</div> : <EmptyReport text="Belum ada biaya operasional." />}
      </ReportSection>
      <ReportSection title="Catatan akuntansi" subtitle="Angka laporan bersifat manajerial dasar">
        <div className="accounting-note"><FileBarChart /><p>Penjualan diambil otomatis dari pesanan non-batal. Biaya dan perubahan modal berasal dari transaksi yang dicatat manager/admin. Neraca saat ini belum mencatat utang, piutang, depresiasi, atau pajak.</p></div>
      </ReportSection>
    </div>
    <ReportSection title="Transaksi biaya & modal" subtitle="Catatan manual yang membentuk laporan keuangan">
      <DataTable headers={['Tanggal', 'Tipe', 'Kategori', 'Metode', 'Nominal', 'Pencatat', '']} empty="Belum ada transaksi biaya atau modal.">{entries.map((row) => <tr key={row.id}><td>{formatDate(row.entryDate)}</td><td><span className={`entry-type ${row.type}`}>{entryLabels[row.type]}</span></td><td><b>{row.category}</b>{row.note && <small className="table-subtext">{row.note}</small>}</td><td>{paymentLabels[row.paymentMethod]}</td><td><strong>{row.type === 'capital_in' ? '+' : '-'}{formatRupiah(row.amount)}</strong></td><td>{row.createdByName || 'Sistem'}</td><td><button className="report-delete" onClick={() => remove(row.id)} title="Hapus transaksi"><Trash2 size={14} /></button></td></tr>)}</DataTable>
    </ReportSection>
  </div>
}

function ReportCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return <article className={`report-card ${tone}`}><span>{tone === 'green' ? <TrendingUp /> : tone === 'red' ? <ArrowDownRight /> : <ArrowUpRight />}</span><div><small>{label}</small><b>{value}</b><p>{detail}</p></div></article>
}

function ReportSection({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="report-section"><header><h3>{title}</h3><p>{subtitle}</p></header>{children}</section>
}

function DataTable({ headers, empty, children }: { headers: string[]; empty: string; children: React.ReactNode }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return hasRows ? <div className="report-table-wrap"><table className="report-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div> : <EmptyReport text={empty} />
}

function EmptyReport({ text = 'Belum ada data pada periode ini.' }: { text?: string }) { return <div className="report-empty"><FileBarChart size={28} /><span>{text}</span></div> }

function FinanceStatement({ title, rows, total }: { title: string; rows: Array<[string, number]>; total: [string, number] }) {
  return <section className="finance-statement"><h3>{title}</h3>{rows.map(([label, amount]) => <div key={label}><span>{label}</span><b className={amount < 0 ? 'negative' : ''}>{amount < 0 ? '-' : ''}{formatRupiah(Math.abs(amount))}</b></div>)}<footer><strong>{total[0]}</strong><strong className={total[1] < 0 ? 'negative' : ''}>{total[1] < 0 ? '-' : ''}{formatRupiah(Math.abs(total[1]))}</strong></footer></section>
}

function FinancialEntryModal({ close, saved }: { close: () => void; saved: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [type, setType] = useState<FinancialEntryType>('expense')
  const categorySuggestions = useMemo(() => type === 'expense' ? ['Packaging', 'Ongkir', 'Bahan baku', 'Listrik', 'Sewa', 'Gaji', 'Marketing', 'Lainnya'] : type === 'capital_in' ? ['Setoran pemilik', 'Investasi'] : ['Prive pemilik', 'Dividen'], [type])
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setError('')
    const form = new FormData(event.currentTarget)
    try {
      await managerApi.createFinancialEntry({ type, category: String(form.get('category') || ''), amount: Number(form.get('amount')), paymentMethod: String(form.get('paymentMethod')) as PaymentMethod, entryDate: String(form.get('entryDate')), note: String(form.get('note') || '') || undefined })
      saved()
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Transaksi gagal disimpan.') }
    finally { setLoading(false) }
  }
  return <div className="manager-modal-bg"><form className="manager-modal finance-entry-modal" onSubmit={submit}><header><div><small>KEUANGAN</small><h2>Catat transaksi</h2></div><button type="button" onClick={close}><X /></button></header><div className="manager-form"><label>Jenis transaksi<select value={type} onChange={(event) => setType(event.target.value as FinancialEntryType)}><option value="expense">Biaya operasional</option><option value="capital_in">Modal masuk</option><option value="capital_out">Penarikan modal</option></select></label><label>Kategori<input name="category" list="finance-categories" placeholder="Contoh: Packaging" required /><datalist id="finance-categories">{categorySuggestions.map((item) => <option key={item} value={item} />)}</datalist></label><div className="manager-form-row"><label>Nominal (Rp)<input name="amount" type="number" min="1" step="1" required /></label><label>Tanggal<input name="entryDate" type="date" defaultValue={today()} max={today()} required /></label></div><label>Metode pembayaran<select name="paymentMethod" defaultValue="cash"><option value="cash">Tunai</option><option value="qris">QRIS</option><option value="ewallet">E-wallet</option><option value="bank_transfer">Transfer bank</option></select></label><label>Catatan (opsional)<textarea name="note" rows={3} maxLength={180} placeholder="Keterangan transaksi" /></label>{error && <p className="manager-form-error">{error}</p>}</div><footer><button type="button" onClick={close}>Batal</button><button className="primary" disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan transaksi'}</button></footer></form></div>
}

export default ReportsModule
