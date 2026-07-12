import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  Heart,
  MapPin,
  Menu,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Star,
  Trash2,
  UserRound,
  X,
  Zap,
  Building2,
} from 'lucide-react'
import { storefrontApi } from './api'
import { defaultCategories, formatRupiah, products as defaultProducts } from './data'
import { useFranchiseSettings } from './franchise'
import type { CartItem, FranchiseSettings, MenuCategory, Outlet, PaymentMethod, Product, Promotion, User } from './types'
import ProfileMenu from './ProfileMenu'

type DrawerView = 'cart' | 'checkout' | 'success'
const envWhatsappNumber = (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined)?.replace(/\D/g, '') ?? ''
const cartLineKey = (item: Pick<CartItem, 'productId' | 'addonIds'>) => `${item.productId}:${[...(item.addonIds || [])].sort((a, b) => a - b).join(',')}`
const allCategory: MenuCategory = { id: 0, label: 'Semua', emoji: '✨', sortOrder: 0, active: true }

function App() {
  const { settings } = useFranchiseSettings()
  const [catalog, setCatalog] = useState<Product[]>(defaultProducts)
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>(defaultCategories)
  const [activePromotions, setActivePromotions] = useState<Promotion[]>([])
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [selectedOutletId, setSelectedOutletId] = useState<number | undefined>(() => {
    const value = Number(localStorage.getItem('franchise-outlet-id'))
    return Number.isInteger(value) && value > 0 ? value : undefined
  })
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('franchise-user') || 'null') as User | null
    } catch {
      return null
    }
  })
  const [activeCategory, setActiveCategory] = useState('Semua')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('franchise-cart') ?? '[]') as CartItem[]
    } catch {
      return []
    }
  })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerView, setDrawerView] = useState<DrawerView>('cart')
  const [toast, setToast] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [addonProduct, setAddonProduct] = useState<Product | null>(null)

  useEffect(() => {
    localStorage.setItem('franchise-cart', JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    storefrontApi.outlets().then((nextOutlets) => {
      setOutlets(nextOutlets)
      const selected = nextOutlets.find((outlet) => outlet.id === selectedOutletId) || nextOutlets.find((outlet) => outlet.isDefault) || nextOutlets[0]
      if (selected) {
        setSelectedOutletId(selected.id)
        localStorage.setItem('franchise-outlet-id', String(selected.id))
      }
    }).catch(() => undefined)
    storefrontApi.promotions().then(setActivePromotions).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!selectedOutletId) return
    let cancelled = false
    Promise.all([
      storefrontApi.categories(selectedOutletId),
      storefrontApi.products(selectedOutletId),
    ]).then(([nextCategories, nextProducts]) => {
      if (cancelled) return
      setMenuCategories(nextCategories)
      setCatalog(nextProducts)
    }).catch(() => {
      if (cancelled) return
      setCatalog([])
      setMenuCategories([])
      setToast('Katalog outlet belum dapat dimuat. Pastikan server aktif.')
    })
    return () => { cancelled = true }
  }, [selectedOutletId])

  const changeOutlet = (outletId: number) => {
    if (outletId === selectedOutletId) return
    setSelectedOutletId(outletId)
    localStorage.setItem('franchise-outlet-id', String(outletId))
    setCart([])
    setToast('Outlet diganti. Keranjang dikosongkan agar stok tetap akurat.')
  }

  useEffect(() => {
    if (activeCategory !== 'Semua' && !menuCategories.some((category) => category.label === activeCategory)) {
      setActiveCategory('Semua')
    }
  }, [activeCategory, menuCategories])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return catalog.filter((product) => {
      const matchesCategory = activeCategory === 'Semua' || product.category === activeCategory
      const matchesQuery =
        !normalizedQuery ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.description.toLowerCase().includes(normalizedQuery)
      return matchesCategory && matchesQuery
    })
  }, [activeCategory, catalog, query])
  const categoryTabs = useMemo(() => [allCategory, ...menuCategories.filter((category) => category.active)], [menuCategories])

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const whatsappNumber = settings.whatsappNumber || envWhatsappNumber
  const heroPhotoStyle = settings.heroImageUrl
    ? { backgroundImage: `linear-gradient(90deg, rgba(112,4,9,.55), rgba(175,17,20,.06)), url(${settings.heroImageUrl})` }
    : undefined
  const storyPhotoStyle = settings.storyImageUrl
    ? { backgroundImage: `linear-gradient(135deg, rgba(255,181,54,.08), rgba(115,8,5,.16)), url(${settings.storyImageUrl})` }
    : undefined

  const addConfiguredProduct = (product: Product, addonIds: number[] = []) => {
    const targetKey = cartLineKey({ productId: product.id, addonIds })
    setCart((current) => {
      const existing = current.find((item) => cartLineKey(item) === targetKey)
      if (existing) {
        return current.map((item) =>
          cartLineKey(item) === targetKey ? { ...item, quantity: item.quantity + 1 } : item,
        )
      }
      return [...current, { productId: product.id, quantity: 1, addonIds }]
    })
    setToast(`${product.name} masuk keranjang`)
  }

  const addToCart = (product: Product) => {
    if (product.addons.some((addon) => addon.active)) {
      setAddonProduct(product)
      return
    }
    addConfiguredProduct(product)
  }

  const updateQuantity = (target: Pick<CartItem, 'productId' | 'addonIds'>, change: number) => {
    const targetKey = cartLineKey(target)
    setCart((current) => {
      const existing = current.some((item) => cartLineKey(item) === targetKey)
      if (!existing && change > 0) {
        return [...current, { ...target, quantity: change }]
      }
      return current
        .map((item) =>
          cartLineKey(item) === targetKey
            ? { ...item, quantity: Math.max(0, item.quantity + change) }
            : item,
        )
        .filter((item) => item.quantity > 0)
    })
  }

  const openCart = () => {
    setDrawerView('cart')
    setDrawerOpen(true)
  }

  const goToMenu = () => document.querySelector('#menu')?.scrollIntoView({ behavior: 'smooth' })
  const featuredPromotion = activePromotions[0]

  const logout = () => {
    localStorage.removeItem('franchise-user-token')
    localStorage.removeItem('franchise-user')
    setCurrentUser(null)
  }

  return (
    <div className="app-shell">
      <header className="header">
        <div className="container header-inner">
          <a className="brand" href="#top" aria-label={`${settings.businessName} beranda`}>
            <span className="brand-mark">{settings.shortName}</span>
            <span className="brand-copy">{settings.tagline}</span>
          </a>

          <nav className={mobileMenuOpen ? 'nav nav-open' : 'nav'} aria-label="Navigasi utama">
            <a href="#menu" onClick={() => setMobileMenuOpen(false)}>Menu</a>
            <a href="#promo" onClick={() => setMobileMenuOpen(false)}>Promo</a>
            <a href="#tentang" onClick={() => setMobileMenuOpen(false)}>Tentang</a>
            <a href="#lokasi" onClick={() => setMobileMenuOpen(false)}>Lokasi</a>
          </nav>

          <div className="header-actions">
            <label className="store-outlet-select"><Building2 size={17} /><select aria-label="Pilih outlet" value={selectedOutletId || ''} onChange={(event) => changeOutlet(Number(event.target.value))}>{outlets.map((outlet) => <option value={outlet.id} key={outlet.id}>{outlet.name}</option>)}</select></label>
            {currentUser ? (
              <ProfileMenu user={currentUser} onLogout={logout} onUserUpdate={setCurrentUser} />
            ) : (
              <a className="store-login" href="/login"><UserRound size={17} /> Masuk</a>
            )}
            <button className="cart-button" type="button" onClick={openCart} aria-label={`Keranjang, ${cartCount} item`}>
              <ShoppingBag size={20} />
              <span>Keranjang</span>
              {cartCount > 0 && <b>{cartCount}</b>}
            </button>
            <button className="mobile-menu" type="button" onClick={() => setMobileMenuOpen((value) => !value)} aria-label="Buka menu">
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-photo" style={heroPhotoStyle} aria-hidden="true" />
          <div className="hero-glow hero-glow-one" />
          <div className="hero-glow hero-glow-two" />
          <div className="container hero-inner">
            <div className="hero-copy">
              <div className="eyebrow"><Zap size={15} fill="currentColor" /> {settings.heroEyebrow}</div>
              <h1>{settings.heroTitle}<br /><em>{settings.heroHighlight}</em></h1>
              <p>{settings.heroDescription}</p>
              <div className="hero-actions">
                <button className="primary-button" type="button" onClick={goToMenu}>
                  Pesan sekarang <ArrowRight size={19} />
                </button>
                <div className="delivery-note">
                  <span><Clock3 size={18} /></span>
                  <div><b>{settings.deliveryEstimate}</b><small>{settings.deliveryNote}</small></div>
                </div>
              </div>
              <div className="hero-social-proof">
                <div className="avatar-stack" aria-hidden="true">
                  <span>R</span><span>A</span><span>D</span>
                </div>
                <div><div className="stars">★★★★★</div><small>Disukai 12.000+ pelanggan</small></div>
              </div>
            </div>
          </div>
          <div className="hero-sticker" aria-hidden="true">
            <small>Mulai dari</small><b>18K</b><span>aja!</span>
          </div>
        </section>

        <section className="benefit-bar" aria-label={`Keunggulan ${settings.businessName}`}>
          <div className="container benefits">
            <div><span>⚡</span><p><b>Sat-set sampai</b><small>Pesanan hangat dalam {settings.deliveryEstimate}</small></p></div>
            <div><span>🍽️</span><p><b>Dibuat fresh</b><small>Dibuat setelah kamu memesan</small></p></div>
            <div><span>🛵</span><p><b>Gratis ongkir</b><small>Minimum belanja Rp75.000</small></p></div>
          </div>
        </section>

        <section className="menu-section" id="menu">
          <div className="container">
            <div className="section-heading">
              <div>
                <span className="section-kicker">{settings.menuKicker}</span>
                <h2>{settings.menuTitle}</h2>
              </div>
              <p>{settings.menuDescription}</p>
            </div>

            <div className="menu-toolbar">
              <div className="category-list" role="tablist" aria-label="Kategori menu">
                {categoryTabs.map((category) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeCategory === category.label}
                    className={activeCategory === category.label ? 'category active' : 'category'}
                    onClick={() => setActiveCategory(category.label)}
                    key={category.label}
                  >
                    <span>{category.emoji}</span>{category.label}
                  </button>
                ))}
              </div>
              <label className="search-box">
                <Search size={18} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari menu favorit..." />
                {query && <button type="button" onClick={() => setQuery('')} aria-label="Hapus pencarian"><X size={15} /></button>}
              </label>
            </div>

            {visibleProducts.length > 0 ? (
              <div className="product-grid">
                {visibleProducts.map((product) => (
                  <ProductCard key={product.id} product={product} onAdd={() => addToCart(product)} />
                ))}
              </div>
            ) : (
              <div className="empty-search">
                <span>🍽️</span><h3>Menu belum ditemukan</h3><p>Coba kata kunci lain, ya.</p>
              </div>
            )}
          </div>
        </section>

        <section className="promo-section" id="promo">
          <div className="container promo-card">
            <div className="promo-pattern" aria-hidden="true">{`${settings.shortName} ${settings.shortName} ${settings.shortName}`}</div>
            <div className="promo-copy">
              <span className="promo-label">PROMO MINGGU INI</span>
              <h2>{featuredPromotion?.title || 'Berdua lebih hemat,'}<br />{featuredPromotion ? 'khusus untukmu.' : 'lebih nikmat.'}</h2>
              <p>{featuredPromotion?.description || '2 ayam + 2 nasi + 2 minuman'}</p>
              <div className="promo-price"><span>{featuredPromotion ? 'Diskon' : 'Cuma'}</span><b>{featuredPromotion ? featuredPromotion.discountType === 'percentage' ? `${featuredPromotion.discountValue}%` : formatRupiah(featuredPromotion.discountValue) : 'Rp59.900'}</b></div>
              {featuredPromotion && <div className="promo-code">Kode: <b>{featuredPromotion.code}</b> · Min. {formatRupiah(featuredPromotion.minOrder)}</div>}
              <button type="button" onClick={() => {
                const product = catalog[0]
                if (product) {
                  addToCart(product)
                  openCart()
                }
              }}>Ambil promonya <ChevronRight size={18} /></button>
            </div>
            <div className="promo-visual" aria-hidden="true">
              <div className="promo-food">🍗</div>
              <div className="promo-food second">🍗</div>
              <div className="promo-drink">🥤</div>
              <div className="promo-burst">HEMAT<br /><b>25%</b></div>
            </div>
          </div>
        </section>

        <section className="story-section" id="tentang">
          <div className="container story-grid">
            <div className="story-art">
              <div className="story-photo" style={storyPhotoStyle} />
              <div className="floating-review">
                <div className="review-stars"><Star size={14} fill="currentColor" /><Star size={14} fill="currentColor" /><Star size={14} fill="currentColor" /><Star size={14} fill="currentColor" /><Star size={14} fill="currentColor" /></div>
                <b>“{settings.aboutReviewQuote}”</b><small>— {settings.aboutReviewAuthor}</small>
              </div>
            </div>
            <div className="story-copy">
              <span className="section-kicker">{settings.aboutKicker}</span>
              <h2>{settings.aboutTitle}</h2>
              <p>{settings.aboutDescription}</p>
              <ul>
                <li><Check size={18} /> Bahan berkualitas & bersertifikat halal</li>
                <li><Check size={18} /> Produk fresh dan siap dipesan online</li>
                <li><Check size={18} /> Harga bersahabat untuk setiap hari</li>
              </ul>
              <a href="#menu">Kenalan dengan menu kami <ArrowRight size={17} /></a>
            </div>
          </div>
        </section>

        <section className="location-section" id="lokasi">
          <div className="container location-card">
            <div>
              <span className="section-kicker">{settings.locationLabel}</span>
              <h2>{settings.businessName} {settings.locationTitle}</h2>
              <p>{settings.locationDescription}</p>
            </div>
            <button type="button"><MapPin size={19} /> Lihat lokasi outlet</button>
          </div>
        </section>
      </main>

      <footer>
        <div className="container footer-grid">
          <div><a className="brand footer-brand" href="#top"><span className="brand-mark">{settings.shortName}</span></a><p>{settings.footerDescription}</p></div>
          <div><b>Jelajahi</b><a href="#menu">Menu</a><a href="#promo">Promo</a><a href="#tentang">Tentang kami</a></div>
          <div><b>Bantuan</b><a href="#lokasi">Lokasi outlet</a><a href={`mailto:${settings.contactEmail}`}>Hubungi kami</a><a href="#top">FAQ</a></div>
          <div><b>Jam operasional</b><p>Setiap hari<br /><strong>09.00 — 22.00 WIB</strong></p></div>
        </div>
        <div className="container copyright"><span>© 2026 {settings.businessName}. Dibuat dengan rasa.</span><span>Instagram · TikTok · Facebook</span></div>
      </footer>

      {drawerOpen && (
        <CartDrawer
          cart={cart}
          view={drawerView}
          setView={setDrawerView}
          close={() => setDrawerOpen(false)}
          updateQuantity={updateQuantity}
          clearCart={() => setCart([])}
          catalog={catalog}
          promotions={activePromotions}
          customer={currentUser?.role === 'customer' ? currentUser : null}
          settings={settings}
          whatsappNumber={whatsappNumber}
          outlet={outlets.find((outlet) => outlet.id === selectedOutletId) || null}
        />
      )}

      {addonProduct && <AddonSelector product={addonProduct} close={() => setAddonProduct(null)} add={(addonIds) => { addConfiguredProduct(addonProduct, addonIds); setAddonProduct(null) }} />}

      {toast && <div className="toast"><span><Check size={15} /></span>{toast}</div>}
    </div>
  )
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  const [liked, setLiked] = useState(false)
  return (
    <article className="product-card">
      <div className={`product-art ${product.tone}${product.imageUrl ? ' has-photo' : ''}`}>
        {product.badge && <span className="product-badge">{product.badge}</span>}
        <button className={liked ? 'heart-button liked' : 'heart-button'} type="button" onClick={() => setLiked((value) => !value)} aria-label="Simpan favorit">
          <Heart size={19} fill={liked ? 'currentColor' : 'none'} />
        </button>
        {product.imageUrl ? (
          <img className="product-photo" src={product.imageUrl} alt={product.name} />
        ) : (
          <>
            <div className="food-shadow" />
            <span className="food-emoji" role="img" aria-label={product.name}>{product.emoji}</span>
          </>
        )}
        {product.spicy && <span className="spice-dot">PEDAS</span>}
      </div>
      <div className="product-content">
        <div className="product-meta"><span>{product.category}</span><span><Star size={13} fill="currentColor" /> 4.9</span></div>
        <h3>{product.name}</h3>
        <p>{product.description}</p>
        {product.addons.length > 0 && <small className="storefront-addon-count">{product.addons.length} pilihan add-on</small>}
        <div className="product-footer">
          <div className="product-price">
            {product.originalPrice && <del>{formatRupiah(product.originalPrice)}</del>}
            <strong>{formatRupiah(product.price)}</strong>
          </div>
          <button type="button" onClick={onAdd} aria-label={`Tambah ${product.name}`}><Plus size={19} /></button>
        </div>
      </div>
    </article>
  )
}

