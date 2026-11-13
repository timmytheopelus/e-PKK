# Program Kerja lanjutan: ringkasan angka, papan ala Trello, pengajuan pembayaran

Tanggal: 2026-11-13. Status: menunggu persetujuan pemilik. Melengkapi `2026-11-13-menu-overhaul-program-kerja-design.md` (Tahap 3 sudah jadi; Tahap 4 pencairan sudah dirancang di sana).

## Maksud
Koordinator seksi dan bidang perlu melihat sekilas kondisi program kerjanya (selesai, berjalan, menunggu persetujuan, berikut nilainya), mengelola pekerjaan tiap program bersama tim seperti di Trello, dan mengajukan pembayaran dari anggaran yang sudah disetujui. Pimpinan, Bendahara, dan Sekjen perlu melihat total anggaran program yang sudah disetujui di dashboard mereka.

## Tujuan
- Pengguna hanya melihat program seksinya. Koordinator Bidang melihat semua program bidangnya. Pimpinan dan Sekjen melihat semua.
- Di atas tabel Program: tiga angka (Selesai, Disetujui dan berjalan, Menunggu persetujuan), masing-masing dengan jumlah program dan total rupiah. Klik angka memfilter tabel di bawahnya; klik lagi melepas filter.
- Anggaran dianggap sah hanya setelah disetujui Koordinator Bidang lalu final oleh Sekjen (alur Tahap 3, tidak berubah).
- Dashboard Pimpinan, Bendahara, dan Sekjen menampilkan jumlah dan total nilai program yang disetujui.
- Papan to-do per program: kartu, kolom, % progres, tag ke anggota tim, komentar.
- Pengajuan pembayaran dari anggaran program disetujui (Tahap 4 di spesifikasi induk).

## Bukan tujuan
- Tidak mengubah alur persetujuan program yang sudah ada.
- Tidak membuat email notifikasi (tetap lonceng aplikasi).
- Tidak menghapus tabel atau data Airtable.
- Papan bukan pengganti Trello penuh: tanpa lampiran, label warna, checklist bersarang, atau tenggat berulang.

## Anti-tujuan (gagal walau jalan)
- Anggota seksi melihat program atau kartu seksi lain tanpa di-tag.
- Pembayaran tercatat dua kali di buku Bendahara.
- Tampilan HP harus digeser ke samping.

## Pendekatan yang dipilih (dipilih pemilik)
Tiga tahap berurutan, tiap tahap di-deploy ke Vercel sendiri-sendiri.
- A (ditolak): satu tahap besar. Deploy besar, sulit diuji, dan pencairan menulis ke buku Bendahara tanpa bisa dibatalkan.
- C (ditolak): papan dulu. Dashboard dan angka yang jadi dasar pengajuan tertunda.

## Tahap 1: Ringkasan angka, pembatasan data, dashboard
Tidak ada tabel Airtable baru.
- **Pembatasan data (perbaikan):** sekarang `daftarProgram` meloloskan program seluruh bidang bagi siapa pun yang punya jabatan apa pun di bidang itu. Diubah: seksi saya = program yang seksi pengajunya atau seksi terlibatnya adalah seksi akun (atau dibuat oleh akun); bidang saya hanya berlaku bagi Koordinator Bidang (peran `koordBidang`); Pimpinan dan Sekjen semua. Ditegakkan di server.
- **Tiga angka:** dihitung dari hasil `daftarProgram` yang sudah dibatasi. Selesai = status Selesai. Disetujui dan berjalan = Disetujui + Berjalan. Menunggu = Menunggu Koord Bidang + Menunggu Kolaborasi + Menunggu Sekjen. Nilai = total pengeluaran terencana program (`totalPengeluaran`). Tiap angka tampil jumlah, rupiah, dan label. Menggantikan kotak "Disetujui/berjalan" yang sekarang dipotong.
- **Filter:** klik angka menyetel filter status di tabel; bekerja bersama pencarian dan filter yang sudah ada.
- **Dashboard (beranda):** kartu ringkasan "Program Kerja" untuk akun berperan Pimpinan, Sekjen, atau Bendahara: jumlah dan total nilai program Disetujui dan Berjalan, plus jumlah yang menunggu Sekjen. Data lewat aksi server baru `ringkasan` yang menolak peran lain (403).
- **Uji:** program seksi lain tidak muncul bagi anggota seksi; Koordinator Bidang melihat bidangnya; angka sama dengan jumlah baris yang difilter; `ringkasan` 403 untuk peran lain.

## Tahap 2: Papan ala Trello
Tabel baru di base BPK (wajib dilaporkan dan diemail ke timmy.theopelus@gmail.com):
- **Kartu Program:** Judul, Program ID, Deskripsi, Kolom (Belum/Dikerjakan/Selesai), Seksi pembuat, Ditugaskan (email, satu per baris), Seksi tertag (satu per baris), Urutan, Dibuat oleh, Waktu.
- **Komentar Kartu:** Kartu ID, Isi, Oleh (email), Waktu.

Aturan:
- Pembuat dan tag hanya ke pengguna yang punya akun login (terdaftar di Pengurus dengan email).
- Kartu terlihat oleh: seksi pembuat, seksi tertag (seksi dari tiap orang yang di-tag), dan Koordinator Bidang dari bidang program. Seksi lain yang tidak terlibat tidak melihat.
- Anggota yang di-tag dari seksi lain hanya melihat kartu itu (dan nama program), bukan seluruh program. Melepas tag mencabut akses seksi itu.
- Pembuat kartu, orang yang ditugaskan, dan Koordinator terkait boleh memindah kolom dan mengubah kartu; yang bisa melihat kartu boleh berkomentar.
- % progres program = kartu Selesai dibagi semua kartu, dihitung server; terlihat di baris program dan di papan.
- Notifikasi lonceng: saat di-tag dan saat ada komentar di kartu yang kita ikuti (pembuat dan yang ditugaskan).
- Papan dibuka dari baris program; di HP kolom berupa tab (Belum/Dikerjakan/Selesai) supaya tidak melebar.
- Semua penulisan lewat endpoint server `/api/proker` (aksi baru); hak ditegakkan server.

## Tahap 3: Pengajuan pembayaran
Mengikuti spesifikasi induk bagian Alur pencairan: pengajuan oleh seksi dari anggaran program yang statusnya Disetujui atau Berjalan, ACC Koordinator Bidang lalu Sekjen, daftar transfer Bendahara, baris Mutasi satu kali per pencairan (kunci idempotensi), bukti transfer. Syarat awal: verifikasi token Airtable boleh menulis ke base Bendahara (appD9GktbF32FT0uB) sebelum menulis kode. Rancangan terperinci ditulis di awal tahap ini.

## Keputusan saya (bisa dikoreksi)
- Nilai pada angka = anggaran pengeluaran terencana, bukan realisasi.
- Kolom papan tetap tiga: Belum, Dikerjakan, Selesai (tanpa kolom buatan sendiri).
- Kartu belum bisa dilampiri berkas.
- Pimpinan Inti dan Penasihat (peran `pimpinan`) melihat semua kartu; Bendahara melihat program tapi tidak kartu, kecuali di-tag.

## Diserahkan ke pembangun
Tata letak persis tiga angka dan papan, urutan kolom, copywriting Indonesia, nama field persis.
