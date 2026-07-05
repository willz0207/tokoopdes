import { useEffect, useState } from 'react'
import { storefrontApi } from './api'
import type { FranchiseSettings } from './types'

export const defaultFranchiseSettings: FranchiseSettings = {
  businessName: 'Franchise Store',
  shortName: 'FS',
  tagline: 'Fresh. Fast. Favorit.',
  heroEyebrow: 'Pesan cepat, makan nikmat',
  heroTitle: 'Lagi lapar?',
  heroHighlight: 'Gas, makan enak!',
  heroDescription: 'Menu favorit siap dipesan cepat, dibuat fresh, dan cocok untuk semua pelanggan.',
  heroImageUrl: '',
  storyImageUrl: '',
  deliveryEstimate: '± 25 menit',
  deliveryNote: 'langsung ke pintumu',
  locationLabel: 'Outlet terdekat',
  locationTitle: 'Makin dekat denganmu.',
  locationDescription: 'Temukan outlet terdekat dan nikmati menu favoritmu langsung di tempat.',
  footerDescription: 'Produk enak, cepat, dan selalu bikin balik lagi.',
  contactEmail: 'halo@franchise.local',
  whatsappNumber: '',
  orderPrefix: 'ORD',
  primaryColor: '#c61d23',
  accentColor: '#ffc83d',
  menuKicker: 'Menu andalan',
  menuTitle: 'Mau pesan apa hari ini?',
  menuDescription: 'Dari menu klasik sampai menu promo, semua bisa kamu atur sesuai franchise.',
  aboutKicker: 'Kenapa kami?',
  aboutTitle: 'Bukan sekadar produk cepat saji.',
  aboutDescription: 'Kami membantu pelanggan memesan dengan cepat, sementara tim toko bisa mengelola produk, promo, dan pesanan dari satu dashboard.',
  aboutReviewQuote: 'Rasanya enak dan prosesnya cepat!',
  aboutReviewAuthor: 'Pelanggan setia',
}

export function applyFranchiseTheme(settings: FranchiseSettings) {
  const root = document.documentElement
  root.style.setProperty('--brand-primary', settings.primaryColor || defaultFranchiseSettings.primaryColor)
  root.style.setProperty('--brand-accent', settings.accentColor || defaultFranchiseSettings.accentColor)
  document.title = `${settings.businessName} — Order Online`
}

export function useFranchiseSettings() {
  const [settings, setSettings] = useState<FranchiseSettings>(defaultFranchiseSettings)

  useEffect(() => {
    applyFranchiseTheme(defaultFranchiseSettings)
    let cancelled = false
    storefrontApi.settings()
      .then((nextSettings) => {
        if (cancelled) return
        setSettings(nextSettings)
        applyFranchiseTheme(nextSettings)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const updateSettings = (nextSettings: FranchiseSettings) => {
    setSettings(nextSettings)
    applyFranchiseTheme(nextSettings)
  }

  return { settings, setSettings: updateSettings }
}
