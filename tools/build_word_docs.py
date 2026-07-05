from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable, Sequence

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = ROOT / "docs"
OUTPUT_SUFFIX = os.getenv("DOCX_OUTPUT_SUFFIX", "")
OUTPUTS = {
    "fsd": DOCS_DIR / f"FSD{OUTPUT_SUFFIX}.docx",
    "tsd": DOCS_DIR / f"TSD{OUTPUT_SUFFIX}.docx",
    "user_guide": DOCS_DIR / f"USER_GUIDE{OUTPUT_SUFFIX}.docx",
}

PROJECT_NAME = "Franchise Ordering Platform"
UPDATE_DATE = "2026-07-05"

PRIMARY = "2E74B5"
PRIMARY_DARK = "1F4D78"
TEXT = "1F2937"
MUTED = "667085"
LIGHT_FILL = "F4F7FB"
TABLE_HEADER = "E8EEF5"
ACCENT_FILL = "FFF3E8"
BORDER = "D9E2EC"


def hex_to_rgb(value: str) -> RGBColor:
    value = value.strip("#")
    return RGBColor(int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16))


def set_cell_shading(cell, fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=80, start=120, bottom=80, end=120) -> None:
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)

    for m, v in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{m}"))
        if node is None:
            node = OxmlElement(f"w:{m}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(v))
        node.set(qn("w:type"), "dxa")


def set_cell_border(cell, color: str = BORDER, size: str = "6") -> None:
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    borders = tc_pr.first_child_found_in("w:tcBorders")
    if borders is None:
        borders = OxmlElement("w:tcBorders")
        tc_pr.append(borders)
    for edge in ("top", "left", "bottom", "right"):
        tag = f"w:{edge}"
        element = borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), size)
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), color)


def set_table_layout(table, widths: Sequence[float] | None = None) -> None:
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.autofit = False
    tbl_pr = table._tbl.tblPr
    tbl_w = tbl_pr.find(qn("w:tblW"))
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.append(tbl_w)
    tbl_w.set(qn("w:w"), "9360")
    tbl_w.set(qn("w:type"), "dxa")

    tbl_ind = tbl_pr.find(qn("w:tblInd"))
    if tbl_ind is None:
        tbl_ind = OxmlElement("w:tblInd")
        tbl_pr.append(tbl_ind)
    tbl_ind.set(qn("w:w"), "120")
    tbl_ind.set(qn("w:type"), "dxa")

    layout = tbl_pr.find(qn("w:tblLayout"))
    if layout is None:
        layout = OxmlElement("w:tblLayout")
        tbl_pr.append(layout)
    layout.set(qn("w:type"), "fixed")

    if widths:
        grid = table._tbl.tblGrid
        for grid_col in list(grid):
            grid.remove(grid_col)
        for width in widths:
            grid_col = OxmlElement("w:gridCol")
            grid_col.set(qn("w:w"), str(round(width * 1440)))
            grid.append(grid_col)
        for row in table.rows:
            for idx, width in enumerate(widths):
                if idx < len(row.cells):
                    row.cells[idx].width = Inches(width)
                    tc_pr = row.cells[idx]._tc.get_or_add_tcPr()
                    tc_w = tc_pr.find(qn("w:tcW"))
                    if tc_w is None:
                        tc_w = OxmlElement("w:tcW")
                        tc_pr.append(tc_w)
                    tc_w.set(qn("w:w"), str(round(width * 1440)))
                    tc_w.set(qn("w:type"), "dxa")


def set_table_borders_and_margins(table) -> None:
    for row in table.rows:
        for cell in row.cells:
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            set_cell_margins(cell)
            set_cell_border(cell)


def set_paragraph_spacing(paragraph, before=0, after=6, line=1.25) -> None:
    fmt = paragraph.paragraph_format
    fmt.space_before = Pt(before)
    fmt.space_after = Pt(after)
    fmt.line_spacing = line
    fmt.line_spacing_rule = WD_LINE_SPACING.MULTIPLE


def apply_run_font(run, size: int | float | None = None, bold: bool | None = None, color: str | None = None) -> None:
    run.font.name = "Calibri"
    run._element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
    if size:
        run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    if color:
        run.font.color.rgb = hex_to_rgb(color)


def set_styles(doc: Document) -> None:
    styles = doc.styles

    normal = styles["Normal"]
    normal.font.name = "Calibri"
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
    normal.font.size = Pt(11)
    normal.font.color.rgb = hex_to_rgb(TEXT)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.25
    normal.paragraph_format.line_spacing_rule = WD_LINE_SPACING.MULTIPLE

    for style_name, size, color, before, after in (
        ("Heading 1", 16, PRIMARY, 18, 10),
        ("Heading 2", 13, PRIMARY, 14, 7),
        ("Heading 3", 12, PRIMARY_DARK, 10, 5),
    ):
        style = styles[style_name]
        style.font.name = "Calibri"
        style._element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
        style.font.size = Pt(size)
        style.font.color.rgb = hex_to_rgb(color)
        style.font.bold = True
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.keep_with_next = True
        style.paragraph_format.line_spacing = 1.15

    for list_style in ("List Bullet", "List Number"):
        style = styles[list_style]
        style.font.name = "Calibri"
        style._element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
        style.font.size = Pt(10.5)
        style.paragraph_format.left_indent = Inches(0.375)
        style.paragraph_format.first_line_indent = Inches(-0.188)
        style.paragraph_format.space_after = Pt(4)
        style.paragraph_format.line_spacing = 1.25


def new_doc(doc_code: str, doc_title: str, subtitle: str) -> Document:
    doc = Document()
    section = doc.sections[0]
    section.start_type = WD_SECTION.NEW_PAGE
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(1)
    section.bottom_margin = Inches(1)
    section.left_margin = Inches(1)
    section.right_margin = Inches(1)
    section.header_distance = Inches(0.492)
    section.footer_distance = Inches(0.492)

    set_styles(doc)
    add_footer(section, doc_code)
    add_masthead(doc, doc_code, doc_title, subtitle)
    return doc


def add_footer(section, doc_code: str) -> None:
    paragraph = section.footer.paragraphs[0]
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    paragraph.text = f"{PROJECT_NAME} · {doc_code} · Update {UPDATE_DATE}"
    for run in paragraph.runs:
        apply_run_font(run, size=8.5, color=MUTED)


