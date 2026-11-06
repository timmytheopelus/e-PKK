# Panduan setup e-PKK (untuk pemilik)

1. **Vercel**: login vercel.com dengan GitHub, "Add New Project", pilih repo `e-pkk`, Deploy.
2. **Airtable token**: airtable.com/create/tokens. Scope: `data.records:read`, `data.records:write`, `schema.bases:read`. Akses: base BPK Bandung dan System Management Pewarta BPK.
3. **Google OAuth**: console.cloud.google.com, APIs & Services, Credentials, OAuth client ID (Web). Authorized redirect URI: `https://<domain-vercel>/api/auth/callback/google`.
4. **Environment variables di Vercel** (Settings, Environment Variables): `AUTH_SECRET` (isi acak, mis. hasil `openssl rand -base64 32`), `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AIRTABLE_TOKEN`. Lalu Redeploy.
5. **Menyetujui pengguna**: tabel "Pengguna Dashboard" di Airtable. Orang yang login pertama kali muncul dengan Status "Menunggu". Ubah Status ke Disetujui, pilih Level (View/Edit) dan Tab diizinkan.

## Superadmin dan email notifikasi
- Level **Superadmin** = semua fungsi Edit + menu "Kelola Pengguna" (klik nama di kanan atas) untuk menyetujui, menolak, menambah pengguna, dan mengatur level serta tab. Lonceng di sebelah nama hanya tampil untuk Superadmin dan menunjukkan pengguna yang menunggu persetujuan.
- Untuk menjadikan seseorang Superadmin, ubah Level-nya di Airtable (tabel "Pengguna Dashboard") atau lewat menu Kelola Pengguna.
- **Email otomatis ke Superadmin** saat ada pengguna baru menunggu. Isi Environment Variables di Vercel (lalu Redeploy):
  - `SMTP_USER`: alamat Gmail pengirim, mis. sekretariat@karismatikkatolikbandung.org (harus akun Google).
  - `SMTP_PASS`: App Password Google (myaccount.google.com, Keamanan, Verifikasi 2 langkah, Sandi aplikasi). Bukan password biasa.
  - Opsional: `APP_URL` (mis. https://e-pkk-one.vercel.app), `MAIL_FROM`.
  - Tanpa SMTP_USER/SMTP_PASS email dilewati, tetapi lonceng tetap bekerja.
