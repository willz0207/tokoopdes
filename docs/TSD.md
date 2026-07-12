# Technical Specification Document (TSD)

Project: Franchise Ordering Platform  
Tanggal update: 2026-07-12

## 1. Stack teknologi

Dokumen ini menjelaskan susunan teknis aplikasi, mulai dari frontend dan backend hingga database, autentikasi, serta pola deployment yang didukung.

- Antarmuka dibangun dengan React, TypeScript, dan Vite.
- Backend menggunakan Express dan TypeScript. Untuk development lokal, server dijalankan melalui `server/start.ts`; Netlify Function tetap tersedia sebagai opsi hosting.
- Data disimpan di PostgreSQL melalui package `pg`. Development menggunakan PostgreSQL lokal dan tidak bergantung pada Netlify.
- Autentikasi menggunakan JWT.
- Setiap halaman utama memiliki file CSS tersendiri agar styling lebih mudah dirawat.

## 2. Struktur penting

| Path | Fungsi |
|---|---|
| `src/App.tsx` | Landing page, pemilih outlet, katalog, keranjang, checkout, dan pengalihan pembayaran online. |
| `src/AuthApp.tsx` | Login/register pelanggan serta login cashier, manager, dan admin. |
| `src/roleRoutes.ts` | Pemetaan URL halaman utama berdasarkan role pengguna. |
| `src/CashierApp.tsx` | Dashboard cashier. |
| `src/CustomerOrdersApp.tsx` | Tracking pesanan pelanggan. |
| `src/ManagerApp.tsx` | Dashboard manager/admin berbasis permission, pemilih outlet, CRUD master produk, assignment produk per outlet, kategori, promosi, cashier, inventory, Report, RBAC, dan franchise settings. |
| `src/PaymentSimulatorApp.tsx` | Simulator pembayaran lokal untuk menguji status berhasil/gagal tanpa API key Midtrans. |
| `src/manager.css` | Sistem visual bersama untuk seluruh dashboard Manager/Admin: token surface/shadow, panel, kartu, tabel, toolbar, modal, action area, hover/focus, dan layout responsif. |
| `src/InventoryModule.tsx` | UI item inventory, minimum stok, stock movement, dan riwayat mutasi. |
| `src/ReportsModule.tsx` | Dashboard laporan operasional/keuangan, filter periode, ekspor CSV, dan transaksi biaya/modal. |
| `src/franchise.ts` | Default settings, hook settings, dan apply warna brand. |
| `src/api.ts` | API client frontend. |
| `server/index.ts` | Routing API async, middleware auth/RBAC, dan Express app untuk Function. |
| `server/start.ts` | Entry point API lokal pada port 3001 untuk `npm run dev`. |
| `server/contracts.ts` | Kontrak tipe domain bersama untuk API dan provider database. |
| `server/postgres-db.ts` | Query PostgreSQL, transaksi, seed idempotent, dan agregasi laporan. |
| `server/payments.ts` | Adapter Midtrans Snap, simulator lokal, pemetaan status transaksi, dan validasi signature webhook. |
| `netlify/functions/api.ts` | Entry point Express Netlify Function. |
| `netlify/database/migrations/0001_initial_schema.sql` | Baseline schema PostgreSQL yang diterapkan otomatis. |
| `netlify/database/migrations/0002_multi_outlet_payments.sql` | Migrasi idempotent untuk outlet, scoping data operasional, penempatan cashier, dan pembayaran. |
| `netlify/database/migrations/0003_outlet_products.sql` | Migrasi idempotent tabel assignment produk per outlet, harga override, status aktif, dan status tersedia. |
| `netlify.toml` | Build, bundling Function, routing API, dan fallback SPA. |
| `vite.config.ts` | Konfigurasi Vite, port 5175, dan proxy `/api` ke API lokal port 3001. |

## 3. Database

Pada mode development, aplikasi terhubung langsung ke PostgreSQL lokal tanpa melalui Netlify. Provider database akan mencari connection string dari `DATABASE_URL`, `POSTGRES_URL`, lalu `LOCAL_DATABASE_URL`. Jika ketiganya tidak diisi, aplikasi memakai fallback `postgres://postgres@127.0.0.1:5432/postgres`. Variable `NETLIFY_DB_URL` tidak lagi digunakan.

