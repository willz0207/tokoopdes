# User Guide

Project: Franchise Ordering Platform  
Tanggal update: 2026-07-12

## 1. Tujuan panduan

Panduan ini membantu Pelanggan, Cashier, Manager, dan Admin menggunakan aplikasi sesuai kebutuhan masing-masing. Mulailah dari bagian yang sesuai dengan role Anda, lalu gunakan bagian pemecahan masalah jika aplikasi tidak berjalan seperti yang diharapkan.

## 2. Menjalankan aplikasi

1. Buka terminal, lalu masuk ke folder project.
2. Pastikan service PostgreSQL lokal sudah berjalan.
3. Jika nama user, password, atau database PostgreSQL Anda berbeda dari konfigurasi bawaan, salin `.env.example` menjadi `.env` dan sesuaikan nilai `DATABASE_URL`.
4. Jalankan `npm run dev`.
5. Tunggu sampai proses API dan Vite berhasil aktif tanpa error.
6. Buka `http://localhost:5175` melalui browser.

Default database lokal:

```env
DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres
```

Jika PostgreSQL memakai password:

```env
DATABASE_URL=postgres://postgres:password_anda@127.0.0.1:5432/postgres
```

Alamat halaman utama:

| Halaman | Alamat |
|---|---|
| Toko | `http://localhost:5175/` |
| Login | `http://localhost:5175/login` |
| Pesanan pelanggan | `http://localhost:5175/orders` |
| Stasiun Cashier | `http://localhost:5175/cashier` |
| Dashboard Manager | `http://localhost:5175/manager` |
| Dashboard Admin | `http://localhost:5175/admin` |

### Akun lokal bawaan

| Role | Email | Password |
|---|---|---|
| Cashier | `cashier@franchise.local` | `cashier123` |
| Manager | `manager@franchise.local` | `manager123` |
| Admin | `admin@franchise.local` | `admin123` |

> Ganti seluruh password bawaan dan `APP_JWT_SECRET` sebelum aplikasi dipublikasikan.

## 3. Ringkasan hak akses

Akses ke modul operasional diatur melalui RBAC. Tabel berikut menunjukkan pengaturan awal. Admin dapat menyesuaikannya kapan saja melalui tab **RBAC**.

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
| Outlet | Tidak | Tidak | Ya | Ya |
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

> Daftar produk dan harga dapat berbeda antar outlet. Katalog selalu menyesuaikan assignment, status ketersediaan, dan harga khusus outlet yang sedang dipilih.

### Keranjang dan checkout

1. Pilih outlet dari bagian atas halaman toko. Pesanan dan stok akan tercatat pada outlet tersebut.
2. Buka ikon keranjang.
3. Gunakan tombol tambah, kurang, atau hapus untuk mengatur jumlah.
4. Periksa produk, add-on, harga satuan, dan subtotal.
5. Tekan **Lanjut checkout**.
6. Pilih metode **Diantar** atau **Ambil sendiri**.
7. Pilih pembayaran **Tunai**, **QRIS**, **E-wallet**, atau **Transfer bank**.
8. Pilih kode promo yang memenuhi minimum belanja jika tersedia.
9. Isi nama, nomor WhatsApp, alamat jika diperlukan, dan catatan opsional.
10. Untuk pembayaran tunai, tekan tombol pembuatan pesanan. Untuk QRIS, e-wallet, atau transfer bank, tekan **Lanjut ke pembayaran**.
11. Jika Midtrans belum dikonfigurasi pada komputer lokal, halaman simulator akan terbuka. Pilih **Simulasikan berhasil** atau **Simulasikan gagal** untuk menguji alur tanpa uang sungguhan.
12. Saat memakai Midtrans sandbox/production, selesaikan pembayaran pada halaman Midtrans. Status pembayaran akan diperbarui melalui webhook.

> Mengganti outlet akan mengosongkan keranjang agar produk tidak divalidasi terhadap stok cabang yang salah.

### Melacak pesanan

