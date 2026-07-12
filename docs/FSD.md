# Functional Specification Document (FSD)

Project: Franchise Ordering Platform  
Tanggal update: 2026-07-12

## 1. Tujuan

Aplikasi ini dirancang sebagai platform pemesanan online yang dapat dipakai oleh berbagai franchise makanan dan minuman. Identitas toko tidak dikunci pada satu brand. Manager dapat menyesuaikan nama usaha, logo teks, warna, konten landing page, informasi kontak, gambar, hingga prefix nomor pesanan tanpa perlu mengubah kode aplikasi.

## 2. Role pengguna

Setiap role memiliki ruang kerja dan tanggung jawab yang berbeda agar proses pemesanan, pelayanan, dan pengelolaan toko tetap teratur.

### Pelanggan

- Pelanggan dapat membuat akun atau masuk menggunakan akun yang sudah dimiliki.
- Pelanggan dapat melihat menu dan promosi yang sedang aktif.
- Sebelum produk dimasukkan ke keranjang, pelanggan dapat memilih add-on yang tersedia.
- Pelanggan dapat mengatur isi keranjang dan menyelesaikan checkout.
- Pelanggan memilih outlet aktif sebelum memesan sehingga pesanan dan stok tercatat pada cabang yang benar.
- Pembayaran QRIS, e-wallet, atau transfer bank diproses secara online melalui Midtrans; simulator lokal tersedia saat API key belum dikonfigurasi.
- Status pesanan dapat dipantau melalui halaman **Pesanan Saya**.

### Cashier

- Cashier masuk menggunakan akun yang dibuat oleh Manager atau Admin.
- Pesanan yang baru masuk dapat dilihat dan diproses dari stasiun Cashier.
- Cashier dapat mengubah status pesanan menjadi baru, diproses, siap, diantar, selesai, atau dibatalkan.
- Ringkasan order dan total penjualan tersedia untuk membantu pemantauan operasional.
- Cashier hanya melihat pesanan dari outlet tempat akunnya ditugaskan.

### Manager

- Manager masuk melalui dashboard khusus di `/manager`.
- Kategori menu dapat ditambah, diubah, diurutkan, diaktifkan, dinonaktifkan, atau diarsipkan.
- Produk beserta foto, harga, status, dan pilihan add-on dapat dikelola dari satu dashboard.
- Manager dapat membuat, mengubah, dan menghapus promosi.
- Mengakses stasiun cashier.
- Mengelola akun cashier: melihat daftar, menambah, mengedit identitas/password, mengaktifkan atau menonaktifkan, dan menghapus cashier.
- Mengelola outlet, menentukan outlet utama, dan berpindah konteks cabang dari dashboard.
- Mengelola inventory, batas minimum stok, dan pergerakan stok.
- Mengakses Report operasional dan keuangan, memfilter periode, serta mengekspor CSV.
- Mencatat dan menghapus biaya operasional, modal masuk, dan modal keluar.
- Mengelola pengaturan franchise.

### Admin

- Admin masuk melalui dashboard khusus di `/admin`, sedangkan `/manager` tetap menjadi halaman Manager.
- Jika URL yang dibuka tidak sesuai dengan role aktif, aplikasi akan mengarahkan pengguna ke dashboard yang benar secara otomatis.
- Secara default, Admin dapat membuka seluruh modul operasional, termasuk stasiun Cashier, kategori, produk, add-on, promosi, akun cashier, inventory, Report, Outlet, pengaturan franchise, dan RBAC.
- Melalui RBAC (Role-Based Access Control), Admin menentukan modul yang boleh digunakan oleh Cashier, Manager, dan Admin.
- Admin juga dapat memantau pesanan dari stasiun Cashier serta memperbarui profil dan password akun sendiri.

## 3. Pengaturan franchise

Identitas dan tampilan toko dapat disesuaikan oleh Manager melalui pengaturan franchise, meliputi:

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