Perintah `npm run dev` menjalankan dua proses lokal secara bersamaan:

- `npm run dev:api`: `tsx watch server/start.ts` untuk API Express lokal pada port 3001.
- `npm run dev:web`: Vite pada port 5175, dengan proxy `/api` ke `http://127.0.0.1:3001`.

Tabel utama:

- `users`
- `menu_categories`
- `products`
- `product_addons`
- `outlet_products`
- `promotions`
- `orders`
- `order_items`
- `outlets`
- `payments`
- `inventory_items`
- `stock_movements`
- `financial_entries`
- `role_permissions`
- `app_settings`

### RBAC

- `role_permissions` menyimpan `role`, `module`, `enabled`, dan `updated_at`.
- Role yang dapat diatur: `cashier`, `manager`, dan `admin`.
- Modul RBAC: `cashier_station`, `categories`, `products`, `promotions`, `cashiers`, `inventory`, `reports`, `outlets`, `settings`, dan `rbac`.
- Default permission: Cashier hanya `cashier_station`; Manager semua modul operasional kecuali `rbac`; Admin semua modul termasuk `rbac`.
- Permission `admin + rbac` dipaksa aktif agar Admin tidak terkunci dari pengaturan akses.
- Permission `rbac` untuk Cashier/Manager dipaksa nonaktif karena endpoint RBAC hanya untuk Admin.
- Backend memakai guard `requireModuleAccess()` dan `requireAnyModuleAccess()` sehingga permission ditegakkan di API, bukan hanya di UI.
- `GET /api/permissions/me` dipakai frontend untuk menentukan tab dashboard yang boleh tampil.
- `ManagerApp.tsx` merender panel tindakan RBAC sebagai elemen `div.rbac-actions`, bukan elemen `footer`, agar tidak menerima gaya footer global yang dipakai pada bagian lain aplikasi.
- `manager.css` memberi tabel, switch, dan panel tindakan RBAC state hover, `focus-visible`, serta susunan responsif. Input switch tetap tersedia bagi keyboard dan pembaca layar meskipun indikator visualnya dibuat khusus.

### Sistem visual dashboard Manager/Admin

- Selector footer halaman publik dibatasi menjadi `.app-shell > footer` di `src/styles.css`. Pembatasan ini mencegah warna footer storefront diterapkan ke elemen `footer` yang berada di dalam kartu Produk, Promosi, Kategori, Cashier, atau panel dashboard lainnya.
- `src/manager.css` menyediakan token bersama seperti `--module-surface`, `--module-soft`, `--module-border`, dan beberapa tingkat shadow agar semua modul memakai warna, garis tepi, kedalaman, dan radius yang seragam.
- Panel, ringkasan statistik, toolbar, tabel, modal, empty state, serta area tindakan pada Produk, Promosi, Inventory, Report, Outlet, Franchise, dan RBAC menggunakan pola interaksi yang konsisten, termasuk `hover`, `focus-visible`, dan disabled state.
- Media query dashboard mengubah grid menjadi satu kolom dan tindakan menjadi susunan vertikal pada layar kecil. Pengujian viewport 390 px memastikan halaman tidak menghasilkan overflow horizontal.

### Kategori menu

- `menu_categories` menyimpan `label`, `emoji`, `sort_order`, status aktif, dan timestamp.
- Seed kategori default dibuat saat database kosong; migrasi juga memasukkan kategori unik dari produk lama agar data existing tetap valid.
- `GET /api/categories?outletId=:id` hanya mengirim kategori aktif yang memiliki produk aktif dan tersedia pada outlet terpilih.
- `GET /api/manager/categories` mengirim kategori aktif/nonaktif beserta `productCount`.
- `CategoryGrid` di `src/ManagerApp.tsx` memisahkan informasi utama, status visibilitas, toggle aktif, dan tombol aksi ke dalam kelompok visual yang lebih mudah dipindai.
- `src/manager.css` memberi kartu kategori layout responsif tiga/dua/satu kolom, warna status aktif/nonaktif, footer terang, transisi hover, serta focus/action surface yang konsisten.
- CRUD kategori (`POST`, `PUT`, `PATCH active`, `DELETE`) dibatasi oleh permission modul `categories`.
- Produk divalidasi terhadap `menu_categories`; daftar kategori tidak lagi hardcoded di backend.
- `getProducts(false, ..., outletId)` hanya mengirim produk yang master dan kategorinya aktif serta memiliki assignment aktif/tersedia pada outlet; `getProducts(true, ..., outletId)` tetap menampilkan seluruh master produk beserta status assignment outlet.
- Rename kategori berjalan dalam transaksi dan ikut memperbarui `products.category`.
- Delete kategori yang masih dipakai produk akan mengarsipkan kategori dengan `active = 0`; delete fisik hanya dilakukan jika kategori belum dipakai produk.