1. Buka menu profil lalu pilih **Pesanan saya**, atau buka `/orders`.
2. Gunakan tab **Aktif** untuk pesanan berjalan dan **Riwayat** untuk pesanan selesai/dibatalkan.
3. Pilih pesanan untuk melihat status, item, add-on, metode penerimaan, alamat, dan total.
4. Status diperbarui otomatis setiap 15 detik dan dapat diperbarui manual.
5. Bagian pembayaran menampilkan nama outlet, metode, dan status pembayaran. Gunakan **Bayar sekarang** jika transaksi online masih menunggu dan URL pembayaran masih tersedia.

## 5. Panduan Cashier

### Masuk ke stasiun Cashier

1. Buka halaman login.
2. Pilih role **Cashier**.
3. Masukkan akun yang diberikan Manager/Admin.
4. Setelah login, aplikasi membuka `/cashier`.
5. Cashier otomatis menggunakan outlet yang ditentukan pada akunnya dan tidak dapat berpindah ke cabang lain.

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
6. Pesanan QRIS, e-wallet, atau transfer bank belum dapat diproses sebelum pembayaran berstatus lunas.

## 6. Panduan Manager

Tab yang terlihat pada dashboard Manager mengikuti permission RBAC yang diberikan oleh Admin. Jika sebuah tab tidak muncul, periksa pengaturan akses sebelum menganggap modul tersebut bermasalah.

Semua tab menggunakan pola tampilan yang sama. Judul dan tombol utama berada di bagian atas panel, isi ditampilkan dalam kartu atau tabel terang, sedangkan tindakan edit, hapus, aktif/nonaktif, dan simpan diletakkan pada area yang mudah ditemukan. Pada ponsel, kartu otomatis tersusun satu kolom dan navigasi tersedia di bagian bawah layar.

### Kategori menu

1. Login sebagai **Manager** lalu buka tab **Kategori**.
2. Setiap kartu menampilkan ikon, urutan, jumlah produk yang terhubung, serta keterangan apakah kategori sedang tampil di toko atau disembunyikan.
3. Tekan **Tambah kategori** untuk membuat filter menu baru.
4. Isi icon/emoji, nama kategori, urutan tampil, dan status aktif.
5. Gunakan angka urutan lebih kecil agar kategori tampil lebih awal di storefront.
6. Gunakan switch pada bagian bawah kartu untuk menampilkan atau menyembunyikan kategori dari pelanggan.
7. Gunakan ikon pensil untuk mengubah kategori dan ikon tempat sampah untuk menghapus atau mengarsipkan.
8. Jika kategori masih dipakai produk, sistem akan menonaktifkan/mengarsipkan kategori agar produk lama tetap aman.
9. Jika nama kategori diubah, produk yang memakai kategori tersebut ikut diperbarui otomatis.

### Produk dan add-on

1. Login sebagai **Manager** lalu buka tab **Produk**.
2. Pilih outlet yang ingin dikelola melalui selector **Outlet Aktif** di kanan atas.
3. Tekan **Tambah produk** untuk membuat master produk baru. Produk baru otomatis ditugaskan ke outlet yang sedang aktif.
4. Isi nama, deskripsi, harga master, kategori, status, dan foto produk bila tersedia. Pastikan kategori sudah dibuat di tab **Kategori**.
5. Pada bagian **Pilihan add-on**, tekan **Tambah add-on**.
6. Isi nama add-on, harga tambahan, dan status aktif.
7. Tekan **Simpan produk**.
8. Gunakan ikon gedung pada kartu produk untuk membuka pengaturan outlet.
9. Aktifkan **Jual produk ini di [nama outlet]** untuk menugaskan produk. Matikan opsi tersebut jika produk tidak dijual pada outlet aktif.
10. Isi **Harga khusus outlet** bila harganya berbeda dari harga master; kosongkan untuk kembali memakai harga master.
11. Gunakan **Konfigurasi outlet aktif** untuk mengaktifkan assignment dan **Produk tersedia dijual** untuk menghentikan penjualan sementara tanpa menghapus assignment.
12. Gunakan ikon pensil untuk mengubah master produk/add-on, switch **Master aktif** untuk menonaktifkan produk pada seluruh outlet, dan ikon hapus untuk menghapus atau mengarsipkan produk.

### Promosi

