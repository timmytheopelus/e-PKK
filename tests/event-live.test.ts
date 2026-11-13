import { describe, it, expect, vi, beforeEach } from "vitest";

let sesi: string | null = "u@x.com";
let akun: any = null;
vi.mock("@/auth", () => ({ auth: async () => (sesi ? { user: { email: sesi } } : null) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/viewas", () => ({ AS_COOKIE: "epk_as", effectiveAccess: async () => ({ real: akun, acc: akun }) }));
vi.mock("@/lib/seksi-hadir", () => ({ pengurusAktif: async () => [] }));
vi.mock("@/lib/airtable", () => ({
  resolveLinks: async (_b: string, _t: string, r: any[]) => r,
  at: vi.fn(), listPage: vi.fn(),
  getRecord: vi.fn(async () => ({ id: "recEVENT00000000A", fields: { fld0d9tIyi4nyTZsM: "261114-Rapat Tim Kerja", fldoIkx9wLMaKOa38: "2026-11-14" } })),
  listUntil: vi.fn(async (_b: string, table: string) => table === "tblQgU4DawCAXIRdi"
    ? { records: [
        { id: "recKH1", fields: { fldrIFO5fehaqaS2u: ["recEVENT00000000A"], fldTuFsmLgiZoHXEf: ["recP1"], fldudT9j1X2vkQCqD: { name: "Hadir" } } },
        { id: "recKH2", fields: { fldrIFO5fehaqaS2u: ["recEVENT00000000A"], fldTuFsmLgiZoHXEf: ["recP2"], fldudT9j1X2vkQCqD: { name: "Hadir" } } }, // pendaftaran batal: tidak dihitung
        { id: "recKH3", fields: { fldrIFO5fehaqaS2u: ["recLAIN000000000X"], fldTuFsmLgiZoHXEf: ["recP3"], fldudT9j1X2vkQCqD: { name: "Hadir" } } },
      ] }
    : { records: [
        { id: "recP1", fields: { flduf15moMpZSklGL: ["recEVENT00000000A"], fldNGGEcwHqIsQPct: { name: "Daftar" } } },
        { id: "recP2", fields: { flduf15moMpZSklGL: ["recEVENT00000000A"], fldNGGEcwHqIsQPct: { name: "Batal" } } },
        { id: "recP4", fields: { flduf15moMpZSklGL: ["recEVENT00000000A"], fldNGGEcwHqIsQPct: { name: "Confirmed" } } },
      ] }),
}));
import { ringkasHadir } from "@/lib/absen";
import { POST } from "@/app/api/event-live/route";

const call = (b: any) => POST(new Request("http://t.test/api/event-live", { method: "POST", body: JSON.stringify(b) }));
beforeEach(() => { sesi = "u@x.com"; akun = { email: "u@x.com", status: "Disetujui", level: "View", tabs: ["Event"] }; });

describe("ringkasHadir", () => {
  it("menghitung yang hadir dari pendaftar aktif saja, dan jumlah pendaftar aktif", async () => {
    expect(await ringkasHadir("recEVENT00000000A")).toEqual({ hadir: 1, daftar: 2 });
  });
});
describe("/api/event-live", () => {
  it("tanpa login 401; tanpa menu Event 403", async () => {
    sesi = null; expect((await call({ events: ["recEVENT00000000A"] })).status).toBe(401);
    sesi = "u@x.com"; akun.tabs = ["Kalender"]; expect((await call({ events: ["recEVENT00000000A"] })).status).toBe(403);
  });
  it("dengan menu Event: angka per event; id tidak sah dibuang", async () => {
    const r = await call({ events: ["recEVENT00000000A", "ngawur"] });
    expect(r.status).toBe(200);
    expect((await r.json()).items).toEqual({ recEVENT00000000A: { hadir: 1, daftar: 2 } });
  });
});
