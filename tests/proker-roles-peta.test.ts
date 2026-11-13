import { it, expect, vi, beforeEach } from "vitest";

const F = { pgUmatLink: "fldfYrY68cNtbaXtN", pgJab: "fldwW6zQoxhbTWLDv", pgPeriode: "fldzVMmCXsP2MP293" };
let data: Record<string, any[]> = {};
vi.mock("../src/lib/airtable", () => ({
  listUntil: async (_b: string, t: string) => ({ records: data[t] || [] }),
}));
vi.mock("../src/lib/policy", async (orig) => ({ ...(await orig<any>()), BASE_BPK: "b", T: { pengguna: "pengguna", jabatan: "jabatan", pengurus: "pengurus" } }));

beforeEach(() => {
  vi.resetModules();
  data = {
    pengguna: [{ id: "u1", fields: { fldXCAPjc4bPkTbSq: "laurentia@x.org", fldRiPREBGEFPsyjW: "Disetujui", fldf0NRl2Ts4kVxKr: ["umatL"] } }],
    jabatan: [
      { id: "j26", fields: { fldCCi0hV9yTL091P: "Dekanat", fldAAyRg1kko5YgrK: "Forkom 1", fldI8J3VXZDyjWa3f: "Ketua" } },
      { id: "j23", fields: { fldCCi0hV9yTL091P: "Lama", fldAAyRg1kko5YgrK: "Seksi Lama", fldI8J3VXZDyjWa3f: "Ketua" } },
    ],
    pengurus: [
      { id: "p26", fields: { [F.pgUmatLink]: ["umatL"], [F.pgJab]: ["j26"], [F.pgPeriode]: { name: "2026-2031" } } },
      { id: "p23", fields: { [F.pgUmatLink]: ["umatL"], [F.pgJab]: ["j23"], [F.pgPeriode]: { name: "2023-2026" } } },
    ],
  };
});

it("rowsOf membaca Pengurus lewat link umat & periode select: hanya 2026-2031", async () => {
  const { rowsOf, peranOf } = await import("../src/lib/proker-roles");
  const rows = await rowsOf("laurentia@x.org");
  expect(rows.map((r) => r.seksi)).toEqual(["Forkom 1"]);
  expect((await peranOf({ email: "laurentia@x.org", level: "Edit", jabatan: "" } as any)).koordSeksi).toEqual(["Forkom 1"]);
});
