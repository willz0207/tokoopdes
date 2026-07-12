import { useEffect, useState } from 'react'
import { CheckCircle2, CreditCard, LoaderCircle, ShieldCheck, XCircle } from 'lucide-react'
import { storefrontApi } from './api'
import type { PaymentSession, User } from './types'
import './payment.css'

function PaymentSimulatorApp() {
  const orderId = new URLSearchParams(window.location.search).get('orderId') || ''
  const [payment, setPayment] = useState<PaymentSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const user = (() => { try { return JSON.parse(localStorage.getItem('franchise-user') || 'null') as User | null } catch { return null } })()

  useEffect(() => {
    if (!user || user.role !== 'customer' || !localStorage.getItem('franchise-user-token')) {
      window.location.replace(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)
      return
    }
    if (!orderId) { setError('Nomor pesanan tidak ditemukan.'); setLoading(false); return }
    storefrontApi.paymentStatus(orderId).then(setPayment).catch((reason) => setError(reason instanceof Error ? reason.message : 'Pembayaran gagal dimuat.')).finally(() => setLoading(false))
  }, [orderId])

  const simulate = async (result: 'paid' | 'failed') => {
    setLoading(true); setError('')
    try { setPayment(await storefrontApi.simulatePayment(orderId, result)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Simulasi pembayaran gagal.') }
    finally { setLoading(false) }
  }

  const finished = payment && payment.status !== 'pending'
  return <main className="payment-page"><section className="payment-card"><header><span><CreditCard /></span><div><small>SIMULATOR PEMBAYARAN LOKAL</small><h1>Uji pembayaran online</h1></div></header>{loading && !payment ? <div className="payment-loading"><LoaderCircle className="spin" /> Memuat pembayaran...</div> : <><div className="payment-order"><small>NOMOR PESANAN</small><b>{orderId || '-'}</b><span className={payment?.status || 'pending'}>{payment?.status === 'paid' ? 'Berhasil dibayar' : payment?.status === 'failed' ? 'Pembayaran gagal' : payment?.status === 'expired' ? 'Kedaluwarsa' : 'Menunggu pembayaran'}</span></div>{error && <p className="payment-error">{error}</p>}{!finished ? <><div className="payment-note"><ShieldCheck /><p><b>Mode pengembangan</b><small>Halaman ini menggantikan Midtrans saat MIDTRANS_SERVER_KEY belum diisi. Tidak ada uang sungguhan yang diproses.</small></p></div><div className="payment-actions"><button disabled={loading} onClick={() => void simulate('failed')}><XCircle /> Simulasikan gagal</button><button className="primary" disabled={loading} onClick={() => void simulate('paid')}>{loading ? <LoaderCircle className="spin" /> : <CheckCircle2 />} Simulasikan berhasil</button></div></> : <div className={`payment-result ${payment.status}`}><span>{payment.status === 'paid' ? <CheckCircle2 /> : <XCircle />}</span><div><h2>{payment.status === 'paid' ? 'Pembayaran berhasil' : 'Pembayaran tidak berhasil'}</h2><p>{payment.status === 'paid' ? 'Pesanan sudah masuk dan dapat diproses oleh cashier outlet.' : 'Pesanan dibatalkan otomatis dan stok sudah dikembalikan.'}</p></div></div>}<a className="payment-back" href="/orders">Lihat Pesanan Saya</a></>}</section></main>
}

export default PaymentSimulatorApp