function AddonSelector({ product, close, add }: { product: Product; close: () => void; add: (addonIds: number[]) => void }) {
  const activeAddons = product.addons.filter((addon) => addon.active)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const total = product.price + activeAddons.filter((addon) => selectedIds.includes(addon.id)).reduce((sum, addon) => sum + addon.price, 0)
  const toggle = (id: number) => setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])

  return <div className="addon-modal-bg" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className="addon-modal"><header><div><small>PILIHAN TAMBAHAN</small><h2>{product.name}</h2></div><button type="button" onClick={close}><X /></button></header><div className="addon-modal-body"><p>Pilih add-on sesuai selera. Semua pilihan bersifat opsional.</p><div className="addon-options">{activeAddons.map((addon) => <label className={selectedIds.includes(addon.id) ? 'selected' : ''} key={addon.id}><input type="checkbox" checked={selectedIds.includes(addon.id)} onChange={() => toggle(addon.id)} /><span><b>{addon.name}</b><small>+{formatRupiah(addon.price)}</small></span><i>{selectedIds.includes(addon.id) ? <Check size={14} /> : <Plus size={14} />}</i></label>)}</div></div><footer><div><small>Total per item</small><b>{formatRupiah(total)}</b></div><button type="button" onClick={() => add(selectedIds)}>Tambah ke keranjang <ShoppingBag size={17} /></button></footer></section></div>
}

