# Technical Specification Document (TSD)

Project: Franchise Ordering Platform  
Tanggal update: 2026-07-05

## 1. Stack teknologi

- Frontend: React + TypeScript + Vite.
- Backend: Express + TypeScript.
- Database: SQLite via `better-sqlite3`.
- Auth: JWT.
- Styling: CSS modular per halaman.

## 2. Struktur penting

| Path | Fungsi |
|---|---|
| `src/App.tsx` | Landing page, katalog, keranjang, checkout. |
| `src/AuthApp.tsx` | Login/register pelanggan serta login cashier, manager, dan admin. |
| `src/CashierApp.tsx` | Dashboard cashier. |
| `src/CustomerOrdersApp.tsx` | Tracking pesanan pelanggan. |
| `src/ManagerApp.tsx` | Dashboard manager/admin berbasis permission, kategori menu, produk beserta add-on, promosi, cashier, inventory, Report, RBAC, dan franchise settings. |
| `src/InventoryModule.tsx` | UI item inventory, minimum stok, stock movement, dan riwayat mutasi. |
| `src/ReportsModule.tsx` | Dashboard laporan operasional/keuangan, filter periode, ekspor CSV, dan transaksi biaya/modal. |
| `src/franchise.ts` | Default settings, hook settings, dan apply warna brand. |
| `src/api.ts` | API client frontend. |
| `server/index.ts` | Routing API dan middleware auth. |
| `server/db.ts` | Skema database, query, seed, dan settings. |

## 3. Database

Database default: `data/franchise.db`.

Tabel utama:

- `users`
- `menu_categories`
- `products`
- `product_addons`
- `promotions`
- `orders`
- `order_items`
- `inventory_items`
- `stock_movements`
- `financial_entries`
- `role_permissions`
- `app_settings`

### RBAC

- `role_permissions` menyimpan `role`, `module`, `enabled`, dan `updated_at`.
- Role yang dapat diatur: `cashier`, `manager`, dan `admin`.
- Modul RBAC: `cashier_station`, `categories`, `products`, `promotions`, `cashiers`, `inventory`, `reports`, `settings`, dan `rbac`.
- Default permission: Cashier hanya `cashier_station`; Manager semua modul operasional kecuali `rbac`; Admin semua modul termasuk `rbac`.
- Permission `admin + rbac` dipaksa aktif agar Admin tidak terkunci dari pengaturan akses.
- Permission `rbac` untuk Cashier/Manager dipaksa nonaktif karena endpoint RBAC hanya untuk Admin.
- Backend memakai guard `requireModuleAccess()` dan `requireAnyModuleAccess()` sehingga permission ditegakkan di API, bukan hanya di UI.
- `GET /api/permissions/me` dipakai frontend untuk menentukan tab dashboard yang boleh tampil.

### Kategori menu

- `menu_categories` menyimpan `label`, `emoji`, `sort_order`, status aktif, dan timestamp.
- Seed kategori default dibuat saat database kosong; migrasi juga memasukkan kategori unik dari produk lama agar data existing tetap valid.
- `GET /api/categories` hanya mengirim kategori aktif untuk storefront.
- `GET /api/manager/categories` mengirim kategori aktif/nonaktif beserta `productCount`.
- CRUD kategori (`POST`, `PUT`, `PATCH active`, `DELETE`) dibatasi oleh permission modul `categories`.
- Produk divalidasi terhadap `menu_categories`; daftar kategori tidak lagi hardcoded di backend.
- `getProducts(false)` hanya mengirim produk aktif yang kategorinya aktif; `getProducts(true)` tetap menampilkan semua produk untuk dashboard operasional.
- Rename kategori berjalan dalam transaksi dan ikut memperbarui `products.category`.
- Delete kategori yang masih dipakai produk akan mengarsipkan kategori dengan `active = 0`; delete fisik hanya dilakukan jika kategori belum dipakai produk.

### Add-on dan detail pesanan

- `product_addons` menyimpan nama, harga, status, dan relasi add-on ke produk.
- API publik hanya mengirim add-on aktif, sedangkan Manager/Admin menerima add-on aktif dan nonaktif.
- `order_items.addons_json` menyimpan snapshot ID, nama, dan harga add-on saat checkout.
- `order_items.unit_price` menyimpan harga produk ditambah seluruh add-on per satuan.

### Inventory