def add_masthead(doc: Document, doc_code: str, title: str, subtitle: str) -> None:
    masthead = doc.add_table(rows=1, cols=2)
    set_table_layout(masthead, widths=(4.15, 2.35))
    set_table_borders_and_margins(masthead)
    for cell in masthead.rows[0].cells:
        set_cell_shading(cell, LIGHT_FILL)

    left, right = masthead.rows[0].cells
    p = left.paragraphs[0]
    p.text = doc_code
    p.runs[0].font.size = Pt(9)
    p.runs[0].bold = True
    p.runs[0].font.color.rgb = hex_to_rgb(PRIMARY)
    p2 = left.add_paragraph(PROJECT_NAME)
    apply_run_font(p2.runs[0], size=11, bold=True, color=TEXT)
    set_paragraph_spacing(p, after=2, line=1)
    set_paragraph_spacing(p2, after=0, line=1)

    rp = right.paragraphs[0]
    rp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    rp.text = f"Update\n{UPDATE_DATE}"
    for run in rp.runs:
        apply_run_font(run, size=9, bold=True, color=MUTED)
    set_paragraph_spacing(rp, after=0, line=1.1)

    title_p = doc.add_paragraph()
    title_p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    set_paragraph_spacing(title_p, before=18, after=4, line=1.1)
    run = title_p.add_run(title)
    apply_run_font(run, size=22, bold=True, color=PRIMARY_DARK)

    subtitle_p = doc.add_paragraph()
    set_paragraph_spacing(subtitle_p, after=14, line=1.2)
    run = subtitle_p.add_run(subtitle)
    apply_run_font(run, size=11, color=MUTED)


def add_heading(doc: Document, text: str, level: int = 1) -> None:
    doc.add_heading(text, level=level)


def add_body(doc: Document, text: str, after: int = 6) -> None:
    p = doc.add_paragraph(text)
    set_paragraph_spacing(p, after=after)


def add_bullets(doc: Document, items: Iterable[str]) -> None:
    for item in items:
        p = doc.add_paragraph(item, style="List Bullet")
        set_paragraph_spacing(p, after=4, line=1.25)


def add_numbered(doc: Document, items: Iterable[str]) -> None:
    for item in items:
        p = doc.add_paragraph(item, style="List Number")
        set_paragraph_spacing(p, after=4, line=1.25)


def add_info_box(doc: Document, title: str, body: str) -> None:
    table = doc.add_table(rows=1, cols=1)
    set_table_layout(table, widths=(6.5,))
    set_table_borders_and_margins(table)
    cell = table.cell(0, 0)
    set_cell_shading(cell, ACCENT_FILL)
    p = cell.paragraphs[0]
    p.text = title
    apply_run_font(p.runs[0], size=10.5, bold=True, color=PRIMARY_DARK)
    set_paragraph_spacing(p, after=2, line=1.1)
    bp = cell.add_paragraph(body)
    apply_run_font(bp.runs[0], size=10, color=TEXT)
    set_paragraph_spacing(bp, after=0, line=1.2)


def add_table(doc: Document, headers: Sequence[str], rows: Sequence[Sequence[str]], widths: Sequence[float]) -> None:
    table = doc.add_table(rows=1, cols=len(headers))
    set_table_layout(table, widths=widths)
    set_table_borders_and_margins(table)
    header_cells = table.rows[0].cells
    for idx, header in enumerate(headers):
        header_cells[idx].text = header
        set_cell_shading(header_cells[idx], TABLE_HEADER)
        for p in header_cells[idx].paragraphs:
            for run in p.runs:
                apply_run_font(run, size=9.5, bold=True, color=PRIMARY_DARK)
            set_paragraph_spacing(p, after=0, line=1.1)

    for row in rows:
        cells = table.add_row().cells
        for idx, value in enumerate(row):
            cells[idx].text = value
            set_cell_margins(cells[idx])
            set_cell_border(cells[idx])
            for p in cells[idx].paragraphs:
                for run in p.runs:
                    apply_run_font(run, size=9.5, color=TEXT)
                set_paragraph_spacing(p, after=0, line=1.15)
    doc.add_paragraph()


def add_code_block(doc: Document, lines: Sequence[str]) -> None:
    table = doc.add_table(rows=1, cols=1)
    set_table_layout(table, widths=(6.5,))
    set_table_borders_and_margins(table)
    cell = table.cell(0, 0)
    set_cell_shading(cell, "F7F7F7")
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    for idx, line in enumerate(lines):
        if idx:
            p.add_run().add_break(WD_BREAK.LINE)
        run = p.add_run(line)
        run.font.name = "Consolas"
        run._element.rPr.rFonts.set(qn("w:eastAsia"), "Consolas")
        run.font.size = Pt(9.5)
        run.font.color.rgb = hex_to_rgb(TEXT)
    doc.add_paragraph()