Setelah disimpan, perubahan tersebut langsung diterapkan pada halaman toko, login, Cashier, pelacakan pesanan, dan dashboard Manager/Admin.

## 4. Modul utama

### Landing page toko

- Menampilkan brand aktif.
- Menampilkan hero, benefit, katalog menu, promo, tentang, lokasi, dan footer.
- Katalog mengambil produk yang aktif, ditugaskan, dan tersedia pada outlet yang sedang dipilih pelanggan.
- Filter kategori menu mengambil kategori aktif dari backend dan otomatis mengikuti urutan yang diatur Manager.
- Jika backend belum aktif, frontend memakai katalog cadangan generik.

### Kategori menu

- Role yang diberi permission kategori dapat membuat kategori menu custom untuk franchise apa saja.
- Setiap kategori memiliki nama, emoji/icon, urutan tampil, dan status aktif.
- Dashboard menampilkan kategori dalam kartu yang ringan dan responsif. Setiap kartu memperlihatkan ikon, urutan, jumlah produk terkait, serta status visibilitas dengan jelas.
- Area tindakan memakai permukaan berwarna lembut, toggle status, dan tombol edit/hapus yang tetap mudah dikenali tanpa membuat kartu terasa berat.
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
- Pelanggan wajib memilih outlet aktif. Mengganti outlet akan mengosongkan keranjang agar validasi stok tidak tercampur antar cabang.
- Checkout memvalidasi status master produk, kategori menu, assignment outlet, status konfigurasi outlet, dan ketersediaan produk. Transaksi ditolak jika salah satu syarat tersebut tidak terpenuhi.
- Harga checkout memakai harga khusus outlet jika diisi; jika tidak, sistem memakai harga master produk.
- Pesanan tersimpan di database.
- Pembayaran tunai dicatat sebagai belum dibayar, sedangkan QRIS, e-wallet, dan transfer bank membuat sesi pembayaran online.
- Jika `MIDTRANS_SERVER_KEY` belum diisi, aplikasi membuka simulator lokal agar alur berhasil/gagal tetap dapat diuji tanpa transaksi sungguhan.
- Pesanan online baru dapat diproses oleh Cashier setelah status pembayaran menjadi `paid`. Pembayaran gagal atau kedaluwarsa membatalkan pesanan dan mengembalikan stok secara otomatis.
- Jika nomor WhatsApp toko tersedia, aplikasi membuka WhatsApp dengan pesan konfirmasi.

### Tracking pesanan

- Pelanggan melihat pesanan aktif dan riwayat.
- Status diperbarui otomatis setiap 15 detik.

### Cashier

- Cashier, Manager, dan Admin dapat memproses pesanan.
- Dashboard menampilkan filter order aktif, baru, diproses, siap, dan semua.
- Detail pesanan menampilkan add-on yang dipilih pelanggan.
- Data pesanan dan ringkasan penjualan difilter berdasarkan outlet aktif. Cashier terkunci pada outlet penempatannya, sedangkan Manager/Admin dapat berpindah outlet.

### Multi-outlet

- Manager dan Admin dapat menambah, mengubah, mengaktifkan, mengarsipkan, serta memilih outlet utama.
- Setiap outlet memiliki kode unik, nama, alamat, nomor telepon, status aktif, dan penanda outlet utama.
- Pesanan, penempatan cashier, inventory, mutasi stok, transaksi keuangan, dan laporan dipisahkan berdasarkan outlet.
- Kategori, master produk, add-on, promosi, serta identitas franchise digunakan bersama oleh seluruh outlet.
- Manager/Admin menentukan produk mana yang dijual pada setiap outlet. Setiap assignment dapat memiliki status aktif, status tersedia, dan harga khusus outlet tanpa menduplikasi master produk.
- Outlet baru otomatis menerima assignment seluruh produk yang sudah ada agar katalog tidak kosong; assignment tersebut dapat diubah dari tab Produk.
- Outlet utama tidak dapat dihapus atau dinonaktifkan. Outlet yang sudah memiliki transaksi akan diarsipkan agar histori tetap utuh.