interface CartDrawerProps {
  cart: CartItem[]
  view: DrawerView
  setView: (view: DrawerView) => void
  close: () => void
  updateQuantity: (target: Pick<CartItem, 'productId' | 'addonIds'>, change: number) => void
  clearCart: () => void
  catalog: Product[]
  promotions: Promotion[]
  customer: User | null
  settings: FranchiseSettings
  whatsappNumber: string
  outlet: Outlet | null
}

function CartDrawer({ cart, view, setView, close, updateQuantity, clearCart, catalog, promotions, customer, settings, whatsappNumber, outlet }: CartDrawerProps) {
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [promoCode, setPromoCode] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const detailedCart = cart.map((item) => {
    const product = catalog.find((catalogProduct) => catalogProduct.id === item.productId)
    const selectedAddons = product ? (item.addonIds || []).map((id) => product.addons.find((addon) => addon.id === id)).filter((addon) => Boolean(addon)) : []
    return { ...item, product, selectedAddons, unitPrice: (product?.price || 0) + selectedAddons.reduce((sum, addon) => sum + (addon?.price || 0), 0) }
  }).filter((item): item is CartItem & { product: Product; selectedAddons: Product['addons']; unitPrice: number } => Boolean(item.product))
  const subtotal = detailedCart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const selectedPromotion = promotions.find((promotion) => promotion.code === promoCode && subtotal >= promotion.minOrder)
  const discountAmount = selectedPromotion
    ? selectedPromotion.discountType === 'percentage' ? Math.floor(subtotal * selectedPromotion.discountValue / 100) : Math.min(subtotal, selectedPromotion.discountValue)
    : 0
  const deliveryFee = deliveryMethod === 'delivery' && subtotal < 75000 ? 9000 : 0
  const total = Math.max(0, subtotal - discountAmount) + deliveryFee

  const submitOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!customer) {
      setSubmitError('Silakan login sebagai pelanggan untuk membuat pesanan.')
      return
    }
    if (!outlet) {
      setSubmitError('Pilih outlet aktif sebelum membuat pesanan.')
      return
    }
    setSubmitError('')
    setSubmitting(true)
    const form = new FormData(event.currentTarget)
    const customerName = String(form.get('name') ?? '')
    const customerPhone = String(form.get('phone') ?? '')
    const address = String(form.get('address') ?? '')
    const note = String(form.get('note') ?? '')
    try {
      const order = await storefrontApi.createOrder({
        outletId: outlet.id,
        customerName,
        phone: customerPhone,
        address,
        note,
        deliveryMethod,
        paymentMethod,
        promoCode: promoCode || undefined,
        items: detailedCart.map((item) => ({ productId: item.productId, quantity: item.quantity, addonIds: item.selectedAddons.map((addon) => addon.id) })),
      })
      const confirmedOrderNumber = order.id
      setOrderNumber(confirmedOrderNumber)
    if (paymentMethod !== 'cash' && order.paymentRedirectUrl) {
      clearCart()
      window.location.href = order.paymentRedirectUrl
      return
    }
    const itemLines = detailedCart
      .map((item) => `• ${item.quantity}x ${item.product.name}${item.selectedAddons.length ? ` (${item.selectedAddons.map((addon) => addon.name).join(', ')})` : ''} — ${formatRupiah(item.unitPrice * item.quantity)}`)
      .join('\n')
    const message = [
      `Halo ${settings.businessName}, saya ingin mengonfirmasi pesanan ${confirmedOrderNumber}`,
      '',
      itemLines,
      '',
      `Subtotal: ${formatRupiah(subtotal)}`,
      discountAmount ? `Diskon ${selectedPromotion?.code}: -${formatRupiah(discountAmount)}` : '',
      `Ongkir: ${deliveryFee === 0 ? 'Gratis' : formatRupiah(deliveryFee)}`,
      `Total: ${formatRupiah(total)}`,
      '',
      `Nama: ${customerName}`,
      `No. WhatsApp: ${customerPhone}`,
      `Metode: ${deliveryMethod === 'delivery' ? 'Diantar' : 'Ambil sendiri'}`,
      `Outlet: ${outlet.name}`,
      `Pembayaran: ${paymentMethod === 'cash' ? 'Tunai' : paymentMethod === 'bank_transfer' ? 'Transfer bank' : paymentMethod === 'ewallet' ? 'E-wallet' : 'QRIS'}`,
      address ? `Alamat: ${address}` : '',
      note ? `Catatan: ${note}` : '',
    ].filter(Boolean).join('\n')

    if (whatsappNumber) {
      window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
    }
    clearCart()
    setView('success')
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Pesanan gagal disimpan.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="drawer-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <aside className="cart-drawer" aria-label="Keranjang belanja">
        {view === 'success' ? (
          <div className="success-view">
            <button className="drawer-close" type="button" onClick={close}><X /></button>
            <div className="success-icon"><Check size={34} /></div>
            <span>Pesanan diterima</span>
            <h2>Siap dimasak!</h2>
            <p>Pesananmu sudah tersimpan dan dapat dipantau oleh tim {settings.businessName} melalui dashboard.</p>
            <div className="order-number"><small>Nomor pesanan</small><b>{orderNumber}</b></div>
            <div className="order-progress">
              <div className="progress-step active"><i><Check size={13} /></i><span>Pesanan masuk</span></div>
              <div className="progress-line" />
              <div className="progress-step"><i>2</i><span>Sedang dimasak</span></div>
              <div className="progress-line" />
              <div className="progress-step"><i>3</i><span>Diantar</span></div>
            </div>
            <a className="track-order-button" href="/orders">Lacak pesanan <ArrowRight size={16} /></a>
            <button className="checkout-button" type="button" onClick={close}>Kembali ke menu</button>
          </div>
        ) : (
          <>
            <div className="drawer-header">
              <div>
                {view === 'checkout' && <button className="back-button" type="button" onClick={() => setView('cart')}><ArrowLeft size={18} /></button>}
                <div><small>{view === 'cart' ? 'Pesananmu' : 'Satu langkah lagi'}</small><h2>{view === 'cart' ? 'Keranjang' : 'Checkout'}</h2></div>
              </div>
              <button className="drawer-close" type="button" onClick={close}><X /></button>
            </div>

            {view === 'cart' ? (
              <>
                <div className="drawer-body">
                  {detailedCart.length === 0 ? (
                    <div className="empty-cart"><span>🛍️</span><h3>Keranjangmu masih kosong</h3><p>Yuk, pilih menu yang bikin ngiler!</p><button type="button" onClick={close}>Lihat menu</button></div>
                  ) : (
                    <>
                      <div className="cart-items">
                        {detailedCart.map((item) => (
                          <div className="cart-item" key={cartLineKey(item)}>
                            <div className={`cart-item-art ${item.product.tone}${item.product.imageUrl ? ' has-photo' : ''}`}>
                              {item.product.imageUrl ? <img className="cart-item-photo" src={item.product.imageUrl} alt={item.product.name} /> : item.product.emoji}
                            </div>
                            <div className="cart-item-info"><b>{item.product.name}</b>{item.selectedAddons.length > 0 && <small className="cart-addon-list">{item.selectedAddons.map((addon) => addon.name).join(' · ')}</small>}<span>{formatRupiah(item.unitPrice)}</span><div className="quantity-control"><button type="button" onClick={() => updateQuantity(item, -1)}>{item.quantity === 1 ? <Trash2 size={14} /> : <Minus size={14} />}</button><strong>{item.quantity}</strong><button type="button" onClick={() => updateQuantity(item, 1)}><Plus size={14} /></button></div></div>
                          </div>
                        ))}
                      </div>
                      <div className="upsell"><span>🍟</span><div><b>Tambah snack pendamping</b><small>Biar makannya makin lengkap</small></div><button type="button" onClick={() => updateQuantity({ productId: 6, addonIds: [] }, 1)}><Plus size={16} /></button></div>
                    </>
                  )}
                </div>
                {detailedCart.length > 0 && (
                  <div className="drawer-summary">
                    <div><span>Subtotal</span><b>{formatRupiah(subtotal)}</b></div>
                    <small>Ongkir dihitung saat checkout</small>
                    <button className="checkout-button" type="button" onClick={() => setView('checkout')}>Lanjut checkout <ArrowRight size={18} /></button>
                  </div>
                )}
              </>
            ) : (
              <form className="checkout-form" onSubmit={submitOrder}>
                <div className="drawer-body checkout-body">
                  <fieldset className="method-picker">
                    <legend>Cara menerima pesanan</legend>
                    <label className={deliveryMethod === 'delivery' ? 'selected' : ''}><input type="radio" name="method" value="delivery" checked={deliveryMethod === 'delivery'} onChange={() => setDeliveryMethod('delivery')} /><span>🛵</span><div><b>Diantar</b><small>{settings.deliveryEstimate}</small></div><i /></label>
                    <label className={deliveryMethod === 'pickup' ? 'selected' : ''}><input type="radio" name="method" value="pickup" checked={deliveryMethod === 'pickup'} onChange={() => setDeliveryMethod('pickup')} /><span>🏪</span><div><b>Ambil sendiri</b><small>± 15 menit</small></div><i /></label>
                  </fieldset>
                  <div className="form-section">
                    <h3>Pembayaran &amp; promo</h3>
                    <label>Metode pembayaran<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}><option value="cash">Tunai</option><option value="qris">QRIS</option><option value="ewallet">E-wallet</option><option value="bank_transfer">Transfer bank</option></select></label>
                    <label>Kode promo<select value={promoCode} onChange={(event) => setPromoCode(event.target.value)}><option value="">Tanpa promo</option>{promotions.map((promotion) => <option key={promotion.id} value={promotion.code} disabled={subtotal < promotion.minOrder}>{promotion.code} · {promotion.discountType === 'percentage' ? `${promotion.discountValue}%` : formatRupiah(promotion.discountValue)}{subtotal < promotion.minOrder ? ` (min. ${formatRupiah(promotion.minOrder)})` : ''}</option>)}</select></label>
                  </div>
                  <div className="form-section">
                    <h3>Data pemesan</h3>
                    <label>Nama lengkap<input required name="name" defaultValue={customer?.name} placeholder="Nama kamu" autoComplete="name" /></label>
                    <label>Nomor WhatsApp<input required name="phone" type="tel" placeholder="08xx xxxx xxxx" autoComplete="tel" /></label>
                    {deliveryMethod === 'delivery' && <label>Alamat pengantaran<textarea required name="address" placeholder="Nama jalan, nomor rumah, patokan..." rows={3} /></label>}
                    <label>Catatan <span>(opsional)</span><input name="note" placeholder="Contoh: saus dipisah" /></label>
                  </div>
                  <div className="payment-info"><span>💳</span><div><b>{paymentMethod === 'cash' ? 'Bayar saat pesanan diterima' : 'Pembayaran online aman'}</b><small>{paymentMethod === 'cash' ? 'Pembayaran tunai di outlet atau kepada kurir' : 'Setelah pesanan dibuat, kamu akan diarahkan ke halaman pembayaran.'}</small></div><Check size={17} /></div>
                </div>
                <div className="drawer-summary checkout-summary">
                  <div><span>Subtotal</span><span>{formatRupiah(subtotal)}</span></div>
                  {discountAmount > 0 && <div><span>Diskon ({selectedPromotion?.code})</span><span>-{formatRupiah(discountAmount)}</span></div>}
                  <div><span>Ongkir</span><span>{deliveryFee === 0 ? 'Gratis' : formatRupiah(deliveryFee)}</span></div>
                  <div className="grand-total"><b>Total</b><strong>{formatRupiah(total)}</strong></div>
                  {!customer && <div className="checkout-login-required"><UserRound size={18} /><span><b>Login pelanggan diperlukan</b><small>Keranjangmu tetap tersimpan setelah login.</small></span></div>}
                  {submitError && <p className="checkout-error">{submitError}</p>}
                  {customer ? <button className="checkout-button" type="submit" disabled={submitting || !outlet}>{submitting ? 'Menyiapkan pesanan...' : paymentMethod === 'cash' ? whatsappNumber ? 'Pesan & buka WhatsApp' : 'Buat pesanan' : 'Lanjut ke pembayaran'} <ArrowRight size={18} /></button> : <a className="checkout-button" href="/login">Masuk sebagai pelanggan <ArrowRight size={18} /></a>}
                </div>
              </form>
            )}
          </>
        )}
      </aside>
    </div>
  )
}

export default App