1. Buka tab **Promosi**.
2. Tambah atau edit judul, deskripsi, kode, tipe diskon, nilai diskon, minimum belanja, periode, dan status.
3. Simpan perubahan atau hapus promosi yang tidak digunakan.

### Mengelola Cashier

1. Buka tab **Cashier**.
2. Setiap kartu menampilkan inisial avatar, nama, email, dan keterangan apakah akun siap digunakan atau aksesnya sedang dinonaktifkan.
3. Tekan **Tambah cashier** untuk membuat akun baru.
4. Pilih outlet penempatan, lalu isi nama, email, dan password awal minimal 8 karakter.
5. Tekan **Edit** untuk mengubah outlet, identitas, password, atau status login.
6. Tekan **Hapus** untuk menghapus akun. Akun nonaktif atau terhapus tidak dapat menggunakan sesi lama.

### Inventory

1. Pilih outlet aktif pada bagian kanan atas dashboard, lalu buka tab **Inventory**.
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

1. Pilih outlet aktif, lalu buka tab **Report**. Default periode adalah tanggal 1 bulan berjalan sampai hari ini.
2. Gunakan **Dari** dan **Sampai**, lalu tekan **Perbarui**. Data juga diperbarui otomatis setiap 30 detik.
3. Pada tab **Operasional**, tinjau omzet, jumlah transaksi/produk, diskon, penjualan harian, produk terlaris, rekap pembayaran, status stok, dan pelanggan.
4. Pada tab **Keuangan**, tinjau laporan laba rugi (menampilkan omzet penjualan, pengeluaran bahan baku / HPP otomatis, laba kotor, biaya operasional manual, dan laba bersih), arus kas, neraca, perubahan modal, serta biaya per kategori.
5. Tekan **Catat transaksi** untuk memasukkan biaya operasional (seperti sewa, listrik, gaji, dll. - *hindari mencatat pembelian bahan baku fisik di sini karena biaya bahan baku sudah dihitung otomatis oleh sistem sebagai HPP saat produk terjual*), modal masuk, atau penarikan modal. Isi kategori, nominal, tanggal, metode pembayaran, dan catatan.
6. Gunakan ikon hapus pada transaksi manual jika terjadi salah input.
7. Tekan **Ekspor CSV** untuk mengunduh seluruh bagian laporan pada periode terpilih (termasuk HPP dan Laba Kotor).

> [!NOTE]
> - Penjualan non-batal masuk otomatis sebagai pendapatan, dan bahan baku yang digunakan otomatis dihitung sebagai Harga Pokok Penjualan (HPP).
> - Pembatalan pesanan secara otomatis mengembalikan stok bahan baku terkait ke inventory dan mencatat mutasi masuk (`in`).
> - Laporan keuangan merupakan pembukuan manajerial dasar; utang, piutang, depresiasi, dan pajak belum dihitung.

### Mengelola outlet

1. Buka tab **Outlet**.
2. Tekan **Tambah outlet**, lalu isi kode unik, nama cabang, alamat, nomor telepon, dan status aktif.
3. Aktifkan **Jadikan outlet utama** jika cabang tersebut harus dipilih otomatis oleh pelanggan dan dashboard.
4. Gunakan **Pilih outlet** pada kartu atau selector di kanan atas untuk mengganti konteks Cashier, Inventory, dan Report.
5. Tekan **Edit** untuk memperbarui cabang. Outlet utama selalu aktif dan tidak dapat dihapus.
6. Saat outlet yang sudah memiliki transaksi dihapus, sistem mengarsipkannya agar histori tetap tersimpan.

Kategori, master produk, add-on, promosi, dan pengaturan brand digunakan bersama oleh semua outlet. Produk yang benar-benar tampil dan harga jualnya mengikuti assignment outlet. Pesanan, cashier, inventory, transaksi keuangan, dan laporan tetap dipisahkan per outlet.

### Pengaturan franchise

1. Buka tab **Franchise**.
2. Ubah identitas brand, warna, kontak, prefix pesanan, konten halaman depan, dan gambar.
3. Tekan **Simpan pengaturan franchise**.
4. Periksa halaman toko setelah perubahan disimpan.

## 7. Panduan Admin

