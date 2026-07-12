# Detailed Playwright Test Cases

## Informasi eksekusi

- Target: `http://127.0.0.1:5175`
- Browser: Chromium Desktop
- Runner: `@playwright/test`
- Evidence: screenshot penuh setelah setiap test, untuk status PASS maupun FAIL
- Data login Manager: `E2E_MANAGER_EMAIL` / `E2E_MANAGER_PASSWORD`, dengan fallback akun lokal
- Data login Cashier: `E2E_CASHIER_EMAIL` / `E2E_CASHIER_PASSWORD`, dengan fallback akun lokal
- Aturan data: test tidak membuat, mengubah, atau menghapus master data permanen

## Storefront

### STORE-001 — Menampilkan komponen utama storefront

- Prioritas: High
- Tipe: Smoke, UI
- Prasyarat: Frontend dan API aktif; katalog memiliki minimal satu produk
- Langkah dan expected result:
  1. Buka `/`; halaman utama tampil tanpa redirect.
  2. Periksa navigasi utama; link Menu dan Promo terlihat.
  3. Periksa aksi pengguna; link Masuk mengarah ke `/login` dan keranjang berjumlah 0.
  4. Periksa kategori; tab Semua aktif secara default.
  5. Periksa katalog; minimal satu kartu produk terlihat.

### STORE-002 — Filter kategori produk

- Prioritas: High
- Tipe: Functional, UI
- Prasyarat: Tersedia kategori aktif selain Semua dan minimal satu produk pada kategori tersebut
- Langkah dan expected result:
  1. Buka `/`; seluruh produk aktif tampil.
  2. Pilih kategori pertama selain Semua; tab terpilih memiliki `aria-selected=true`.
  3. Periksa kategori pada semua kartu yang tampil; seluruhnya sama dengan kategori terpilih.

### STORE-003 — Pencarian nama menu

- Prioritas: High
- Tipe: Functional, UI
- Prasyarat: Katalog memiliki minimal satu produk
- Data uji: Nama lengkap produk pertama yang tampil
- Langkah dan expected result:
  1. Buka `/` dan ambil nama produk pertama.
  2. Isi kolom pencarian dengan nama tersebut.
  3. Periksa hasil; hanya satu produk dengan nama yang sama tampil.

### STORE-004 — Pencarian tanpa hasil

- Prioritas: Medium
- Tipe: Negative, UI
- Data uji: `produk-tidak-ada-e2e-999`
- Langkah dan expected result:
  1. Buka `/` dan isi pencarian dengan data uji.
  2. Periksa daftar produk; tidak ada kartu produk.
  3. Periksa empty state; judul “Menu belum ditemukan” dan saran pencarian tampil.

### STORE-005 — Menambah produk ke keranjang

- Prioritas: Critical
- Tipe: Functional, UI
- Prasyarat: Katalog memiliki minimal satu produk aktif
- Langkah dan expected result:
  1. Buka `/` dan klik Tambah pada produk pertama.
  2. Jika modal add-on muncul, lanjutkan tanpa add-on.
  3. Periksa counter keranjang; berubah menjadi 1 item.
  4. Buka keranjang; satu baris item, subtotal, dan tombol Lanjut checkout tampil.

### STORE-006 — Mengubah jumlah produk

- Prioritas: High
- Tipe: Functional, UI
- Prasyarat: Keranjang berisi satu produk
- Langkah dan expected result:
  1. Buka keranjang; quantity awal bernilai 1.
  2. Klik tambah quantity; quantity dan counter keranjang berubah menjadi 2.
  3. Klik kurang quantity; quantity dan counter kembali menjadi 1.

### STORE-007 — Pembatasan checkout untuk tamu

- Prioritas: Critical
- Tipe: Security, Functional
- Prasyarat: Pengguna belum login dan keranjang berisi produk
- Langkah dan expected result:
  1. Dari keranjang klik Lanjut checkout; form Checkout tampil.
  2. Periksa metode penerimaan dan pembayaran; input tersedia.
  3. Periksa pembatasan; pesan login pelanggan tampil.
  4. Periksa CTA; link Masuk sebagai pelanggan mengarah ke `/login`.

## Autentikasi

### AUTH-001 — Komponen halaman login

- Prioritas: Critical
- Tipe: Smoke, UI
- Langkah dan expected result:
  1. Buka `/login`; form login tampil.
  2. Periksa pilihan role; Pelanggan, Cashier, Manager, dan Admin tersedia.
  3. Periksa field; Email editable dan Password memiliki minimal delapan karakter.
  4. Periksa aksi pelanggan; tombol Daftar sekarang tersedia.

### AUTH-002 — Perubahan role login

