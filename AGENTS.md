# Project Documentation Rules

Setiap perubahan fitur, kode, API, database, role, alur pengguna, atau UI utama wajib memperbarui seluruh dokumen berikut:

- `docs/FSD.md`
- `docs/FSD.docx`
- `docs/TSD.md`
- `docs/TSD.docx`
- `docs/USER_GUIDE.md`
- `docs/USER_GUIDE.docx`

Setelah konten Markdown dan `tools/build_word_docs.py` disinkronkan, jalankan generator Word dan validasi dokumen sebelum pekerjaan dinyatakan selesai.

Setiap pembaruan `docs/FSD.md`, `docs/TSD.md`, dan `docs/USER_GUIDE.md` harus memakai bahasa Indonesia yang natural, jelas, dan profesional. Hindari kalimat yang terasa kaku atau seperti terjemahan mesin, tetapi pertahankan akurasi istilah teknis, role, URL, endpoint API, nama file, command, dan konfigurasi. Sinkronkan hasil akhirnya ke `tools/build_word_docs.py` serta seluruh versi `.docx`.