### Pembayaran online

- Integrasi utama menggunakan Midtrans Snap dengan mode sandbox atau production melalui environment variable.
- Backend membuat token dan URL pembayaran; Server Key tidak pernah dikirim ke frontend.
- Webhook Midtrans memverifikasi `signature_key` dan nominal transaksi sebelum memperbarui status pembayaran.
- Status yang didukung adalah `unpaid`, `pending`, `paid`, `failed`, `expired`, dan `refunded`. Sesi pembayaran online Midtrans diatur kedaluwarsa otomatis dalam 15 menit agar stok barang segera dilepaskan kembali jika tidak dibayar.
- Halaman `/payment-simulator` hanya digunakan pada development lokal ketika Server Key Midtrans belum tersedia.

### Inventory

- Manager dan Admin dapat membuat, mengedit, mengaktifkan/nonaktifkan, serta menghapus/mengarsipkan item inventory.
- Setiap item memiliki nama, SKU unik, satuan, stok saat ini, batas minimum, dan harga modal per satuan.
- SKU bersifat unik di dalam satu outlet, sehingga cabang berbeda dapat memakai kode SKU yang sama.
- Item dapat ditautkan ke produk beserta jumlah pemakaian per produk terjual.
- Checkout otomatis mengurangi stok item terkait dan membuat riwayat mutasi; pesanan ditolak jika stok tidak cukup.
- Pembatalan pesanan (status berubah menjadi `cancelled`) secara otomatis mengembalikan (refund) stok item terkait ke inventory dan mencatat mutasi masuk (`in`). Pemulihan pesanan dari batal ke aktif akan memotong stok kembali (gagal jika stok kurang).
- Pergerakan mencakup stok masuk, stok keluar, koreksi tambah, dan koreksi kurang.
- Sistem menolak pergerakan yang membuat stok menjadi negatif.
- Dashboard menampilkan jumlah item aktif, item dengan stok menipis, mutasi hari ini, dan riwayat mutasi.

### Report

- Manager dan Admin dapat memilih periode laporan serta melihat pembaruan data operasional setiap 30 detik.
- Laporan operasional mencakup ringkasan penjualan, transaksi harian, jumlah produk terjual, omzet bruto/bersih, diskon, produk terlaris, metode pembayaran, status/nilai stok, dan riwayat pembelian pelanggan.
- Checkout mendukung pembayaran tunai, QRIS, e-wallet, dan transfer bank serta penerapan kode promo aktif.
- Laporan keuangan mencakup laba rugi (menampilkan Pendapatan, HPP/COGS otomatis berdasarkan resep/modal bahan, Laba Kotor, Biaya operasional manual, dan Laba Bersih), arus kas, neraca sederhana, perubahan modal, rincian biaya, dan transaksi biaya/modal.
- Penjualan tunai non-batal dan pembayaran online berstatus `paid` menjadi pendapatan otomatis serta menghitung Harga Pokok Penjualan (HPP). Biaya operasional non-bahan baku dan perubahan modal dicatat manual oleh Manager/Admin.
- Data laporan dapat diekspor ke CSV untuk rekonsiliasi dan pembukuan lanjutan.
- Neraca bersifat manajerial dasar dan belum mencakup utang, piutang, depresiasi, atau pajak.

### Keamanan sistem

Sistem menerapkan proteksi tambahan untuk menjamin keamanan operasional franchise:

- **Verifikasi Kekuatan Kata Sandi**: Pengguna (pelanggan maupun kasir yang didaftarkan manager) wajib menggunakan kata sandi dengan panjang minimal 8 karakter yang mengandung huruf besar, huruf kecil, angka, dan simbol khusus (seperti `@`, `$`, `!`, `%`, dll.).
- **Pembatasan Percobaan Login (Rate Limiting)**: Setiap IP dibatasi maksimal melakukan 5 kali request login atau registrasi dalam jangka waktu 15 menit. Jika melanggar, server akan mengembalikan pesan penolakan percobaan login (HTTP 429).
- **Kebijakan Keamanan Konten (CSP)**: Mengaktifkan Content Security Policy (CSP) pada browser melalui middleware keamanan Helmet untuk mencegah eksekusi skrip luar yang tidak sah, dengan tetap mengizinkan fungsi pembayaran online Midtrans Snap.

