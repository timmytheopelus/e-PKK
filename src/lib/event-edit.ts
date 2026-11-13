// Hak edit event: Admin/Superadmin, anggota Kesekretariatan, atau pembuat event.
import { BASE_BPK, T } from "./policy";
import { listUntil } from "./airtable";
import { AF } from "./access";

export function canEditEvent(acc: { email: string; level: string }, creatorEmail: string | undefined, isSekretariat: boolean): boolean {
  if (acc.level === "Admin" || acc.level === "Superadmin") return true;
  if (isSekretariat) return true;
  const c = (creatorEmail || "").trim().toLowerCase();
  return !!c && c === (acc.email || "").trim().toLowerCase();
}

const JAB_BIDANG = "fldCCi0hV9yTL091P";
const PGR = { umat: "fldfYrY68cNtbaXtN", jabatan: "fldwW6zQoxhbTWLDv", periode: "fldzVMmCXsP2MP293" }; // umat = link record, periode = select
const SEKRE = /kesekretariatan|unit staf/i; // "Unit Staf" = nama lama opsi bidang di Airtable
let cache: { at: number; v: Promise<Set<string>> } | null = null;

/** Email akun yang umatnya memegang jabatan di bidang Kesekretariatan, periode 2026. Cache 10 menit. */
export function sekretariatEmails(): Promise<Set<string>> {
  if (cache && Date.now() - cache.at < 600_000) return cache.v;
  const v = (async () => {
    const jab = await listUntil(BASE_BPK, T.jabatan, { fieldIds: [JAB_BIDANG], want: Infinity, maxPages: 10 });
    const jabIds = new Set(jab.records.filter((r) => { const b: any = r.fields[JAB_BIDANG]; return SEKRE.test(String(typeof b === "object" && b ? b.name ?? "" : b ?? "")); }).map((r) => r.id));
    const pg = await listUntil(BASE_BPK, T.pengurus, { fieldIds: [PGR.umat, PGR.jabatan, PGR.periode], want: Infinity, maxPages: 30 });
    const umat = new Set<string>();
    for (const r of pg.records) {
      const p: any = r.fields[PGR.periode], ptxt = String(typeof p === "object" && p ? p.name ?? "" : p ?? "");
      if (ptxt && !/^2026/.test(ptxt)) continue;
      const js: any[] = r.fields[PGR.jabatan] || [];
      if (!js.some((j) => jabIds.has(typeof j === "string" ? j : j?.id))) continue;
      (r.fields[PGR.umat] || []).forEach((u: any) => umat.add(typeof u === "string" ? u : u?.id));
    }
    const us = await listUntil(BASE_BPK, T.pengguna, { fieldIds: [AF.email, AF.umat], want: Infinity, maxPages: 10 });
    const out = new Set<string>();
    for (const r of us.records) {
      const ids: any[] = r.fields[AF.umat] || [];
      if (ids.some((u) => umat.has(typeof u === "string" ? u : u?.id))) out.add(String(r.fields[AF.email] || "").trim().toLowerCase());
    }
    out.delete("");
    return out;
  })();
  cache = { at: Date.now(), v };
  v.catch(() => { cache = null; });
  return v;
}
export function clearSekretariatCache() { cache = null; }
