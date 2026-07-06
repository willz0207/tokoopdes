# User Guide

Project: Franchise Ordering Platform  
Tanggal update: 2026-07-06

## 1. Tujuan panduan

Panduan ini menjelaskan penggunaan aplikasi untuk Pelanggan, Cashier, Manager, dan Admin. Isi panduan harus diperbarui setiap kali fitur, alur, role, tampilan utama, atau cara pengoperasian aplikasi berubah.

## 2. Menjalankan aplikasi

1. Buka terminal di folder project.
2. Jalankan `npm run dev`.
3. Tunggu Vite dan emulasi Netlify berstatus aktif.
4. Buka `http://localhost:5175`.

Alamat halaman utama:

| Halaman | Alamat |
|---|---|
| Toko | `http://localhost:5175/` |
| Login | `http://localhost:5175/login` |
| Pesanan pelanggan | `http://localhost:5175/orders` |
| Stasiun Cashier | `http://localhost:5175/cashier` |
| Dashboard Manager/Admin | `http://localhost:5175/manager` |

### Akun lokal bawaan

| Role | Email | Password |
|---|---|---|
| Cashier | `cashier@franchise.local` | `cashier123` |
| Manager | `manager@franchise.local` | `manager123` |
| Admin | `admin@franchise.local` | `admin123` |

> Ganti seluruh password bawaan dan `APP_JWT_SECRET` sebelum aplikasi dipublikasikan.

## 3. Ringkasan hak akses

Hak akses operasional memakai RBAC. Tabel berikut adalah default awal; Admin dapat mengubah akses modul melalui tab **RBAC**.

| Modul | Pelanggan | Cashier | Manager | Admin |
|---|---:|---:|---:|---:|
| Toko dan katalog | Ya | Ya | Ya | Ya |
| Keranjang dan checkout | Ya | Tidak | Tidak | Tidak |
| Pesanan Saya | Ya | Tidak | Tidak | Tidak |
| Stasiun Cashier | Tidak | Ya | Ya | Ya |
| Kategori menu | Tidak | Tidak | Ya | Ya |
| Produk dan add-on | Tidak | Tidak | Ya | Ya |
| Promosi | Tidak | Tidak | Ya | Ya |
| Akun Cashier | Tidak | Tidak | Ya | Ya |
| Inventory | Tidak | Tidak | Ya | Ya |
| Report operasional & keuangan | Tidak | Tidak | Ya | Ya |
| Pengaturan franchise | Tidak | Tidak | Ya | Ya |
| RBAC modul | Tidak | Tidak | Tidak | Ya |

## 4. Panduan Pelanggan

### Registrasi dan login

1. Tekan tombol masuk pada halaman toko.
2. Pilih role **Pelanggan**.
3. Untuk akun baru, pilih **Daftar sekarang** dan isi nama, email, serta password minimal 8 karakter.
4. Untuk akun lama, isi email dan password lalu tekan **Masuk**.

### Memilih produk dan add-on

1. Cari produk melalui kategori atau kolom pencarian.
2. Tekan tombol tambah pada kartu produk.
3. Jika produk memiliki add-on, pilih satu atau beberapa tambahan yang diinginkan.
4. Periksa total harga per item, lalu tekan **Tambah ke keranjang**.
5. Produk yang sama dengan kombinasi add-on berbeda akan menjadi baris keranjang yang berbeda.

### Keranjang dan checkout

1. Buka ikon keranjang.
2. Gunakan tombol tambah, kurang, atau hapus untuk mengatur jumlah.
3. Periksa produk, add-on, harga satuan, dan subtotal.
4. Tekan **Lanjut checkout**.
5. Pilih metode **Diantar** atau **Ambil sendiri**.
6. Pilih pembayaran **Tunai**, **QRIS**, **E-wallet**, atau **Transfer bank**.
7. Pilih kode promo yang memenuhi minimum belanja jika tersedia.
8. Isi nama, nomor WhatsApp, alamat jika diperlukan, dan catatan opsional.
9. Tekan tombol pembuatan pesanan. Jika WhatsApp toko tersedia, aplikasi juga membuka pesan konfirmasi WhatsApp.