1. Pilih role **Admin** pada halaman login.
2. Setelah login berhasil, aplikasi membuka `/admin` dan menampilkan label **Admin Dashboard**.
3. Admin dapat menggunakan modul yang diizinkan oleh RBAC, secara default: Kategori, Produk, Promosi, Cashier, Inventory, Report, Outlet, Franchise, Stasiun Cashier, dan RBAC.
4. Buka tab **RBAC** untuk mengatur modul yang boleh diakses Cashier, Manager, dan Admin.
5. Centang modul yang ingin diaktifkan atau hilangkan centang untuk menonaktifkan. Periksa kembali pengaturannya pada panel **Simpan pengaturan akses**, lalu tekan **Simpan RBAC**. Gunakan **Reset tampilan** jika ingin membatalkan perubahan yang belum disimpan.
6. Permission **Admin - RBAC** wajib aktif dan tidak bisa dimatikan agar Admin tidak terkunci dari pengaturan akses.
7. Jika akses suatu modul dimatikan, tab modul tersebut akan hilang dari dashboard role terkait dan request backend akan ditolak.
8. Admin dapat membuka **Stasiun cashier** untuk melihat dan memproses semua pesanan jika permission Stasiun Cashier aktif.
9. Gunakan menu profil untuk memperbarui nama, email, atau password Admin.

> Alamat dashboard selalu mengikuti role yang sedang login. Admin yang membuka `/manager` akan dibawa kembali ke `/admin`, sedangkan Manager yang membuka `/admin` akan diarahkan ke `/manager`.

## 8. Menu profil

Menu profil tersedia di pojok kanan atas untuk setiap role. Dari menu ini, pengguna dapat:

- Membuka halaman utama sesuai role.
- Mengubah nama dan email.
- Mengganti password.
- Keluar dari aplikasi.

## 9. Pemecahan masalah

### Pembayaran online tidak terbuka

- Pastikan outlet aktif sudah dipilih dan pelanggan sudah login.
- Untuk mode Midtrans, isi `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION`, dan `PUBLIC_APP_URL` pada `.env`, lalu jalankan ulang server.
- Pastikan Payment Notification URL pada dashboard Midtrans mengarah ke `https://domain-anda/api/payments/midtrans/notification`.
- Jika Server Key kosong, aplikasi sengaja menggunakan simulator lokal di `/payment-simulator`.
- Pesanan online yang gagal atau kedaluwarsa dibatalkan otomatis dan stok dikembalikan.

### Data outlet terlihat kosong

- Periksa outlet aktif pada selector di kanan atas dashboard.
- Cashier hanya dapat melihat outlet yang ditentukan pada akunnya.
- Inventory, pesanan, transaksi keuangan, dan laporan memang dipisahkan per outlet.

### Halaman tidak dapat dibuka

- Pastikan terminal berada di folder project yang benar.
- Pastikan PostgreSQL lokal menyala.
- Jalankan `npm run dev` dan jangan tutup terminal selama aplikasi digunakan.
- Jika port 5175 dipakai aplikasi lain, tutup proses lama sebelum menjalankan ulang project.
- Jika port 3001 dipakai aplikasi lain, tutup proses lama atau ubah `PORT` untuk API lokal.

### Database lokal gagal tersambung

- Pastikan service PostgreSQL berjalan di komputer.
- Pastikan `DATABASE_URL` di `.env` sesuai user, password, host, port, dan nama database.
- Jika belum membuat database khusus, gunakan database bawaan `postgres`.
- Development lokal tidak memakai database Netlify; error koneksi harus diperbaiki di PostgreSQL lokal.

### Muncul pesan sesi berakhir atau akses ditolak

- Logout lalu login kembali menggunakan role yang benar.
- Pastikan akun masih aktif.
- Hubungi Manager/Admin jika akun Cashier dinonaktifkan atau permission modul belum diberikan.

### Produk atau promosi tidak muncul

- Pastikan status produk/promosi aktif.
- Pastikan kategori produk juga aktif di tab **Kategori** Manager.
- Pilih outlet yang benar, lalu buka ikon gedung pada kartu produk dan pastikan produk sudah ditugaskan, konfigurasi outlet aktif, serta **Produk tersedia dijual** dicentang.
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

### Mengakses versi hosting publik