### Manager

- Seluruh modul dashboard Manager/Admin memakai pola visual yang sama: panel terang, sudut membulat, jarak antarelemen yang lega, header dan area tindakan yang konsisten, serta state hover/focus yang jelas.
- Tampilan tetap nyaman dipakai pada desktop maupun layar ponsel. Navigasi berubah menjadi baris menu bawah dan kartu/tabel menyesuaikan lebar layar tanpa menimbulkan scroll horizontal halaman.
- Tab Produk untuk CRUD master produk dan assignment produk pada outlet aktif.
- Tab Kategori untuk CRUD kategori menu jika role memiliki permission kategori.
- Editor Produk untuk mengelola add-on produk.
- Tab Promosi untuk CRUD promosi.
- Tab Cashier untuk CRUD akun cashier, termasuk pengaturan status akses login.
- Daftar cashier memakai kartu responsif yang menampilkan avatar, nama, email, dan status akses login. Area tindakan menggunakan footer terang dengan tombol **Edit** dan **Hapus** yang mudah dikenali.
- Tab Inventory untuk stok, batas minimum, dan stock movement.
- Tab Report untuk laporan operasional/keuangan, ekspor CSV, serta pencatatan biaya dan modal.
- Tab Outlet untuk CRUD cabang dan memilih outlet aktif yang menjadi konteks Cashier, Inventory, serta Report.
- Tab Franchise untuk pengaturan brand dan halaman publik.
- Tab RBAC khusus Admin untuk mengatur akses modul per role.

### RBAC Modul

- Admin dapat membuka tab **RBAC** pada dashboard Manager/Admin.
- RBAC menyimpan matrix akses role `cashier`, `manager`, dan `admin` terhadap modul: Stasiun Cashier, Kategori Menu, Produk & Add-on, Promosi, Akun Cashier, Inventory, Report, Outlet, Franchise, dan RBAC.
- Menu dashboard hanya menampilkan tab yang diizinkan untuk role aktif.
- Backend juga memvalidasi permission modul pada setiap endpoint operasional agar akses tidak hanya dibatasi di UI.
- Permission **Admin - RBAC** wajib aktif agar Admin tidak terkunci dari pengaturan akses.
- Permission RBAC untuk Cashier/Manager dikunci nonaktif; pengaturan RBAC hanya dapat dikelola Admin.
- Tabel akses memakai baris yang lega, penanda aktif/nonaktif yang mudah dibaca, serta panel tindakan terang dan ringkas di bagian bawah. Panel tersebut memuat pengingat singkat, tombol **Reset tampilan**, dan tombol **Simpan RBAC** tanpa menutupi isi halaman.

### Mode development lokal

- Aplikasi dapat berjalan lokal tanpa Netlify.
- `npm run dev` menjalankan API Express lokal pada `http://localhost:3001` dan frontend Vite pada `http://localhost:5175`.
- Route frontend `/api/*` diproxy ke API lokal sehingga pengguna tetap membuka satu alamat utama: `http://localhost:5175`.
- Database development memakai PostgreSQL lokal dari `DATABASE_URL`, `POSTGRES_URL`, atau `LOCAL_DATABASE_URL`.
- Jika tidak ada connection string, backend memakai default `postgres://postgres@127.0.0.1:5432/postgres`.
- Migration awal tetap memakai file SQL project dan diterapkan otomatis saat database kosong.

### Hosting publik opsional

