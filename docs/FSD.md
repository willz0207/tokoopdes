# Functional Specification Document (FSD)

Project: Franchise Ordering Platform  
Tanggal update: 2026-07-05

## 1. Tujuan

Aplikasi ini menyediakan website pemesanan online yang dapat dikustom untuk berbagai franchise makanan/minuman. Tidak ada identitas brand yang wajib dikunci ke satu nama; manager dapat mengubah nama usaha, logo teks, warna, teks landing page, kontak, gambar hero, gambar tentang, dan prefix nomor pesanan.

## 2. Role pengguna

### Pelanggan

- Registrasi dan login.
- Melihat menu dan promosi aktif.
- Memilih add-on produk sebelum memasukkan produk ke keranjang.
- Menambahkan produk ke keranjang.
- Checkout pesanan.
- Melacak status pesanan dari halaman “Pesanan Saya”.

### Cashier

- Login dengan akun cashier.
- Melihat pesanan masuk.
- Mengubah status pesanan: baru, diproses, siap, diantar, selesai, atau dibatalkan.
- Melihat ringkasan order dan total penjualan.

### Manager

- Login dengan akun manager.
- Mengelola kategori menu: tambah, edit, urutkan, aktif/nonaktif, dan hapus/arsip.
- Mengelola produk: tambah, edit, aktif/nonaktif, hapus/arsip.
- Mengelola pilihan add-on, harga add-on, dan status add-on pada setiap produk.
- Upload foto produk.
- Mengelola promosi: tambah, edit, hapus.
- Mengakses stasiun cashier.
- Mengelola akun cashier: melihat daftar, menambah, mengedit identitas/password, mengaktifkan atau menonaktifkan, dan menghapus cashier.
- Mengelola inventory, batas minimum stok, dan pergerakan stok.
- Mengakses Report operasional dan keuangan, memfilter periode, serta mengekspor CSV.
- Mencatat dan menghapus biaya operasional, modal masuk, dan modal keluar.
- Mengelola pengaturan franchise.

### Admin

- Login menggunakan akun Admin.
- Secara default mengakses seluruh modul operasional: stasiun Cashier, kategori, produk, add-on, promosi, cashier, inventory, Report, dan pengaturan franchise.
- Mengelola RBAC (Role-Based Access Control) untuk menentukan modul apa saja yang boleh dibuka oleh role Cashier, Manager, dan Admin.
- Mengakses stasiun Cashier untuk memantau dan memproses pesanan.
- Memiliki menu profil dan dapat mengganti data akun/password.

## 3. Pengaturan franchise

Manager dapat mengubah:

- Nama usaha.
- Logo singkat.
- Tagline.
- Warna utama dan aksen.
- Nomor WhatsApp toko.
- Email kontak.
- Prefix nomor pesanan.
- Teks hero landing page.
- Estimasi delivery.
- Gambar hero.
- Teks menu.
- Teks tentang.
- Gambar tentang.
- Teks lokasi.
- Deskripsi footer.

Perubahan pengaturan langsung memengaruhi halaman toko, login, cashier, tracking, dan manager.

## 4. Modul utama

### Landing page toko

- Menampilkan brand aktif.
- Menampilkan hero, benefit, katalog menu, promo, tentang, lokasi, dan footer.
- Katalog mengambil produk aktif dari backend.
- Filter kategori menu mengambil kategori aktif dari backend dan otomatis mengikuti urutan yang diatur Manager.
- Jika backend belum aktif, frontend memakai katalog cadangan generik.

### Kategori menu

- Role yang diberi permission kategori dapat membuat kategori menu custom untuk franchise apa saja.
- Setiap kategori memiliki nama, emoji/icon, urutan tampil, dan status aktif.
- Kategori aktif tampil sebagai filter pada storefront.
- Kategori nonaktif tidak tampil di storefront dan produk pada kategori tersebut tidak ditampilkan di katalog publik.
- Jika kategori yang masih dipakai produk dihapus, sistem mengarsipkan/nonaktifkan kategori tersebut agar data produk tetap aman.
- Saat nama kategori diubah, produk yang memakai kategori tersebut ikut diperbarui otomatis.

