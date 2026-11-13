// Email sambutan HTML untuk pengguna baru e-PKK. Dipakai aplikasi dan skrip pengiriman manual agar isinya selalu sama.
const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const FITUR: { tab: string; judul: string; isi: string }[] = [
  { tab: "Dashboard", judul: "Dashboard", isi: "Ringkasan pengurus, pewarta, PD, dan kegiatan dalam satu layar." },
  { tab: "Pengurus", judul: "Pengurus", isi: "Struktur dan daftar pengurus BPK per bidang dan seksi, lengkap dengan tombol WA." },
  { tab: "Pewarta", judul: "Pewarta, pengajar &amp; konselor", isi: "Pewarta aktif per PD, per modul, pastor &amp; suster, kelompok usia, profil, dan video YouTube." },
  { tab: "Pewarta luar kota", judul: "Pewarta luar kota", isi: "Permohonan dan pewarta tamu dari keuskupan lain." },
  { tab: "PD", judul: "PD / Komunitas", isi: "Data PD, koordinator, jadwal, anggota, dan dekanat." },
  { tab: "Umat", judul: "Umat", isi: "Pencarian data umat dan pembaruan data kontak." },
  { tab: "Kalender", judul: "Kalender kegiatan", isi: "Kalender bulanan dan daftar kegiatan BPK, bisa ditambah dari sini." },
  { tab: "Event", judul: "Event &amp; pendaftar", isi: "Event berjalan, pendaftar per PD, PD yang belum mendaftar, dan data demografis." },
  { tab: "Absensi", judul: "Absensi kehadiran", isi: "Mencatat siapa saja yang hadir di acara lewat link absensi. Login dulu dengan akun ini." },
];

export function welcomeHtml(o: { nama: string; email: string; level: string; tabs: string[]; url: string }) {
  const lv = o.level === "Edit" ? "Edit (boleh mengubah data)" : o.level === "Superadmin" ? "Superadmin" : o.level === "Admin" ? "Admin (mengubah data dan menambah pengguna View)" : "Hanya lihat";
  const fitur = FITUR.filter((f) => o.tabs.includes(f.tab));
  const rows = fitur.map((f) => `<tr><td style="padding:10px 0;border-bottom:1px solid #e6ebf0"><div style="font-weight:700;color:#14344b">${f.judul}</div><div style="color:#55687a;font-size:14px;line-height:1.45">${f.isi}</div></td></tr>`).join("");
  return `<!doctype html><html lang="id"><body style="margin:0;background:#f2f5f8;font-family:Segoe UI,Arial,sans-serif;color:#1d2b38">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f5f8"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#14344b;padding:26px 28px"><div style="color:#9fd0ee;font-size:13px;letter-spacing:.08em;text-transform:uppercase">BPKPKK Keuskupan Bandung</div><div style="color:#ffffff;font-size:26px;font-weight:700;margin-top:4px">Selamat datang di e-PKK</div></td></tr>
<tr><td style="padding:26px 28px 8px;font-size:15px;line-height:1.55"><p style="margin:0 0 12px">Shalom <b>${esc(o.nama)}</b>,</p><p style="margin:0">Anda sudah diberi akses ke dashboard e-PKK, tempat data pengurus, pewarta, PD, umat, kegiatan, dan pendaftaran event BPKPKK Bandung dikumpulkan di satu tempat.</p></td></tr>
<tr><td style="padding:16px 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef6fb;border-radius:10px"><tr><td style="padding:16px 18px;font-size:14.5px;line-height:1.7">
<div><span style="color:#55687a">Username (email login)</span><br><b>${esc(o.email)}</b></div>
<div style="margin-top:8px"><span style="color:#55687a">Hak akses</span><br><b>${esc(lv)}</b></div></td></tr></table></td></tr>
<tr><td align="center" style="padding:4px 28px 18px"><a href="${esc(o.url)}" style="display:inline-block;background:#1b6ea8;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 28px;border-radius:9px">Buka e-PKK</a><div style="color:#55687a;font-size:13px;margin-top:8px">${esc(o.url)}</div></td></tr>
<tr><td style="padding:0 28px 8px"><div style="font-weight:700;font-size:16px;margin-bottom:6px">Cara masuk</div><ol style="margin:0;padding-left:20px;line-height:1.7;font-size:14.5px"><li>Buka link di atas.</li><li>Pilih <b>Masuk dengan Google</b>.</li><li>Login memakai Gmail di atas (<b>${esc(o.email)}</b>). Email lain tidak akan dikenali.</li></ol></td></tr>
<tr><td style="padding:18px 28px 6px"><div style="font-weight:700;font-size:16px">Fitur yang bisa Anda pakai</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
<tr><td style="padding:14px 28px 26px;color:#55687a;font-size:13px;line-height:1.55">Nomor WA dan email umat tidak ditampilkan sebagai teks; hubungi lewat tombol WA. Menu bisa disembunyikan lewat tombol ☰ Menu. Bila ada kendala login atau data yang keliru, balas email ini.<br><br>Tuhan memberkati,<br><b>Sekretariat BPKPKK Bandung</b></td></tr>
</table></td></tr></table></body></html>`;
}