- Buka alamat publik `https://tokokopdes.netlify.app`; pengunjung tidak memerlukan verifikasi tambahan.
- Website publik tidak dapat memakai database lokal di laptop jika laptop mati/offline.
- Jika ingin hosting publik aktif 24 jam, gunakan PostgreSQL online dan isi `DATABASE_URL`/`POSTGRES_URL` pada environment hosting.
- Jika project tidak dapat diakses dan limit Free sudah habis, tunggu reset periode atau tingkatkan paket dari dashboard Netlify.
- Kredensial publik mengikuti password environment variable yang disimpan di hosting, bukan password yang tersimpan di Git.

## 10. Aturan pembaruan dokumen

Setiap perubahan fitur, role, API, database, alur pengguna, atau UI utama wajib memperbarui:

- `docs/FSD.md` dan `docs/FSD.docx`
- `docs/TSD.md` dan `docs/TSD.docx`
- `docs/USER_GUIDE.md` dan `docs/USER_GUIDE.docx`

## 11. Riwayat perubahan

| Tanggal | Perubahan |
|---|---|
| 2026-07-12 | Menambahkan panduan master produk global dan assignment per outlet, termasuk harga khusus, status aktif/tersedia, dampak pada katalog, serta pemecahan masalah produk outlet. |
| 2026-07-12 | Menambahkan panduan tampilan seragam seluruh modul Manager/Admin, termasuk letak tindakan, pola panel terang, dan penyesuaian navigasi pada layar ponsel. |
| 2026-07-12 | Menambahkan panduan memilih dan mengelola outlet, menempatkan cashier, serta memahami pemisahan pesanan, stok, dan laporan per cabang. |
| 2026-07-12 | Menambahkan panduan pembayaran online Midtrans, simulator lokal, status pembayaran pada tracking, webhook, dan pemecahan masalah konfigurasi. |
| 2026-07-12 | Memperbarui panduan RBAC sesuai tampilan baru: tabel lebih nyaman dibaca serta panel Reset dan Simpan yang ringkas di bawah daftar akses. |
| 2026-07-12 | Memperbarui panduan kartu cashier agar sesuai dengan tampilan baru, termasuk status akses dan tombol aksi berlabel. |
| 2026-07-12 | Memperbarui panduan kartu kategori agar sesuai dengan tampilan baru, termasuk informasi visibilitas, switch status, dan tombol aksi. |
| 2026-07-12 | Merapikan bahasa User Guide agar terasa lebih natural dan instruksinya lebih mudah diikuti tanpa mengubah langkah operasional. |
| 2026-07-12 | Memisahkan alamat dashboard Admin menjadi `/admin` dan Manager menjadi `/manager`, termasuk pengalihan otomatis jika URL tidak sesuai role login. |
| 2026-07-10 | Menambahkan panduan menjalankan database PostgreSQL lokal tanpa Netlify, API lokal port 3001, Vite port 5175, dan catatan bahwa hosting publik membutuhkan database online. |
| 2026-07-06 | Menambahkan URL live Netlify `https://tokokopdes.netlify.app`, catatan deploy context production, dan database production yang sudah diprovision. |
| 2026-07-06 | Menambahkan panduan akses Netlify, API satu domain, PostgreSQL persisten, credential environment, dan batas kredit paket Free. |
| 2026-07-06 | Menambahkan panduan akses deployment Render, waktu bangun service gratis, credential deploy, dan batasan data SQLite pada filesystem sementara. |
| 2026-07-05 | Menambahkan panduan RBAC Admin per modul, default hak akses, efek tab dashboard berbasis permission, dan pemecahan masalah akses ditolak. |
| 2026-07-05 | Menambahkan panduan kategori menu custom khusus Manager, efek kategori aktif/nonaktif pada storefront, serta catatan akses Admin terhadap kategori. |
| 2026-07-05 | Menambahkan panduan Report, metode pembayaran/promo, transaksi biaya/modal, ekspor CSV, harga modal inventory, dan pengurangan stok otomatis dari pesanan. |
| 2026-07-05 | Membuat User Guide pertama yang mencakup Pelanggan, Cashier, Manager, Admin, add-on produk, Inventory, profil, dan pemecahan masalah. |
