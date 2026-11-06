// Email notifikasi ke superadmin saat ada pengguna baru menunggu persetujuan.
// Memakai SMTP (mis. Gmail dengan App Password). Bila belum diatur, notifikasi email dilewati; lonceng di dashboard tetap bekerja.
import nodemailer from "nodemailer";
import { BASE_BPK, T } from "./policy";
import { listPage } from "./airtable";

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
