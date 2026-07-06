# Franchise Ordering Platform

Website pemesanan online berbasis React + TypeScript dengan backend Express pada Netlify Functions dan database PostgreSQL persisten. Project ini dibuat agar bisa dipakai untuk berbagai franchise makanan/minuman tanpa brand hardcode.

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

Website dan API lokal berjalan pada `http://localhost:5175`. Plugin Vite Netlify menjalankan emulasi Functions dan PostgreSQL lokal secara otomatis.

## Konfigurasi

Salin `.env.example` menjadi `.env`, lalu ganti nilai rahasia sebelum publikasi.

- `APP_ADMIN_PASSWORD`
- `APP_JWT_SECRET`
- `APP_CASHIER_EMAIL`
- `APP_CASHIER_PASSWORD`
- `APP_MANAGER_EMAIL`
- `APP_MANAGER_PASSWORD`
- `VITE_WHATSAPP_NUMBER`
- `NETLIFY_DB_URL` dikelola otomatis oleh Netlify Database; jangan simpan connection string di Git.

Schema PostgreSQL dikelola melalui migration `netlify/database/migrations/0001_initial_schema.sql`.

## Deploy ke Netlify

Project menyediakan `netlify.toml`, Netlify Function `netlify/functions/api.ts`, serta Netlify Database. Build menggunakan `npm run build`, folder publik adalah `dist`, route `/api/*` diteruskan ke Express Function, dan route aplikasi memakai fallback `index.html`.

Setelah repository dihubungkan, Netlify memprovisikan PostgreSQL dan menerapkan migration secara otomatis. Isi `APP_JWT_SECRET`, `APP_ADMIN_PASSWORD`, `APP_MANAGER_PASSWORD`, dan `APP_CASHIER_PASSWORD` sebagai environment variable rahasia sebelum penggunaan publik.

Paket Free Netlify memiliki batas 300 kredit per bulan. Jika batas habis, project berhenti sementara sampai periode berikutnya. Data bisnis tetap disimpan di PostgreSQL, bukan filesystem Function yang sementara.

## Dokumen analisis

- FSD: `docs/FSD.md`
- TSD: `docs/TSD.md`
- User Guide: `docs/USER_GUIDE.md`

Setiap perubahan fitur/teknis berikutnya harus ikut memperbarui FSD, TSD, dan User Guide dalam format Markdown serta Word.
