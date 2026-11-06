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