### Keranjang dan checkout

- Pelanggan dapat mengubah jumlah item.
- Produk dengan add-on menampilkan pilihan tambahan sebelum masuk keranjang.
- Harga add-on dihitung ke harga satuan, subtotal, dan total pesanan.
- Nama dan harga add-on disimpan sebagai snapshot pada detail pesanan.
- Ongkir otomatis gratis jika subtotal minimal Rp75.000.
- Checkout wajib login sebagai pelanggan.
- Pesanan tersimpan di database.
- Jika nomor WhatsApp toko tersedia, aplikasi membuka WhatsApp dengan pesan konfirmasi.

### Tracking pesanan

- Pelanggan melihat pesanan aktif dan riwayat.
- Status diperbarui otomatis setiap 15 detik.

### Cashier

- Cashier, Manager, dan Admin dapat memproses pesanan.
- Dashboard menampilkan filter order aktif, baru, diproses, siap, dan semua.
- Detail pesanan menampilkan add-on yang dipilih pelanggan.

### Inventory

- Manager dan Admin dapat membuat, mengedit, mengaktifkan/nonaktifkan, serta menghapus/mengarsipkan item inventory.
- Setiap item memiliki nama, SKU unik, satuan, stok saat ini, batas minimum, dan harga modal per satuan.
- Item dapat ditautkan ke produk beserta jumlah pemakaian per produk terjual.
- Checkout otomatis mengurangi stok item terkait dan membuat riwayat mutasi; pesanan ditolak jika stok tidak cukup.
- Pergerakan mencakup stok masuk, stok keluar, koreksi tambah, dan koreksi kurang.
- Sistem menolak pergerakan yang membuat stok menjadi negatif.
- Dashboard menampilkan jumlah item aktif, item dengan stok menipis, mutasi hari ini, dan riwayat mutasi.

### Report

- Manager dan Admin dapat memilih periode laporan serta melihat pembaruan data operasional setiap 30 detik.
- Laporan operasional mencakup ringkasan penjualan, transaksi harian, jumlah produk terjual, omzet bruto/bersih, diskon, produk terlaris, metode pembayaran, status/nilai stok, dan riwayat pembelian pelanggan.
- Checkout mendukung pembayaran tunai, QRIS, e-wallet, dan transfer bank serta penerapan kode promo aktif.
- Laporan keuangan mencakup laba rugi, arus kas, neraca sederhana, perubahan modal, rincian biaya, dan transaksi biaya/modal.
- Penjualan non-batal menjadi pendapatan otomatis. Biaya dan perubahan modal dicatat manual oleh Manager/Admin.
- Data laporan dapat diekspor ke CSV untuk rekonsiliasi dan pembukuan lanjutan.
- Neraca bersifat manajerial dasar dan belum mencakup utang, piutang, depresiasi, atau pajak.

### Manager

- Tab Produk untuk CRUD produk.
- Tab Kategori untuk CRUD kategori menu jika role memiliki permission kategori.
- Editor Produk untuk mengelola add-on produk.
- Tab Promosi untuk CRUD promosi.
- Tab Cashier untuk CRUD akun cashier, termasuk pengaturan status akses login.
- Tab Inventory untuk stok, batas minimum, dan stock movement.
- Tab Report untuk laporan operasional/keuangan, ekspor CSV, serta pencatatan biaya dan modal.
- Tab Franchise untuk pengaturan brand dan halaman publik.
- Tab RBAC khusus Admin untuk mengatur akses modul per role.

### RBAC Modul

