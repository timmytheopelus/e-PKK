// Kebijakan akses: tabel mana boleh dibaca/ditulis oleh tab dan level apa.
export const TAB_IDS: Record<string, string> = {
  Dashboard: "beranda",
  Pengurus: "pengurus",
  Pewarta: "pewarta",
  "Pewarta luar kota": "luar",
  PD: "pd",
  Umat: "umat",
  Kalender: "kalender",
};
export const ALL_TABS = Object.keys(TAB_IDS);

export const BASE_BPK = "appIGR8Duhj3Vsz48";
export const BASE_SMP = "appK4oGjawCjLHV0w";
export const T = {
  pengurus: "tbluIlEgPdHeodJHK",
  umat: "tblwRNtXSVzgzVXuk",
  events: "tblbAIILkeRIwn3kl",
  pd: "tblNjwoOJEGZeQxkJ",
  smpEvents: "tbll71vbqU6JbmrJq",
  smpKui: "tblIMjnv1ffB4LqK7",
  pengguna: "tbls2nQ3hW5rEIZUk",
};

export type Access = { email: string; nama: string; status: string; level: string; tabs: string[] };

type Spec = {
  base: string;
  read: string[]; // tab (nama tampilan) yang boleh membaca
  update?: { tabs: string[]; fields: string[] };
  create?: { tabs: string[]; fields: string[] };
};

const EF = ["fld0d9tIyi4nyTZsM", "fldoIkx9wLMaKOa38", "fldMO46zH4SDzIypy", "fld4i5iQ6zTY8UTSm", "fldrYLgd8LCDjwmLZ", "fldhgv2WlvqytF6zA", "fldCGnuPOkqzb5jx2", "fldROaJ8rPAZQPTED", "fld4qestIo5EjWAvk", "fldY0qw1v0a4fK9Sp", "fldSNUErmbrKEOCcf", "fldG7mLTlU3TDeXoF", "fldCFtFJH9S16bjl3"];
const PERSON = ["fldIpQTSkFB9sU0lo", "fld469PYR80nAUNIF", "fldzY1Z2QvIIEkYXR", "fldAaQ3zmiLBhp4z9", "fldcQFzBtr9EELTtV"];

export const TABLES: Record<string, Spec> = {
  [T.pengurus]: { base: BASE_BPK, read: ["Pengurus"] },
  [T.umat]: {
    base: BASE_BPK,
    read: ["Pengurus", "Pewarta", "PD", "Umat", "Dashboard"],
    update: { tabs: ["Pengurus", "Pewarta"], fields: PERSON },
    create: { tabs: ["PD"], fields: [PERSON[0], PERSON[2], "fldrHJ6q3HZvApccl"] },
  },
  [T.events]: { base: BASE_BPK, read: ["Kalender", "Dashboard"], create: { tabs: ["Kalender"], fields: EF } },
  [T.pd]: { base: BASE_BPK, read: ["PD", "Dashboard"], update: { tabs: ["PD"], fields: ["fldagyoKQyhfenB7u"] } },
  [T.smpEvents]: { base: BASE_SMP, read: ["Dashboard", "Pewarta luar kota"] },
  [T.smpKui]: { base: BASE_SMP, read: ["Dashboard"] },
};

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = "tool_error") { super(message); }
}

const any = (acc: Access, tabs: string[]) => tabs.some((t) => acc.tabs.includes(t));

export function checkRead(spec: Spec, tableId: string, input: any, acc: Access) {
  let tabs = spec.read;
  if (tableId === T.umat) {
    const hasIds = Array.isArray(input.recordIds) && input.recordIds.length > 0;
    const hasFilter = !!input.filters;
    if (!hasIds && !hasFilter) tabs = ["Umat"]; // daftar penuh umat hanya untuk tab Umat
    if (hasIds) tabs = ["Pengurus", "Pewarta", "PD", "Umat"];
  }
  if (!any(acc, tabs)) throw new HttpError(403, "Anda tidak punya izin membaca data ini.");
}

export function checkWrite(spec: Spec, kind: "update" | "create", records: any[], acc: Access) {
  const rule = spec[kind];
  if (!rule) throw new HttpError(403, "Penulisan ke tabel ini tidak diizinkan.");
  if (acc.level !== "Edit") throw new HttpError(403, "Level Anda View saja, tidak boleh mengubah data.");
  if (!any(acc, rule.tabs)) throw new HttpError(403, "Anda tidak punya izin mengubah data ini.");
  for (const r of records) {
    for (const k of Object.keys(r.fields || {})) {
      if (!rule.fields.includes(k)) throw new HttpError(403, "Field " + k + " tidak boleh diubah dari dashboard.");
    }
  }
}