### Melacak pesanan

1. Buka menu profil lalu pilih **Pesanan saya**, atau buka `/orders`.
2. Gunakan tab **Aktif** untuk pesanan berjalan dan **Riwayat** untuk pesanan selesai/dibatalkan.
3. Pilih pesanan untuk melihat status, item, add-on, metode penerimaan, alamat, dan total.
4. Status diperbarui otomatis setiap 15 detik dan dapat diperbarui manual.

## 5. Panduan Cashier

### Masuk ke stasiun Cashier

1. Buka halaman login.
2. Pilih role **Cashier**.
3. Masukkan akun yang diberikan Manager/Admin.
4. Setelah login, aplikasi membuka `/cashier`.

### Memproses pesanan

1. Gunakan filter pesanan aktif, baru, diproses, siap, atau semua.
2. Gunakan pencarian untuk menemukan nomor pesanan, nama pelanggan, atau nomor telepon.
3. Buka **Detail** untuk melihat item, add-on, pelanggan, alamat, dan catatan.
4. Ubah status sesuai alur berikut:
   - Pesanan baru → Sedang dimasak.
   - Sedang dimasak → Siap.
   - Siap → Sedang diantar atau Selesai untuk pickup.
   - Sedang diantar → Selesai.
5. Gunakan status **Dibatalkan** hanya jika pesanan benar-benar dibatalkan.

## 6. Panduan Manager

Tab Manager yang tampil mengikuti permission RBAC yang diberikan Admin.

### Kategori menu

1. Login sebagai **Manager** lalu buka tab **Kategori**.
2. Tekan **Tambah kategori** untuk membuat filter menu baru.
3. Isi icon/emoji, nama kategori, urutan tampil, dan status aktif.
4. Gunakan angka urutan lebih kecil agar kategori tampil lebih awal di storefront.
5. Gunakan ikon edit untuk mengubah kategori, switch untuk aktif/nonaktif, dan ikon hapus untuk menghapus atau mengarsipkan.
6. Jika kategori masih dipakai produk, sistem akan menonaktifkan/mengarsipkan kategori agar produk lama tetap aman.
7. Jika nama kategori diubah, produk yang memakai kategori tersebut ikut diperbarui otomatis.

### Produk dan add-on

1. Login sebagai **Manager** lalu buka tab **Produk**.
2. Tekan **Tambah produk** untuk membuat menu baru.
3. Isi nama, deskripsi, harga, kategori, status, dan foto produk bila tersedia. Pastikan kategori sudah dibuat di tab **Kategori**.
4. Pada bagian **Pilihan add-on**, tekan **Tambah add-on**.
5. Isi nama add-on, harga tambahan, dan status aktif.
6. Tekan **Simpan produk**.
7. Gunakan ikon edit untuk mengubah produk/add-on, switch untuk aktif/nonaktif, dan ikon hapus untuk menghapus atau mengarsipkan produk.

### Promosi

1. Buka tab **Promosi**.
2. Tambah atau edit judul, deskripsi, kode, tipe diskon, nilai diskon, minimum belanja, periode, dan status.
3. Simpan perubahan atau hapus promosi yang tidak digunakan.

### Mengelola Cashier

1. Buka tab **Cashier**.
2. Tekan **Tambah cashier** untuk membuat akun baru.
3. Isi nama, email, dan password awal minimal 8 karakter.
4. Gunakan ikon edit untuk mengubah identitas, password, atau status login.
5. Gunakan ikon hapus untuk menghapus akun. Akun nonaktif atau terhapus tidak dapat menggunakan sesi lama.

### Inventory

