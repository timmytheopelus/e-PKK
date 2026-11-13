# Tahap 1-2: Tata letak menu dan Kalender/Event Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Setiap menu terbuka ke dashboard pendek dengan laporan di tab Laporan (tabel gulir), dan Kalender/Event memakai Agenda view (default, mulai hari ini) dan Calendar view dengan hak edit lewat klik.

**Architecture:** UI tetap satu berkas `docs/prototipe-artifact.html` (dibangun `scripts/build-ui.mjs` menjadi `src/ui/dashboard-html.ts`) ditambah modul JS khusus (`keuangan-js.ts`, `inventaris-js.ts`). Pola baru: satu helper tab Laporan dan satu kelas tabel gulir bersama. Hak edit event ditegakkan di server (`src/lib/policy.ts` + `src/lib/proxy.ts`).

**Tech Stack:** Next.js 15 + TypeScript, vitest (+ jsdom), Airtable REST lewat proxy.

**Spec:** `docs/superpowers/specs/2026-11-13-menu-overhaul-program-kerja-design.md` (tahap 1 dan 2). Tahap 3-4 (Program Kerja, pencairan, Overall View) dibuat sebagai rencana terpisah setelah tahap ini.

## Global Constraints

- Bahasa antarmuka Indonesia; HP adalah layar utama (lebar 360-430 px, tanpa geser ke samping di luar kotak tabel).
- Tabel laporan: header terkunci (`position: sticky; top: 0`), baris selang-seling, kotak `overflow: auto; max-height: 70vh`; acuan gaya: kelas `.tablebox, .tw, .inv-tw` dan `.keu-tw` yang sudah ada (jangan membuat gaya tabel ketiga).
- Tampilan pertama setiap daftar adalah tabel.
- Nomor WA/email umat tidak tampil sebagai teks; alamat dan tanggal lahir tidak tampil (usia saja).
- Hak akses ditegakkan di server; tidak ada token di browser.
- Istilah: "Calendar view" dan "Agenda view" (bukan "Bulan" dan "Daftar").
- Setiap perubahan tabel/field Airtable dilaporkan ke pemilik dan dikirim ke timmy.theopelus@gmail.com.
- Sebelum push: `node --check` skrip hasil ekstraksi, `node scripts/build-ui.mjs`, `npx tsc --noEmit`, `npx vitest run`. Commit diakhiri dua baris atribusi dari system-reminder.

## Review Focus

- Pengguna dengan tab Kalender tapi bukan pembuat event, bukan admin, bukan Kesekretariatan: klik agenda tidak boleh membuka edit, dan permintaan update langsung ke server harus ditolak 403.
- Event tanpa tanggal selesai atau tanpa jam: tetap muncul di Agenda hari ini jika tanggal mulai >= hari ini.
- Event berlangsung hari ini yang jamnya sudah lewat: tetap tampil sebagai hari ini (bukan "sudah lewat").
- Menu dengan data kosong atau gagal dimuat: dashboard pendek dan tab Laporan tetap tampil dengan pesan kosong, tidak membuat halaman kosong.
- Layar sempit (360 px): tab Laporan bisa digeser horizontal sendiri tanpa menggeser halaman.

---

### Task 1: Helper tab Laporan dan kotak dashboard pendek

**Files:**
- Modify: `docs/prototipe-artifact.html` (CSS `.rtabs`, `.dash-short`; fungsi `reportTabs`)
- Test: `tests/laporan-tabs.test.ts`

**Interfaces:**
- Produces: `reportTabs(root: HTMLElement, tabs: {id: string; label: string; sectionId: string}[], opts?: {storeKey?: string}): void` yang membuat deretan tombol `role="tablist"` di `root`, hanya menampilkan section aktif (atribut `hidden` pada yang lain), mengingat pilihan di `localStorage[storeKey]` dalam try/catch. Kelas CSS `.rtabs` (baris tombol yang bisa digeser horizontal, `overflow-x: auto`, tanpa pembungkus) dan `.dash-short` (grid maksimal 2 kolom, tinggi total kira-kira satu layar HP).
- Consumes: kelas `.chip` yang sudah ada untuk gaya tombol.

- [ ] **Step 1: Write the failing test** `tests/laporan-tabs.test.ts`: render `renderDashboard(acc)`, ekstrak fungsi `reportTabs` dari HTML ke JSDOM, panggil dengan tiga tab; assert hanya satu section tidak `hidden`, klik tab kedua menampilkan section kedua dan menyembunyikan yang pertama, `aria-selected` benar, dan bila `localStorage` melempar error fungsi tetap bekerja.
- [ ] **Step 2: Run** `npx vitest run tests/laporan-tabs.test.ts`; expected FAIL (fungsi belum ada).
- [ ] **Step 3: Implement `reportTabs` dan CSS** di prototipe; pola mengikuti `viewChips` Pengurus tetapi umum.
- [ ] **Step 4: Run** test; expected PASS.
- [ ] **Step 5: Commit** "Helper tab Laporan dan kotak dashboard pendek".

