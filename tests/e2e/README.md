# Playwright end-to-end tests

Jalankan seluruh test:

```bash
npm run test:e2e
```

Playwright otomatis menyalakan aplikasi lokal melalui `npm run dev`. Screenshot evidence untuk setiap test, termasuk test yang gagal, disimpan di:

```text
outputs/playwright-evidence/chromium/pass
outputs/playwright-evidence/chromium/fail
```

Laporan HTML disimpan di `outputs/playwright-report`. Untuk akun non-default, set environment variable `E2E_MANAGER_EMAIL`, `E2E_MANAGER_PASSWORD`, `E2E_CASHIER_EMAIL`, dan `E2E_CASHIER_PASSWORD` sebelum menjalankan test.

Definisi lengkap setiap test case, termasuk prioritas, prasyarat, data uji, langkah, dan expected result, tersedia di `tests/e2e/TEST_CASES.md`.