1. Buka tab **Inventory**.
2. Tekan **Tambah item** dan isi nama item, SKU unik, satuan, stok awal, minimum stok, harga modal, serta status.
3. Jika stok harus berkurang saat penjualan, pilih **Produk terkait** dan isi **Pemakaian per produk terjual**. Satu produk dapat ditautkan ke beberapa bahan/item inventory.
4. Gunakan tombol tambah pada baris item untuk mencatat pergerakan stok manual.
5. Pilih tipe pergerakan:
   - **Stok masuk** untuk penerimaan barang.
   - **Stok keluar** untuk pemakaian atau pengeluaran barang.
   - **Koreksi tambah** untuk menambah stok hasil penyesuaian.
   - **Koreksi kurang** untuk mengurangi stok hasil penyesuaian.
6. Isi jumlah dan catatan, lalu simpan.
7. Buka **Riwayat mutasi** untuk melihat stok sebelum/sesudah, waktu, catatan, dan pembuat mutasi. Penjualan yang tertaut muncul dengan catatan **Otomatis dari pesanan ...**.
8. Item dengan stok sama dengan atau di bawah minimum ditandai **Stok menipis**. Pesanan produk tertaut ditolak jika stoknya tidak cukup.

### Report operasional dan keuangan

1. Buka tab **Report**. Default periode adalah tanggal 1 bulan berjalan sampai hari ini.
2. Gunakan **Dari** dan **Sampai**, lalu tekan **Perbarui**. Data juga diperbarui otomatis setiap 30 detik.
3. Pada tab **Operasional**, tinjau omzet, jumlah transaksi/produk, diskon, penjualan harian, produk terlaris, rekap pembayaran, status stok, dan pelanggan.
4. Pada tab **Keuangan**, tinjau laba rugi, arus kas, neraca, perubahan modal, serta biaya per kategori.
5. Tekan **Catat transaksi** untuk memasukkan biaya operasional, modal masuk, atau penarikan modal. Isi kategori, nominal, tanggal, metode pembayaran, dan catatan.
6. Gunakan ikon hapus pada transaksi manual jika terjadi salah input.
7. Tekan **Ekspor CSV** untuk mengunduh seluruh bagian laporan pada periode terpilih.

> Penjualan non-batal masuk otomatis sebagai pendapatan. Laporan ini merupakan pembukuan manajerial dasar; utang, piutang, depresiasi, dan pajak belum dihitung.

### Pengaturan franchise

1. Buka tab **Franchise**.
2. Ubah identitas brand, warna, kontak, prefix pesanan, konten halaman depan, dan gambar.
3. Tekan **Simpan pengaturan franchise**.
4. Periksa halaman toko setelah perubahan disimpan.

## 7. Panduan Admin

1. Pilih role **Admin** pada halaman login.
2. Setelah login, Admin diarahkan ke dashboard `/manager` dengan label **Admin Dashboard**.
3. Admin dapat menggunakan modul yang diizinkan oleh RBAC, secara default: Kategori, Produk, Promosi, Cashier, Inventory, Report, Franchise, Stasiun Cashier, dan RBAC.
4. Buka tab **RBAC** untuk mengatur modul yang boleh diakses Cashier, Manager, dan Admin.
5. Centang modul yang ingin diaktifkan, hilangkan centang untuk menonaktifkan, lalu tekan **Simpan RBAC**.
6. Permission **Admin - RBAC** wajib aktif dan tidak bisa dimatikan agar Admin tidak terkunci dari pengaturan akses.
7. Jika akses suatu modul dimatikan, tab modul tersebut akan hilang dari dashboard role terkait dan request backend akan ditolak.
8. Admin dapat membuka **Stasiun cashier** untuk melihat dan memproses semua pesanan jika permission Stasiun Cashier aktif.
9. Gunakan menu profil untuk memperbarui nama, email, atau password Admin.

## 8. Menu profil

Setiap role memiliki menu profil di bagian kanan atas. Menu ini digunakan untuk:

- Membuka halaman utama sesuai role.
- Mengubah nama dan email.
- Mengganti password.
- Keluar dari aplikasi.

## 9. Pemecahan masalah

### Halaman tidak dapat dibuka

