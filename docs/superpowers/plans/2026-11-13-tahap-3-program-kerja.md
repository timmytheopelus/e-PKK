# Tahap 3: Program Kerja dan Persetujuannya Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (pemilik memilih eksekusi native) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Seksi dapat mengajukan Program Kerja (nama, detail, perkiraan mulai, seksi terlibat, anggaran) dan program itu melewati persetujuan Koordinator Bidang, kolaborasi seksi lain, dan Sekjen, dengan notifikasi lonceng dua arah.

**Architecture:** Menu baru "Program Kerja" (tab id `proker`). Semua penulisan lewat endpoint server `/api/proker` (bukan proxy generik) supaya peran dan urutan persetujuan ditegakkan di server. Status dihitung dari satu fungsi murni `nextStatus`. Peran (Koordinator Bidang, Koordinator Seksi, Sekjen) dibaca dari jabatan Pengurus akun yang login. Lonceng notifikasi (sekarang hanya Superadmin dan kosong) membaca tabel Notifikasi untuk semua pengguna.

**Tech Stack:** Next.js App Router + TS, Airtable REST (`src/lib/airtable.ts`), vitest + JSDOM, prototipe `docs/prototipe-artifact.html` (dibangun `scripts/build-ui.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-13-menu-overhaul-program-kerja-design.md` (bagian Alur Program Kerja, Peran, Perubahan Airtable). Tahap 4 (pencairan, Overall View) bukan bagian rencana ini.

## Global Constraints
- Jangan hapus tabel Airtable yang ada. Setiap tabel/field baru wajib dilaporkan ke pemilik DAN diemail ke timmy.theopelus@gmail.com (`mcp__Gmail__send_message`).
- Token Airtable hanya di server; hak akses ditegakkan di server, bukan hanya UI.
- Nomor WA dan email umat tidak ditampilkan sebagai teks di UI; alamat dan tanggal lahir tidak ditampilkan.
- Bahasa antarmuka Indonesia. Commit diakhiri dua baris atribusi (`Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` dan `Claude-Session: https://claude.ai/code/session_01LtGBC8qjU3ihevatb99ASj`).
- Status program (urutan): Draft, Menunggu Koord Bidang, Menunggu Kolaborasi, Menunggu Sekjen, Disetujui, Berjalan, Selesai, Ditolak.
- Tampilan HP dulu: tidak boleh melebar ke samping; tabel dulu dengan header terkunci (`.tw tablebox`); filter dilipat.
- Menu baru diberikan lewat Administrasi > Akses per menu; tidak otomatis ke siapa pun selain Superadmin.

## Review Focus
- Koordinator Seksi mengajukan atas nama seksi lain: server menolak (seksi pengaju harus seksi milik pengaju).
- Persetujuan ganda / urutan salah (Sekjen menyetujui sebelum Koord Bidang): server menolak.
- Seksi terlibat dihapus setelah ada persetujuan kolaborasi: persetujuan lama tidak boleh dianggap sah.
- Pengaju yang juga Koordinator Bidang: tidak boleh menyetujui programnya sendiri tanpa tercatat sebagai persetujuan Koord Bidang (satu langkah, bukan dilewati).
- Notifikasi hanya dibaca/ditandai oleh penerimanya; pengguna lain mendapat 403.
- Anggaran rincian tidak negatif, nominal bulat, total = pemasukan/pengeluaran dihitung server (bukan dipercaya dari browser).

---

### Task 1: Tabel baru di Airtable dan konstanta ID

**Files:**
- Create: `src/lib/proker-schema.ts`
- Test: `tests/proker-schema.test.ts`

**Interfaces:**
- Produces: konstanta `T_PROGRAM`, `T_ANGGARAN`, `T_SETUJU`, `T_NOTIF` (ID tabel) dan objek field `PK`, `AG`, `ST`, `NT` (ID field), plus `STATUS` (tuple status program) dan `JENIS` (`"Pemasukan" | "Pengeluaran"`), semua diekspor.

- [ ] **Step 1:** Buat 4 tabel di base BPK (appIGR8Duhj3Vsz48) via `mcp__Airtable__create_table`:
  - **Program Kerja**: Nama (utama), Detail (multilineText), Seksi pengaju (singleLineText), Bidang (singleLineText), Perkiraan mulai (singleLineText, `YYYY-MM-DD` atau `YYYY-MM`), Seksi terlibat (multilineText, satu seksi per baris), Mode anggaran (singleSelect Total/Rincian), Total anggaran (number 0), Status (singleSelect sesuai Global Constraints), Dibuat oleh (singleLineText email), Waktu dibuat (dateTime).
  - **Anggaran Program**: Keterangan (utama), Program ID, Jenis (singleSelect Pemasukan/Pengeluaran), Nominal (number 0).
  - **Persetujuan Program**: Ringkasan (utama), Program ID, Tahap (singleSelect Koord Bidang/Kolaborasi/Sekjen), Seksi (singleLineText, untuk Kolaborasi), Keputusan (singleSelect Menunggu/Setuju/Tolak), Oleh (email), Waktu (dateTime), Catatan (multilineText).
  - **Notifikasi**: Pesan (utama), Penerima (email), Tautan (singleLineText, mis. `proker:recXXX`), Dibaca (checkbox), Waktu (dateTime).
- [ ] **Step 2:** Tulis test `proker-schema.test.ts`: semua ID cocok pola `^tbl[A-Za-z0-9]{14}$` / `^fld...`, `STATUS` berisi 8 nilai berurutan. Run: FAIL (modul belum ada).
- [ ] **Step 3:** Implement `proker-schema.ts` dari hasil create_table (ID nyata). Run test: PASS.
- [ ] **Step 4:** Kirim email laporan ke timmy.theopelus@gmail.com (4 tabel + semua field) dan sebut di balasan akhir. Commit.

### Task 2: Peran dari jabatan dan aturan alur (fungsi murni)

**Files:**
- Create: `src/lib/proker-flow.ts`, `src/lib/proker-roles.ts`
- Test: `tests/proker-flow.test.ts`

**Interfaces:**
- Produces:
  - `type Peran = { koordBidang: string[]; koordSeksi: string[]; sekjen: boolean; bendahara: boolean; pimpinan: boolean }`
  - `peranOf(acc: Access): Promise<Peran>` (cache 5 menit): dari baris Pengurus (periode 2026) akun: jabatan master `peran`/`bidang`/`seksi` (field di `src/lib/event-edit.ts`, `JAB`). "Ketua" bidang → koordBidang, "Ketua" seksi → koordSeksi; jabatan "Sekretaris Jenderal" → sekjen (pakai `canApprove`); Pimpinan Inti/Penasihat → pimpinan.
  - `nextStatus(p: { status: string; seksiTerlibat: string[]; seksiPengaju: string }, setuju: { tahap: "Koord Bidang" | "Kolaborasi" | "Sekjen"; seksi?: string; keputusan: "Setuju" | "Tolak" }[]): string`
  - `canAct(peran: Peran, p: { bidang: string; seksiPengaju: string; seksiTerlibat: string[]; status: string }, tahap: string, seksi?: string): boolean`
- [ ] **Step 1: Tests `proker-flow.test.ts`** (nama test = perilaku): Draft tanpa persetujuan tetap "Menunggu Koord Bidang" setelah diajukan; Koord Bidang setuju + tidak ada seksi lain → "Menunggu Sekjen"; Koord Bidang setuju + ada seksi lain belum setuju → "Menunggu Kolaborasi"; semua kolaborasi setuju → "Menunggu Sekjen"; Sekjen setuju → "Disetujui"; satu "Tolak" di tahap mana pun → "Ditolak"; Sekjen setuju sebelum Koord Bidang → status tidak maju; persetujuan kolaborasi dari seksi yang sudah dihapus dari `seksiTerlibat` diabaikan; `canAct`: koordSeksi seksi A tidak bisa bertindak atas seksi B; koordBidang hanya untuk bidangnya.
- [ ] **Step 2:** Run: FAIL. **Step 3:** Implement kedua berkas (`nextStatus` murni, tanpa I/O). **Step 4:** Run: PASS. **Step 5:** Commit.

### Task 3: Endpoint server Program Kerja (ajukan, setujui, daftar)

**Files:**
- Create: `src/lib/proker.ts`, `src/app/api/proker/route.ts`
- Modify: `src/lib/policy.ts` (`TAB_IDS` tambah `"Program Kerja": "proker"`)
- Test: `tests/proker-api.test.ts`

**Interfaces:**
- Consumes: `peranOf`, `nextStatus`, `canAct` (Task 2); konstanta Task 1; `effectiveAccess` (`src/lib/viewas.ts`).
- Produces (`src/lib/proker.ts`), semua `(acc: Access, input) => Promise<...>` dan melempar `HttpError`:
  - `ajukanProgram(acc, { nama, detail, mulai, seksiTerlibat: string[], anggaran: { mode: "Total"; total: number } | { mode: "Rincian"; baris: { keterangan: string; jenis: "Pemasukan" | "Pengeluaran"; nominal: number }[] } }): Promise<{ id: string }>` — seksi pengaju diambil dari peran (bukan dari input); tab "Program Kerja" wajib; viewAs ditolak.
  - `putuskan(acc, { programId, tahap, seksi?, keputusan, catatan? }): Promise<{ status: string }>` — memanggil `canAct` lalu `nextStatus`, menulis Persetujuan Program dan memperbarui Status, membuat Notifikasi (lihat Task 4).
  - `daftarProgram(acc): Promise<{ id; nama; detail; seksiPengaju; bidang; mulai; seksiTerlibat: string[]; status; totalPemasukan; totalPengeluaran; baru: boolean; aksi: ("Koord Bidang" | "Kolaborasi" | "Sekjen")[] }[]>` — Pimpinan/Sekjen melihat semua; lainnya hanya program bidang/seksinya; `aksi` = tahap yang boleh dikerjakan akun ini sekarang; `baru` = dibuat ≤ 14 hari.
  - Rute: `POST /api/proker` body `{ aksi: "ajukan" | "putuskan" | "daftar", ... }`.
- [ ] **Step 1: Tests** (fetch di-stub seperti `tests/approval.test.ts`): `ajukan` ditolak tanpa tab Program Kerja / saat viewAs; seksi pengaju selalu seksi milik akun (input palsu diabaikan); total rincian dihitung server dan nominal negatif ditolak 400; `putuskan` oleh bukan Koord Bidang ditolak 403; Sekjen sebelum Koord Bidang ditolak 409; keputusan ganda dari orang yang sama ditolak 409; `daftar` untuk Koordinator Seksi hanya memuat bidangnya.
- [ ] **Step 2:** Run: FAIL. **Step 3:** Implement (struktur route meniru `src/app/api/approval/route.ts`). **Step 4:** Run semua test: PASS. **Step 5:** Commit.

### Task 4: Notifikasi dan lonceng untuk semua pengguna

**Files:**
- Create: `src/lib/notif.ts`, `src/app/api/notif/route.ts`
- Modify: `scripts/build-ui.mjs` (lonceng `epkBell` tampil untuk semua pengguna, bukan hanya Superadmin)
- Test: `tests/notif.test.ts`

**Interfaces:**
- Produces: `buatNotif(penerima: string[], pesan: string, tautan: string): Promise<void>` (tidak boleh menggagalkan pemanggil; kegagalan dicatat di console); `daftarNotif(acc): Promise<{ id; pesan; tautan; dibaca: boolean; waktu: string }[]>` (hanya milik `acc.email`, 30 terbaru); `tandaiDibaca(acc, ids: string[]): Promise<void>` (403 bila id bukan milik akun).
- Notifikasi yang dibuat `putuskan`/`ajukan`: ke Koordinator Bidang saat diajukan; ke koordinator tiap seksi terlibat saat menunggu kolaborasi; ke pengaju saat setiap keputusan (disetujui/ditolak); ke Sekjen saat menunggu Sekjen; ke pengaju dan Koordinator BPK (Pimpinan) saat Disetujui.
- [ ] **Step 1: Tests:** `daftarNotif` hanya mengembalikan milik akun; `tandaiDibaca` id milik orang lain → 403; `buatNotif` tidak melempar saat Airtable 500; lonceng: HTML hasil render memuat `epkBell` untuk akun level View (JSDOM). Run: FAIL.
- [ ] **Step 2:** Implement; di `build-ui.mjs` tampilkan lonceng untuk semua, badge angka belum dibaca, panel memuat daftar (klik membuka tab/program dari `tautan`, menandai dibaca), polling 60 detik via `/api/notif`, dan tugas Superadmin yang sudah ada tetap ditampilkan. **Step 3:** Run semua test: PASS. **Step 4:** Commit.

### Task 5: Menu Program Kerja (UI, tabel dulu)

**Files:**
- Modify: `docs/prototipe-artifact.html` (tab `tab-proker`, CSS seperlunya), `src/ui/admin-js.ts` (`ALLT` tambah "Program Kerja")
- Test: `tests/menu-layout.test.ts`

**Interfaces:** Consumes `POST /api/proker` (Task 3). Layout: kartu ringkas (jumlah program, menunggu tindakan saya), `proRptTabs` (Daftar [tabel `.tw tablebox`, pertama] | Ajukan program), kolom tabel: Program, Seksi, Mulai, Status, Anggaran; baris baru bertanda "Baru"; klik baris membuka detail dengan tombol Setujui/Tolak sesuai `aksi`. Formulir Ajukan: nama, detail, mulai (tanggal lengkap atau bulan+tahun), seksi terlibat (seksi sendiri otomatis tercentang dan terkunci), anggaran Total atau Rincian (baris keterangan/jenis/nominal). Filter dilipat satu tombol.
- [ ] **Step 1: Test:** tab `proker` ada; `proRptTabs` ada; hanya Daftar tampil awal; kontrol filter tampil ≤ 2; semua `<table>` di dalam `.tw`; formulir tidak punya input seksi pengaju. Run: FAIL.
- [ ] **Step 2:** Implement UI; **Step 3:** build, `node --check` skrip, `tsc`, seluruh test; uji Playwright 390 px (tidak melebar, tombol Setujui hanya muncul bila `aksi` berisi tahap); **Step 4:** Commit.

### Task 6: Verifikasi akhir dan rilis

- [ ] Jalankan `npx next build`, `npx vitest run`, `npx tsc --noEmit`; review seluruh cabang terhadap Review Focus (satu per satu, catat di ledger); `git pull --rebase` lalu push; laporkan "Rulings I made", "Deferred minors", dan daftar tabel/field baru yang sudah diemail. Pemberian menu "Program Kerja" ke pengguna dilakukan pemilik lewat Administrasi > Akses per menu.