def build_fsd() -> None:
    doc = new_doc(
        "FSD",
        "Functional Specification Document",
        "Dokumen kebutuhan fungsional untuk platform pemesanan online franchise makanan/minuman yang dapat dikustom.",
    )

    add_heading(doc, "1. Tujuan", 1)
    add_body(
        doc,
        "Aplikasi ini menyediakan website pemesanan online yang dapat dikustom untuk berbagai franchise makanan/minuman. "
        "Tidak ada identitas brand yang dikunci ke satu nama; manager dapat mengubah identitas usaha, konten landing page, "
        "warna, kontak, gambar, dan prefix nomor pesanan.",
    )

    add_info_box(
        doc,
        "Prinsip utama",
        "Satu aplikasi dapat digunakan oleh banyak brand/franchise dengan mengganti data konfigurasi, produk, promosi, dan tampilan publik.",
    )

    add_heading(doc, "2. Role Pengguna", 1)
    add_table(
        doc,
        ("Role", "Kapabilitas utama"),
        (
            ("Pelanggan", "Registrasi/login, melihat menu dan promosi, memilih add-on produk, checkout, dan melacak status pesanan."),
            ("Cashier", "Login cashier, melihat pesanan masuk, mengubah status pesanan, serta memantau ringkasan order dan total penjualan."),
            ("Manager", "Mengelola kategori menu, produk dan add-on, promosi, cashier, inventory, Report operasional/keuangan, stasiun cashier, serta pengaturan franchise."),
            ("Admin", "Secara default mengakses seluruh modul operasional dan mengelola RBAC untuk menentukan modul yang boleh dibuka Cashier, Manager, dan Admin."),
        ),
        widths=(1.45, 5.05),
    )

    add_heading(doc, "3. Pengaturan Franchise", 1)
    add_body(doc, "Manager dapat mengubah elemen brand dan konten toko tanpa mengubah kode aplikasi.")
    add_table(
        doc,
        ("Area", "Yang dapat dikustom"),
        (
            ("Identitas", "Nama usaha, logo singkat, tagline, warna utama, dan warna aksen."),
            ("Kontak", "Nomor WhatsApp toko dan email kontak."),
            ("Pesanan", "Prefix nomor pesanan dan estimasi delivery."),
            ("Landing page", "Teks hero, gambar hero, teks menu, teks tentang, gambar tentang, lokasi, dan footer."),
            ("Dampak tampilan", "Perubahan langsung memengaruhi halaman toko, login, cashier, tracking, dan manager."),
        ),
        widths=(1.75, 4.75),
    )

    add_heading(doc, "4. Modul Utama", 1)

    add_heading(doc, "4.1 Landing Page Toko", 2)
    add_bullets(
        doc,
        (
            "Menampilkan brand aktif, hero, benefit, katalog menu, promo, tentang, lokasi, dan footer.",
            "Katalog mengambil produk aktif dari backend.",
            "Filter kategori menu mengambil kategori aktif dari backend dan mengikuti urutan yang diatur Manager.",
            "Jika backend belum aktif, frontend memakai katalog cadangan generik.",
        ),
    )

    add_heading(doc, "4.2 Kategori Menu", 2)
    add_bullets(
        doc,
        (
            "Role yang diberi permission kategori dapat membuat kategori menu custom untuk franchise apa saja.",
            "Setiap kategori memiliki nama, emoji/icon, urutan tampil, dan status aktif.",
            "Kategori aktif tampil sebagai filter storefront; kategori nonaktif tidak tampil dan produk pada kategori tersebut tidak dikirim ke katalog publik.",
            "Kategori yang masih dipakai produk akan diarsipkan saat dihapus agar data produk tetap aman.",
            "Rename kategori ikut memperbarui produk terkait secara otomatis.",
        ),
    )

    add_heading(doc, "4.3 Keranjang dan Checkout", 2)
    add_bullets(
        doc,
        (
            "Pelanggan dapat menambah, mengurangi, atau menghapus item dari keranjang.",
            "Produk dapat memiliki add-on opsional; harga add-on dihitung ke harga satuan, subtotal, dan total.",
            "Nama serta harga add-on disimpan sebagai snapshot pada detail pesanan.",
            "Ongkir otomatis gratis jika subtotal minimal Rp75.000.",
            "Pelanggan memilih pembayaran tunai, QRIS, e-wallet, atau transfer bank serta dapat memakai kode promo aktif.",
            "Checkout wajib login sebagai pelanggan.",
            "Pesanan tersimpan di database.",
            "Jika nomor WhatsApp toko tersedia, aplikasi membuka WhatsApp dengan pesan konfirmasi.",
        ),
    )

    add_heading(doc, "4.4 Tracking Pesanan", 2)
    add_bullets(
        doc,
        (
            "Pelanggan melihat pesanan aktif dan riwayat pesanan.",
            "Status diperbarui otomatis setiap 15 detik.",
        ),
    )

    add_heading(doc, "4.5 Cashier", 2)
    add_bullets(
        doc,
        (
            "Cashier, Manager, dan Admin dapat memproses pesanan.",
            "Dashboard menampilkan filter order aktif, baru, diproses, siap, dan semua.",
            "Detail pesanan menampilkan add-on yang dipilih pelanggan.",
        ),
    )

    add_heading(doc, "4.6 Inventory", 2)
    add_bullets(
        doc,
        (
            "Manager dan Admin dapat CRUD item inventory dengan SKU, satuan, stok, batas minimum, dan harga modal.",
            "Item dapat ditautkan ke produk dan jumlah pemakaian agar checkout mengurangi stok secara otomatis.",
            "Pesanan ditolak secara atomik jika stok item yang tertaut tidak mencukupi.",
            "Mutasi meliputi stok masuk, stok keluar, koreksi tambah, dan koreksi kurang.",
            "Sistem menolak mutasi yang membuat stok negatif dan menyimpan riwayat stok sebelum/sesudah.",
            "Dashboard menampilkan item aktif, stok menipis, mutasi hari ini, dan riwayat mutasi.",
        ),
    )

    add_heading(doc, "4.7 Report Operasional dan Keuangan", 2)
    add_bullets(
        doc,
        (
            "Report operasional mencakup penjualan harian/real-time, produk terlaris, pembayaran, stok, dan pelanggan.",
            "Report keuangan mencakup laba rugi, arus kas, neraca sederhana, perubahan modal, dan biaya per kategori.",
            "Manager/Admin dapat mencatat biaya atau perubahan modal, memfilter periode, dan mengekspor CSV.",
            "Penjualan non-batal menjadi pendapatan otomatis; utang, piutang, depresiasi, dan pajak belum dihitung.",
        ),
    )

    add_heading(doc, "4.8 Manager dan Admin", 2)
    add_bullets(
        doc,
        (
            "Tab Kategori untuk CRUD kategori menu jika role memiliki permission kategori.",
            "Tab Produk untuk CRUD produk dan pengelolaan add-on.",
            "Tab Promosi untuk CRUD promosi.",
            "Tab Cashier untuk CRUD akun cashier, termasuk edit identitas/password dan pengaturan status akses login.",
            "Tab Inventory untuk item stok, batas minimum, dan stock movement.",
            "Tab Report untuk laporan operasional/keuangan, ekspor CSV, serta transaksi biaya/modal.",
            "Tab Franchise untuk pengaturan brand dan halaman publik.",
            "Tab RBAC khusus Admin untuk mengatur akses modul per role.",
        ),
    )

    add_heading(doc, "4.9 RBAC Modul", 2)
    add_bullets(
        doc,
        (
            "Admin dapat membuka tab RBAC pada dashboard Manager/Admin.",
            "RBAC menyimpan matrix akses role cashier, manager, dan admin terhadap modul Stasiun Cashier, Kategori Menu, Produk & Add-on, Promosi, Akun Cashier, Inventory, Report, Franchise, dan RBAC.",
            "Menu dashboard hanya menampilkan tab yang diizinkan untuk role aktif.",
            "Backend memvalidasi permission modul pada setiap endpoint operasional.",
            "Permission Admin - RBAC wajib aktif agar Admin tidak terkunci dari pengaturan akses.",
            "Permission RBAC untuk Cashier/Manager dikunci nonaktif; pengaturan RBAC hanya dapat dikelola Admin.",
        ),
    )

    add_heading(doc, "5. Aturan Dokumen", 1)
    add_body(doc, "Setiap perubahan fitur, alur bisnis, API, database, role, atau UI utama harus memperbarui dokumen berikut:")
    add_bullets(doc, ("docs/FSD.md", "docs/TSD.md", "docs/USER_GUIDE.md", "docs/FSD.docx", "docs/TSD.docx", "docs/USER_GUIDE.docx"))

    add_heading(doc, "6. Riwayat Perubahan", 1)
    add_table(
        doc,
        ("Tanggal", "Perubahan"),
        (
            ("2026-07-05", "Menambahkan RBAC per modul untuk Admin, tabel permission role, tab RBAC, menu dashboard berbasis permission, dan validasi permission di backend."),
            ("2026-07-05", "Menambahkan modul kategori menu custom berbasis database, endpoint kategori publik/manager, tab Kategori khusus Manager, dan sinkronisasi kategori ke storefront."),
            ("2026-07-05", "Menambahkan modul Report, pembayaran/promo checkout, transaksi biaya/modal, ekspor CSV, valuasi persediaan, dan pengurangan stok otomatis."),
            ("2026-07-05", "Menambahkan User Guide sebagai dokumen wajib yang selalu diperbarui bersama FSD dan TSD."),
            ("2026-07-05", "Menambahkan add-on produk end-to-end, role Admin dengan akses seluruh modul operasional, dan modul Inventory untuk item stok serta stock movement."),
            ("2026-07-05", "Melengkapi modul Cashier pada role Manager menjadi CRUD penuh: tambah, lihat, edit, aktif/nonaktif, ubah password, dan hapus."),
            ("2026-07-05", "Menambahkan penyempurnaan stabilitas agar setup database baru tetap dapat menjalankan modul manager dan promosi."),
            ("2026-07-05", "Menambahkan modul manager untuk melihat daftar cashier dan membuat akun cashier baru."),
            ("2026-07-05", "Project digenerikkan untuk franchise apa saja, ditambah pengaturan franchise, upload gambar brand, dan dokumen FSD/TSD."),
            ("2026-07-05", "Sisa teks/konfigurasi brand lama dibersihkan dari UI, README, env example, seed/default, dan key penyimpanan browser."),
            ("2026-07-05", "Dokumen FSD/TSD dibuat ulang dalam format Word yang lebih rapi untuk kebutuhan review dan arsip."),
        ),
        widths=(1.35, 5.15),
    )

    doc.save(OUTPUTS["fsd"])


