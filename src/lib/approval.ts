// Approval (ACC) permohonan pewarta luar kota oleh Sekretaris Jenderal BPK (dan Superadmin).
// Keputusan disimpan sebagai catatan di tabel ACC (SMP) yang ditautkan ke jadwal; tidak ada tabel atau field baru.
import { Access, BASE_SMP, HttpError, T } from "./policy";
import { at, clearCaches } from "./airtable";
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
  const qs = [EV.nama, EV.tgl, EV.hapus, EV.acc].map((f) => "fields%5B%5D=" + f).join("&");
  const ev = await at(`/v0/${BASE_SMP}/${T.smpEvents}/${eventId}?returnFieldsByFieldId=true&${qs}`);
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
