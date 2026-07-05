import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, KeyRound, LogOut, Pencil, ReceiptText, Store, UserRound, X } from 'lucide-react'
import { authApi } from './api'
import type { User } from './types'
import './profile-menu.css'

interface ProfileMenuProps {
  user: User
  onLogout: () => void
  onUserUpdate?: (user: User) => void
}

const roleLabels = { customer: 'Pelanggan', cashier: 'Cashier', manager: 'Manager', admin: 'Admin' }

function ProfileMenu({ user, onLogout, onUserUpdate }: ProfileMenuProps) {
  const [displayUser, setDisplayUser] = useState(user)
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState<'profile' | 'password' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => setDisplayUser(user), [user])
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const openModal = (value: 'profile' | 'password') => {
    setOpen(false); setError(''); setSuccess(''); setModal(value)
  }

  const submitProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setError(''); setSuccess('')
    const form = new FormData(event.currentTarget)
    try {
      const updated = await authApi.updateProfile({ name: String(form.get('name') || ''), email: String(form.get('email') || '') })
      localStorage.setItem('franchise-user', JSON.stringify(updated))
      setDisplayUser(updated); onUserUpdate?.(updated); setSuccess('Profil berhasil diperbarui.')
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'Profil gagal diperbarui.') }
    finally { setLoading(false) }
  }

  const submitPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setError(''); setSuccess('')
    const form = new FormData(event.currentTarget)
    const newPassword = String(form.get('newPassword') || '')
    if (newPassword !== String(form.get('confirmPassword') || '')) { setError('Konfirmasi password tidak sama.'); setLoading(false); return }
    try {
      await authApi.changePassword({ currentPassword: String(form.get('currentPassword') || ''), newPassword })
      event.currentTarget.reset(); setSuccess('Password berhasil diganti.')
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'Password gagal diganti.') }
    finally { setLoading(false) }
  }

  const dashboardLink = displayUser.role === 'customer' ? '/orders' : displayUser.role === 'cashier' ? '/cashier' : '/manager'
  const dashboardLabel = displayUser.role === 'customer' ? 'Pesanan saya' : displayUser.role === 'cashier' ? 'Stasiun cashier' : displayUser.role === 'admin' ? 'Dashboard admin' : 'Dashboard manager'

  return <>
    <div className="profile-menu" ref={wrapperRef}>
      <button className="profile-trigger" type="button" onClick={() => setOpen((value) => !value)} aria-label="Buka menu profil" aria-expanded={open}>
        <span>{displayUser.name.charAt(0).toUpperCase()}</span>
        <div><b>{displayUser.name}</b><small>{roleLabels[displayUser.role]}</small></div>
        <ChevronDown size={14} />
      </button>
      {open && <div className="profile-dropdown">
        <header><span>{displayUser.name.charAt(0).toUpperCase()}</span><div><b>{displayUser.name}</b><small>{displayUser.email}</small><i>{roleLabels[displayUser.role]}</i></div></header>
        <nav>
          <a href={dashboardLink}>{displayUser.role === 'customer' ? <ReceiptText /> : <Store />}<span><b>{dashboardLabel}</b><small>Buka halaman utama role</small></span></a>
          <button type="button" onClick={() => openModal('profile')}><Pencil /><span><b>Edit profil</b><small>Ubah nama dan email</small></span></button>
          <button type="button" onClick={() => openModal('password')}><KeyRound /><span><b>Ganti password</b><small>Perbarui keamanan akun</small></span></button>
        </nav>
        <button className="profile-logout" type="button" onClick={onLogout}><LogOut size={16} /> Keluar dari akun</button>
      </div>}
    </div>

    {modal && createPortal(<div className="profile-modal-bg" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}>
      <form className="profile-modal" onSubmit={modal === 'profile' ? submitProfile : submitPassword}>
        <header><div><span>{modal === 'profile' ? <UserRound /> : <KeyRound />}</span><div><small>AKUN {roleLabels[displayUser.role].toUpperCase()}</small><h2>{modal === 'profile' ? 'Edit profil' : 'Ganti password'}</h2></div></div><button type="button" onClick={() => setModal(null)}><X /></button></header>
        <div className="profile-form">
          {modal === 'profile' ? <>
            <label>Nama lengkap<input name="name" defaultValue={displayUser.name} required minLength={2} /></label>
            <label>Email<input name="email" type="email" defaultValue={displayUser.email} required /></label>
            <div className="profile-role-info"><span>{displayUser.name.charAt(0).toUpperCase()}</span><p><small>ROLE AKUN</small><b>{roleLabels[displayUser.role]}</b></p></div>
          </> : <>
            <label>Password saat ini<input name="currentPassword" type="password" required /></label>
            <label>Password baru<input name="newPassword" type="password" required minLength={8} placeholder="Minimal 8 karakter" /></label>
            <label>Konfirmasi password<input name="confirmPassword" type="password" required minLength={8} /></label>
          </>}
          {error && <p className="profile-error">{error}</p>}{success && <p className="profile-success">{success}</p>}
        </div>
        <footer><button type="button" onClick={() => setModal(null)}>Batal</button><button className="primary" type="submit" disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan perubahan'}</button></footer>
      </form>
    </div>, document.body)}
  </>
}

export default ProfileMenu
