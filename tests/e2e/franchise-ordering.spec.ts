import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

const managerEmail = process.env.E2E_MANAGER_EMAIL || 'manager@franchise.local'
const managerPassword = process.env.E2E_MANAGER_PASSWORD || 'manager123'
const cashierEmail = process.env.E2E_CASHIER_EMAIL || 'cashier@franchise.local'
const cashierPassword = process.env.E2E_CASHIER_PASSWORD || 'cashier123'

async function login(page: Page, role: 'Manager' | 'Cashier', email: string, password: string) {
  await test.step(`Buka halaman login dan pilih role ${role}`, async () => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: new RegExp(`^${role}`) })).toBeVisible()
    await page.getByRole('button', { name: new RegExp(`^${role}`) }).click()
  })

  await test.step('Isi kredensial dan kirim form login', async () => {
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: /^Masuk/ }).click()
  })
}

async function addFirstProduct(page: Page) {
  await test.step('Tambahkan produk pertama dari katalog', async () => {
    const firstProduct = page.locator('.product-card').first()
    await expect(firstProduct).toBeVisible()
    await firstProduct.getByRole('button', { name: /^Tambah / }).click()

    const addonModal = page.locator('.addon-modal')
    if (await addonModal.isVisible().catch(() => false)) {
      await addonModal.getByRole('button', { name: /Tambah ke keranjang/ }).click()
    }
  })
}

