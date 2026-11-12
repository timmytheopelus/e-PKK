import { it, expect, vi } from "vitest";

it("adminCall menolak level/tab/email tidak valid dan self-demote", async () => {
  vi.resetModules();
  process.env.AIRTABLE_TOKEN = "x";
  const rows = [{ id: "recSELFSELFSELF01", fields: { fldXCAPjc4bPkTbSq: "me@x.com", fldvlRQXDZJdIIcw8: "Superadmin", fldRiPREBGEFPsyjW: "Disetujui" } }];
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ records: rows }), { status: 200 }));
  const { adminCall } = await import("@/lib/admin");
  await expect(adminCall("create", { email: "bukan-email", level: "View", tabs: [] }, "me@x.com")).rejects.toThrow(/Email/);
  await expect(adminCall("create", { email: "a@b.co", level: "Root", tabs: [] }, "me@x.com")).rejects.toThrow(/Level/);
  await expect(adminCall("create", { email: "a@b.co", level: "View", tabs: ["Rahasia"] }, "me@x.com")).rejects.toThrow(/Tab/);
  await expect(adminCall("update", { id: "recSELFSELFSELF01", level: "Edit" }, "me@x.com")).rejects.toThrow(/sendiri/);
  await expect(adminCall("hapus", {}, "me@x.com")).rejects.toThrow(/tidak dikenal/);
});

it("add: Admin hanya View dan hanya menu miliknya; Edit hanya Superadmin", async () => {
  vi.resetModules();
  process.env.AIRTABLE_TOKEN = "x";
  const umat = { id: "recUMAT00000000001", fields: { fldIpQTSkFB9sU0lo: "Ani Test", fldAaQ3zmiLBhp4z9: "ani@x.com" } };
  vi.stubGlobal("fetch", async (u: any) => new Response(JSON.stringify(String(u).includes("tblwRNtXSVzgzVXuk") ? { records: [umat] } : { records: [] }), { status: 200 }));
  const { adminCall } = await import("@/lib/admin");
  const adm = { level: "Admin", tabs: ["Dashboard", "Event"] };
  await expect(adminCall("add", { umatId: umat.id, level: "Edit", tabs: ["Dashboard"] }, "a@x.com", adm)).rejects.toThrow(/hanya boleh memberi hak View/);
  await expect(adminCall("add", { umatId: umat.id, level: "View", tabs: ["Umat"] }, "a@x.com", adm)).rejects.toThrow(/menu yang Anda miliki/);
  await expect(adminCall("add", { umatId: umat.id, level: "Superadmin", tabs: ["Dashboard"] }, "a@x.com")).rejects.toThrow(/View atau Edit/);
  await expect(adminCall("list", {}, "a@x.com", adm)).rejects.toThrow(/Superadmin/);
  await expect(adminCall("add", { umatId: "recTIDAKADA0000001", level: "View", tabs: ["Dashboard"] }, "a@x.com", adm)).rejects.toThrow(/tidak ditemukan/);
});
