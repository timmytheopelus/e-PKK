# Dashboard BPKPKK Bandung – spesifikasi website (handoff ke Claude Code)

## Tujuan
Memindahkan prototipe "BPKPKK Bandung" (`docs/prototipe-artifact.html`) menjadi website sungguhan. Kode di GitHub, deploy di Vercel, data tetap di Airtable, login Google SSO, dengan level akses per pengguna.

## Keputusan yang sudah disetujui pemilik
- Hosting: Vercel + GitHub (repo ini).
- Login: Google SSO (Auth.js / NextAuth). Hanya email yang terdaftar dan sudah disetujui.
- Daftar pengguna dan hak akses disimpan di tabel baru di Airtable (bukan di kode).
- Level: View only atau Edit, plus daftar tab yang boleh dibuka per pengguna.
- Default level Edit: Pimpinan Inti Koordinator, Sekretariat, dan Sekretaris.
- Pengerjaan di Claude Code.

## Aturan proyek (wajib)
- Dilarang menghapus tabel Airtable yang sudah ada. Beri peringatan jika diminta.
- Setiap pembuatan tabel baru atau field baru harus dilaporkan ke pemilik, dan dikirim lewat email ke timmy.theopelus@gmail.com.
- Tabel baru yang direncanakan: "Pengguna Dashboard" (lihat di bawah). Laporkan dan email saat dibuat.

## Arsitektur
- Next.js (App Router) + TypeScript, Auth.js Google provider, deploy Vercel.
- Semua panggilan Airtable lewat route handler di server. Personal Access Token Airtable hanya di environment variable Vercel, tidak pernah ke browser.
- Setiap route memeriksa sesi, status persetujuan, level (view/edit), dan tab yang diizinkan. Tombol disembunyikan di UI, tetapi penegakan ada di server.
- Cache ringan di server (mis. 60 detik) untuk Events, Kuesioner, dan Umat agar cepat dan hemat rate limit Airtable (5 req/detik per base).

## Tabel baru: "Pengguna Dashboard" (base BPK Bandung appIGR8Duhj3Vsz48)
- Email (primary, unik)
- Nama
- Status: Menunggu / Disetujui / Ditolak
- Level: View / Edit
- Tab diizinkan (multi select): Dashboard, Pengurus, Pewarta, Pewarta luar kota, PD, Umat, Kalender
- Peran/jabatan (teks)
- Terakhir login (date/time)
- Alur: login Google dengan email yang belum ada membuat baris Status=Menunggu dan menampilkan "menunggu persetujuan". Admin (sekretariat) mengubah Status, Level, dan Tab langsung di Airtable.
- Seed awal: ambil email pengurus yang jabatannya Pimpinan Inti Koordinator, Sekretariat, atau Sekretaris dari tabel Pengurus BPK, set Disetujui + Edit + semua tab. Konfirmasikan daftar ke pemilik sebelum dibuat.

## Sumber data (ID Airtable)
Base BPK Bandung `appIGR8Duhj3Vsz48`:
- Pengurus BPK `tbluIlEgPdHeodJHK` (periode 2026-2031; filter contains pada field periode `fldHngi5Klnm5bUmM`), nama `fldHK8r2o5q60IDXW`, WA `fldXut0nHbouaznB7`
- MasterData TeamUmat `tblwRNtXSVzgzVXuk` (2099 umat). Nama `fldIpQTSkFB9sU0lo`, Panggilan `fld469PYR80nAUNIF`, WA `fldzY1Z2QvIIEkYXR`, Email `fldAaQ3zmiLBhp4z9`, Alamat `fldcQFzBtr9EELTtV`, PD Komunitas (link) `fldrHJ6q3HZvApccl`, Foto `fldWLeXoMSiVp5RbG`, Asal BPK `fldjRcxpLoVxAJv0n`, Status/Kategori pewarta, pengajar, konselor, dan Kompetensi (lihat prototipe)
- Events `tblbAIILkeRIwn3kl` (kalender; field di prototipe objek `EF`)
- Master Data PD `tblNjwoOJEGZeQxkJ` (38 PD; Koordinator PD link `fldagyoKQyhfenB7u`)
- Pesan biodata: formula `fld0E38ESdLAQDXyj` di TeamUmat
Base System Management Pewarta BPK `appK4oGjawCjLHV0w`:
- Events (jadwal pewartaan) `tbll71vbqU6JbmrJq`, Kuisioner Pewarta `tblIMjnv1ffB4LqK7`

## Fitur yang dipindahkan dari prototipe
1. Dashboard: ringkasan, agenda terdekat, program berjalan, tren kegiatan 12 bulan, permohonan pewarta luar kota (tren dan daftar per bulan), hasil kuesioner (skor terendah, klik untuk detail), tren tema PD 90 hari.
2. Pengurus: daftar per seksi/bidang dengan jumlah (Tim Inti termasuk Grup Harian), tombol View/Edit/WA.
3. Pewarta, pengajar, konselor: hanya asal Bandung (Asal BPK kosong dianggap Bandung), filter peran/status/kategori/keahlian/PD.
4. Pewarta luar kota: riwayat undangan, peringkat, tujuan, detail per orang.
5. PD: peta skematis Jawa Barat per kota, daftar dekanat bisa diklik, detail PD, ganti koordinator, tambah umat baru (nama + WA) lalu tombol wa.me berisi link biodata.
6. Umat: pencarian dan filter PD; nomor WA dan email tidak ditampilkan, hanya tombol (idealnya link dibuat di server saat diklik).
7. Kalender: tampilan bulan dan daftar, filter, detail, tambah kegiatan (hanya level Edit).
Semua tombol tulis (Edit, ganti koordinator, tambah umat, tambah kegiatan) hanya untuk level Edit.

## Hal yang masih diperlukan dari pemilik
- Akun Vercel, domain (opsional).
- Google OAuth client ID/secret (Google Cloud Console), redirect URI dari Vercel.
- Airtable Personal Access Token (scope: data.records:read dan write, schema.bases:read, schema.bases:write bila tabel dibuat lewat API) untuk kedua base.
- Konfirmasi daftar email admin awal.

## Catatan teknis dari prototipe
- Foto Airtable punya URL sementara; ambil per rekaman saat detail dibuka.
- Skor kuesioner: rata-rata jawaban 1 sampai 5 dikali 20; fungsi `ansScore` di prototipe.
- Pewarta luar kota = Asal Pewarta bukan "BPK Bandung" atau ada ACC pewarta non-Bandung.
- Peta: poligon skematis `JABAR` dan koordinat kota `KOTA_XY` di prototipe.