### Add-on dan detail pesanan

- `product_addons` menyimpan nama, harga, status, dan relasi add-on ke produk.
- API publik hanya mengirim add-on aktif, sedangkan Manager/Admin menerima add-on aktif dan nonaktif.
- `order_items.addons_json` menyimpan snapshot ID, nama, dan harga add-on saat checkout.
- `order_items.unit_price` menyimpan harga produk ditambah seluruh add-on per satuan.

### Produk per outlet

- `outlet_products` memakai primary key gabungan `outlet_id + product_id` dan menyimpan `price_override`, `active`, `available`, serta timestamp.
- Migrasi `0003_outlet_products.sql` menugaskan seluruh produk lama ke seluruh outlet yang sudah ada agar perilaku katalog lama tetap terjaga.
- Saat outlet baru dibuat, backend membuat assignment awal untuk seluruh master produk. Produk baru otomatis ditugaskan ke outlet yang aktif di dashboard saat produk dibuat.
- `GET /api/products?outletId=:id` mengembalikan harga efektif dengan `COALESCE(price_override, products.price)` dan tidak mengirim produk yang belum ditugaskan, nonaktif, atau tidak tersedia pada outlet tersebut.
- `GET /api/manager/products` memakai header `X-Outlet-Id` dan mengembalikan master produk beserta `outletAssignment`, `basePrice`, `effectivePrice`, dan status assignment.
- `PUT /api/manager/products/:id/outlet-assignment` membuat, memperbarui, atau menghapus assignment untuk outlet aktif. Endpoint dilindungi permission `products`.
- `createOrder()` mengambil ulang produk dalam transaksi berdasarkan `outlet_id`, memvalidasi assignment serta ketersediaan, lalu menghitung subtotal menggunakan harga efektif server-side.

### Multi-outlet

- `outlets` menyimpan `code`, `name`, `address`, `phone`, `active`, `is_default`, dan timestamp.
- `users.outlet_id` menempatkan Cashier/Manager pada outlet; Cashier selalu menggunakan outlet tersebut, sementara Manager/Admin dapat mengirim header `X-Outlet-Id` untuk berpindah konteks.
- `orders.outlet_id`, `inventory_items.outlet_id`, dan `financial_entries.outlet_id` memisahkan data operasional per cabang.
- Unique index inventory berubah dari SKU global menjadi kombinasi `outlet_id + UPPER(sku)`.
- Data lama otomatis dipindahkan ke `Outlet Pusat` oleh migrasi `0002_multi_outlet_payments.sql`.
- Kategori, master produk, add-on, promosi, RBAC, dan `app_settings` tetap berada pada level franchise. Ketersediaan serta harga efektif produk dipisahkan melalui `outlet_products`.

### Pembayaran online

- `payments` memiliki relasi unik ke `orders` dan menyimpan provider, status, token Snap, URL redirect, transaction ID, payment type, gross amount, raw response, serta waktu pembayaran.
- `server/payments.ts` memilih Midtrans sandbox/production berdasarkan `MIDTRANS_IS_PRODUCTION`. Jika `MIDTRANS_SERVER_KEY` kosong, provider otomatis berubah menjadi `simulator`.
- Pembuatan transaksi Snap dilakukan dari backend dengan HTTP Basic menggunakan Server Key. Frontend hanya menerima URL redirect.
- Endpoint webhook memvalidasi SHA-512 dari `order_id + status_code + gross_amount + server_key`, lalu membandingkan nominal notifikasi dengan total order.
- Status Midtrans dipetakan ke `pending`, `paid`, `failed`, `expired`, atau `refunded`. Status gagal/kedaluwarsa memanggil pembatalan order sehingga stok dikembalikan.
- `updateOrderStatus()` menolak proses order online yang belum berstatus `paid`.

### Inventory

