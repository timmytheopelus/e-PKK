# e-PKK (Dashboard BPKPKK Bandung)

Baca `docs/SPEC.md` dulu. Prototipe fungsional ada di `docs/prototipe-artifact.html` (satu file HTML; logika data, skor kuesioner, peta, dan alur edit bisa dipakai ulang).

## Aturan wajib
- Jangan menghapus tabel Airtable yang sudah ada. Jika diminta, beri peringatan dulu.
- Setiap tabel atau field baru di Airtable harus dilaporkan ke pemilik dan dikirim lewat email ke timmy.theopelus@gmail.com.
- Token Airtable dan secret Google hanya di environment variable server. Jangan di-commit, jangan dikirim ke browser.
- Hak akses (view/edit, tab) ditegakkan di server, bukan hanya disembunyikan di UI.
- Nomor WA dan email umat tidak ditampilkan di UI; tampilkan sebagai tombol saja.
- Bahasa antarmuka: Indonesia.

## Stack
Next.js (App Router) + TypeScript, Auth.js (Google), Airtable REST API, deploy Vercel.

## Cara kerja disarankan
Rencanakan dulu, buat kerangka (auth, skema akses, klien Airtable) oleh satu agent, baru bagi pekerjaan tab ke beberapa agent paralel dengan berkas yang terpisah.
