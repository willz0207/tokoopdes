# Franchise Ordering Platform

Website pemesanan online berbasis React + TypeScript dengan backend Express dan database PostgreSQL. Saat development, frontend, API, dan database berjalan lokal tanpa Netlify. Project ini dibuat agar bisa dipakai untuk berbagai franchise makanan/minuman tanpa brand hardcode.

## Dibangun bersama Codex & GPT-5.6

> **AI-assisted engineering:** Codex dan GPT-5.6 digunakan sebagai rekan pengembangan untuk membantu mengubah kebutuhan bisnis menjadi implementasi yang dapat dijalankan, diuji, dan didokumentasikan.

Penggunaannya mencakup:

- Menganalisis kebutuhan dan merancang alur pelanggan, Cashier, Manager, serta Admin.
- Membantu implementasi React/TypeScript, Express, PostgreSQL, RBAC, multi-outlet, pembayaran, inventory, report, dan aplikasi Android Capacitor.
- Menelusuri penyebab error pada frontend, API, database, port development, deployment, Android SDK, emulator, dan Gradle.
- Menjalankan build, pemeriksaan TypeScript, pengujian responsif, validasi endpoint, serta verifikasi APK Android.
- Menjaga FSD, TSD, dan User Guide tetap sinkron dalam format Markdown dan Word setiap kali fitur utama berubah.

Codex dan GPT-5.6 mempercepat proses engineering, sedangkan keputusan bisnis, credential, data produksi, validasi kebutuhan, dan persetujuan akhir tetap berada di tangan pengelola project.

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
- Aplikasi Android berbasis Capacitor dengan satu codebase React/TypeScript yang sama seperti versi web.

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
- `VITE_API_BASE_URL` untuk alamat backend yang diakses aplikasi Android.
- `MOBILE_ALLOWED_ORIGINS` untuk origin Capacitor tambahan yang diizinkan API.

Jika `MIDTRANS_SERVER_KEY` kosong, pembayaran QRIS/e-wallet/transfer bank memakai simulator lokal dan tidak memproses uang sungguhan. Untuk Midtrans, arahkan Payment Notification URL ke `https://domain-anda/api/payments/midtrans/notification`.

Schema PostgreSQL dikelola melalui migration `netlify/database/migrations/0001_initial_schema.sql`, `0002_multi_outlet_payments.sql`, dan `0003_outlet_products.sql`.

## Aplikasi Android

Versi Android berada di folder `android/` dan memakai hasil build Vite dari `dist/`. Atur alamat backend melalui `VITE_API_BASE_URL`. Emulator Android dapat memakai `http://10.0.2.2:3001`, sedangkan perangkat fisik harus memakai IP LAN komputer, misalnya `http://192.168.1.10:3001`. Untuk rilis publik, gunakan backend HTTPS.

```bash
npm run mobile:build
npm run mobile:open
```

Perintah `mobile:build` membangun web lalu menjalankan `cap sync android`. Perintah `mobile:open` membuka project native di Android Studio. Untuk mencoba membuat APK debug dari command line:

```bash
npm run mobile:apk
```

Android Studio dan Android SDK wajib terpasang untuk menjalankan emulator atau menghasilkan APK. Pembayaran online dan WhatsApp dibuka melalui browser perangkat, sedangkan status pesanan tetap dipantau dari aplikasi.

## Hosting publik opsional

Project masih menyediakan `netlify.toml` dan Netlify Function `netlify/functions/api.ts` sebagai opsi hosting. Build menggunakan `npm run build`, folder publik adalah `dist`, route `/api/*` diteruskan ke Express Function, dan route aplikasi memakai fallback `index.html`.

Jika ingin memakai hosting publik, gunakan database PostgreSQL online yang bisa diakses oleh server hosting, lalu isi `DATABASE_URL`/`POSTGRES_URL` pada environment hosting. Database lokal di laptop tidak dapat dipakai oleh Netlify saat laptop mati atau tidak bisa diakses dari internet.

Isi `APP_JWT_SECRET`, `APP_ADMIN_PASSWORD`, `APP_MANAGER_PASSWORD`, dan `APP_CASHIER_PASSWORD` sebagai environment variable rahasia sebelum penggunaan publik.

## Dokumen analisis

- FSD: `docs/FSD.md`
- TSD: `docs/TSD.md`
- User Guide: `docs/USER_GUIDE.md`

Setiap perubahan fitur/teknis berikutnya harus ikut memperbarui FSD, TSD, dan User Guide dalam format Markdown serta Word.
