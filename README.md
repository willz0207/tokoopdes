# Franchise Ordering Platform

Website pemesanan online berbasis React + TypeScript dengan backend Express + SQLite. Project ini dibuat agar bisa dipakai untuk berbagai franchise makanan/minuman tanpa brand hardcode.

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

Frontend berjalan di `http://localhost:5175` dan backend di `http://localhost:3001`.

## Konfigurasi

Salin `.env.example` menjadi `.env`, lalu ganti nilai rahasia sebelum publikasi.

- `APP_ADMIN_PASSWORD`
- `APP_JWT_SECRET`
- `APP_CASHIER_EMAIL`
- `APP_CASHIER_PASSWORD`
- `APP_MANAGER_EMAIL`
- `APP_MANAGER_PASSWORD`
- `VITE_WHATSAPP_NUMBER`
- `DATABASE_PATH` opsional

Database default tersimpan di `data/franchise.db`.

## Dokumen analisis

- FSD: `docs/FSD.md`
- TSD: `docs/TSD.md`
- User Guide: `docs/USER_GUIDE.md`

Setiap perubahan fitur/teknis berikutnya harus ikut memperbarui FSD, TSD, dan User Guide dalam format Markdown serta Word.
