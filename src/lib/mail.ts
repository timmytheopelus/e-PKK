// Email notifikasi ke superadmin saat ada pengguna baru menunggu persetujuan.
// Memakai SMTP (mis. Gmail dengan App Password). Bila belum diatur, notifikasi email dilewati; lonceng di dashboard tetap bekerja.
import nodemailer from "nodemailer";
import { BASE_BPK, T } from "./policy";
import { listPage } from "./airtable";
import { welcomeHtml } from "./mail-template";

export function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return "https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return "";
}
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function superadminEmails(): Promise<string[]> {
  const { records } = await listPage(BASE_BPK, T.pengguna, {
    fieldIds: ["fldXCAPjc4bPkTbSq"], pageSize: 50,
    formula: 'AND({Level}="Superadmin",{Status}="Disetujui")',
  });
  return records.map((r) => String(r.fields["fldXCAPjc4bPkTbSq"] || "").trim()).filter(Boolean);
}

export async function notifySuperadmins(email: string, nama: string) {
  const { SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_USER || !SMTP_PASS) { console.log("SMTP belum diatur; email notifikasi dilewati"); return; }
  const to = await superadminEmails();
  if (!to.length) return;
  const link = appUrl() + "/dashboard?kelola=1";
  const tr = nodemailer.createTransport({ host: process.env.SMTP_HOST || "smtp.gmail.com", port: Number(process.env.SMTP_PORT) || 465, secure: (Number(process.env.SMTP_PORT) || 465) === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
  await tr.sendMail({
    from: process.env.MAIL_FROM || `e-PKK BPKPKK Bandung <${SMTP_USER}>`,
    to,
    subject: "[e-PKK] Pengguna baru menunggu persetujuan",
    text: `${nama || "(tanpa nama)"} <${email}> baru login dan menunggu persetujuan.\\n\\nBuka halaman persetujuan:\\n${link}`,
    html: `<p><b>${esc(nama || "(tanpa nama)")}</b> (${esc(email)}) baru login dan menunggu persetujuan.</p><p><a href="${link}">Buka halaman persetujuan</a></p>`,
  });
}

/** Email sambutan HTML ke pengguna baru. Mengembalikan false bila SMTP belum diatur. */
export async function sendWelcome(o: { nama: string; email: string; level: string; tabs: string[] }) {
  const { SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_USER || !SMTP_PASS) return false;
  const tr = nodemailer.createTransport({ host: process.env.SMTP_HOST || "smtp.gmail.com", port: Number(process.env.SMTP_PORT) || 465, secure: (Number(process.env.SMTP_PORT) || 465) === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
  const url = appUrl() || "https://e-pkk-one.vercel.app";
  await tr.sendMail({ from: process.env.MAIL_FROM || `e-PKK BPKPKK Bandung <${SMTP_USER}>`, to: o.email, subject: "Akses e-PKK BPKPKK Bandung", text: `Shalom ${o.nama}, Anda sudah diberi akses ke e-PKK: ${url}. Login dengan Gmail ${o.email}.`, html: welcomeHtml({ ...o, url }) });
  return true;
}

/** Laporan perubahan ke pemilik (mis. opsi Lokasi baru di Airtable). Mengembalikan false bila SMTP belum diatur atau gagal. */
export async function notifyOwner(subject: string, text: string): Promise<boolean> {
  const { SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_USER || !SMTP_PASS) { console.log("SMTP belum diatur; laporan ke pemilik dilewati: " + subject); return false; }
  try {
    const tr = nodemailer.createTransport({ host: process.env.SMTP_HOST || "smtp.gmail.com", port: Number(process.env.SMTP_PORT) || 465, secure: (Number(process.env.SMTP_PORT) || 465) === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
    await tr.sendMail({ from: process.env.MAIL_FROM || `e-PKK BPKPKK Bandung <${SMTP_USER}>`, to: process.env.OWNER_EMAIL || "timmy.theopelus@gmail.com", subject, text });
    return true;
  } catch (e) { console.error("email ke pemilik gagal", e); return false; }
}
