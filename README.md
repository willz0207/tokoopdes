# Franchise Ordering Platform

Website pemesanan online berbasis React + TypeScript dengan backend Express dan database PostgreSQL. Saat development, frontend, API, dan database berjalan lokal tanpa Netlify. Project ini dibuat agar bisa dipakai untuk berbagai franchise makanan/minuman tanpa brand hardcode.

## Fitur utama

- Landing page toko yang bisa dikustom oleh manager.
- Login pelanggan, cashier, dan manager.
- Keranjang, checkout, dan pelacakan pesanan pelanggan.
- Dashboard cashier untuk memproses pesanan.
- Dashboard manager/admin untuk CRUD produk/add-on, promosi, cashier, inventory, dan pengaturan franchise.
- Kategori menu custom berbasis database yang dapat ditambah, diurutkan, dinonaktifkan, atau diarsipkan oleh Manager.
- Report operasional dan keuangan: penjualan, produk terlaris, pembayaran, stok, pelanggan, laba rugi, arus kas, neraca, serta perubahan modal.
- Pembayaran multi-metode, kode promo, ekspor CSV, dan pengurangan inventory otomatis dari produk terjual.
- Upload foto produk, gambar hero, dan gambar bagian tentang.
- Multi-outlet: CRUD cabang, penempatan cashier, assignment produk, harga/ketersediaan per outlet, serta pemisahan pesanan, stok, transaksi keuangan, dan laporan.
- Pembayaran online Midtrans Snap dengan webhook tervalidasi serta simulator lokal ketika API key belum tersedia.

## Akun lokal bawaan

- Manager: `manager@franchise.local` / `manager123`
- Cashier: `cashier@franchise.local` / `cashier123`
- Admin: `admin@franchise.local` / `admin123`
- Admin legacy: `admin123`

## Menjalankan project

```bash
npm install
npm run dev
```

Website lokal berjalan pada `http://localhost:5175`, sedangkan API lokal berjalan pada `http://localhost:3001` dan diproxy otomatis oleh Vite dari route `/api`.

Database development memakai PostgreSQL lokal dari `DATABASE_URL`. Default jika `.env` belum diisi adalah:

```env
DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres
```

Jika PostgreSQL lokal memakai password, buat file `.env` dari `.env.example`, lalu isi:

```env
DATABASE_URL=postgres://postgres:password_anda@127.0.0.1:5432/postgres
```

Pastikan service PostgreSQL di komputer menyala sebelum memakai fitur yang membaca/menulis data.

## Konfigurasi

Salin `.env.example` menjadi `.env`, lalu ganti nilai rahasia sebelum publikasi.

- `APP_ADMIN_PASSWORD`
- `APP_JWT_SECRET`
- `APP_CASHIER_EMAIL`
- `APP_CASHIER_PASSWORD`
- `APP_MANAGER_EMAIL`
- `APP_MANAGER_PASSWORD`
- `VITE_WHATSAPP_NUMBER`
- `DATABASE_URL` untuk PostgreSQL lokal/mandiri.
- `MIDTRANS_SERVER_KEY` dan `MIDTRANS_CLIENT_KEY` untuk pembayaran Midtrans.
- `MIDTRANS_IS_PRODUCTION=false` untuk sandbox atau `true` untuk production.
- `PUBLIC_APP_URL` untuk URL callback pembayaran.

Jika `MIDTRANS_SERVER_KEY` kosong, pembayaran QRIS/e-wallet/transfer bank memakai simulator lokal dan tidak memproses uang sungguhan. Untuk Midtrans, arahkan Payment Notification URL ke `https://domain-anda/api/payments/midtrans/notification`.

Schema PostgreSQL dikelola melalui migration `netlify/database/migrations/0001_initial_schema.sql`, `0002_multi_outlet_payments.sql`, dan `0003_outlet_products.sql`.

## Hosting publik opsional

Project masih menyediakan `netlify.toml` dan Netlify Function `netlify/functions/api.ts` sebagai opsi hosting. Build menggunakan `npm run build`, folder publik adalah `dist`, route `/api/*` diteruskan ke Express Function, dan route aplikasi memakai fallback `index.html`.

Jika ingin memakai hosting publik, gunakan database PostgreSQL online yang bisa diakses oleh server hosting, lalu isi `DATABASE_URL`/`POSTGRES_URL` pada environment hosting. Database lokal di laptop tidak dapat dipakai oleh Netlify saat laptop mati atau tidak bisa diakses dari internet.

Isi `APP_JWT_SECRET`, `APP_ADMIN_PASSWORD`, `APP_MANAGER_PASSWORD`, dan `APP_CASHIER_PASSWORD` sebagai environment variable rahasia sebelum penggunaan publik.

## Dokumen analisis

- FSD: `docs/FSD.md`
- TSD: `docs/TSD.md`
- User Guide: `docs/USER_GUIDE.md`

Setiap perubahan fitur/teknis berikutnya harus ikut memperbarui FSD, TSD, dan User Guide dalam format Markdown serta Word.