### Task 2: Menu Pewarta (laporan yang paling ruwet)

**Files:**
- Modify: `docs/prototipe-artifact.html` (tab `tab-pewarta`, bagian `pwViews`, `pwSec*`)
- Test: `tests/menu-layout.test.ts`

**Interfaces:**
- Consumes: `reportTabs` (Task 1).
- Produces: menu Pewarta berisi `#pwRing` sebagai dashboard pendek (maks 4 kartu angka), lalu tab Laporan dengan urutan: Daftar (tabel, pertama), Per PD, Per modul, Pastor dan suster, Permohonan dan tema, Kuesioner. Semua tabel memakai `.tw`.

- [ ] **Step 1: Test** di `menu-layout.test.ts`: HTML tab Pewarta memuat `id="pwRptTabs"`; section `pwSecDaftar` adalah yang pertama dan satu-satunya yang tidak `hidden` saat awal; `pwSecPd`, `pwSecModul`, `pwSecPastor`, `pwSecLk`, `pwSecKui` ada sebagai tab; tidak ada `<table>` di Pewarta di luar `.tw`.
- [ ] **Step 2: Run** (FAIL).
- [ ] **Step 3: Pindahkan section** ke dalam tab Laporan memakai `reportTabs`; ubah daftar pewarta dan per-PD dari kartu panjang menjadi tabel `.tw` (kolom: Nama, PD, Status, Modul, Usia kelompok); filter `pwQ/pwStatus/...` dilipat dalam satu tombol "Filter" yang membuka panel.
- [ ] **Step 5: Run** semua test; expected PASS. **Commit**.

### Task 3: Menu Pengurus, PD, Pewarta luar kota, Umat, KEP

**Files:**
- Modify: `docs/prototipe-artifact.html` (tab `tab-pengurus`, `tab-pd`, `tab-luar`, `tab-umat`, `tab-kep`)
- Test: `tests/menu-layout.test.ts`

**Interfaces:** Consumes `reportTabs`. Setiap menu: kartu ringkasan maksimal satu layar, lalu tab Laporan dengan tabel `.tw`/`.tablebox` sebagai tab pertama. Pengurus: Tabel, Bagan (urutan Bagan/Tabel mengikuti keputusan pemilik, lihat Open Question di bawah). Filter banyak diganti satu tombol "Filter".

- [ ] **Step 1: Test** per menu: ada `#<menu>RptTabs` (atau chip view yang sudah ada), tab pertama adalah tabel, jumlah kontrol filter yang tampil sekaligus <= 2 (pencarian + tombol Filter).
- [ ] **Step 2: Run** (FAIL). **Step 3: Implement** per menu. **Step 4: Run** PASS. **Step 5: Commit** per menu.

### Task 4: Dashboard (Beranda), Event, Inventaris, Keuangan konsisten

**Files:**
- Modify: `docs/prototipe-artifact.html` (tab `tab-beranda`, `tab-event`), `src/ui/inventaris-js.ts`, `src/ui/keuangan-js.ts` (hanya bila menyimpang)
- Test: `tests/menu-layout.test.ts`, `tests/keuangan-ui.test.ts` (tetap lulus)

**Interfaces:** Beranda menjadi satu kotak `.dash-short`; panel laporan di bawahnya (tren permohonan, dan lain-lain) pindah ke tab Laporan. Tahap 4 memindahkan Beranda menjadi Overall View; di sini hanya merapikan. Keuangan dan Inventaris tidak diubah selain memastikan tabel memakai kelas bersama.

- [ ] **Step 1: Test** tab Beranda memuat `dash-short` dan `id="berRptTabs"`; test lama `tabel-style.test.ts` tetap lulus. **Step 2-5** seperti di atas, commit.

### Task 5: Agenda view dan Calendar view

**Files:**
- Modify: `docs/prototipe-artifact.html` (tab `tab-kalender`: `calPrev`, `calNext`, `.seg` tampilan, `cq`, `cJenis`, `cSifat`, `cPlan`, `cWaktu`, `kelChips`; tab `tab-event`: `evWaktu`)
- Test: `tests/kalender-agenda.test.ts`

**Interfaces:**
- Produces: `agendaItems(events: Ev[], today: string, showPast: boolean): Ev[]` (`today` format `YYYY-MM-DD`, urut naik menurut tanggal mulai; `Ev` memuat `tgl`, `selesai?`), dipakai Kalender dan Event. Tombol "Tampilkan yang sudah lewat" mengubah `showPast`. Label tampilan: "Agenda view" (default, aktif saat load) dan "Calendar view".
- Filter disederhanakan: kolom pencarian, satu tombol "Filter" (Jenis, Sifat, Status, Kelompok di panel yang bisa dilipat), `cWaktu` dihapus (digantikan tombol sudah-lewat).

