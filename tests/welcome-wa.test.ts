import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/access", () => ({ AF: { email: "fE", nama: "fN", status: "fS", level: "fL", tabs: "fT", umat: "fU", login: "fG", jabatan: "fJ" }, invalidateAccess: () => {}, jabatanOf: () => "" }));
vi.mock("@/lib/mail", () => ({ appUrl: () => "https://e-pkk-one.vercel.app", sendWelcome: vi.fn(async () => { throw new Error("tidak boleh dipanggil"); }) }));
vi.mock("@/lib/airtable", () => ({
  at: vi.fn(async (_p: string, init: any) => ({ records: [{ id: "recPENGGUNA00001", fields: JSON.parse(init.body).records?.[0]?.fields || {} }] })),
  listPage: vi.fn(async () => ({ records: [] })),
  resolveLinks: async (_b: string, _t: string, r: any[]) => r,
  listUntil: vi.fn(async () => ({ records: [
    { id: "recUMAT0000000001", fields: { fldIpQTSkFB9sU0lo: "Richie Osfred", fldAaQ3zmiLBhp4z9: "richie@gmail.com", fldzY1Z2QvIIEkYXR: "0812-3456-7890" } },
    { id: "recUMAT0000000002", fields: { fldIpQTSkFB9sU0lo: "Tanpa Wa", fldAaQ3zmiLBhp4z9: "tanpa@gmail.com" } },
  ] })),
}));
import { welcomeWa } from "@/lib/mail-template";
import { adminCall } from "@/lib/admin";

describe("welcomeWa", () => {
  const t = welcomeWa({ nama: "Richie", email: "richie@gmail.com", level: "View", tabs: ["Dashboard", "Event", "Absensi"], url: "https://e-pkk-one.vercel.app" });
  it("memuat sapaan, link, email login, hak akses, cara masuk", () => {
    expect(t).toContain("Shalom Richie");
    expect(t).toContain("https://e-pkk-one.vercel.app");
    expect(t).toContain("richie@gmail.com");
    expect(t).toContain("Hanya lihat");
    expect(t).toMatch(/Masuk dengan Google/);
  });
  it("hanya menjelaskan menu yang dipegang, tanpa entitas HTML", () => {
    expect(t).toContain("Event & pendaftar");
    expect(t).toContain("Absensi kehadiran");
    expect(t).not.toContain("Kalender kegiatan");
    expect(t).not.toContain("&amp;");
  });
});

describe("adminCall add: sambutan lewat WhatsApp", () => {
  const add = (umatId: string) => adminCall("add", { umatId, level: "View", tabs: ["Dashboard", "Event"] }, "me@x.com");
  it("mengembalikan nomor WA (digit, format 62) dan teks pesan; tidak mengirim email", async () => {
    const r: any = await add("recUMAT0000000001");
    expect(r.wa).toBe("6281234567890");
    expect(r.pesan).toContain("Shalom Richie Osfred");
    expect(r.pesan).toContain("richie@gmail.com");
    expect(r.emailed).toBeUndefined();
  });
  it("umat tanpa nomor WA: wa kosong, pesan tetap ada untuk disalin", async () => {
    const r: any = await add("recUMAT0000000002");
    expect(r.wa).toBe("");
    expect(r.pesan).toContain("Shalom Tanpa Wa");
  });
});

import { ADMIN_JS } from "@/ui/admin-js";
describe("layar Tambah pengguna", () => {
  it("menampilkan tombol WhatsApp berisi pesan sambutan dan tombol salin; tidak lagi menyebut email/SMTP", () => {
    expect(ADMIN_JS).toContain('"https://wa.me/" + j.wa + "?text=" + encodeURIComponent(j.pesan)');
    expect(ADMIN_JS).toContain("Kirim sambutan via WhatsApp");
    expect(ADMIN_JS).toContain("Salin pesan");
    expect(ADMIN_JS).not.toContain("SMTP belum diatur");
  });
});
