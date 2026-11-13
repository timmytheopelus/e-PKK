# e-PKK: Tata letak menu, Kalender/Event, Overall View, Program Kerja dan Pencairan

Tanggal: 2026-11-13. Status: menunggu persetujuan pemilik (timmy).

## Maksud
Pengguna utama membuka dashboard lewat HP. Halaman sekarang terlalu panjang ke bawah dan laporan menumpuk dalam satu halaman. Selain itu pimpinan butuh satu tempat untuk melihat program kerja seksi/bidang, persetujuannya, realisasi biaya, dan kebutuhan dana, dan bendahara butuh daftar pencairan yang harus ditransfer.

## Tujuan
- Setiap menu terbuka ke dashboard pendek (muat satu layar HP), laporan di tab Laporan.
- Semua laporan panjang berbentuk tabel gulir: header terkunci, baris selang-seling. Tampilan awal selalu tabel. Acuan: laporan Keuangan.
- Kalender/Event: istilah Calendar view dan Agenda view, bawaan Agenda dari hari ini ke depan, yang lewat tersembunyi dengan tombol.
- Menu baru Overall View (dashboard utama lama dipindah ke sini, bersih) untuk Pimpinan/Koordinator BPK, Penasihat dan Sekjen.
- Program Kerja dengan alur persetujuan, kolaborasi seksi, realisasi, pengajuan pencairan, dan pembayaran oleh Bendahara yang masuk ke laporan keuangan.

## Bukan tujuan
- Tidak mengubah data atau tampilan Bagan/Pengurus yang sudah jadi.
- Tidak mengirim email pendaftar (menunggu pengirim baru).
- Tidak menghapus tabel Airtable yang ada.

## Anti-tujuan (dianggap gagal walau jalan)
- Tampilan HP masih harus digeser ke samping atau bergulir panjang.
- Nomor rekening umat atau data pribadi bocor ke pihak yang tidak berhak.
- Dana tercatat dua kali di buku Bendahara.

## Pendekatan yang dipilih (pencairan -> laporan keuangan)
- A (ditolak): tabel pencairan milik aplikasi, ditampilkan di Keuangan sebagai sumber tambahan.
- **B (dipilih pemilik)**: saat Bendahara klik "sudah transfer" dan unggah bukti, aplikasi menulis satu baris ke tabel **Mutasi** di base Bendahara (appD9GktbF32FT0uB). Satu buku besar.

## Tahap
1. Tata letak semua menu (dashboard pendek, tab Laporan, tabel gulir, tabel dulu).
2. Kalender dan Event (Agenda/Calendar, edit lewat klik, hak edit, riwayat perubahan).
3. Program Kerja dan persetujuannya (termasuk kolaborasi dan notifikasi lonceng).
4. Pencairan dana, daftar transfer Bendahara, kebutuhan dana ke depan, Overall View.

## Alur Program Kerja
1. Seksi mengajukan: nama, keterangan, perkiraan mulai (tanggal lengkap atau bulan+tahun), seksi terlibat (seksi pengaju otomatis tercentang), anggaran (total saja atau rincian: keterangan, jenis Pemasukan/Pengeluaran, nominal).
2. Koordinator Bidang pengaju menyetujui. Tiap koordinator seksi lain yang dicentang menyetujui kolaborasi (notifikasi lonceng; pengirim dapat notifikasi saat disetujui atau ditolak).
3. Sebelum pelaksanaan, Sekjen menyetujui. Status: Draft, Menunggu Koord Bidang, Menunggu Kolaborasi, Menunggu Sekjen, Disetujui, Berjalan, Selesai, Ditolak.
4. Overall View menampilkan jumlah program, status realisasi, rencana vs biaya nyata; program baru bertanda seru.

## Alur pencairan
Biaya nyata diajukan (nominal, rekening tujuan: bank, nomor, atas nama) -> ACC Koord Bidang -> ACC Sekjen -> masuk daftar transfer Bendahara (Koordinator BPK hanya diberi notifikasi). Bendahara memilih akun dan rekening sumber, klik Sudah transfer, unggah bukti (maks sekitar 5 MB). Server membuat baris Mutasi (Jenis Pengeluaran, tanggal, nominal, keterangan memuat kode program, Nama Penerima, Bidang, Attachment bukti) lalu menandai pencairan Dibayar. Bendahara juga melihat total kebutuhan dana per bulan dari program yang disetujui.

## Peran
Ditentukan dari jabatan di data Pengurus akun yang login: Koordinator Bidang (Ketua bidang), Koordinator Seksi (Ketua seksi), Sekjen, Bendahara, Pimpinan Inti, Penasihat. Hak akses ditegakkan di server.
Hak edit Kalender/Event: level Admin, anggota Kesekretariatan, atau pembuat event.
Overall View: tab baru "Overall View", diberikan lewat Administrasi, Akses per menu, kepada Pimpinan/Koordinator BPK, Penasihat, Sekjen.

## Perubahan Airtable (semua wajib dilaporkan dan diemail ke timmy.theopelus@gmail.com)
Base BPK (appIGR8Duhj3Vsz48), tabel baru:
- Program Kerja
- Anggaran Program (rincian rencana, realisasi, status pencairan, rekening tujuan, kode mutasi)
- Persetujuan Program (log persetujuan, kolaborasi seksi, pencairan)
- Notifikasi (penerima, pesan, tautan, dibaca)
- Riwayat Event (event, field, nilai lama, nilai baru, oleh, waktu)
Field baru di tabel Event BPK: Dibuat oleh (email).
Base Bendahara: tidak ada tabel atau field baru; hanya menambah baris di Mutasi.

## Syarat dan risiko
- Token Airtable server harus punya izin tulis ke base Bendahara. Belum diverifikasi; dicek di awal tahap 4.
- Menulis ke buku Bendahara tidak bisa dibatalkan otomatis; baris hanya dibuat sekali per pencairan (kunci idempotensi) dan memuat kode program agar bisa dilacak.
- Struktur Mutasi milik Bendahara; baris baru hanya memakai field yang sudah ada.

## Keputusan saya (bisa dikoreksi)
- Notifikasi hanya di lonceng aplikasi (email menunggu SMTP baru).
- Peran dari jabatan Pengurus, bukan daftar manual.
- Bukti transfer sebagai lampiran Airtable.
- Pembuatan tabel dilakukan per tahap, bukan sekaligus.

## Diserahkan ke pembangun
Detail tampilan tiap menu, nama field persisnya, urutan kolom tabel laporan, copywriting Indonesia.