- [ ] **Step 1: Write the failing tests** `tests/kalender-agenda.test.ts`: `agendaItems` dengan `today="2026-11-13"` dan event 2026-11-12, 2026-11-13 (tanpa jam), 2026-11-14, serta event 2026-11-12 sampai 2026-11-14 (berjalan): hasil `showPast=false` = [berjalan, 11-13, 11-14] terurut; `showPast=true` menyertakan 11-12; event tanpa `selesai` pada hari ini tetap masuk.
- [ ] **Step 2: Run** (FAIL). **Step 3: Implement `agendaItems`** sebagai fungsi murni di prototipe dan ganti label/default; **Step 4: Run** PASS; **Step 5: Commit**.

### Task 6: Hak edit event (server) dan edit lewat klik

**Files:**
- Create: `src/lib/event-edit.ts`
- Modify: `src/lib/policy.ts` (spesifikasi `[T.events]` mendapat `update`), `src/lib/proxy.ts` (cek per-record), `docs/prototipe-artifact.html` (klik agenda membuka formulir edit)
- Test: `tests/event-edit.test.ts`

**Interfaces:**
- Produces: `canEditEvent(acc: {email: string; level: string}, creatorEmail: string | undefined, isSekretariat: boolean): boolean` (true bila `level === "Admin"` atau `"Superadmin"`, atau `isSekretariat`, atau `creatorEmail` sama dengan `acc.email` tanpa membedakan huruf besar/kecil); `sekretariatEmails(): Promise<Set<string>>` (email akun yang umatnya memegang jabatan di bidang Kesekretariatan; cache 10 menit seperti `parokiKeuskupan` di `src/lib/sep.ts`).
- Consumes: field baru Event "Dibuat oleh" (email) yang diisi saat event dibuat lewat aplikasi; event lama tanpa pembuat hanya bisa diedit Admin/Kesekretariatan.

- [ ] **Step 1: Write the failing tests** `tests/event-edit.test.ts`: `canEditEvent` untuk Admin true; View non-pembuat non-sekre false; pembuat dengan huruf besar-kecil berbeda true; sekre true; pembuat kosong + View false. Test proxy: permintaan `update_records_for_table` ke `T.events` oleh View non-pembuat mendapat 403.
- [ ] **Step 2: Run** (FAIL).
- [ ] **Step 3: Implement** fungsi di `event-edit.ts`; di `policy.ts` tambahkan `update: { tabs: ["Kalender","Event"], fields: EF, record: "event-owner" }`; di `proxy.ts` untuk spesifikasi dengan `record: "event-owner"` baca dulu record target lalu panggil `canEditEvent` (403 bila false). Buat field "Dibuat oleh" (email) di tabel Event BPK lewat `mcp__Airtable__create_field`, lalu kirim email laporan ke timmy.theopelus@gmail.com dan sebut di balasan. Isi `Dibuat oleh` pada pembuatan event (`create` fields tetap, ditambah email akun di sisi server).
- [ ] **Step 4: Run** test; PASS. **Step 5: Commit**.

### Task 7: Riwayat perubahan event (14 hari)

**Files:**
- Create: `src/lib/event-log.ts`
- Modify: `src/lib/proxy.ts` (tulis log setelah update event berhasil)
- Test: `tests/event-log.test.ts`

**Interfaces:**
- Produces: `diffEvent(before: Record<string, unknown>, after: Record<string, unknown>, watch: string[]): {field: string; lama: string; baru: string}[]` (hanya field di `watch`: nama, tanggal, lokasi, jam, status) dan `logEventChange(eventId: string, by: string, changes: ReturnType<typeof diffEvent>): Promise<void>` yang menulis satu baris per perubahan ke tabel baru "Riwayat Event" (BPK).
- Tabel baru "Riwayat Event" dibuat lewat `mcp__Airtable__create_table` (Event, Field, Nilai lama, Nilai baru, Oleh, Waktu) dan dilaporkan/diemail seperti Task 6. Data ini dipakai tahap 4 (Overall View).

- [ ] **Step 1: Test** `diffEvent` mengembalikan hanya field yang berubah dan mengabaikan field di luar `watch`; `logEventChange` tidak melempar bila penulisan gagal (kegagalan log tidak boleh menggagalkan update event).
- [ ] **Step 2-5:** run FAIL, implement, run PASS, commit.

### Task 8: Verifikasi akhir dan rilis

- [ ] **Step 1:** Jalankan `node --check` skrip ekstraksi, `node scripts/build-ui.mjs`, `npx tsc --noEmit`, `npx vitest run`; semua harus lulus.
- [ ] **Step 2:** Buka halaman di Playwright (lebar 390 px) untuk setiap menu: tidak ada geser horizontal halaman, header tabel terkunci, tampilan pertama tabel; ambil screenshot.
- [ ] **Step 3:** `git pull --rebase`, push, pastikan deployment Vercel sukses; laporkan ke pemilik, termasuk email laporan tabel/field baru.

## Open Question untuk pemilik
"Selalu tampilan pertama tabel" bertabrakan dengan permintaan sebelumnya agar menu Pengurus membuka Bagan dulu. Rencana ini mengikuti permintaan terbaru: Pengurus membuka Tabel dulu, kecuali pemilik menyatakan Pengurus tetap Bagan dulu.
