# Anggaran program & realisasi di menu Keuangan — rancangan

## Tujuan
Bendahara/Sekjen/Koordinator/Penasihat melihat anggaran program yang sudah disetujui di menu Keuangan, dan Bendahara mencatat realisasi (pengeluaran) terhadap anggaran itu. Sistem menunjukkan sisa anggaran yang boleh dipakai, dan tiap realisasi otomatis menjadi satu baris pengeluaran biasa di Mutasi (base Bendahara).

## Bukan tujuan
- Ketua seksi tidak mencatat realisasi (hanya melihat sisa di Program Kerja). Usulan, belum dikonfirmasi.
- Tidak mengubah/menghapus baris Mutasi yang sudah ada. Tidak ada pengajuan pembayaran (itu Tahap 3).
- Pemasukan program tidak dihitung ke sisa anggaran.

## Pendekatan (dipilih: A)
A. Tabel **Realisasi Program** baru di base BPK + tulis satu baris ke Mutasi. (dipilih)
B. Hanya field Program di Mutasi (ditolak: lintas base, tanpa tempat catatan sendiri).
C. Catat di sini, Bendahara input manual (ditolak: kerja dobel, tidak sinkron).

## Rancangan
**Tab baru "Anggaran" di Keuangan** (hanya yang lolos `pastikanKeuangan`). Daftar program berstatus Disetujui/Berjalan: anggaran pengeluaran, total realisasi, sisa, bar progres. Buka satu program untuk melihat baris detail anggaran (dari tabel Anggaran) dan riwayat realisasinya.

**Catat realisasi** (hanya Bendahara + Superadmin, ditegakkan di server): pilih program, tanggal, nominal, keterangan, Account, Rekening, penerima, lampiran opsional. Server menolak bila nominal > sisa anggaran (409), nominal <= 0, atau program bukan Disetujui/Berjalan.

**Alur tulis** (urutan menentukan pemulihan galat): 1) buat baris Mutasi (Jenis = Pengeluaran, keterangan diawali `[Proker: <nama>]`, nominal, tanggal, Account, Rekening); 2) buat baris Realisasi Program berisi id record Mutasi tadi. Bila langkah 2 gagal, Mutasi dibiarkan dan galat dilaporkan jelas (jangan menghapus data keuangan otomatis).

**Skema baru** (wajib dilaporkan ke pemilik + email timmy.theopelus@gmail.com, dan persetujuan sebelum dibuat): tabel `Realisasi Program` di base BPK: Program (id record, teks), Tanggal, Nominal, Keterangan, Penerima, Mutasi ID (teks), Dicatat oleh (email), Waktu. Tidak ada perubahan skema di base Bendahara.

**Akses**: baca anggaran/realisasi = peran Keuangan; tulis = Bendahara + Superadmin. Email/WA tidak ditampilkan. UI berbahasa Indonesia.

## Risiko / syarat awal
- Token server harus boleh menulis ke base Bendahara (`appD9GktbF32FT0uB`): diverifikasi sebelum membangun; bila tidak bisa, kembali ke pendekatan C.
- Nama opsi Jenis Transaksi untuk pengeluaran dikonfirmasi dari data sebelum menulis.
- Cache peran 5 menit tidak memengaruhi angka sisa; sisa dihitung segar per permintaan.

## Diserahkan ke pembangun
Susunan visual tab, format rupiah, urutan kolom.
