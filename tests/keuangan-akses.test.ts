import { describe, it, expect, vi, beforeEach } from "vitest";

let peran: any;
vi.mock("@/lib/proker-roles", () => ({ peranOf: async () => peran }));
const none = { koordBidang: [], koordSeksi: [], sekjen: false, bendahara: false, pimpinan: false };
const acc: any = { email: "x@x.com", nama: "X", status: "Disetujui", level: "View", tabs: ["Keuangan"], jabatan: "" };

beforeEach(() => { peran = { ...none }; });

describe("akses Keuangan menurut jabatan (server)", () => {
  it("anggota biasa yang kebetulan punya tab Keuangan ditolak", async () => {
    const { keuanganBoleh, pastikanKeuangan } = await import("../src/lib/keuangan-akses");
    expect(await keuanganBoleh(acc)).toBe(false);
    await expect(pastikanKeuangan(acc)).rejects.toMatchObject({ status: 403 });
  });
  it("Bendahara, Sekjen, Koordinator/Penasihat (pimpinan) diizinkan", async () => {
    const { keuanganBoleh } = await import("../src/lib/keuangan-akses");
    for (const k of ["bendahara", "sekjen", "pimpinan"]) { peran = { ...none, [k]: true }; expect(await keuanganBoleh(acc)).toBe(true); }
  });
  it("Superadmin selalu diizinkan tanpa membaca jabatan", async () => {
    const { keuanganBoleh } = await import("../src/lib/keuangan-akses");
    expect(await keuanganBoleh({ ...acc, level: "Superadmin" })).toBe(true);
  });
  it("Ketua seksi atau koordinator bidang biasa ditolak", async () => {
    const { keuanganBoleh } = await import("../src/lib/keuangan-akses");
    peran = { ...none, koordBidang: ["Outreach"], koordSeksi: ["Forkom 1"] };
    expect(await keuanganBoleh(acc)).toBe(false);
  });
  it("handleCall ke tabel Keuangan ditolak 403 untuk non-bendahara walau punya tab", async () => {
    const { handleCall } = await import("../src/lib/proxy");
    const { BASE_BEN, KEU, T } = await import("../src/lib/policy");
    await expect(handleCall("list_records_for_table", { baseId: BASE_BEN, tableId: T.mutasi, fieldIds: [KEU.nominal] }, acc)).rejects.toMatchObject({ status: 403 });
  });
});
