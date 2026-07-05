import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, BadgeDollarSign, BriefcaseBusiness, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { authApi } from './api'
import { useFranchiseSettings } from './franchise'
import type { UserRole } from './types'
import './auth.css'

function AuthApp() {
  const { settings } = useFranchiseSettings()
  const [role, setRole] = useState<UserRole>('customer')
  const [registering, setRegistering] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const rawUser = localStorage.getItem('franchise-user')
    if (!rawUser || !localStorage.getItem('franchise-user-token')) return
    try {
      const user = JSON.parse(rawUser) as { role: UserRole }
      window.location.replace(['manager', 'admin'].includes(user.role) ? '/manager' : user.role === 'cashier' ? '/cashier' : '/')
    } catch {
      localStorage.removeItem('franchise-user')
      localStorage.removeItem('franchise-user-token')
    }
  }, [])

  const selectRole = (nextRole: UserRole) => {
    setRole(nextRole)
    setRegistering(false)
    setError('')
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      const result = registering
        ? await authApi.register({
          name: String(form.get('name') || ''),
          email: String(form.get('email') || ''),
          password: String(form.get('password') || ''),
        })
        : await authApi.login({
          email: String(form.get('email') || ''),
          password: String(form.get('password') || ''),
          role,
        })
      localStorage.setItem('franchise-user-token', result.token)
      localStorage.setItem('franchise-user', JSON.stringify(result.user))
      window.location.href = ['manager', 'admin'].includes(result.user.role) ? '/manager' : result.user.role === 'cashier' ? '/cashier' : '/'
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Login gagal.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <a href="/" className="auth-back"><ArrowLeft size={17} /> Kembali ke toko</a>
      <section className="auth-card">
        <div className="auth-brand"><span>{settings.shortName}</span><div><b>{settings.businessName}</b><small>Masuk untuk melanjutkan</small></div></div>
        <div className="auth-role-tabs" role="tablist">
          <button type="button" className={role === 'customer' ? 'active' : ''} onClick={() => selectRole('customer')}><UserRound size={18} /><span>Pelanggan<small>Pesan menu favorit</small></span></button>
          <button type="button" className={role === 'cashier' ? 'active' : ''} onClick={() => selectRole('cashier')}><BadgeDollarSign size={18} /><span>Cashier<small>Kelola pesanan</small></span></button>
          <button type="button" className={role === 'manager' ? 'active' : ''} onClick={() => selectRole('manager')}><BriefcaseBusiness size={18} /><span>Manager<small>Produk & promo</small></span></button>
          <button type="button" className={role === 'admin' ? 'active' : ''} onClick={() => selectRole('admin')}><ShieldCheck size={18} /><span>Admin<small>Semua modul</small></span></button>
        </div>

        <div className="auth-heading">
          <span>{role === 'customer' ? 'AKUN PELANGGAN' : 'AKSES KARYAWAN'}</span>
          <h1>{registering ? 'Buat akun baru' : `Masuk sebagai ${role === 'customer' ? 'pelanggan' : role}`}</h1>
          <p>{registering ? 'Daftar sebentar, setelah itu langsung bisa memesan.' : role === 'customer' ? 'Masuk untuk menyimpan dan membuat pesanan.' : role === 'cashier' ? 'Gunakan akun cashier yang diberikan pengelola.' : role === 'admin' ? `Akses seluruh modul operasional ${settings.businessName}.` : `Kelola operasional, produk, promosi, dan inventory ${settings.businessName}.`}</p>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {registering && <label>Nama lengkap<div><UserRound size={17} /><input name="name" placeholder="Nama Anda" required autoFocus /></div></label>}
          <label>Email<div><Mail size={17} /><input name="email" type="email" placeholder={role === 'cashier' ? 'cashier@franchise.local' : role === 'manager' ? 'manager@franchise.local' : role === 'admin' ? 'admin@franchise.local' : 'nama@email.com'} required autoFocus={!registering} /></div></label>
          <label>Password<div><LockKeyhole size={17} /><input name="password" type="password" placeholder="Minimal 8 karakter" minLength={8} required /></div></label>
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-submit" type="submit" disabled={loading}>{loading ? 'Memproses...' : registering ? 'Daftar sebagai pelanggan' : 'Masuk'} <ArrowRight size={18} /></button>
        </form>

        {role === 'customer' ? (
          <button className="auth-switch" type="button" onClick={() => { setRegistering((value) => !value); setError('') }}>{registering ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar sekarang'}</button>
        ) : (
          <div className="cashier-hint"><b>Akun {role} lokal</b><span>{role === 'manager' ? 'manager@franchise.local · manager123' : role === 'admin' ? 'admin@franchise.local · admin123' : 'cashier@franchise.local · cashier123'}</span></div>
        )}
      </section>
      <div className="auth-art" aria-hidden="true"><div>🍗</div><span>Pesan cepat.<br /><b>Makan nikmat.</b></span></div>
    </main>
  )
}

export default AuthApp