- `inventory_items` menyimpan outlet, nama, SKU unik per outlet, satuan, `current_stock`, `minimum_stock`, `unit_cost`, `linked_product_id`, `usage_per_sale`, dan status aktif.
- `stock_movements` menyimpan tipe mutasi, jumlah, stok sebelum/sesudah, catatan, pembuat, dan waktu.
- Tipe mutasi: `in`, `out`, `adjustment_add`, dan `adjustment_subtract`.
- Update stok dan insert riwayat dijalankan dalam satu transaksi PostgreSQL dengan row locking pada operasi pengurangan stok.
- Saat order dibuat, sistem memvalidasi master produk, kategori, assignment outlet, status aktif/tersedia, serta harga efektif. Seluruh inventory aktif yang tertaut ke produk dikurangi sebesar `quantity × usage_per_sale`; proses order dibatalkan secara atomik jika produk tidak tersedia atau stok tidak cukup.
- Ketika pesanan dibatalkan (status berubah menjadi `cancelled`), stok dikembalikan (refund) secara otomatis dan dicatat sebagai mutasi masuk (`in`). Sebaliknya, jika pesanan dipulihkan kembali dari status batal, stok akan dikurangi kembali (gagal jika stok tidak mencukupi).

### Report dan keuangan

- `orders.payment_method` mendukung `cash`, `qris`, `bank_transfer`, dan `ewallet`.
- `orders.discount_amount` dan `orders.promo_code` menyimpan hasil penerapan promo pada saat checkout.
- `financial_entries` menyimpan `expense`, `capital_in`, atau `capital_out`, kategori, nominal, metode pembayaran, tanggal, catatan, dan pembuat.
- Agregasi report dijalankan server-side dengan filter tanggal dan outlet; order berstatus `cancelled` serta pembayaran online yang belum lunas dikecualikan.
- Laba rugi: omzet bersih dikurangi HPP (COGS) dan biaya operasional periode untuk menghasilkan laba bersih. HPP dihitung dinamis dari total penjualan produk dikali resep bahan baku dikali unit_cost inventory item.
- Laba kotor: omzet bersih dikurangi HPP (COGS).
- Arus kas: penjualan dan modal masuk dikurangi biaya serta modal keluar.
- Neraca sederhana: saldo kas historis ditambah nilai persediaan (`current_stock × unit_cost`), dengan liabilitas awal nol.
- Perubahan modal: modal masuk ditambah laba ditahan dikurangi modal keluar.

### `app_settings`

Menyimpan pengaturan franchise dalam bentuk key-value.

Field yang dipakai aplikasi:

- `businessName`
- `shortName`
- `tagline`
- `heroEyebrow`
- `heroTitle`
- `heroHighlight`
- `heroDescription`
- `heroImageUrl`
- `storyImageUrl`
- `deliveryEstimate`
- `deliveryNote`
- `locationLabel`
- `locationTitle`
- `locationDescription`
- `footerDescription`
- `contactEmail`
- `whatsappNumber`
- `orderPrefix`
- `primaryColor`
- `accentColor`
- `menuKicker`
- `menuTitle`
- `menuDescription`
- `aboutKicker`
- `aboutTitle`
- `aboutDescription`
- `aboutReviewQuote`
- `aboutReviewAuthor`

## 4. API utama

### Public

- `GET /api/health`
- `GET /api/outlets`
- `GET /api/settings`
- `GET /api/categories`
- `GET /api/products`
- `GET /api/promotions`
- `POST /api/auth/register`
- `POST /api/auth/login`

### Customer

- `POST /api/orders`
- `GET /api/customer/orders`
- `GET /api/payments/:orderId/status`
- `POST /api/payments/:orderId/simulate` (hanya simulator lokal)
- `GET /api/auth/me`
- `PUT /api/profile`
- `PUT /api/profile/password`

### Cashier / Manager / Admin

- `GET /api/cashier/stats`
- `GET /api/cashier/orders`
- `PATCH /api/cashier/orders/:id/status`
- `GET /api/staff/outlets`

### Manager / Admin

- `GET /api/manager/outlets`
- `POST /api/manager/outlets`
- `PUT /api/manager/outlets/:id`
- `DELETE /api/manager/outlets/:id`

