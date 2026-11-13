# Program Kerja Tahap 1: Ringkasan Angka, Pembatasan Data, Kartu Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (eksekusi native di sesi ini) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menu Program Kerja hanya menampilkan program yang berhak dilihat akun, punya tiga angka klik-able (jumlah dan rupiah) yang memfilter tabel, dan dashboard Pimpinan/Sekjen/Bendahara menampilkan ringkasan program disetujui.

**Architecture:** Logika hitung angka berupa fungsi murni baru `hitungRingkas` (`src/lib/proker-ringkas.ts`). `daftarProgram` dipecah menjadi pemuat bersama `muatProgram` (membaca Airtable) dan penyaring cakupan akun; aksi server baru `ringkasan` memakai semua program tetapi hanya untuk peran tertentu. UI memakai `src/ui/proker-js.ts` dan `scripts/build-ui.mjs` (pola yang sudah ada). Tanpa tabel Airtable baru.

**Tech Stack:** Next.js App Router + TS, Airtable REST (`src/lib/airtable.ts`), vitest + JSDOM.

**Spec:** `docs/superpowers/specs/2026-11-13-proker-ringkasan-papan-pencairan-design.md` (bagian Tahap 1).

## Global Constraints
- Jangan hapus tabel Airtable. Tahap 1 tidak membuat tabel atau field baru.
- Hak akses ditegakkan di server; token Airtable hanya di server.
- Antarmuka berbahasa Indonesia. Tampilan HP dulu: tidak boleh melebar ke samping.
- Status program: Draft, Menunggu Koord Bidang, Menunggu Kolaborasi, Menunggu Sekjen, Disetujui, Berjalan, Selesai, Ditolak.
- Grup angka: Selesai = {Selesai}; Disetujui dan berjalan = {Disetujui, Berjalan}; Menunggu persetujuan = {Menunggu Koord Bidang, Menunggu Kolaborasi, Menunggu Sekjen}. Nilai = `totalPengeluaran`.
- Commit diakhiri dua baris atribusi: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` dan `Claude-Session: https://claude.ai/code/session_01LtGBC9VseW2ocJxZkVU2oK`.

## Review Focus
- Anggota biasa (bukan Ketua/Wakil) seksi A tidak melihat program seksi B, walau satu bidang: hanya program yang seksi pengaju atau seksi terlibatnya adalah seksi A.
- Koordinator Bidang melihat semua program bidangnya, tetapi tidak program bidang lain.
- Program yang seksi terlibatnya mencantumkan seksi akun tetap terlihat oleh akun itu.
- Akun tanpa jabatan sama sekali: daftar kosong, bukan error.
- Program tanpa anggaran (total 0, tanpa baris): angka nilai 0, tidak NaN.
- `ringkasan` dipanggil peran Koordinator Seksi biasa: 403.

---

### Task 1: Pembatasan data per seksi dan bidang

**Files:**
- Modify: `src/lib/proker.ts` (fungsi `daftarProgram`, sekitar baris 170-200)
- Test: `tests/proker-api.test.ts`

**Interfaces:**
- Produces: `function dalamCakupan(p: { bidang: string; seksiPengaju: string; seksiTerlibat: string[]; dibuatOleh: string }, ctx: { semua: boolean; bidangKoord: Set<string>; seksiSaya: Set<string>; email: string }): boolean` (diekspor dari `src/lib/proker.ts`, murni). `bidangKoord` diisi dari `peran.koordBidang` (dinormalisasi `norm`), bukan dari semua baris jabatan.

- [ ] **Step 1: Tulis test gagal** di `tests/proker-api.test.ts`, blok `describe("daftarProgram cakupan")`, memakai fake Airtable yang sudah ada: (a) anggota seksi "Forkom 1" (rows: Kesekretariatan/Forkom 1/Anggota, peran kosong) tidak melihat program seksi pengaju "Forkom 2" di bidang yang sama; (b) program seksi pengaju "Forkom 2" dengan seksiTerlibat ["Forkom 1"] terlihat oleh anggota Forkom 1; (c) peran `koordBidang: ["Kesekretariatan"]` melihat program "Forkom 1" dan "Forkom 2" tetapi tidak program bidang "Inreach (El Shaddai)"; (d) akun tanpa baris jabatan mendapat `[]`; (e) `pimpinan: true` melihat semua.
- [ ] **Step 2:** Run `npx vitest run tests/proker-api.test.ts`. Expected: (a) dan (c) FAIL (kode lama meloloskan seluruh bidang).
- [ ] **Step 3:** Implement `dalamCakupan` dan pakai di `daftarProgram` menggantikan syarat `bidangSaya.has(...)`. `semua = peran.sekjen || peran.pimpinan || acc.level === "Superadmin"`.
- [ ] **Step 4:** Run `npx vitest run tests/proker-api.test.ts`. Expected: PASS semua.
- [ ] **Step 5:** Commit `fix: program hanya terlihat oleh seksi terkait dan koordinator bidangnya`.

