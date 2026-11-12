import { it, expect, vi } from "vitest";

it("lihat sebagai: hanya Superadmin asli; target harus aktif", async () => {
  vi.resetModules();
  const users: any = {
    "su@x.com": { email: "su@x.com", status: "Disetujui", level: "Superadmin", tabs: ["Dashboard"] },
    "ed@x.com": { email: "ed@x.com", status: "Disetujui", level: "Edit", tabs: ["PD"] },
    "off@x.com": { email: "off@x.com", status: "Ditolak", level: "View", tabs: ["PD"] },
  };
  vi.doMock("@/lib/access", () => ({ getAccess: async (e: string) => users[e] || null }));
  const { effectiveAccess } = await import("@/lib/viewas");
  expect((await effectiveAccess("su@x.com", "ed@x.com")).acc).toMatchObject({ email: "ed@x.com", level: "Edit", viewAs: "su@x.com" });
  expect((await effectiveAccess("su@x.com", "off@x.com")).acc?.email).toBe("su@x.com");
  expect((await effectiveAccess("ed@x.com", "su@x.com")).acc?.email).toBe("ed@x.com");
  expect((await effectiveAccess("su@x.com", null)).acc?.viewAs).toBeUndefined();
});