- Pastikan terminal berada di folder project yang benar.
- Jalankan `npm run dev` dan jangan tutup terminal selama aplikasi digunakan.
- Jika port 5175 dipakai aplikasi lain, tutup proses lama sebelum menjalankan ulang project.

### Muncul pesan sesi berakhir atau akses ditolak

- Logout lalu login kembali menggunakan role yang benar.
- Pastikan akun masih aktif.
- Hubungi Manager/Admin jika akun Cashier dinonaktifkan atau permission modul belum diberikan.

### Produk atau promosi tidak muncul

- Pastikan status produk/promosi aktif.
- Pastikan kategori produk juga aktif di tab **Kategori** Manager.
- Periksa periode promosi.
- Tekan tombol **Perbarui** pada dashboard.

### Kategori tidak muncul di storefront

- Pastikan role Anda memiliki permission **Kategori** di RBAC.
- Pastikan kategori berstatus aktif.
- Pastikan produk terkait juga aktif.
- Jika kategori baru dibuat tetapi belum ada produk aktif, kategori tetap bisa tampil sebagai filter kosong sampai produk ditambahkan.

### Add-on gagal digunakan saat checkout

- Add-on mungkin sudah dinonaktifkan atau dihapus setelah dimasukkan ke keranjang.
- Hapus produk dari keranjang, lalu tambahkan kembali dengan add-on yang masih tersedia.

### Mutasi stok ditolak

- Pastikan jumlah lebih dari nol.
- Stok keluar dan koreksi kurang tidak boleh membuat stok menjadi negatif.
- Pastikan item inventory masih aktif.

### Report tidak menampilkan transaksi

- Periksa rentang tanggal dan pastikan tanggal awal tidak melewati tanggal akhir.
- Pesanan berstatus **Dibatalkan** tidak dihitung.
- Pastikan login memakai role Manager atau Admin.

### Upload gambar gagal

- Gunakan PNG, JPG/JPEG, WebP, atau GIF.
- Gunakan file maksimal sekitar 2 MB.

### Mengakses versi Netlify

- Buka alamat publik `*.netlify.app` yang diberikan setelah deploy; pengunjung tidak memerlukan verifikasi tambahan.
- Website, API, dan database tersedia pada domain yang sama. Data operasional disimpan di PostgreSQL persisten.
- Jika project tidak dapat diakses dan limit Free sudah habis, tunggu reset periode atau tingkatkan paket dari dashboard Netlify.
- Kredensial publik mengikuti password environment variable yang disimpan di Netlify, bukan password yang tersimpan di Git.

## 10. Aturan pembaruan dokumen

Setiap perubahan fitur, role, API, database, alur pengguna, atau UI utama wajib memperbarui:

- `docs/FSD.md` dan `docs/FSD.docx`
- `docs/TSD.md` dan `docs/TSD.docx`
- `docs/USER_GUIDE.md` dan `docs/USER_GUIDE.docx`

## 11. Riwayat perubahan

| Tanggal | Perubahan |
|---|---|
| 2026-07-06 | Menambahkan panduan akses Netlify, API satu domain, PostgreSQL persisten, credential environment, dan batas kredit paket Free. |
| 2026-07-06 | Menambahkan panduan akses deployment Render, waktu bangun service gratis, credential deploy, dan batasan data SQLite pada filesystem sementara. |
| 2026-07-05 | Menambahkan panduan RBAC Admin per modul, default hak akses, efek tab dashboard berbasis permission, dan pemecahan masalah akses ditolak. |
| 2026-07-05 | Menambahkan panduan kategori menu custom khusus Manager, efek kategori aktif/nonaktif pada storefront, serta catatan akses Admin terhadap kategori. |
| 2026-07-05 | Menambahkan panduan Report, metode pembayaran/promo, transaksi biaya/modal, ekspor CSV, harga modal inventory, dan pengurangan stok otomatis dari pesanan. |
| 2026-07-05 | Membuat User Guide pertama yang mencakup Pelanggan, Cashier, Manager, Admin, add-on produk, Inventory, profil, dan pemecahan masalah. |