test.describe('Storefront', () => {
  test('STORE-001 menampilkan komponen utama storefront', async ({ page }) => {
    await test.step('Buka halaman storefront', async () => {
      await page.goto('/')
      await expect(page.locator('main#top')).toBeVisible()
    })

    await test.step('Verifikasi header dan navigasi utama', async () => {
      const navigation = page.getByRole('navigation', { name: 'Navigasi utama' })
      await expect(navigation).toBeVisible()
      await expect(navigation.getByRole('link', { name: 'Menu' })).toBeVisible()
      await expect(navigation.getByRole('link', { name: 'Promo' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Masuk' })).toHaveAttribute('href', '/login')
      await expect(page.getByRole('button', { name: /Keranjang, 0 item/ })).toBeVisible()
    })

    await test.step('Verifikasi kategori dan katalog produk', async () => {
      await expect(page.getByRole('tablist', { name: 'Kategori menu' })).toBeVisible()
      await expect(page.getByRole('tab', { name: /Semua/ })).toHaveAttribute('aria-selected', 'true')
      await expect(page.locator('.product-card').first()).toBeVisible()
      expect(await page.locator('.product-card').count()).toBeGreaterThan(0)
    })
  })

  test('STORE-002 filter kategori hanya menampilkan produk kategori terpilih', async ({ page }) => {
    await page.goto('/')

    let selectedCategory = ''
    await test.step('Pilih kategori pertama selain Semua', async () => {
      const categoryTab = page.getByRole('tab').filter({ hasNotText: 'Semua' }).first()
      selectedCategory = await categoryTab.evaluate((element) =>
        Array.from(element.childNodes)
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent || '')
          .join('')
          .trim(),
      )
      expect(selectedCategory).toBeTruthy()
      await categoryTab.click()
      await expect(categoryTab).toHaveAttribute('aria-selected', 'true')
    })

    await test.step('Verifikasi seluruh produk sesuai kategori', async () => {
      const cards = page.locator('.product-card')
      expect(await cards.count()).toBeGreaterThan(0)
      const displayedCategories = await cards.locator('.product-meta > span:first-child').allTextContents()
      expect(displayedCategories.map((value) => value.trim())).toEqual(
        Array(displayedCategories.length).fill(selectedCategory),
      )
    })
  })

  test('STORE-003 pencarian nama menu menampilkan produk yang sesuai', async ({ page }) => {
    await page.goto('/')
    let productName = ''

    await test.step('Ambil nama produk pertama sebagai data pencarian', async () => {
      const firstProduct = page.locator('.product-card').first()
      productName = (await firstProduct.getByRole('heading', { level: 3 }).textContent())?.trim() || ''
      expect(productName).toBeTruthy()
    })

    await test.step('Cari produk menggunakan nama lengkap', async () => {
      await page.getByPlaceholder('Cari menu favorit...').fill(productName)
    })

    await test.step('Verifikasi hanya produk yang dicari tampil', async () => {
      await expect(page.locator('.product-card')).toHaveCount(1)
      await expect(page.locator('.product-card').getByRole('heading', { level: 3 })).toHaveText(productName)
    })
  })

  test('STORE-004 pencarian yang tidak ditemukan menampilkan empty state', async ({ page }) => {
    await page.goto('/')

    await test.step('Masukkan kata kunci yang tidak ada pada katalog', async () => {
      await page.getByPlaceholder('Cari menu favorit...').fill('produk-tidak-ada-e2e-999')
    })

    await test.step('Verifikasi daftar kosong dan pesan bantuan tampil', async () => {
      await expect(page.locator('.product-card')).toHaveCount(0)
      await expect(page.getByRole('heading', { name: 'Menu belum ditemukan' })).toBeVisible()
      await expect(page.getByText('Coba kata kunci lain, ya.')).toBeVisible()
    })
  })

  test('STORE-005 menambahkan produk ke keranjang', async ({ page }) => {
    await page.goto('/')
    await addFirstProduct(page)

    await test.step('Verifikasi counter keranjang bertambah', async () => {
      await expect(page.getByRole('button', { name: /Keranjang, 1 item/ })).toBeVisible()
    })

    await test.step('Buka drawer dan verifikasi ringkasan belanja', async () => {
      await page.getByRole('button', { name: /Keranjang, 1 item/ }).click()
      await expect(page.getByRole('complementary', { name: 'Keranjang belanja' })).toBeVisible()
      await expect(page.locator('.cart-item')).toHaveCount(1)
      await expect(page.getByText('Subtotal', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: /Lanjut checkout/ })).toBeEnabled()
    })
  })

  test('STORE-006 mengubah jumlah produk di keranjang', async ({ page }) => {
    await page.goto('/')
    await addFirstProduct(page)
    await page.getByRole('button', { name: /Keranjang, 1 item/ }).click()

    await test.step('Tambah quantity produk dari satu menjadi dua', async () => {
      const quantityControl = page.locator('.cart-item .quantity-control').first()
      await expect(quantityControl.locator('strong')).toHaveText('1')
      await quantityControl.getByRole('button').last().click()
      await expect(quantityControl.locator('strong')).toHaveText('2')
      await expect(page.getByRole('button', { name: /Keranjang, 2 item/ })).toBeVisible()
    })

    await test.step('Kurangi quantity produk kembali menjadi satu', async () => {
      const quantityControl = page.locator('.cart-item .quantity-control').first()
      await quantityControl.getByRole('button').first().click()
      await expect(quantityControl.locator('strong')).toHaveText('1')
      await expect(page.getByRole('button', { name: /Keranjang, 1 item/ })).toBeVisible()
    })
  })

  test('STORE-007 checkout tamu meminta login pelanggan', async ({ page }) => {
    await page.goto('/')
    await addFirstProduct(page)

    await test.step('Buka halaman checkout dari drawer keranjang', async () => {
      await page.getByRole('button', { name: /Keranjang, 1 item/ }).click()
      await page.getByRole('button', { name: /Lanjut checkout/ }).click()
      await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible()
    })

    await test.step('Verifikasi data checkout dan pembatasan tamu', async () => {
      await expect(page.getByText('Cara menerima pesanan')).toBeVisible()
      await expect(page.getByLabel('Metode pembayaran')).toBeVisible()
      await expect(page.getByText('Login pelanggan diperlukan')).toBeVisible()
      await expect(page.getByRole('link', { name: /Masuk sebagai pelanggan/ })).toHaveAttribute('href', '/login')
    })
  })
})

test.describe('Autentikasi', () => {
  test('AUTH-001 halaman login menampilkan empat pilihan role', async ({ page }) => {
    await page.goto('/login')

    await test.step('Verifikasi tab seluruh role tersedia', async () => {
      await expect(page.getByRole('button', { name: /^Pelanggan/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /^Cashier/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /^Manager/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /^Admin/ })).toBeVisible()
    })

    await test.step('Verifikasi field dan aksi login pelanggan', async () => {
      await expect(page.getByLabel('Email')).toBeEditable()
      await expect(page.getByLabel('Password')).toHaveAttribute('minlength', '8')
      await expect(page.getByRole('button', { name: /^Masuk/ })).toBeEnabled()
      await expect(page.getByRole('button', { name: 'Belum punya akun? Daftar sekarang' })).toBeVisible()
    })
  })

  test('AUTH-002 perubahan role mengubah informasi akun', async ({ page }) => {
    await page.goto('/login')

    await test.step('Pilih role Manager', async () => {
      await page.getByRole('button', { name: /^Manager/ }).click()
      await expect(page.getByRole('heading', { name: 'Masuk sebagai manager' })).toBeVisible()
      await expect(page.getByText('manager@franchise.local · manager123')).toBeVisible()
    })

    await test.step('Pilih role Cashier', async () => {
      await page.getByRole('button', { name: /^Cashier/ }).click()
      await expect(page.getByRole('heading', { name: 'Masuk sebagai cashier' })).toBeVisible()
      await expect(page.getByText('cashier@franchise.local · cashier123')).toBeVisible()
    })
  })

  test('AUTH-003 login manager ditolak dengan password salah', async ({ page }) => {
    await login(page, 'Manager', managerEmail, 'password-salah-999')

    await test.step('Verifikasi error tanpa membuat sesi', async () => {
      await expect(page).toHaveURL(/\/login$/)
      await expect(page.locator('.auth-error')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Masuk sebagai manager' })).toBeVisible()
      expect(await page.evaluate(() => localStorage.getItem('franchise-user-token'))).toBeNull()
    })
  })

  test('AUTH-004 login manager berhasil membuka dashboard', async ({ page }) => {
    await login(page, 'Manager', managerEmail, managerPassword)

    await test.step('Verifikasi redirect dan identitas dashboard', async () => {
      await expect(page).toHaveURL(/\/manager$/)
      await expect(page.getByText('MANAGER DASHBOARD')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Kelola produk' })).toBeVisible()
      await expect(page.locator('.manager-sidebar')).toBeVisible()
    })
  })
})

test.describe('Manager dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'Manager', managerEmail, managerPassword)
    await expect(page).toHaveURL(/\/manager$/)
  })

  test('MGR-001 navigasi manager mengikuti hak akses role', async ({ page }) => {
    const sidebar = page.locator('.manager-sidebar')

    await test.step('Verifikasi modul manager yang diizinkan tampil', async () => {
      for (const moduleName of ['Produk', 'Kategori', 'Promosi', 'Inventory', 'Report', 'Franchise']) {
        await expect(sidebar.getByRole('button', { name: moduleName })).toBeVisible()
      }
    })

    await test.step('Verifikasi modul RBAC khusus admin disembunyikan', async () => {
      await expect(sidebar.getByRole('button', { name: 'RBAC' })).toHaveCount(0)
    })

    await test.step('Buka modul Kategori dan verifikasi panel', async () => {
      await sidebar.getByRole('button', { name: 'Kategori' }).click()
      await expect(page.getByRole('heading', { name: 'Kelola kategori menu' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Kategori menu', exact: true })).toBeVisible()
    })
  })

  test('MGR-002 dashboard menampilkan ringkasan operasional', async ({ page }) => {
    await test.step('Verifikasi empat kartu ringkasan tersedia', async () => {
      const summary = page.locator('.manager-summary')
      await expect(summary.locator('article')).toHaveCount(4)
      for (const label of ['Master produk', 'Dijual di outlet', 'Promosi aktif', 'Akun cashier']) {
        const card = summary.locator('article').filter({ hasText: label })
        await expect(card).toBeVisible()
        await expect(card.locator('b')).toHaveText(/^\d+$/)
      }
    })

    await test.step('Verifikasi katalog produk berhasil dimuat', async () => {
      await expect(page.getByRole('heading', { name: 'Katalog menu' })).toBeVisible()
      await expect(page.locator('.manager-product').first()).toBeVisible()
      expect(await page.locator('.manager-product').count()).toBeGreaterThan(0)
    })
  })

  test('MGR-003 form tambah produk dan kategori dapat dibuka tanpa menyimpan', async ({ page }) => {
    await test.step('Buka dan validasi modal Tambah produk', async () => {
      await page.getByRole('button', { name: 'Tambah produk' }).click()
      const modal = page.locator('.product-editor-modal')
      await expect(modal.getByRole('heading', { name: 'Tambah produk' })).toBeVisible()
      await expect(modal.getByLabel('Nama produk')).toBeEditable()
      await expect(modal.getByLabel('Harga', { exact: true })).toHaveAttribute('type', 'number')
      await expect(modal.getByRole('button', { name: 'Simpan produk' })).toBeEnabled()
      await modal.getByRole('button', { name: 'Batal' }).click()
      await expect(modal).toHaveCount(0)
    })

    await test.step('Buka dan validasi modal Tambah kategori', async () => {
      await page.locator('.manager-sidebar').getByRole('button', { name: 'Kategori' }).click()
      await page.getByRole('button', { name: 'Tambah kategori' }).click()
      const modal = page.locator('.category-modal')
      await expect(modal.getByRole('heading', { name: 'Tambah kategori' })).toBeVisible()
      await expect(modal.getByLabel('Nama kategori')).toBeEditable()
      await expect(modal.getByLabel('Urutan tampil')).toHaveValue('100')
      await modal.getByRole('button', { name: 'Batal' }).click()
      await expect(modal).toHaveCount(0)
    })
  })
})

test.describe('Cashier station', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'Cashier', cashierEmail, cashierPassword)
    await expect(page).toHaveURL(/\/cashier$/)
  })

  test('CASH-001 cashier station menampilkan data operasional', async ({ page }) => {
    await test.step('Verifikasi identitas dan salam cashier', async () => {
      await expect(page.getByText('Cashier Station')).toBeVisible()
      await expect(page.getByText('LIVE ORDER')).toBeVisible()
      await expect(page.getByRole('heading', { name: /Halo,/ })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Perbarui' })).toBeEnabled()
    })

    await test.step('Verifikasi kartu statistik cashier', async () => {
      const stats = page.locator('.cashier-stats')
      await expect(stats.locator('article')).toHaveCount(4)
      await expect(stats).toContainText('Total pesanan')
      await expect(stats).toContainText('Perlu diproses')
      await expect(stats).toContainText('Pesanan selesai')
      await expect(stats).toContainText('Total penjualan')
    })
  })

  test('CASH-002 filter dan pencarian pesanan berfungsi', async ({ page }) => {
    await test.step('Verifikasi seluruh tombol filter tersedia', async () => {
      const filters = page.locator('.cashier-filters')
      for (const label of ['Aktif', 'Baru', 'Dimasak', 'Siap', 'Semua']) {
        await expect(filters.getByRole('button', { name: new RegExp(`^${label}`) })).toBeVisible()
      }
    })

    await test.step('Pilih filter Semua dan cari data yang tidak ada', async () => {
      await page.locator('.cashier-filters').getByRole('button', { name: 'Semua' }).click()
      await page.getByPlaceholder('Cari ID atau pelanggan...').fill('E2E-DATA-TIDAK-ADA-999')
    })

    await test.step('Verifikasi empty state hasil pencarian', async () => {
      await expect(page.getByRole('heading', { name: 'Tidak ada pesanan' })).toBeVisible()
      await expect(page.getByText('Pesanan yang sesuai filter akan muncul di sini.')).toBeVisible()
    })
  })
})

