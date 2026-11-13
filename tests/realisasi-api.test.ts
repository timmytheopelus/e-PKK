import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpError } from "../src/lib/policy";

let sesi: string | null = "b@x.org";
let akun: any = null;
vi.mock("@/auth", () => ({ auth: async () => (sesi ? { user: { email: sesi } } : null) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/viewas", () => ({ AS_COOKIE: "epk_as", effectiveAccess: async () => ({ real: akun, acc: akun }) }));
const daftar = vi.fn(async () => ({ programs: [{ id: "recP" }], bisaCatat: true }));
const catat = vi.fn(async (_a: any, _i: any) => ({ id: "recREAL", sisa: 100 }));
vi.mock("@/lib/realisasi", () => ({ daftarAnggaran: (a: any) => daftar(a), catatRealisasi: (a: any, i: any) => catat(a, i) }));
import { POST } from "@/app/api/realisasi/route";

const call = (b: any) => POST(new Request("http://t.test/api/realisasi", { method: "POST", body: JSON.stringify(b) }));
beforeEach(() => { sesi = "b@x.org"; akun = { email: "b@x.org", status: "Disetujui", level: "Edit", tabs: ["Keuangan"] }; daftar.mockClear(); catat.mockClear(); });

describe("/api/realisasi", () => {
  it("tanpa login: 401", async () => { sesi = null; expect((await call({ aksi: "daftar" })).status).toBe(401); });
  it("akun belum Disetujui: 403", async () => { akun.status = "Menunggu"; expect((await call({ aksi: "daftar" })).status).toBe(403); });
  it("daftar mengembalikan program dan bisaCatat", async () => {
    const r = await call({ aksi: "daftar" });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ programs: [{ id: "recP" }], bisaCatat: true });
  });
  it("catat meneruskan input ke lib dan mengembalikan hasilnya", async () => {
    const r = await call({ aksi: "catat", programId: "recP", nominal: 5 });
    expect(r.status).toBe(200); expect(await r.json()).toEqual({ id: "recREAL", sisa: 100 });
    expect(catat.mock.calls[0][1]).toMatchObject({ programId: "recP", nominal: 5 });
  });
  it("galat lib dipetakan ke status dan pesan: 409 dan 403", async () => {
    catat.mockRejectedValueOnce(new HttpError(409, "Nominal melebihi sisa anggaran"));
    const r = await call({ aksi: "catat" });
    expect(r.status).toBe(409); expect((await r.json()).message).toContain("melebihi");
    daftar.mockRejectedValueOnce(new HttpError(403, "Menu Keuangan hanya untuk"));
    expect((await call({ aksi: "daftar" })).status).toBe(403);
  });
  it("aksi tidak dikenal: 400", async () => { expect((await call({ aksi: "hapus" })).status).toBe(400); });
});
