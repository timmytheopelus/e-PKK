import { describe, it, expect, vi, beforeEach } from "vitest";

let sesi: string | null = "u@x.com";
let akun: any = null;
vi.mock("@/auth", () => ({ auth: async () => (sesi ? { user: { email: sesi } } : null) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
let lihatSbg = false;
vi.mock("@/lib/viewas", () => ({ AS_COOKIE: "epk_as", effectiveAccess: async () => ({ real: akun, acc: lihatSbg ? { ...akun, viewAs: "r@x.com" } : akun }) }));
vi.mock("@/lib/absen", async (orig) => {
  const m: any = await orig();
  return { ...m, infoAbsen: vi.fn(async () => ({ nama: "Rapat", tgl: "2026-11-14", buka: true, peserta: [] })), simpanHadir: vi.fn(async () => ({ ok: true, ditambah: 1, dihapus: 0 })) };
});
import { POST } from "@/app/api/absen/route";

const call = (b: any) => POST(new Request("http://t.test/api/absen", { method: "POST", body: JSON.stringify(b) }));
beforeEach(() => { lihatSbg = false; process.env.AUTH_SECRET = "rahasia"; sesi = "u@x.com"; akun = { email: "u@x.com", status: "Disetujui", level: "View", tabs: ["Absensi"] }; });

describe("/api/absen", () => {
  it("tanpa login: 401", async () => { sesi = null; expect((await call({ aksi: "daftar", token: "x" })).status).toBe(401); });
  it("login tanpa menu Absensi: 403 untuk daftar dan tandai", async () => {
    akun.tabs = ["Event"];
    expect((await call({ aksi: "daftar", token: "x" })).status).toBe(403);
    expect((await call({ aksi: "simpan", token: "x", perubahan: [{ pendaftaran: "recPEND00000000B1", hadir: true }] })).status).toBe(403);
  });
  it("dengan menu Absensi: daftar dan tandai berhasil", async () => {
    expect((await call({ aksi: "daftar", token: "x" })).status).toBe(200);
    expect((await call({ aksi: "simpan", token: "x", perubahan: [{ pendaftaran: "recPEND00000000B1", hadir: true }] })).status).toBe(200);
  });
  it("membuat link: boleh untuk menu Event atau Absensi, tidak untuk yang lain", async () => {
    akun.tabs = ["Event"];
    const r = await call({ aksi: "link", event: "recEVENT00000000A" });
    expect(r.status).toBe(200); expect((await r.json()).token).toMatch(/^recEVENT00000000A\./);
    akun.tabs = ["Kalender"];
    expect((await call({ aksi: "link", event: "recEVENT00000000A" })).status).toBe(403);
  });
});

describe("/api/absen go show", () => {
  it("cari dan goshow: 403 tanpa menu Absensi, 200 dengan menu Absensi", async () => {
    akun.tabs = ["Event"];
    expect((await call({ aksi: "cari", token: "x", q: "ab" })).status).toBe(403);
    expect((await call({ aksi: "goshow", token: "x", umat: "recUMAT0000000002" })).status).toBe(403);
  });
});

describe("/api/absen di mode Lihat sebagai", () => {
  it("link ditolak dengan pesan yang menjelaskan mode pratinjau", async () => {
    akun.tabs = ["Event", "Absensi"]; lihatSbg = true;
    const r = await call({ aksi: "link", event: "recEVENT00000000A" });
    expect(r.status).toBe(403);
    expect((await r.json()).message).toMatch(/Lihat sebagai/);
  });
});
