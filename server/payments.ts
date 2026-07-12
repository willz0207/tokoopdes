import { createHash, timingSafeEqual } from 'node:crypto'
import type { PaymentMethod, PaymentSessionRecord, PaymentStatus } from './contracts.js'

interface PaymentOrder {
  id: string
  total: number
  customerName: string
  email?: string
  phone: string
  paymentMethod: PaymentMethod
}

interface MidtransNotification {
  order_id?: string
  status_code?: string
  gross_amount?: string
  signature_key?: string
  transaction_status?: string
  fraud_status?: string
  transaction_id?: string
  payment_type?: string
  [key: string]: unknown
}

const isProduction = /^true$/i.test(process.env.MIDTRANS_IS_PRODUCTION || '')
const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim() || ''
const snapBaseUrl = isProduction ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com'

export const paymentMode = () => serverKey ? (isProduction ? 'midtrans-production' : 'midtrans-sandbox') : 'local-simulator'

export async function createPaymentSession(order: PaymentOrder): Promise<PaymentSessionRecord & { grossAmount: number; rawResponse?: unknown }> {
  if (order.paymentMethod === 'cash') {
    return { orderId: order.id, provider: 'cash', status: 'unpaid', grossAmount: order.total }
  }

  if (!serverKey) {
    return {
      orderId: order.id,
      provider: 'simulator',
      status: 'pending',
      token: `SIM-${order.id}`,
      redirectUrl: `/payment-simulator?orderId=${encodeURIComponent(order.id)}`,
      grossAmount: order.total,
    }
  }

  const response = await fetch(`${snapBaseUrl}/snap/v1/transactions`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transaction_details: { order_id: order.id, gross_amount: order.total },
      customer_details: { first_name: order.customerName, email: order.email || undefined, phone: order.phone },
      callbacks: { finish: `${process.env.PUBLIC_APP_URL || 'http://localhost:5175'}/orders?payment=${encodeURIComponent(order.id)}` },
    }),
  })
  const data = await response.json().catch(() => ({})) as { token?: string; redirect_url?: string; error_messages?: string[] }
  if (!response.ok || !data.token || !data.redirect_url) {
    throw new Error(data.error_messages?.join(' ') || 'Midtrans tidak dapat membuat sesi pembayaran.')
  }
  return { orderId: order.id, provider: 'midtrans', status: 'pending', token: data.token, redirectUrl: data.redirect_url, grossAmount: order.total, rawResponse: data }
}

export function verifyMidtransNotification(notification: MidtransNotification) {
  if (!serverKey || !notification.order_id || !notification.status_code || !notification.gross_amount || !notification.signature_key) return false
  const expected = createHash('sha512').update(`${notification.order_id}${notification.status_code}${notification.gross_amount}${serverKey}`).digest('hex')
  const received = String(notification.signature_key)
  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(received)
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer)
}

export function paymentStatusFromMidtrans(notification: MidtransNotification): PaymentStatus {
  const status = String(notification.transaction_status || '')
  if (status === 'settlement' || (status === 'capture' && notification.fraud_status === 'accept')) return 'paid'
  if (status === 'expire') return 'expired'
  if (status === 'refund' || status === 'partial_refund') return 'refunded'
  if (status === 'deny' || status === 'cancel' || status === 'failure') return 'failed'
  return 'pending'
}

export type { MidtransNotification }