### Task 2: Fungsi hitung angka dan aksi server `ringkasan`

**Files:**
- Create: `src/lib/proker-ringkas.ts`
- Modify: `src/lib/proker.ts` (pecah `muatProgram`, tambah `ringkasanProgram`), `src/app/api/proker/route.ts` (aksi `ringkasan`)
- Test: `tests/proker-ringkas.test.ts` (fungsi murni), `tests/proker-api.test.ts` (aksi)

**Interfaces:**
- Produces (`proker-ringkas.ts`):
  - `type Grup = "selesai" | "berjalan" | "menunggu"`
  - `type Ringkas = Record<Grup, { n: number; nilai: number }>`
  - `const GRUP_STATUS: Record<Grup, readonly string[]>` (nilai dari Global Constraints)
  - `function hitungRingkas(list: { status: string; totalPengeluaran: number }[]): Ringkas`
- Produces (`proker.ts`):
  - `async function muatProgram(acc: Access): Promise<Program[]>` (isi lama `daftarProgram` tanpa penyaringan; `Program` = elemen hasil `daftarProgram` yang sekarang)
  - `async function ringkasanProgram(acc: Access): Promise<Ringkas & { menungguSekjen: number }>`: memanggil `peranOf`; hanya `peran.sekjen || peran.pimpinan || peran.bendahara || acc.level === "Superadmin"`, selain itu `HttpError(403, "Tidak punya akses ke ringkasan program.")`; memakai semua program (tidak dibatasi cakupan). `menungguSekjen` = jumlah status "Menunggu Sekjen".
- Rute: `POST /api/proker` body `{ aksi: "ringkasan" }` mengembalikan JSON hasil `ringkasanProgram`.

- [ ] **Step 1: Tulis test gagal** `tests/proker-ringkas.test.ts`: daftar kosong menghasilkan semua `{n:0,nilai:0}`; campuran status (`Selesai` 100, `Disetujui` 200, `Berjalan` 300, `Menunggu Sekjen` 50, `Menunggu Koord Bidang` 25, `Draft` 999, `Ditolak` 888) menghasilkan selesai `{1,100}`, berjalan `{2,500}`, menunggu `{2,75}` (Draft dan Ditolak tidak dihitung). Di `proker-api.test.ts`: `ringkasan` oleh Koordinator Seksi biasa ditolak 403; oleh sekjen, pimpinan, bendahara berhasil dan menghitung program lintas bidang.
- [ ] **Step 2:** Run `npx vitest run tests/proker-ringkas.test.ts tests/proker-api.test.ts`. Expected: FAIL (modul belum ada).
- [ ] **Step 3:** Implement `proker-ringkas.ts`; pecah `daftarProgram` menjadi `muatProgram` + penyaring (`daftarProgram` tetap tanda tangan lama); tambah `ringkasanProgram`; tambah cabang `ringkasan` di route.
- [ ] **Step 4:** Run `npx vitest run tests/proker-ringkas.test.ts tests/proker-api.test.ts`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: ringkasan angka program kerja untuk pimpinan, sekjen, bendahara`.

### Task 3: Tiga angka klik-able di menu Program Kerja

**Files:**
- Modify: `src/ui/proker-js.ts` (fungsi `tiles`, `draw`, `filt`), `scripts/build-ui.mjs` (gaya angka bila perlu; wadah `#proTiles` sudah ada)
- Test: `tests/proker-ui.test.ts` (JSDOM, pola `tests/keuangan-ui.test.ts`)

**Interfaces:**
- Consumes: `hitungRingkas`, `GRUP_STATUS` dari Task 2 (nilai disalin sebagai konstanta di skrip UI karena skrip berjalan di browser; test memastikan sama dengan modul).
- Produces: tiga tombol `button.tile.go` di `#proTiles` dengan `data-grup="selesai|berjalan|menunggu"`, isi: angka jumlah, label ("Selesai", "Disetujui dan berjalan", "Menunggu persetujuan"), dan nilai `Rp ...`. Klik menyetel `filt.grup` dan menandai `.on`; klik lagi mengosongkan. Kotak "Menunggu tindakan saya" tetap ada (dua tile lama dipertahankan bentuknya: "Program" diganti tiga angka baru, "Menunggu tindakan saya" tetap).

