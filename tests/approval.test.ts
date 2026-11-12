import { it, expect, vi } from "vitest";

it("canApprove: hanya Sekretaris Jenderal atau Superadmin", async () => {
  const { canApprove } = await import("@/lib/approval");
  expect(canApprove({ level: "Edit", jabatan: "Sekretaris Jenderal" })).toBe(true);
  expect(canApprove({ level: "View", jabatan: "Wakil Ketua 1, Sekretaris Jenderal" })).toBe(true);
  expect(canApprove({ level: "Superadmin", jabatan: "" })).toBe(true);
  expect(canApprove({ level: "Edit", jabatan: "Sekretaris Jenderal Muda" })).toBe(false);
  expect(canApprove({ level: "Admin", jabatan: "Sekretariat" })).toBe(false);
});

it("decide: menolak non-Sekjen, view-as, keputusan/id salah, dan yang sudah diputuskan", async () => {
  vi.resetModules();
  process.env.AIRTABLE_TOKEN = "x";
  const calls: any[] = [];
  vi.stubGlobal("fetch", async (u: any, init: any) => {
    calls.push([String(u), init?.method || "GET", init?.body]);
    return new Response(JSON.stringify({ id: "recAAAAAAAAAAAAAA", fields: { fldQEDVuqLDDDSSex: "Pak X", fldFJ1CisvUveU2cM: "2026-11-20" } }), { status: 200 });
  });
  const { decide } = await import("@/lib/approval");
  const sek: any = { email: "n@x.com", nama: "Novi", status: "Disetujui", level: "Edit", tabs: [], jabatan: "Sekretaris Jenderal" };
  await expect(decide("recAAAAAAAAAAAAAA", "acc", { ...sek, jabatan: "Ketua" })).rejects.toThrow(/Sekretaris Jenderal/);
  await expect(decide("recAAAAAAAAAAAAAA", "acc", { ...sek, viewAs: "t@x.com" })).rejects.toThrow(/Lihat sebagai/);
  await expect(decide("recAAAAAAAAAAAAAA", "hapus", sek)).rejects.toThrow(/tidak dikenal/);
  await expect(decide("bukan-id", "acc", sek)).rejects.toThrow(/tidak valid/);
  await decide("recAAAAAAAAAAAAAA", "tolak", sek);
  const post = calls.find((c) => c[1] === "POST");
  expect(post[0]).toContain("tblN1c0nqFpHVgike");
  expect(JSON.parse(post[2]).records[0].fields.fldJqUzH9hVqzW5pZ).toBe("Ditolak");
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ id: "recAAAAAAAAAAAAAA", fields: { fld90EYItgFfqDNn7: ["recBBBBBBBBBBBBBB"] } }), { status: 200 }));
  await expect(decide("recAAAAAAAAAAAAAA", "acc", sek)).rejects.toThrow(/sudah diputuskan/);
});
