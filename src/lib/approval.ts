// Approval (ACC) permohonan pewarta luar kota oleh Sekretaris Jenderal BPK (dan Superadmin).
// Keputusan disimpan sebagai catatan di tabel ACC (SMP) yang ditautkan ke jadwal; tidak ada tabel atau field baru.
import { Access, BASE_BPK, BASE_SMP, HttpError, T } from "./policy";
import { at, clearCaches, getRecord, listPage } from "./airtable";
import { AF } from "./access";
import { clearProxyCache } from "./proxy";

const T_ACC = "tblN1c0nqFpHVgike";
const ACC = { judul: "fldwRI9Ja2uHqO1Kv", event: "fldFWueimBhWKbCYi", status: "fldJqUzH9hVqzW5pZ" };
const EV = { nama: "fldQEDVuqLDDDSSex", tgl: "fldFJ1CisvUveU2cM", hapus: "fldhLU1ca1XQz9jzr", acc: "fld90EYItgFfqDNn7" };
const REC = /^rec[A-Za-z0-9]{14}$/;
export const DECISIONS = { acc: "ACC - Ok", tolak: "Ditolak" } as const;

export const canApprove = (a: Pick<Access, "level" | "jabatan">) =>
  a.level === "Superadmin" || String(a.jabatan || "").split(",").some((j) => /^sekretaris jenderal$/i.test(j.trim()));

export async function decide(eventId: string, decision: string, acc: Access) {
  if (!canApprove(acc)) throw new HttpError(403, "Hanya Sekretaris Jenderal BPK atau Superadmin yang boleh approve.");
  if (acc.viewAs) throw new HttpError(403, "Mode 'Lihat sebagai' hanya untuk melihat, tidak bisa approve.");
  const status = (DECISIONS as Record<string, string>)[decision];
  if (!status) throw new HttpError(400, "Keputusan tidak dikenal.");
  if (!REC.test(eventId || "")) throw new HttpError(400, "id permohonan tidak valid.");
  const ev = await getRecord(BASE_SMP, T.smpEvents, eventId);
  const f = ev.fields || {};
  if (f[EV.hapus]) throw new HttpError(409, "Jadwal ini sudah dibatalkan.");
  if (Array.isArray(f[EV.acc]) && f[EV.acc].length) throw new HttpError(409, "Permohonan ini sudah diputuskan. Muat ulang halaman.");
  const judul = `${status} · ${f[EV.nama] || "Pewarta"} · ${String(f[EV.tgl] || "").slice(0, 10)} · oleh ${acc.nama || acc.email} via e-PKK`;
  console.log(JSON.stringify({ audit: "approval", who: acc.email, eventId, status }));
  await at(`/v0/${BASE_SMP}/${T_ACC}`, {
    method: "POST",
    // typecast hanya dipakai agar opsi status baru ("Ditolak") dibuat otomatis; nilainya sudah divalidasi di atas.
    body: JSON.stringify({ records: [{ fields: { [ACC.judul]: judul, [ACC.event]: [eventId], [ACC.status]: status } }], typecast: true }),
  });
  clearProxyCache(); clearCaches();
  return { ok: true, status };
}

/** Kontak Sekretaris Jenderal untuk tombol WA (hanya dikirim ke Admin/Superadmin). Cache 5 menit; gagal = null. */
let sj: { at: number; v: { nama: string; wa: string } | null } | null = null;
export async function sekjenContact() {
  if (sj && Date.now() - sj.at < 300_000) return sj.v;
  let v: { nama: string; wa: string } | null = null;
  try {
    const { records } = await listPage(BASE_BPK, T.pengguna, {
      fieldIds: [AF.nama, AF.umat, AF.jabLk, AF.status], pageSize: 20,
      formula: `FIND("Sekretaris Jenderal",ARRAYJOIN({Jabatan BPK (dari Umat)}))`,
    });
    const r = records.find((x: any) => x.fields[AF.status] === "Disetujui");
    const uid = r && Array.isArray(r.fields[AF.umat]) ? (r.fields[AF.umat][0]?.id || r.fields[AF.umat][0]) : "";
    if (r && /^rec[A-Za-z0-9]{14}$/.test(uid || "")) {
      const u = await getRecord(BASE_BPK, T.umat, uid);
      const wa = String(u.fields?.fldzY1Z2QvIIEkYXR || "");
      if (wa) v = { nama: String(r.fields[AF.nama] || "Sekretaris Jenderal"), wa };
    }
  } catch (e) { console.error("sekjenContact", e); }
  sj = { at: Date.now(), v };
  return v;
}
