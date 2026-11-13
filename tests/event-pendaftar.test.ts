import { describe, it, expect, vi, beforeEach } from "vitest";

let sesi: string | null = "u@x.com";
let akun: any = null;
let lihatSbg = false;
let rec: any = null;
const calls: any[] = [];
vi.mock("@/auth", () => ({ auth: async () => (sesi ? { user: { email: sesi } } : null) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/viewas", () => ({ AS_COOKIE: "epk_as", effectiveAccess: async () => ({ real: akun, acc: lihatSbg ? { ...akun, viewAs: "r@x.com" } : akun }) }));
vi.mock("@/lib/airtable", () => ({
  getRecord: vi.fn(async () => rec),
  at: vi.fn(async (path: string, init: any) => { calls.push({ path, init }); return {}; }),
}));
import { POST } from "@/app/api/event-pendaftar/route";

const E = "recEVENT00000000A", P = "recPEND00000000B1";
const call = (b: any) => POST(new Request("http://t.test/api/event-pendaftar", { method: "POST", body: JSON.stringify(b) }));
beforeEach(() => {
  sesi = "u@x.com"; lihatSbg = false; calls.length = 0;
  akun = { email: "u@x.com", status: "Disetujui", level: "Admin", tabs: ["Event"] };
  rec = { id: P, fields: { flduf15moMpZSklGL: [E], fldNGGEcwHqIsQPct: { name: "Daftar" } } };
});

describe("/api/event-pendaftar (hapus = tandai Batal)", () => {
  it("Admin dengan menu Event: status jadi Batal, baris tidak dihapus", async () => {
    const r = await call({ aksi: "batal", event: E, id: P });
    expect(r.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].init.method).toBe("PATCH");
    expect(JSON.parse(calls[0].init.body).records[0]).toEqual({ id: P, fields: { fldNGGEcwHqIsQPct: "Batal" } });
  });
  it("Superadmin juga boleh", async () => {
    akun.level = "Superadmin";
    expect((await call({ aksi: "batal", event: E, id: P })).status).toBe(200);
  });
  it("Edit/View ditolak 403; tanpa login 401; tanpa menu Event 403; mode Lihat sebagai 403", async () => {
    akun.level = "Edit"; expect((await call({ aksi: "batal", event: E, id: P })).status).toBe(403);
    akun.level = "View"; expect((await call({ aksi: "batal", event: E, id: P })).status).toBe(403);
    akun.level = "Admin"; akun.tabs = ["Kalender"]; expect((await call({ aksi: "batal", event: E, id: P })).status).toBe(403);
    akun.tabs = ["Event"]; lihatSbg = true; expect((await call({ aksi: "batal", event: E, id: P })).status).toBe(403);
    lihatSbg = false; sesi = null; expect((await call({ aksi: "batal", event: E, id: P })).status).toBe(401);
    expect(calls).toHaveLength(0);
  });
  it("pendaftar milik event lain ditolak; id ngawur 400; sudah Batal tidak ditulis ulang", async () => {
    rec.fields.flduf15moMpZSklGL = ["recLAIN000000000X"];
    expect((await call({ aksi: "batal", event: E, id: P })).status).toBe(400);
    expect((await call({ aksi: "batal", event: E, id: "ngawur" })).status).toBe(400);
    rec.fields.flduf15moMpZSklGL = [E]; rec.fields.fldNGGEcwHqIsQPct = { name: "Batal" };
    expect((await call({ aksi: "batal", event: E, id: P })).status).toBe(200);
    expect(calls).toHaveLength(0);
  });
});
