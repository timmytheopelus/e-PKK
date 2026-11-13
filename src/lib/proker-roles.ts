// Peran Program Kerja dibaca dari jabatan Pengurus (periode 2026) akun yang login.
import { Access, BASE_BPK, T } from "./policy";
import { listUntil } from "./airtable";
import { AF } from "./access";
import { canApprove } from "./approval";

export type Peran = { koordBidang: string[]; koordSeksi: string[]; sekjen: boolean; bendahara: boolean; pimpinan: boolean };
export type JabRow = { bidang: string; seksi: string; peran: string };

const JAB = { bidang: "fldCCi0hV9yTL091P", seksi: "fldAAyRg1kko5YgrK", peran: "fldI8J3VXZDyjWa3f" };
const PGR = { umat: "fldHK8r2o5q60IDXW", jabatan: "fldwW6zQoxhbTWLDv", periode: "fldHngi5Klnm5bUmM" };

const sel = (v: any) => String(typeof v === "object" && v ? v.name ?? "" : v ?? "").trim();
const uniq = (a: string[]) => [...new Set(a)];

/** Turunkan peran dari baris jabatan master. Ketua seksi "Pimpinan <Bidang>" = Koordinator Bidang; Ketua seksi lain = Koordinator Seksi. */
export function peranFromRows(rows: JabRow[], sekjen: boolean): Peran {
  const koordBidang: string[] = [], koordSeksi: string[] = [];
  let pimpinan = false, bendahara = false;
  for (const r of rows) {
    if (/^(pimpinan|koordinator|penasihat)$/i.test(r.peran) || /^(pimpinan|koordinator)$/i.test(r.bidang)) pimpinan = true; // "Pimpinan" kini bernama "Koordinator"
    if (/bendahara/i.test(r.seksi)) bendahara = true;
    if (r.peran !== "Ketua") continue;
    if (/^(pimpinan|koordinator)\s+/i.test(r.seksi)) koordBidang.push(r.bidang);
    else koordSeksi.push(r.seksi);
  }
  return { koordBidang: uniq(koordBidang), koordSeksi: uniq(koordSeksi), sekjen, bendahara, pimpinan };
}

type Peta = { byEmail: Map<string, JabRow[]>; seksi: Set<string>; seksiBidang: Map<string, string>; sekjen: Set<string> };
let petaCache: { at: number; v: Promise<Peta> } | null = null;

/** Peta email akun -> baris jabatan (Pengurus periode 2026), daftar seksi master, dan email Sekretaris Jenderal. Cache 5 menit. */
function muatPeta(): Promise<Peta> {
  if (petaCache && Date.now() - petaCache.at < 300_000) return petaCache.v;
  const v = (async (): Promise<Peta> => {
    const [us, jab, pg] = await Promise.all([
      listUntil(BASE_BPK, T.pengguna, { fieldIds: [AF.email, AF.umat, AF.status, AF.jabLk], want: Infinity, maxPages: 10 }),
      listUntil(BASE_BPK, T.jabatan, { fieldIds: [JAB.bidang, JAB.seksi, JAB.peran], want: Infinity, maxPages: 10 }),
      listUntil(BASE_BPK, T.pengurus, { fieldIds: [PGR.umat, PGR.jabatan, PGR.periode], want: Infinity, maxPages: 30 }),
    ]);
    const master = new Map<string, JabRow>(jab.records.map((r) => [r.id, { bidang: sel(r.fields[JAB.bidang]), seksi: sel(r.fields[JAB.seksi]), peran: sel(r.fields[JAB.peran]) }]));
    const seksi = new Set<string>([...master.values()].map((m) => m.seksi).filter(Boolean));
    const seksiBidang = new Map<string, string>();
    for (const m of master.values()) if (m.seksi && m.bidang && !seksiBidang.has(m.seksi)) seksiBidang.set(m.seksi, m.bidang);
    const rowsByUmat = new Map<string, JabRow[]>();
    for (const r of pg.records) {
      const ptxt = sel(r.fields[PGR.periode]);
      if (ptxt && !ptxt.includes("2026")) continue;
      const ms: JabRow[] = ((r.fields[PGR.jabatan] as any[]) || []).map((j) => master.get(typeof j === "string" ? j : j?.id)).filter(Boolean) as JabRow[];
      for (const u of (r.fields[PGR.umat] as any[]) || []) {
        const id = typeof u === "string" ? u : u?.id;
        rowsByUmat.set(id, [...(rowsByUmat.get(id) || []), ...ms]);
      }
    }
    const byEmail = new Map<string, JabRow[]>(), sekjen = new Set<string>();
    for (const r of us.records) {
      const email = String(r.fields[AF.email] || "").trim().toLowerCase();
      if (!email || (r.fields[AF.status] && r.fields[AF.status] !== "Disetujui")) continue;
      const rows = ((r.fields[AF.umat] as any[]) || []).flatMap((u) => rowsByUmat.get(typeof u === "string" ? u : u?.id) || []);
      byEmail.set(email, rows);
      if (/sekretaris jenderal/i.test(JSON.stringify(r.fields[AF.jabLk] ?? ""))) sekjen.add(email);
    }
    return { byEmail, seksi, seksiBidang, sekjen };
  })();
  petaCache = { at: Date.now(), v };
  v.catch(() => { petaCache = null; });
  return v;
}

/** Baris jabatan akun (Pengurus periode 2026). */
export async function rowsOf(email: string): Promise<JabRow[]> {
  return (await muatPeta()).byEmail.get((email || "").trim().toLowerCase()) || [];
}

/** Peran akun. Superadmin/Sekjen: sekjen=true. */
export async function peranOf(acc: Pick<Access, "email" | "level" | "jabatan">): Promise<Peran> {
  return peranFromRows(await rowsOf(acc.email), canApprove(acc));
}

/** Nama seksi yang dikenal di master Jabatan. */
export async function semuaSeksi(): Promise<Set<string>> { return (await muatPeta()).seksi; }

/** Peta seksi -> bidang dari master Jabatan. */
export async function seksiBidang(): Promise<Map<string, string>> { return (await muatPeta()).seksiBidang; }

/** Email akun yang peran turunannya memenuhi pred; sekjen=true menambahkan pemegang jabatan Sekretaris Jenderal. */
export async function emailsWhere(pred: (p: Peran) => boolean): Promise<string[]> {
  const m = await muatPeta();
  const out: string[] = [];
  for (const [email, rows] of m.byEmail) if (pred(peranFromRows(rows, m.sekjen.has(email)))) out.push(email);
  return out;
}
export function clearPeranCache() { petaCache = null; }