- [ ] **Step 1: Tulis test gagal** `tests/proker-ui.test.ts`: dengan 5 program palsu (statusnya campur) memuat `PROKER_JS` di JSDOM; assert tiga tombol ada dengan teks jumlah dan `Rp` yang benar; klik tombol "berjalan" membuat baris `#proBody` hanya berisi program berstatus Disetujui/Berjalan; klik lagi mengembalikan semua baris; kata kunci pencarian bekerja bersamaan dengan filter angka; daftar kosong menampilkan "Belum ada program." dan angka 0 / `Rp 0`.
- [ ] **Step 2:** Run `npx vitest run tests/proker-ui.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement di `proker-js.ts`: `filt.grup`; `draw` memakai `GRUP[filt.grup]` bila terisi; `tiles` merender tiga tombol dengan `aria-pressed`. Hitung angka di browser dari `items` (sudah dibatasi server).
- [ ] **Step 4:** Run `npx vitest run tests/proker-ui.test.ts`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: tiga angka program kerja yang memfilter tabel`.

### Task 4: Kartu ringkasan di dashboard utama

**Files:**
- Modify: `scripts/build-ui.mjs` (sisipkan wadah `#proDashCard` di `#tab-beranda` melalui `swap`, pola menu lain), `src/ui/proker-js.ts` (fungsi `kartuDashboard`, hook `window.EPK_PROKER_DASH`)
- Modify: pemanggil `showTab` untuk `beranda` agar memanggil hook bila ada (di `build-ui.mjs`, dekat baris yang sudah memanggil `EPK_PROKER_OPEN`)
- Test: `tests/proker-ui.test.ts`

**Interfaces:**
- Consumes: aksi server `ringkasan` (Task 2).
- Produces: kartu `#proDashCard` berisi "Program Kerja": jumlah dan nilai Disetujui/Berjalan, dan jumlah "Menunggu Sekjen". Bila server menjawab 403 kartu disembunyikan tanpa pesan galat.

- [ ] **Step 1: Tulis test gagal** di `tests/proker-ui.test.ts`: `fetch` stub mengembalikan `{selesai:{n:1,nilai:100},berjalan:{n:2,nilai:500},menunggu:{n:2,nilai:75},menungguSekjen:1}` lalu `EPK_PROKER_DASH()` mengisi kartu dengan "2" dan "Rp 500" serta "1 menunggu Sekjen"; stub 403 membuat kartu `hidden`.
- [ ] **Step 2:** Run `npx vitest run tests/proker-ui.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Skrip `proker-js` hanya dikirim ke pengguna bertab Program Kerja (lihat `scripts/build-ui.mjs`/`render.ts`); pastikan Pimpinan, Sekjen, dan Bendahara mendapat tab itu lewat Administrasi, Akses per menu, dan catat di balasan akhir bahwa akses tab itu harus diberikan oleh Superadmin.
- [ ] **Step 4:** Run `npx vitest run tests/proker-ui.test.ts`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: kartu ringkasan program kerja di dashboard`.

### Task 5: Verifikasi dan deploy ke Vercel

**Files:** tidak ada perubahan kode.

- [ ] **Step 1:** Run `npm test` dan `npm run typecheck`. Expected: semua PASS, tanpa galat tipe.
- [ ] **Step 2:** Run `npm run build`. Expected: build Next.js sukses.
- [ ] **Step 3:** `git push origin main` (Vercel terhubung ke repo dan men-deploy otomatis). Cek status deploy; bila deploy gagal, perbaiki dari log, jangan paksa.
- [ ] **Step 4:** Buka situs yang sudah di-deploy di browser bawaan pada lebar HP (390 px): menu Program Kerja tidak melebar, tiga angka muncul, klik memfilter. Catat apa yang tidak bisa diperiksa tanpa login (halaman dilindungi Google) dan minta pemilik mengecek dengan akun Koordinator Seksi dan Sekjen.
- [ ] **Step 5:** Laporkan ke pemilik: apa yang selesai, dan bahwa Tahap 2 (papan Trello, tabel baru) menunggu persetujuan untuk dimulai.