- Prioritas: Medium
- Tipe: Functional, UI
- Langkah dan expected result:
  1. Pilih Manager; heading dan petunjuk akun Manager tampil.
  2. Pilih Cashier; heading dan petunjuk akun Cashier menggantikan informasi Manager.

### AUTH-003 — Login manager dengan password salah

- Prioritas: Critical
- Tipe: Negative, Security
- Data uji: Email Manager valid dan password `password-salah-999`
- Langkah dan expected result:
  1. Buka `/login` dan pilih Manager.
  2. Isi kredensial dengan password salah lalu klik Masuk.
  3. Periksa hasil; tetap di `/login` dan pesan error tampil.
  4. Periksa storage; token sesi tidak dibuat.

### AUTH-004 — Login manager berhasil

- Prioritas: Critical
- Tipe: Positive, Integration
- Prasyarat: Akun Manager aktif dan database tersedia
- Langkah dan expected result:
  1. Buka `/login`, pilih Manager, dan isi kredensial valid.
  2. Klik Masuk; browser diarahkan ke `/manager`.
  3. Periksa dashboard; label MANAGER DASHBOARD, heading Kelola produk, dan sidebar tampil.

## Manager dashboard

### MGR-001 — Navigasi berdasarkan hak akses Manager

- Prioritas: Critical
- Tipe: RBAC, UI
- Prasyarat: Login sebagai Manager
- Langkah dan expected result:
  1. Periksa sidebar; Produk, Kategori, Promosi, Inventory, Report, dan Franchise tampil.
  2. Periksa RBAC; modul ini tidak tampil untuk role Manager.
  3. Klik Kategori; heading Kelola kategori menu dan panel Kategori menu tampil.

### MGR-002 — Ringkasan operasional dashboard

- Prioritas: High
- Tipe: Functional, Integration
- Prasyarat: Login sebagai Manager dan API dashboard berhasil dimuat
- Langkah dan expected result:
  1. Periksa ringkasan; terdapat empat kartu statistik.
  2. Periksa Total produk, Produk aktif, Promosi aktif, dan Akun cashier; masing-masing memiliki nilai numerik.
  3. Periksa panel produk; heading Katalog menu dan minimal satu produk tampil.

### MGR-003 — Validasi modal tambah produk dan kategori

- Prioritas: High
- Tipe: UI, Form validation
- Prasyarat: Login sebagai Manager dengan akses Produk dan Kategori
- Langkah dan expected result:
  1. Klik Tambah produk; modal dan field Nama produk, Harga, serta Simpan produk tampil.
  2. Klik Batal; modal tertutup tanpa menyimpan data.
  3. Buka modul Kategori dan klik Tambah kategori.
  4. Periksa field Nama kategori dan default Urutan tampil 100.
  5. Klik Batal; modal tertutup tanpa menyimpan data.

## Cashier station

### CASH-001 — Data operasional cashier

- Prioritas: Critical
- Tipe: Smoke, Integration
- Prasyarat: Akun Cashier aktif dan database tersedia
- Langkah dan expected result:
  1. Login sebagai Cashier; browser diarahkan ke `/cashier`.
  2. Periksa identitas; Cashier Station, LIVE ORDER, salam, dan tombol Perbarui tampil.
  3. Periksa statistik; empat kartu Total pesanan, Perlu diproses, Pesanan selesai, dan Total penjualan tampil.

### CASH-002 — Filter dan pencarian pesanan

- Prioritas: High
- Tipe: Functional, UI
- Prasyarat: Login sebagai Cashier
- Data uji: `E2E-DATA-TIDAK-ADA-999`
- Langkah dan expected result:
  1. Periksa filter; Aktif, Baru, Dimasak, Siap, dan Semua tersedia.
  2. Pilih Semua lalu cari data uji.
  3. Periksa hasil; empty state “Tidak ada pesanan” tampil.

## API

### API-001 — Health check dan settings publik

- Prioritas: Critical
- Tipe: API, Integration
- Prasyarat: API dan database tersedia
- Langkah dan expected result:
  1. GET `/api/health`; status 200 dan body mengandung `ok: true`.
  2. GET `/api/settings`; status 200 serta `businessName` dan `shortName` berupa string.
  3. Buka response health di browser; JSON terlihat sebagai evidence.

### API-002 — Proteksi endpoint Manager

- Prioritas: Critical
- Tipe: API, Negative, Security
- Prasyarat: Request tidak memiliki Authorization header
- Langkah dan expected result:
  1. GET `/api/manager/products` tanpa token.
  2. Periksa response; status 401 dan pesan menjelaskan login, sesi, token, atau akses.
  3. Buka endpoint yang sama di browser; response tetap 401.