- Admin dapat membuka tab **RBAC** pada dashboard Manager/Admin.
- RBAC menyimpan matrix akses role `cashier`, `manager`, dan `admin` terhadap modul: Stasiun Cashier, Kategori Menu, Produk & Add-on, Promosi, Akun Cashier, Inventory, Report, Franchise, dan RBAC.
- Menu dashboard hanya menampilkan tab yang diizinkan untuk role aktif.
- Backend juga memvalidasi permission modul pada setiap endpoint operasional agar akses tidak hanya dibatasi di UI.
- Permission **Admin - RBAC** wajib aktif agar Admin tidak terkunci dari pengaturan akses.
- Permission RBAC untuk Cashier/Manager dikunci nonaktif; pengaturan RBAC hanya dapat dikelola Admin.

### Hosting publik Render

- Aplikasi dapat dipublikasikan sebagai satu Web Service Node.js melalui Blueprint `render.yaml`.
- Render memberikan domain publik acak `*.onrender.com` tanpa halaman verifikasi pengunjung.
- Konfigurasi memilih paket gratis dan region Singapura, menjalankan health check `/api/health`, serta melakukan deploy otomatis dari branch `main`.
- Password Admin, Manager, dan Cashier diisi sebagai secret saat Blueprint dibuat dan tidak disimpan di repository.
- Hosting gratis ini ditujukan untuk demo. Database SQLite dan gambar Data URL berada pada filesystem sementara sehingga data dapat kembali ke seed awal setelah service sleep, restart, atau redeploy.

## 5. Aturan dokumen

Setiap perubahan fitur, alur bisnis, API, database, role, atau UI utama harus memperbarui:

- `docs/FSD.md`
- `docs/TSD.md`
- `docs/FSD.docx`
- `docs/TSD.docx`
- `docs/USER_GUIDE.md`
- `docs/USER_GUIDE.docx`

## 6. Riwayat perubahan

| Tanggal | Perubahan |
|---|---|
| 2026-07-06 | Menambahkan Blueprint Render untuk hosting publik gratis, domain `onrender.com`, secret credential saat deploy, health check, auto-deploy, serta batasan penyimpanan SQLite sementara. |
| 2026-07-05 | Menambahkan RBAC per modul untuk Admin, tabel permission role, tab RBAC, menu dashboard berbasis permission, dan validasi permission di backend. |
| 2026-07-05 | Menambahkan modul kategori menu custom berbasis database, endpoint kategori publik/manager, tab Kategori khusus Manager, validasi produk terhadap kategori database, dan sinkronisasi kategori ke storefront. |
| 2026-07-05 | Menambahkan modul Report operasional dan keuangan, pembayaran/promo checkout, ekspor CSV, transaksi biaya/modal, valuasi persediaan, dan pengurangan stok otomatis dari penjualan. |
| 2026-07-05 | Menambahkan User Guide sebagai dokumen wajib yang harus selalu diperbarui bersama FSD dan TSD. |
| 2026-07-05 | Menambahkan add-on produk end-to-end, role Admin dengan akses seluruh modul operasional, dan modul Inventory untuk item stok serta stock movement. |
| 2026-07-05 | Melengkapi modul Cashier pada role Manager menjadi CRUD penuh: tambah, lihat, edit, aktif/nonaktif, ubah password, dan hapus. |
| 2026-07-05 | Menambahkan penyempurnaan stabilitas agar setup database baru tetap dapat menjalankan modul manager dan promosi. |
| 2026-07-05 | Menambahkan modul manager untuk melihat daftar cashier dan membuat akun cashier baru. |
| 2026-07-05 | Dokumen FSD/TSD dibuat ulang dalam format Word yang lebih rapi untuk kebutuhan review dan arsip. |
| 2026-07-05 | Project digenerikkan untuk franchise apa saja, ditambah pengaturan franchise, upload gambar brand, dan dokumen FSD/TSD. |
| 2026-07-05 | Sisa teks/konfigurasi brand lama dibersihkan dari UI, README, env example, seed/default, dan key penyimpanan browser. |