def build_tsd() -> None:
    doc = new_doc(
        "TSD",
        "Technical Specification Document",
        "Dokumen spesifikasi teknis untuk frontend, backend, database, API, role, dan konfigurasi franchise.",
    )

    add_heading(doc, "1. Stack Teknologi", 1)
    add_table(
        doc,
        ("Layer", "Teknologi"),
        (
            ("Frontend", "React + TypeScript + Vite."),
            ("Backend", "Express + TypeScript."),
            ("Database", "SQLite via better-sqlite3."),
            ("Auth", "JWT."),
            ("Styling", "CSS modular per halaman."),
        ),
        widths=(1.65, 4.85),
    )

    add_heading(doc, "2. Struktur Penting", 1)
    add_table(
        doc,
        ("Path", "Fungsi"),
        (
            ("src/App.tsx", "Landing page, katalog, pemilih add-on, keranjang, checkout."),
            ("src/AuthApp.tsx", "Login/register pelanggan serta login cashier, manager, admin."),
            ("src/CashierApp.tsx", "Dashboard cashier."),
            ("src/CustomerOrdersApp.tsx", "Tracking pesanan pelanggan."),
            ("src/ManagerApp.tsx", "Dashboard manager/admin berbasis permission, kategori menu, produk dan add-on, promosi, cashier, inventory, Report, RBAC, dan settings."),
            ("src/InventoryModule.tsx", "UI item inventory, minimum stok, mutasi, dan riwayat stok."),
            ("src/ReportsModule.tsx", "Dashboard Report operasional/keuangan, filter periode, ekspor CSV, dan transaksi biaya/modal."),
            ("src/franchise.ts", "Default settings, hook settings, dan apply warna brand."),
            ("src/api.ts", "API client frontend."),
            ("server/index.ts", "Routing API dan middleware auth."),
            ("server/db.ts", "Skema database, query, seed, dan settings."),
        ),
        widths=(2.25, 4.25),
    )

    add_heading(doc, "3. Database", 1)
    add_body(doc, "Database default: data/franchise.db.")
    add_table(
        doc,
        ("Tabel", "Kegunaan"),
        (
            ("users", "Data akun pelanggan, cashier, manager, dan admin."),
            ("menu_categories", "Kategori menu custom, emoji/icon, urutan tampil, status aktif, dan jumlah produk terkait."),
            ("products", "Data menu/product yang tampil di katalog."),
            ("product_addons", "Pilihan add-on, harga, status, dan relasi ke produk."),
            ("promotions", "Data promo yang dapat dikelola manager."),
            ("orders", "Header pesanan, status, total, dan data pengiriman."),
            ("order_items", "Detail produk, harga satuan, dan snapshot add-on per pesanan."),
            ("inventory_items", "SKU, stok, minimum, harga modal, relasi produk, pemakaian per penjualan, dan status."),
            ("stock_movements", "Mutasi stok beserta stok sebelum/sesudah dan pembuat."),
            ("financial_entries", "Biaya operasional, modal masuk/keluar, kategori, metode pembayaran, dan tanggal."),
            ("role_permissions", "Matrix permission role terhadap modul operasional dan RBAC."),
            ("app_settings", "Pengaturan franchise dalam bentuk key-value."),
        ),
        widths=(1.8, 4.7),
    )

    add_heading(doc, "3.1 RBAC", 2)
    add_bullets(
        doc,
        (
            "role_permissions menyimpan role, module, enabled, dan updated_at.",
            "Role yang dapat diatur adalah cashier, manager, dan admin.",
            "Modul RBAC: cashier_station, categories, products, promotions, cashiers, inventory, reports, settings, dan rbac.",
            "Default permission: Cashier hanya cashier_station; Manager seluruh modul operasional kecuali rbac; Admin seluruh modul termasuk rbac.",
            "Permission admin + rbac dipaksa aktif; permission rbac untuk Cashier/Manager dipaksa nonaktif.",
            "server/index.ts memakai requireModuleAccess dan requireAnyModuleAccess agar permission ditegakkan di backend.",
            "GET /api/permissions/me dipakai frontend untuk menentukan tab dashboard yang boleh tampil.",
        ),
    )

    add_heading(doc, "3.2 Kategori Menu", 2)
    add_bullets(
        doc,
        (
            "menu_categories menyimpan label, emoji, sort_order, status aktif, created_at, dan updated_at.",
            "Seed kategori default dibuat saat database kosong; kategori unik dari produk lama ikut dimigrasikan.",
            "GET /api/categories hanya mengirim kategori aktif untuk storefront.",
            "GET /api/manager/categories mengirim kategori aktif/nonaktif beserta productCount.",
            "CRUD kategori dibatasi permission categories melalui POST/PUT/PATCH/DELETE /api/manager/categories.",
            "Produk divalidasi terhadap menu_categories dan tidak lagi memakai daftar kategori hardcoded.",
            "getProducts(false) hanya mengirim produk aktif dengan kategori aktif; getProducts(true) tetap menampilkan seluruh produk dashboard.",
            "Rename kategori ikut memperbarui products.category; delete kategori terpakai mengarsipkan kategori dengan active = 0.",
        ),
    )

    add_heading(doc, "3.3 Add-on dan Detail Pesanan", 2)
    add_bullets(
        doc,
        (
            "API publik hanya mengirim add-on aktif; Manager/Admin menerima add-on aktif dan nonaktif.",
            "order_items.addons_json menyimpan snapshot ID, nama, dan harga add-on saat checkout.",
            "order_items.unit_price menyimpan harga produk ditambah add-on per satuan.",
        ),
    )

    add_heading(doc, "3.4 Inventory", 2)
    add_bullets(
        doc,
        (
            "Tipe mutasi: in, out, adjustment_add, adjustment_subtract.",
            "Update current_stock dan insert stock_movements berjalan dalam satu transaksi SQLite.",
            "Mutasi ditolak jika menghasilkan stok negatif.",
            "Order mengurangi item terkait sebesar quantity x usage_per_sale dan membuat stock movement otomatis.",
        ),
    )

    add_heading(doc, "3.5 Report dan Keuangan", 2)
    add_bullets(
        doc,
        (
            "orders menyimpan payment_method, discount_amount, dan promo_code sebagai snapshot checkout.",
            "Agregasi laporan dikerjakan server-side berdasarkan periode dan mengecualikan order cancelled.",
            "Laba rugi memakai omzet bersih dikurangi biaya; arus kas turut menghitung modal masuk/keluar.",
            "Neraca sederhana memakai saldo kas historis dan nilai inventory current_stock x unit_cost.",
        ),
    )

    add_heading(doc, "3.6 app_settings", 2)
    add_body(doc, "Tabel app_settings menyimpan pengaturan franchise dalam bentuk key-value. Field yang dipakai aplikasi:")
    add_bullets(
        doc,
        (
            "businessName, shortName, tagline, heroEyebrow, heroTitle, heroHighlight, heroDescription",
            "heroImageUrl, storyImageUrl, deliveryEstimate, deliveryNote",
            "locationLabel, locationTitle, locationDescription, footerDescription",
            "contactEmail, whatsappNumber, orderPrefix, primaryColor, accentColor",
            "menuKicker, menuTitle, menuDescription, aboutKicker, aboutTitle",
            "aboutDescription, aboutReviewQuote, aboutReviewAuthor",
        ),
    )

    add_heading(doc, "4. API Utama", 1)
    add_table(
        doc,
        ("Area", "Endpoint"),
        (
            ("Public", "GET /api/health; GET /api/settings; GET /api/categories; GET /api/products; GET /api/promotions; POST /api/auth/register; POST /api/auth/login"),
            ("Customer", "POST /api/orders; GET /api/customer/orders; GET /api/auth/me; PUT /api/profile; PUT /api/profile/password"),
            ("Cashier / Manager / Admin", "GET /api/cashier/stats; GET /api/cashier/orders; PATCH /api/cashier/orders/:id/status"),
            ("Manager / Admin", "CRUD categories, product/add-on, promotion, cashier; inventory; GET reports; POST/DELETE financial entries; GET/PUT settings"),
            ("Permission / Admin RBAC", "GET /api/permissions/me; GET /api/admin/rbac; PUT /api/admin/rbac"),
        ),
        widths=(1.75, 4.75),
    )

    add_heading(doc, "5. Auth dan Role", 1)
    add_body(doc, "JWT memakai secret dari APP_JWT_SECRET. Role yang didukung:")
    add_bullets(doc, ("customer", "cashier", "manager", "admin"))
    add_body(doc, "Admin tersedia sebagai akun user biasa dan diarahkan ke dashboard Manager/Admin. Endpoint /api/auth/admin tetap tersedia untuk halaman admin legacy.")
    add_body(doc, "Untuk token dengan userId, middleware memeriksa bahwa user masih tersedia, aktif, dan memiliki role yang sesuai.")
    add_body(doc, "Frontend menyimpan token dan data sesi di localStorage dengan key generik:")
    add_table(
        doc,
        ("Key", "Fungsi"),
        (
            ("franchise-user-token", "Token pelanggan, cashier, manager, atau admin."),
            ("franchise-user", "Data profil user aktif."),
            ("franchise-admin-token", "Token halaman admin legacy."),
            ("franchise-cart", "Keranjang belanja."),
        ),
        widths=(2.35, 4.15),
    )

    add_heading(doc, "5.1 Enforcement RBAC", 2)
    add_bullets(
        doc,
        (
            "Endpoint Cashier membutuhkan permission cashier_station.",
            "Endpoint kategori membutuhkan permission categories; GET /api/manager/categories juga dapat dipakai permission products untuk dropdown produk.",
            "Endpoint produk membutuhkan permission products; GET /api/manager/products juga dapat dipakai permission inventory untuk tautan item inventory.",
            "Endpoint promosi, cashier, inventory, report/financial, dan settings membutuhkan permission modul terkait.",
            "Endpoint RBAC membutuhkan role admin dan permission rbac.",
            "Endpoint legacy /api/admin/* tetap tersedia dan ikut dicek memakai permission modul terkait.",
        ),
    )

    add_heading(doc, "6. Upload Gambar", 1)
    add_body(doc, "Upload gambar produk dan gambar brand memakai Data URL base64.")
    add_bullets(
        doc,
        (
            "Format: PNG, JPG/JPEG, WebP, GIF.",
            "Maksimal sekitar 2 MB per gambar.",
            "Server membatasi JSON request hingga 6 MB.",
            "Untuk produksi besar, file sebaiknya dipindahkan ke object storage atau folder upload statis.",
        ),
    )

    add_heading(doc, "7. Pengaturan Brand Frontend", 1)
    add_body(doc, "Frontend mengambil settings dari GET /api/settings melalui useFranchiseSettings(). Hook tersebut:")
    add_bullets(
        doc,
        (
            "Menggunakan default generik saat data belum tersedia.",
            "Mengambil settings dari backend.",
            "Mengubah CSS variable --brand-primary dan --brand-accent.",
            "Mengubah judul browser sesuai nama usaha.",
        ),
    )

    add_heading(doc, "8. Build dan Run", 1)
    add_table(
        doc,
        ("Mode", "Command"),
        (
            ("Development", "npm run dev"),
            ("Build", "npm run build"),
            ("Production", "npm run build lalu npm start"),
        ),
        widths=(1.65, 4.85),
    )

    add_heading(doc, "9. Aturan Update Dokumen", 1)
    add_info_box(
        doc,
        "Wajib sinkron",
        "Setiap perubahan kode yang memengaruhi fitur, API, database, role, pengaturan brand, upload, atau alur checkout wajib memperbarui FSD, TSD, dan User Guide, termasuk versi Markdown dan Word.",
    )
    add_bullets(doc, ("docs/FSD.md", "docs/TSD.md", "docs/USER_GUIDE.md", "docs/FSD.docx", "docs/TSD.docx", "docs/USER_GUIDE.docx"))

    add_heading(doc, "10. Riwayat Perubahan", 1)
    add_table(
        doc,
        ("Tanggal", "Perubahan teknis"),
        (
            ("2026-07-05", "Menambahkan role_permissions, default matrix RBAC, endpoint /api/permissions/me dan /api/admin/rbac, guard permission per modul, serta UI tab RBAC Admin."),
            ("2026-07-05", "Menambahkan menu_categories, seed/migrasi kategori, endpoint kategori publik/manager, validasi produk ke kategori database, tab Kategori khusus Manager, dan dropdown produk berbasis API."),
            ("2026-07-05", "Menambahkan financial_entries, payment/diskon order, linkage inventory-produk, pengurangan stok atomik, agregasi Report, endpoint, UI, dan ekspor CSV."),
            ("2026-07-05", "Menambahkan generator dan artefak User Guide Markdown/Word serta menjadikannya dokumen wajib dalam sinkronisasi dokumentasi."),
            ("2026-07-05", "Menambahkan migrasi role admin, seed akun Admin, akses endpoint Manager/Cashier, dan dashboard Admin berbasis ManagerApp."),
            ("2026-07-05", "Menambahkan product_addons, CRUD add-on, pemilih add-on storefront, kalkulasi server-side, dan snapshot add-on pada order_items."),
            ("2026-07-05", "Menambahkan inventory_items, stock_movements, transaksi stok, endpoint inventory, dan UI Inventory untuk Manager/Admin."),
            ("2026-07-05", "Menambahkan updateCashier dan deleteCashier, endpoint PUT/DELETE cashier, form edit/status/password, aksi hapus, serta validasi sesi user aktif."),
            ("2026-07-05", "Memindahkan seed promosi setelah mapper promosi siap agar server tidak gagal saat database masih kosong."),
            ("2026-07-05", "Menambahkan fungsi database getCashiers, endpoint manager cashier, API client, dan tab Cashier di dashboard manager."),
            ("2026-07-05", "Menambahkan app_settings, API settings, hook brand frontend, tab Franchise manager, upload gambar brand, prefix order dinamis, dan key localStorage generik."),
            ("2026-07-05", "Mengganti default database/env/package/README menjadi generik dan membersihkan sisa string brand lama dari kode utama."),
            ("2026-07-05", "Menambahkan output Word untuk FSD dan TSD dengan format dokumen spesifikasi yang lebih rapi."),
        ),
        widths=(1.35, 5.15),
    )

    doc.save(OUTPUTS["tsd"])


