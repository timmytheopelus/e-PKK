import { describe, it, expect, vi } from "vitest";

// Airtable REST mengirim kolom tautan (Periode) sebagai kode record, bukan teks "2026-2031".
vi.mock("@/lib/airtable", () => ({
  listUntil: async (_b: string, t: string) =>
    t.includes("jab")
      ? { records: [{ id: "recJ1", fields: { fldCCi0hV9yTL091P: { name: "Inreach" }, fldAAyRg1kko5YgrK: { name: "Sekretariat" }, fldI8J3VXZDyjWa3f: { name: "Ketua" } } }] }
      : { records: [
          { id: "recP1", fields: { fldfYrY68cNtbaXtN: ["recU1"], fldHK8r2o5q60IDXW: ["Ani"], fldwW6zQoxhbTWLDv: ["recJ1"], fldHngi5Klnm5bUmM: ["recPer26"] } },
          { id: "recP2", fields: { fldfYrY68cNtbaXtN: ["recU2"], fldHK8r2o5q60IDXW: ["Lama"], fldwW6zQoxhbTWLDv: ["recJ1"], fldHngi5Klnm5bUmM: ["recPer23"] } },
        ] },
  resolveLinks: async (_b: string, _t: string, recs: any[]) => {
    const nm: Record<string, string> = { recPer26: "2026-2031", recPer23: "2023-2026" };
    return recs.map((r) => ({ ...r, fields: { ...r.fields, fldHngi5Klnm5bUmM: (r.fields.fldHngi5Klnm5bUmM || []).map((id: string) => ({ id, name: nm[id] })) } }));
  },
  getRecord: async () => ({ fields: {} }),
}));
vi.mock("@/lib/policy", async (o) => ({ ...(await o<any>()), BASE_BPK: "appX", T: { jabatan: "jab", pengurus: "pgr", pendaftaran: "pd", events: "ev" } }));
vi.mock("@/lib/absen", () => ({ T_HADIR: "kh" }));

import { pengurusAktif } from "@/lib/seksi-hadir";

describe("pengurusAktif", () => {
  it("hanya periode 2026 yang dibaca, walau Periode berupa tautan", async () => {
    const o = await pengurusAktif();
    expect(o.map((x) => x.nama)).toEqual(["Ani"]);
    expect(o[0].jab[0].seksi).toBe("Sekretariat");
  });
});