- Project masih dapat dibuild untuk hosting publik melalui Netlify Function atau host Node lain.
- Database lokal di komputer tidak dapat dipakai oleh website publik ketika komputer mati/offline atau tidak dapat diakses dari internet.
- Untuk website publik yang aktif 24 jam, hosting perlu memakai PostgreSQL online yang diisi melalui `DATABASE_URL` atau `POSTGRES_URL`.
- Password Admin, Manager, Cashier, dan JWT secret harus disimpan sebagai environment variable hosting dan tidak masuk repository.

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
| 2026-07-12 | Mengganti pemilih outlet bawaan browser dengan komponen dropdown kustom (OutletSelector) yang lebih interaktif dan premium di storefront, manager, dan cashier. |
| 2026-07-12 | Meningkatkan keamanan web: menambahkan in-memory rate limiter untuk login/register, menerapkan validasi kekuatan kata sandi (huruf besar/kecil, angka, simbol), dan mengonfigurasi Content Security Policy (CSP) pada Helmet. |
| 2026-07-12 | Mengoptimasi performa backend: meningkatkan pg pool size ke 20, mengatasi bottleneck kueri N+1 pada produk via bulk fetch addons, mengimplementasi cache matriks otorisasi role, menggabungkan kueri statistik dashboard dengan CTE, mempercepat cold-start migrasi via check `to_regclass`, serta menambahkan masa berlaku pembayaran Snap 15 menit. |
| 2026-07-12 | Menambahkan assignment produk per outlet, harga khusus, status aktif/tersedia per cabang, filter katalog outlet, dan validasi checkout berbasis `outlet_products`, sementara kategori dan master produk tetap global. |
| 2026-07-12 | Menyeragamkan tampilan seluruh modul Manager/Admin—Produk, Kategori, Promosi, Cashier, Inventory, Report, Outlet, Franchise, dan RBAC—dengan panel terang, area tindakan konsisten, serta layout responsif. |
| 2026-07-12 | Menambahkan multi-outlet untuk pesanan, cashier, inventory, transaksi keuangan, dan laporan; melengkapi dashboard dengan pemilih outlet serta modul CRUD cabang. |
| 2026-07-12 | Menambahkan pembayaran online Midtrans Snap, verifikasi webhook, status pembayaran, perlindungan proses pesanan sebelum lunas, dan simulator lokal tanpa API key. |
| 2026-07-12 | Menyegarkan tampilan RBAC dengan tabel yang lebih nyaman dibaca, switch yang lebih jelas, dan panel simpan terang yang ringkas serta responsif. |
| 2026-07-12 | Menyelaraskan tampilan kartu cashier dengan kartu kategori: avatar lembut, status akses informatif, footer terang, tombol aksi berlabel, serta efek hover. |
| 2026-07-12 | Menyegarkan tampilan kartu kategori dengan layout yang lebih ringan, status visibilitas informatif, footer lembut, tombol aksi interaktif, dan efek hover. |
| 2026-07-12 | Merapikan gaya bahasa FSD agar lebih natural dan mudah dibaca tanpa mengubah makna fungsional maupun istilah teknis. |
| 2026-07-12 | Memisahkan URL dashboard berdasarkan role: Admin memakai `/admin`, Manager memakai `/manager`, serta menambahkan pengalihan otomatis ke URL kanonis role. |
| 2026-07-10 | Mengubah mode development agar database berjalan lokal tanpa Netlify: API lokal port 3001, Vite port 5175 dengan proxy `/api`, PostgreSQL lokal melalui `DATABASE_URL`, dan dokumentasi lokal diperbarui. |
| 2026-07-06 | Deploy production Netlify aktif pada `https://tokokopdes.netlify.app`, Netlify Database diprovision, migration production diterapkan, dan backend dibuat kompatibel dengan deploy manual CLI melalui `NETLIFY_DB_URL`. |
| 2026-07-06 | Memigrasikan hosting ke Netlify Free, Express ke Netlify Functions, SQLite ke Netlify Database/PostgreSQL persisten, migration otomatis, routing SPA/API, dan emulator lokal Vite. |
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
