# Anggaran & Realisasi Keuangan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Tab "Anggaran" di menu Keuangan (program Disetujui/Berjalan + sisa anggaran) dan pencatatan realisasi oleh Bendahara yang ikut masuk ke Mutasi.

**Architecture:** Lib baru `src/lib/realisasi.ts` (hitung sisa, daftar, catat) + route `/api/realisasi` + modul UI di `src/ui/keuangan-js.ts`. Realisasi disimpan di tabel baru `Realisasi Program` (base BPK) dan satu baris Mutasi (base Bendahara). Hak akses ditegakkan server.

**Tech Stack:** Next.js App Router, TypeScript, Airtable REST (`at`, `listUntil`), vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-11-13-realisasi-anggaran-design.md`

## Global Constraints
- Jangan hapus tabel Airtable. Tabel/field baru: laporkan ke pemilik dan email ke timmy.theopelus@gmail.com.
- Token hanya di env server. Baca = `keuanganBoleh(acc)`; tulis = Bendahara atau Superadmin; mode "Lihat sebagai" (`acc.viewAs`) menolak tulis.
- Email/WA umat tidak tampil. UI berbahasa Indonesia. Branch: `feat/realisasi-anggaran` dari main (setelah fix visibilitas di-merge). Merge/push hanya dengan persetujuan.

## Review Focus
- Dua realisasi bersamaan yang total-nya melebihi sisa: yang kedua harus ditolak (sisa dihitung segar, bukan cache).
- Langkah tulis Mutasi sukses tapi Realisasi gagal: pesan galat jelas, tidak ada penghapusan otomatis.
- Program berstatus Draft/Menunggu/Ditolak/Selesai: realisasi ditolak (409).
- Nominal 0, negatif, atau bukan angka: ditolak (400).
- Anggaran mode "Total" (tanpa baris rincian): sisa = total anggaran dikurangi realisasi.

### Task 1: Skema Realisasi Program
**Files:** Modify `src/lib/proker-schema.ts`; Test `tests/proker-schema.test.ts`
**Interfaces:** Produces `T_REALISASI: string`, `RZ = { programId, tanggal, nominal, keterangan, penerima, mutasiId, oleh, waktu }` (field id).
- [ ] Buat tabel `Realisasi Program` di base BPK lewat MCP Airtable: Program ID (teks, primary), Tanggal (date), Nominal (currency), Keterangan (teks), Penerima (teks), Mutasi ID (teks), Dicatat oleh (teks), Waktu (createdTime). Persetujuan pembuatan sudah diberikan pengguna.
- [ ] Salin id tabel/field ke `proker-schema.ts`; tambah tes bentuk id (`/^tbl/`, `/^fld/`).
- [ ] Kirim email ke timmy.theopelus@gmail.com (Gmail MCP) berisi tabel + field baru; laporkan juga ke pengguna. Commit.

### Task 2: Logika anggaran dan realisasi
**Files:** Create `src/lib/realisasi.ts`; Test `tests/realisasi.test.ts`
**Interfaces:** Consumes `keuanganBoleh`, `peranOf`, `at`, `listUntil`, `T_PROGRAM/T_ANGGARAN/PK/AG`, `KEU`, `T.mutasi`. Produces:
- `hitungSisa(anggaran: number, realisasi: number[]): { terpakai: number; sisa: number }` (murni)
- `daftarAnggaran(acc: Access): Promise<{ programs: { id; nama; seksi; status; anggaran; terpakai; sisa; baris: {keterangan; nominal}[]; realisasi: {tanggal; nominal; keterangan; penerima}[] }[]; bisaCatat: boolean }>`
- `catatRealisasi(acc: Access, input: { programId; tanggal; nominal; keterangan; penerima?; account; rekening }): Promise<{ id: string; sisa: number }>`
- [ ] Tes RED: `hitungSisa` (kosong, sebagian, melebihi); `daftarAnggaran` hanya status Disetujui/Berjalan dan 403 untuk non-keuangan; `catatRealisasi` menolak: bukan Bendahara/Superadmin (403), `viewAs` (403), nominal <=0 (400), status salah (409), nominal > sisa (409). Sukses: memanggil tulis Mutasi lebih dulu (Jenis pengeluaran, keterangan berawalan `[Proker: nama]`), lalu Realisasi berisi id Mutasi.
- [ ] Tes RED: tulis Realisasi gagal setelah Mutasi sukses -> HttpError 502 berpesan menyebut id Mutasi; tidak ada pemanggilan hapus.
- [ ] Implement ketiga fungsi; sisa dihitung dari data segar per panggilan; anggaran pengeluaran = jumlah baris Pengeluaran (mode Rincian) atau total (mode Total). Nama opsi Jenis pengeluaran dibaca dari data Mutasi, bukan ditebak.
- [ ] `npm test` hijau; commit.

### Task 3: Route API
**Files:** Create `src/app/api/realisasi/route.ts`; Test `tests/realisasi-api.test.ts`
**Interfaces:** Consumes Task 2. Produces `POST /api/realisasi` aksi `daftar` dan `catat`, pola sama dengan `api/proker/route.ts` (auth, effectiveAccess, HttpError -> status).
- [ ] Tes RED: 401 tanpa login; `daftar` mengembalikan `programs`; `catat` meneruskan input; galat 403/409 dipetakan.
- [ ] Implement meniru `api/proker/route.ts`; tes hijau; commit.

### Task 4: UI tab Anggaran
**Files:** Modify `src/ui/keuangan-js.ts`, `scripts/build-ui.mjs`, `docs/prototipe-artifact.html` jika perlu; Test `tests/keuangan-ui.test.ts`
**Interfaces:** Consumes `POST /api/realisasi`.
- [ ] Tes RED (jsdom): sub-tab "Anggaran" memuat daftar, menampilkan anggaran/terpakai/sisa dan bar progres; baris program dapat dibuka untuk detail dan riwayat realisasi; tombol "Catat realisasi" hanya bila `bisaCatat`; formulir menolak nominal > sisa dengan pesan Indonesia.
- [ ] Implement UI (rupiah `Rp 1.250.000`); build; `npm test` hijau; commit.
- [ ] Minta persetujuan lalu merge dan push.
