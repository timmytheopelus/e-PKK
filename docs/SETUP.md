# Panduan setup e-PKK (untuk pemilik)

1. **Vercel**: login vercel.com dengan GitHub, "Add New Project", pilih repo `e-pkk`, Deploy.
2. **Airtable token**: airtable.com/create/tokens. Scope: `data.records:read`, `data.records:write`, `schema.bases:read`. Akses: base BPK Bandung dan System Management Pewarta BPK.
3. **Google OAuth**: console.cloud.google.com, APIs & Services, Credentials, OAuth client ID (Web). Authorized redirect URI: `https://<domain-vercel>/api/auth/callback/google`.
4. **Environment variables di Vercel** (Settings, Environment Variables): `AUTH_SECRET` (isi acak, mis. hasil `openssl rand -base64 32`), `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AIRTABLE_TOKEN`. Lalu Redeploy.
5. **Menyetujui pengguna**: tabel "Pengguna Dashboard" di Airtable. Orang yang login pertama kali muncul dengan Status "Menunggu". Ubah Status ke Disetujui, pilih Level (View/Edit) dan Tab diizinkan.