- `GET /api/manager/categories`
- `POST /api/manager/categories`
- `PUT /api/manager/categories/:id`
- `PATCH /api/manager/categories/:id/active`
- `DELETE /api/manager/categories/:id`
- `GET /api/manager/products`
- `POST /api/manager/products`
- `PUT /api/manager/products/:id`
- `PATCH /api/manager/products/:id/active`
- `DELETE /api/manager/products/:id`
- `GET /api/manager/promotions`
- `POST /api/manager/promotions`
- `PUT /api/manager/promotions/:id`
- `DELETE /api/manager/promotions/:id`
- `GET /api/manager/cashiers`
- `POST /api/manager/cashiers`
- `PUT /api/manager/cashiers/:id`
- `DELETE /api/manager/cashiers/:id`
- `GET /api/manager/inventory`
- `POST /api/manager/inventory/items`
- `PUT /api/manager/inventory/items/:id`
- `DELETE /api/manager/inventory/items/:id`
- `POST /api/manager/inventory/movements`
- `GET /api/manager/reports?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `POST /api/manager/financial-entries`
- `DELETE /api/manager/financial-entries/:id`
- `GET /api/manager/settings`
- `PUT /api/manager/settings`

### Permission / Admin RBAC

- `GET /api/permissions/me`
- `GET /api/admin/rbac`
- `PUT /api/admin/rbac`

### Webhook pembayaran

- `POST /api/payments/midtrans/notification`
- Endpoint tidak memakai JWT karena dipanggil Midtrans, tetapi wajib lolos verifikasi signature dan nominal.

## 5. Auth dan role

JWT memakai secret dari `APP_JWT_SECRET`. Role yang didukung:

- `customer`
- `cashier`
- `manager`
- `admin`

Admin disimpan sebagai user biasa, dengan akun awal `admin@franchise.local`. Setelah login, `homePathForRole()` memilih halaman utama berdasarkan role: Customer ke `/`, Cashier ke `/cashier`, Manager ke `/manager`, dan Admin ke `/admin`. Rute `/admin` dan `/manager` sama-sama menggunakan `ManagerApp`, tetapi aplikasi tetap memeriksa sesi dan mengalihkan pengguna jika URL tidak sesuai dengan role. Endpoint lama `/api/auth/admin` masih dipertahankan untuk kompatibilitas API, meskipun UI utama Admin kini berada di `/admin`.

Untuk setiap token yang memiliki `userId`, middleware memastikan akun masih ada, masih aktif, dan role di database sesuai dengan isi token. Karena itu, sesi lama otomatis tidak dapat digunakan lagi setelah akun dinonaktifkan atau dihapus.

Frontend menyimpan token di localStorage dengan key generik:

- `franchise-user-token`
- `franchise-user`
- `franchise-admin-token`
- `franchise-cart`
- `franchise-outlet-id`

### Enforcement RBAC

- Endpoint Cashier (`/api/cashier/*`) membutuhkan permission `cashier_station`.
- Endpoint kategori membutuhkan permission `categories`; `GET /api/manager/categories` juga dapat dipakai role dengan permission `products` untuk dropdown produk.
- Endpoint produk membutuhkan permission `products`; `GET /api/manager/products` juga dapat dipakai role dengan permission `inventory` untuk tautan item inventory ke produk.
- Perubahan assignment melalui `PUT /api/manager/products/:id/outlet-assignment` membutuhkan permission `products` dan konteks outlet yang valid.
- Endpoint promosi, cashier, inventory, report/financial, outlet, dan settings masing-masing membutuhkan permission modul terkait.
- Endpoint RBAC membutuhkan role `admin` dan permission `rbac`.
- Endpoint legacy `/api/admin/*` tetap tersedia dan ikut dicek memakai permission modul terkait.

## 6. Upload gambar

Foto produk dan gambar brand dikirim sebagai Data URL base64 agar dapat disimpan bersama data aplikasi tanpa layanan penyimpanan file tambahan.

Validasi:

- Format: PNG, JPG/JPEG, WebP, GIF.
- Maksimal sekitar 2 MB per gambar.
- Server membatasi JSON request hingga 6 MB.

Cara ini cukup praktis untuk penggunaan lokal atau demo. Untuk produksi dengan jumlah gambar yang besar, file sebaiknya dipindahkan ke object storage atau folder upload statis.

## 7. Pengaturan brand

Frontend mengambil settings dari `GET /api/settings` melalui `useFranchiseSettings()`.

Hook tersebut:

- Menggunakan default generik saat data belum tersedia.
- Mengambil settings dari backend.
- Mengubah CSS variable:
  - `--brand-primary`
  - `--brand-accent`
- Mengubah judul browser sesuai nama usaha.

## 8. Build dan run

Environment pembayaran:

- `MIDTRANS_SERVER_KEY`: credential rahasia backend untuk membuat transaksi dan memverifikasi webhook.
- `MIDTRANS_CLIENT_KEY`: disiapkan untuk kebutuhan Snap JS bila mode popup dipakai pada pengembangan berikutnya.
- `MIDTRANS_IS_PRODUCTION=false`: memakai endpoint sandbox; ubah menjadi `true` hanya dengan key production.
- `PUBLIC_APP_URL`: base URL callback selesai pembayaran, misalnya `http://localhost:5175` atau domain production.
- Jika `MIDTRANS_SERVER_KEY` kosong, checkout online memakai `/payment-simulator` dan tidak mengirim transaksi ke Midtrans.

Development:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Production:

```bash
npm run build
```

### 8.1 Hosting publik opsional

- Production URL sebelumnya: `https://tokokopdes.netlify.app`.
- Infrastructure as Code memakai `netlify.toml`; build command `npm run build` dan publish directory `dist`.
- `netlify/functions/api.ts` membungkus Express dengan `serverless-http`; `/api/*` di-rewrite ke Function dan `/*` memakai fallback SPA.
- Provider `server/postgres-db.ts` memakai connection string eksplisit dari environment (`DATABASE_URL`, `POSTGRES_URL`, atau `LOCAL_DATABASE_URL`) dan tidak lagi memakai `NETLIFY_DB_URL`.
- Seed settings, role permission, akun awal, kategori, produk, dan promosi bersifat idempotent serta memakai advisory lock.
- Checkout dan stock movement memakai transaksi PostgreSQL; inventory terkait dikunci dengan `FOR UPDATE` untuk mencegah overselling.
- Local development tidak memakai `@netlify/vite-plugin`; API lokal dan Vite lokal dijalankan terpisah oleh `concurrently`.
- Database lokal komputer tidak dapat dipakai oleh website publik jika komputer mati/offline. Untuk hosting publik 24 jam, gunakan PostgreSQL online yang dapat diakses oleh server hosting.
- Secret produksi disimpan pada environment variable hosting: `APP_JWT_SECRET`, `APP_ADMIN_PASSWORD`, `APP_MANAGER_PASSWORD`, dan `APP_CASHIER_PASSWORD`.
- Jika tetap memakai Netlify Free, perhatikan batas kredit bulanan karena project dapat pause otomatis jika limit tercapai.

## 9. Aturan update dokumen

Setiap perubahan kode yang memengaruhi fitur, API, database, role, pengaturan brand, upload, atau alur checkout wajib memperbarui:

- `docs/FSD.md`
- `docs/TSD.md`
- `docs/FSD.docx`
- `docs/TSD.docx`
- `docs/USER_GUIDE.md`
- `docs/USER_GUIDE.docx`

## 10. Riwayat perubahan

| Tanggal | Perubahan teknis |
|---|---|
| 2026-07-12 | Menambahkan migrasi `0003_outlet_products.sql`, kontrak assignment, query harga efektif, endpoint assignment per outlet, filter kategori/katalog storefront, validasi checkout server-side, dan UI pengaturan produk pada outlet aktif. |
| 2026-07-12 | Membatasi CSS footer storefront ke `.app-shell > footer` dan menambahkan sistem visual bersama pada `manager.css` agar seluruh modul Manager/Admin memakai panel, kartu, tabel, toolbar, modal, action area, hover/focus, dan layout responsif yang konsisten. |
| 2026-07-12 | Menambahkan tabel `outlets`, foreign key outlet pada user/order/inventory/keuangan, unique SKU per outlet, resolver `X-Outlet-Id`, CRUD outlet, scoping query, pemilih outlet, dan permission `outlets`. |
| 2026-07-12 | Menambahkan tabel `payments`, adapter Midtrans Snap, webhook SHA-512, simulator lokal, status pembayaran pada order, redirect checkout, dan guard order online sebelum lunas. |
| 2026-07-12 | Mengganti footer aksi RBAC dengan `div.rbac-actions`, menambahkan helper copy, state hover/focus pada tabel dan switch, serta toolbar terang yang responsif agar tidak terpengaruh CSS footer global. |
| 2026-07-12 | Mendesain ulang `CashierGrid` dan CSS kartu cashier dengan struktur informasi baru, status akses login, footer terang, tombol berlabel, hover, dan focus state. |
| 2026-07-12 | Mendesain ulang `CategoryGrid` dan CSS kartu kategori: struktur informasi baru, status visibilitas, footer terang, hover transition, serta layout responsif. |
| 2026-07-12 | Menyunting bahasa TSD agar lebih natural dan mudah dipahami sambil mempertahankan detail arsitektur, route, API, dan konfigurasi. |
| 2026-07-12 | Menambahkan helper `homePathForRole`, memetakan `/admin` ke dashboard berbasis `ManagerApp`, memisahkan redirect login Admin/Manager, dan melakukan canonical redirect sesuai role sesi. |
| 2026-07-10 | Menghapus ketergantungan development pada Netlify Database/Vite plugin, menambahkan API lokal port 3001, proxy Vite `/api`, PostgreSQL lokal via `DATABASE_URL`, dan panduan local-only database. |
| 2026-07-06 | Mengaktifkan production deploy Netlify `tokokopdes.netlify.app`, provisioning Netlify Database production, apply migration production, setting `NETLIFY_DB_URL`, dan fallback connection string explicit untuk deploy manual CLI. |
| 2026-07-06 | Memigrasikan backend ke Express Netlify Function, database ke Netlify PostgreSQL, query async/transactional, migration otomatis, Vite emulator lokal, dan routing SPA/API melalui `netlify.toml`. |
| 2026-07-06 | Menambahkan `render.yaml` untuk Web Service gratis region Singapura, build/start command, health check, secret env, auto-deploy branch `main`, dan dokumentasi keterbatasan filesystem ephemeral. |
| 2026-07-05 | Menambahkan tabel `role_permissions`, default matrix RBAC, endpoint `/api/permissions/me` dan `/api/admin/rbac`, guard permission per modul, serta UI tab RBAC Admin. |
| 2026-07-05 | Menambahkan tabel `menu_categories`, seed/migrasi kategori dari produk lama, endpoint kategori publik/manager, validasi produk terhadap kategori database, tab Kategori khusus Manager, dan dropdown produk berbasis kategori API. |
| 2026-07-05 | Menambahkan `financial_entries`, kolom pembayaran/diskon order, valuasi dan linkage inventory-produk, pengurangan stok atomik saat checkout, agregasi report, endpoint Report, UI Report, dan ekspor CSV. |
| 2026-07-05 | Menambahkan generator dan artefak User Guide Markdown/Word serta menjadikannya bagian wajib dari sinkronisasi dokumentasi. |
| 2026-07-05 | Menambahkan migrasi role `admin`, seed akun Admin, akses Admin ke endpoint Manager/Cashier, dan dashboard Admin berbasis ManagerApp. |
| 2026-07-05 | Menambahkan `product_addons`, sinkronisasi add-on dalam CRUD produk, pemilih add-on storefront, kalkulasi harga server-side, serta snapshot add-on pada `order_items`. |
| 2026-07-05 | Menambahkan `inventory_items`, `stock_movements`, transaksi stok, endpoint inventory, dan UI inventory untuk Manager/Admin. |
| 2026-07-05 | Menambahkan `updateCashier` dan `deleteCashier`, endpoint PUT/DELETE cashier, form edit/status/password, aksi hapus, serta validasi sesi user aktif. |
| 2026-07-05 | Memindahkan seed promosi setelah mapper promosi siap agar server tidak gagal saat database masih kosong. |
| 2026-07-05 | Menambahkan fungsi database `getCashiers`, endpoint manager cashier, API client, dan tab Cashier di dashboard manager. |
| 2026-07-05 | Menambahkan output Word untuk FSD dan TSD dengan format dokumen spesifikasi yang lebih rapi. |
| 2026-07-05 | Menambahkan `app_settings`, API settings, hook brand frontend, tab Franchise manager, upload gambar brand, prefix order dinamis, dan key localStorage generik. |
| 2026-07-05 | Mengganti default database/env/package/README menjadi generik dan membersihkan sisa string brand lama dari kode utama. |