def build_user_guide() -> None:
    doc = new_doc(
        "USER GUIDE",
        "Panduan Pengguna",
        "Panduan operasional ringkas untuk Pelanggan, Cashier, Manager, dan Admin pada Franchise Ordering Platform.",
    )

    add_info_box(
        doc,
        "Cara menggunakan panduan",
        "Pilih bagian sesuai role Anda. Ikuti langkah secara berurutan dan gunakan bagian Pemecahan Masalah jika aplikasi tidak merespons sesuai harapan.",
    )

    add_heading(doc, "1. Mulai Menggunakan Aplikasi", 1)
    add_numbered(
        doc,
        (
            "Buka terminal pada folder project.",
            "Jalankan npm run dev.",
            "Tunggu API dan WEB berstatus aktif.",
            "Buka http://localhost:5175 pada browser.",
        ),
    )
    add_table(
        doc,
        ("Halaman", "Alamat"),
        (
            ("Toko", "http://localhost:5175/"),
            ("Login", "http://localhost:5175/login"),
            ("Pesanan pelanggan", "http://localhost:5175/orders"),
            ("Stasiun Cashier", "http://localhost:5175/cashier"),
            ("Dashboard Manager/Admin", "http://localhost:5175/manager"),
        ),
        widths=(2.05, 4.45),
    )

    add_heading(doc, "1.1 Akun Lokal Bawaan", 2)
    add_table(
        doc,
        ("Role", "Email", "Password"),
        (
            ("Cashier", "cashier@franchise.local", "cashier123"),
            ("Manager", "manager@franchise.local", "manager123"),
            ("Admin", "admin@franchise.local", "admin123"),
        ),
        widths=(1.25, 3.4, 1.85),
    )
    add_info_box(doc, "Penting untuk produksi", "Ganti seluruh password bawaan dan APP_JWT_SECRET sebelum aplikasi dipublikasikan.")

    add_heading(doc, "2. Ringkasan Hak Akses", 1)
    add_body(doc, "Hak akses operasional memakai RBAC. Tabel berikut adalah default awal; Admin dapat mengubah akses modul melalui tab RBAC.")
    add_table(
        doc,
        ("Modul", "Pelanggan", "Cashier", "Manager", "Admin"),
        (
            ("Toko dan katalog", "Ya", "Ya", "Ya", "Ya"),
            ("Keranjang dan checkout", "Ya", "-", "-", "-"),
            ("Pesanan Saya", "Ya", "-", "-", "-"),
            ("Stasiun Cashier", "-", "Ya", "Ya", "Ya"),
            ("Kategori menu", "-", "-", "Ya", "Ya"),
            ("Produk dan add-on", "-", "-", "Ya", "Ya"),
            ("Promosi", "-", "-", "Ya", "Ya"),
            ("Akun Cashier", "-", "-", "Ya", "Ya"),
            ("Inventory", "-", "-", "Ya", "Ya"),
            ("Report operasional & keuangan", "-", "-", "Ya", "Ya"),
            ("Pengaturan franchise", "-", "-", "Ya", "Ya"),
            ("RBAC modul", "-", "-", "-", "Ya"),
        ),
        widths=(2.1, 1.1, 1.1, 1.1, 1.1),
    )

    add_heading(doc, "3. Panduan Pelanggan", 1)
    add_heading(doc, "3.1 Registrasi dan Login", 2)
    add_numbered(
        doc,
        (
            "Tekan tombol masuk pada halaman toko dan pilih role Pelanggan.",
            "Untuk akun baru, pilih Daftar sekarang lalu isi nama, email, dan password minimal 8 karakter.",
            "Untuk akun lama, isi email dan password lalu tekan Masuk.",
        ),
    )

    add_heading(doc, "3.2 Memilih Produk dan Add-on", 2)
    add_numbered(
        doc,
        (
            "Cari produk melalui kategori atau kolom pencarian.",
            "Tekan tombol tambah pada kartu produk.",
            "Jika produk memiliki add-on, pilih satu atau beberapa tambahan yang diinginkan.",
            "Periksa total harga per item lalu tekan Tambah ke keranjang.",
        ),
    )
    add_body(doc, "Produk yang sama dengan kombinasi add-on berbeda ditampilkan sebagai baris keranjang yang berbeda.")

    add_heading(doc, "3.3 Keranjang dan Checkout", 2)
    add_numbered(
        doc,
        (
            "Buka ikon keranjang dan periksa produk, add-on, harga satuan, serta subtotal.",
            "Gunakan tombol tambah, kurang, atau hapus untuk mengatur jumlah.",
            "Tekan Lanjut checkout lalu pilih Diantar atau Ambil sendiri.",
            "Pilih pembayaran Tunai, QRIS, E-wallet, atau Transfer bank serta kode promo jika tersedia.",
            "Isi data pemesan, alamat jika diperlukan, dan catatan opsional.",
            "Tekan tombol pembuatan pesanan. Jika WhatsApp toko tersedia, aplikasi membuka pesan konfirmasi.",
        ),
    )

    add_heading(doc, "3.4 Melacak Pesanan", 2)
    add_numbered(
        doc,
        (
            "Buka menu profil dan pilih Pesanan saya, atau buka /orders.",
            "Gunakan tab Aktif untuk pesanan berjalan dan Riwayat untuk pesanan selesai/dibatalkan.",
            "Pilih pesanan untuk melihat status, item, add-on, metode penerimaan, alamat, dan total.",
            "Gunakan tombol Perbarui status jika tidak ingin menunggu pembaruan otomatis 15 detik.",
        ),
    )

    add_heading(doc, "4. Panduan Cashier", 1)
    add_heading(doc, "4.1 Login", 2)
    add_numbered(doc, ("Buka halaman login.", "Pilih role Cashier.", "Masukkan akun yang diberikan Manager/Admin.", "Aplikasi akan membuka /cashier."))
    add_heading(doc, "4.2 Memproses Pesanan", 2)
    add_numbered(
        doc,
        (
            "Gunakan filter atau pencarian untuk menemukan pesanan.",
            "Buka Detail untuk memeriksa item, add-on, pelanggan, alamat, dan catatan.",
            "Ubah Pesanan baru menjadi Sedang dimasak.",
            "Ubah Sedang dimasak menjadi Siap.",
            "Untuk delivery, ubah Siap menjadi Sedang diantar lalu Selesai. Untuk pickup, ubah Siap langsung menjadi Selesai.",
            "Gunakan Dibatalkan hanya jika pesanan benar-benar dibatalkan.",
        ),
    )

    add_heading(doc, "5. Panduan Manager", 1)
    add_body(doc, "Tab Manager yang tampil mengikuti permission RBAC yang diberikan Admin.")
    add_heading(doc, "5.1 Kategori Menu", 2)
    add_numbered(
        doc,
        (
            "Buka tab Kategori lalu tekan Tambah kategori.",
            "Isi icon/emoji, nama kategori, urutan tampil, dan status aktif.",
            "Gunakan angka urutan lebih kecil agar kategori tampil lebih awal di storefront.",
            "Gunakan ikon edit untuk mengubah kategori, switch untuk aktif/nonaktif, dan ikon hapus untuk menghapus atau mengarsipkan.",
            "Jika kategori masih dipakai produk, sistem menonaktifkan/mengarsipkan kategori agar produk lama tetap aman.",
            "Jika nama kategori diubah, produk yang memakai kategori tersebut ikut diperbarui otomatis.",
        ),
    )

    add_heading(doc, "5.2 Produk dan Add-on", 2)
    add_numbered(
        doc,
        (
            "Buka tab Produk lalu tekan Tambah produk atau ikon edit.",
            "Isi identitas produk, harga, kategori, status, dan foto bila tersedia. Pastikan kategori sudah dibuat di tab Kategori.",
            "Pada Pilihan add-on, tekan Tambah add-on lalu isi nama, harga, dan status aktif.",
            "Tekan Simpan produk. Gunakan switch untuk aktif/nonaktif dan ikon hapus untuk menghapus atau mengarsipkan.",
        ),
    )

    add_heading(doc, "5.3 Promosi", 2)
    add_numbered(
        doc,
        (
            "Buka tab Promosi dan pilih Tambah promosi atau Edit.",
            "Isi judul, deskripsi, kode, tipe dan nilai diskon, minimum belanja, periode, serta status.",
            "Simpan perubahan atau hapus promosi yang tidak digunakan.",
        ),
    )

    add_heading(doc, "5.4 Mengelola Cashier", 2)
    add_numbered(
        doc,
        (
            "Buka tab Cashier dan tekan Tambah cashier.",
            "Isi nama, email, dan password awal minimal 8 karakter.",
            "Gunakan ikon edit untuk mengubah identitas, password, atau status login.",
            "Gunakan ikon hapus untuk menghapus akun. Akun nonaktif/terhapus tidak dapat memakai sesi lama.",
        ),
    )

    add_heading(doc, "5.5 Inventory", 2)
    add_numbered(
        doc,
        (
            "Buka tab Inventory lalu tekan Tambah item.",
            "Isi nama, SKU unik, satuan, stok awal, minimum stok, harga modal, dan status.",
            "Pilih Produk terkait dan jumlah Pemakaian per produk terjual jika stok harus berkurang otomatis.",
            "Tekan tombol tambah pada baris item untuk mencatat pergerakan stok.",
            "Pilih Stok masuk, Stok keluar, Koreksi tambah, atau Koreksi kurang; isi jumlah dan catatan.",
            "Buka Riwayat mutasi untuk melihat stok sebelum/sesudah, waktu, catatan, dan pembuat.",
        ),
    )
    add_info_box(doc, "Kontrol stok", "Stok keluar dan koreksi kurang ditolak jika membuat stok negatif. Stok yang sama dengan atau di bawah minimum ditandai Stok menipis.")

    add_heading(doc, "5.6 Report Operasional dan Keuangan", 2)
    add_numbered(
        doc,
        (
            "Buka tab Report dan pilih periode Dari/Sampai; data diperbarui otomatis setiap 30 detik.",
            "Pada Operasional, tinjau penjualan harian, produk terlaris, pembayaran, stok, dan pelanggan.",
            "Pada Keuangan, tinjau laba rugi, arus kas, neraca, perubahan modal, dan biaya per kategori.",
            "Tekan Catat transaksi untuk memasukkan biaya, modal masuk, atau penarikan modal.",
            "Tekan Ekspor CSV untuk mengunduh seluruh bagian laporan pada periode terpilih.",
        ),
    )
    add_info_box(doc, "Batas laporan", "Penjualan non-batal masuk otomatis. Laporan bersifat manajerial dasar dan belum menghitung utang, piutang, depresiasi, atau pajak.")

    add_heading(doc, "5.7 Pengaturan Franchise", 2)
    add_numbered(
        doc,
        (
            "Buka tab Franchise.",
            "Ubah identitas brand, warna, kontak, prefix pesanan, konten halaman depan, dan gambar.",
            "Tekan Simpan pengaturan franchise lalu periksa halaman toko.",
        ),
    )

    add_heading(doc, "6. Panduan Admin", 1)
    add_numbered(
        doc,
        (
            "Pilih role Admin pada halaman login.",
            "Admin diarahkan ke /manager dengan label Admin Dashboard.",
            "Gunakan modul yang diizinkan RBAC; secara default Kategori, Produk, Promosi, Cashier, Inventory, Report, Franchise, Stasiun Cashier, dan RBAC aktif.",
            "Buka tab RBAC untuk mengatur modul yang boleh diakses Cashier, Manager, dan Admin.",
            "Centang modul yang ingin diaktifkan, hilangkan centang untuk menonaktifkan, lalu tekan Simpan RBAC.",
            "Permission Admin - RBAC wajib aktif dan tidak dapat dimatikan agar Admin tidak terkunci dari pengaturan akses.",
            "Jika akses modul dimatikan, tab modul tersebut hilang dari dashboard role terkait dan request backend ditolak.",
            "Buka Stasiun cashier untuk melihat dan memproses semua pesanan jika permission Stasiun Cashier aktif.",
        ),
    )

    add_heading(doc, "7. Menu Profil", 1)
    add_bullets(
        doc,
        (
            "Membuka halaman utama sesuai role.",
            "Mengubah nama dan email.",
            "Mengganti password.",
            "Keluar dari aplikasi.",
        ),
    )

    add_heading(doc, "8. Referensi Status Pesanan", 1)
    add_table(
        doc,
        ("Status", "Arti"),
        (
            ("Pesanan baru", "Pesanan diterima dan menunggu diproses."),
            ("Sedang dimasak", "Tim sedang menyiapkan pesanan."),
            ("Siap", "Pesanan siap diambil atau dikirim."),
            ("Sedang diantar", "Pesanan sedang menuju pelanggan."),
            ("Selesai", "Pesanan telah diterima/diambil."),
            ("Dibatalkan", "Pesanan tidak dilanjutkan."),
        ),
        widths=(1.9, 4.6),
    )

    add_heading(doc, "9. Pemecahan Masalah", 1)
    add_heading(doc, "9.1 Halaman Tidak Dapat Dibuka", 2)
    add_bullets(doc, ("Pastikan terminal berada di folder project.", "Jalankan npm run dev dan biarkan terminal tetap terbuka.", "Jika port 5175 dipakai, tutup proses lama sebelum menjalankan ulang project."))
    add_heading(doc, "9.2 Sesi Berakhir atau Akses Ditolak", 2)
    add_bullets(doc, ("Logout lalu login kembali menggunakan role yang benar.", "Pastikan akun masih aktif.", "Hubungi Manager/Admin jika akun Cashier dinonaktifkan atau permission modul belum diberikan."))
    add_heading(doc, "9.3 Add-on Gagal Digunakan", 2)
    add_body(doc, "Add-on mungkin dinonaktifkan setelah masuk keranjang. Hapus produk dari keranjang lalu tambahkan kembali dengan add-on yang tersedia.")
    add_heading(doc, "9.4 Kategori Tidak Muncul di Storefront", 2)
    add_bullets(doc, ("Pastikan role Anda memiliki permission Kategori di RBAC.", "Pastikan kategori berstatus aktif.", "Pastikan produk terkait juga aktif.", "Kategori aktif tanpa produk akan tampil sebagai filter kosong sampai produk ditambahkan."))
    add_heading(doc, "9.5 Mutasi Stok Ditolak", 2)
    add_bullets(doc, ("Pastikan jumlah lebih dari nol.", "Pastikan pengurangan tidak membuat stok negatif.", "Pastikan item inventory masih aktif."))
    add_heading(doc, "9.6 Upload Gambar Gagal", 2)
    add_bullets(doc, ("Gunakan PNG, JPG/JPEG, WebP, atau GIF.", "Gunakan file maksimal sekitar 2 MB."))
    add_heading(doc, "9.7 Report Tidak Menampilkan Transaksi", 2)
    add_bullets(doc, ("Periksa periode Dari dan Sampai.", "Order cancelled tidak dihitung.", "Pastikan login menggunakan role Manager atau Admin."))

    add_heading(doc, "10. Aturan Pembaruan Dokumen", 1)
    add_info_box(
        doc,
        "Wajib diperbarui bersama",
        "Setiap perubahan fitur, role, API, database, alur pengguna, atau UI utama wajib memperbarui FSD, TSD, dan User Guide dalam format Markdown dan Word.",
    )
    add_bullets(doc, ("docs/FSD.md dan docs/FSD.docx", "docs/TSD.md dan docs/TSD.docx", "docs/USER_GUIDE.md dan docs/USER_GUIDE.docx"))

    add_heading(doc, "11. Riwayat Perubahan", 1)
    add_table(
        doc,
        ("Tanggal", "Perubahan"),
        (
            ("2026-07-05", "Menambahkan panduan RBAC Admin per modul, default hak akses, efek tab dashboard berbasis permission, dan pemecahan masalah akses ditolak."),
            ("2026-07-05", "Menambahkan panduan kategori menu custom khusus Manager, efek kategori aktif/nonaktif pada storefront, dan catatan akses Admin terhadap kategori."),
            ("2026-07-05", "Menambahkan panduan Report, pembayaran/promo, transaksi biaya/modal, ekspor CSV, harga modal, dan stok otomatis."),
            ("2026-07-05", "Membuat User Guide pertama untuk seluruh role, add-on produk, Inventory, profil, dan pemecahan masalah."),
        ),
        widths=(1.35, 5.15),
    )

    doc.save(OUTPUTS["user_guide"])


def main() -> None:
    DOCS_DIR.mkdir(exist_ok=True)
    build_fsd()
    build_tsd()
    build_user_guide()
    for name, path in OUTPUTS.items():
        print(f"{name.upper()} -> {path}")


if __name__ == "__main__":
    main()