- `inventory_items` menyimpan nama, SKU unik, satuan, `current_stock`, `minimum_stock`, `unit_cost`, `linked_product_id`, `usage_per_sale`, dan status aktif.
- `stock_movements` menyimpan tipe mutasi, jumlah, stok sebelum/sesudah, catatan, pembuat, dan waktu.
- Tipe mutasi: `in`, `out`, `adjustment_add`, dan `adjustment_subtract`.
- Update stok dan insert riwayat dijalankan dalam satu transaksi SQLite.
- Saat order dibuat, seluruh inventory aktif yang tertaut ke produk dikurangi sebesar `quantity × usage_per_sale`; proses order dibatalkan atomik jika stok tidak cukup.

### Report dan keuangan

- `orders.payment_method` mendukung `cash`, `qris`, `bank_transfer`, dan `ewallet`.
- `orders.discount_amount` dan `orders.promo_code` menyimpan hasil penerapan promo pada saat checkout.
- `financial_entries` menyimpan `expense`, `capital_in`, atau `capital_out`, kategori, nominal, metode pembayaran, tanggal, catatan, dan pembuat.
- Agregasi report dijalankan server-side dengan filter tanggal; order berstatus `cancelled` dikecualikan.
- Laba rugi: omzet bersih dikurangi biaya operasional periode.
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
- `GET /api/settings`
- `GET /api/categories`
- `GET /api/products`
- `GET /api/promotions`
- `POST /api/auth/register`
- `POST /api/auth/login`

### Customer

- `POST /api/orders`
- `GET /api/customer/orders`
- `GET /api/auth/me`
- `PUT /api/profile`
- `PUT /api/profile/password`

### Cashier / Manager / Admin

- `GET /api/cashier/stats`
- `GET /api/cashier/orders`
- `PATCH /api/cashier/orders/:id/status`

### Manager / Admin

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

## 5. Auth dan role

JWT memakai secret dari `APP_JWT_SECRET`. Role yang didukung:

- `customer`
- `cashier`
- `manager`
- `admin`

Admin tersedia sebagai akun user biasa (`admin@franchise.local`) dan diarahkan ke dashboard Manager/Admin. Endpoint legacy `/api/auth/admin` tetap dipertahankan untuk kompatibilitas halaman `/admin` lama.

Untuk token user yang memiliki `userId`, middleware memeriksa bahwa user masih tersedia, aktif, dan memiliki role yang sesuai. Dengan demikian, akun yang dinonaktifkan atau dihapus tidak dapat terus menggunakan token lama.

Frontend menyimpan token di localStorage dengan key generik:

- `franchise-user-token`
- `franchise-user`
- `franchise-admin-token`
- `franchise-cart`

### Enforcement RBAC

- Endpoint Cashier (`/api/cashier/*`) membutuhkan permission `cashier_station`.
- Endpoint kategori membutuhkan permission `categories`; `GET /api/manager/categories` juga dapat dipakai role dengan permission `products` untuk dropdown produk.
- Endpoint produk membutuhkan permission `products`; `GET /api/manager/products` juga dapat dipakai role dengan permission `inventory` untuk tautan item inventory ke produk.
- Endpoint promosi, cashier, inventory, report/financial, dan settings masing-masing membutuhkan permission modul terkait.
- Endpoint RBAC membutuhkan role `admin` dan permission `rbac`.
- Endpoint legacy `/api/admin/*` tetap tersedia dan ikut dicek memakai permission modul terkait.

## 6. Upload gambar

Upload gambar produk dan gambar brand memakai Data URL base64.

Validasi:

- Format: PNG, JPG/JPEG, WebP, GIF.
- Maksimal sekitar 2 MB per gambar.
- Server membatasi JSON request hingga 6 MB.

Catatan teknis: penyimpanan Data URL cocok untuk penggunaan lokal/demo. Untuk produksi besar, sebaiknya pindahkan file ke object storage atau folder upload statis.

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
npm start
```

### 8.1 Deployment Render

- Infrastructure as Code: `render.yaml` di root repository.
- Service: Node.js Web Service, paket `free`, region `singapore`, branch `main`.
- Build command: `npm ci && npm run build`.
- Start command: `npm start`.
- Health check: `GET /api/health`.
- `PORT` disediakan otomatis oleh Render dan sudah dibaca oleh `server/index.ts`.
- `APP_JWT_SECRET` dibuat otomatis oleh Render.
- `APP_ADMIN_PASSWORD`, `APP_MANAGER_PASSWORD`, dan `APP_CASHIER_PASSWORD` memakai `sync: false`, sehingga nilainya diminta pada pembuatan Blueprint dan tidak masuk Git.
- Frontend hasil Vite dilayani Express dari folder `dist`; route non-API menggunakan fallback `index.html`.
- SQLite memakai filesystem service yang bersifat ephemeral pada paket gratis. Data runtime dan gambar Data URL tidak dijamin bertahan setelah sleep, restart, atau redeploy; deployment produksi harus memakai penyimpanan persisten.

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