test.describe('API', () => {
  test('API-001 health check dan settings publik tersedia', async ({ page, request }) => {
    await test.step('Verifikasi endpoint health', async () => {
      const response = await request.get('/api/health')
      expect(response.status()).toBe(200)
      await expect(response.json()).resolves.toMatchObject({ ok: true })
    })

    await test.step('Verifikasi endpoint settings', async () => {
      const response = await request.get('/api/settings')
      expect(response.status()).toBe(200)
      expect(await response.json()).toEqual(expect.objectContaining({
        businessName: expect.any(String),
        shortName: expect.any(String),
      }))
    })

    await test.step('Tampilkan response health sebagai evidence', async () => {
      await page.goto('/api/health')
      await expect(page.locator('body')).toContainText('"ok":true')
    })
  })

  test('API-002 endpoint manager menolak request tanpa token', async ({ page, request }) => {
    await test.step('Panggil endpoint terproteksi tanpa Authorization header', async () => {
      const response = await request.get('/api/manager/products')
      expect(response.status()).toBe(401)
      expect(await response.text()).toMatch(/login|sesi|token|akses/i)
    })

    await test.step('Verifikasi response browser juga berstatus unauthorized', async () => {
      const response = await page.goto('/api/manager/products')
      expect(response?.status()).toBe(401)
      await expect(page.locator('body')).toContainText(/login|sesi|token|akses/i)
    })
  })
})
