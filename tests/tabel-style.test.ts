import { describe, it, expect } from "vitest";
import { renderDashboard } from "@/ui/render";

const acc: any = { email: "a@b.c", nama: "A", status: "Disetujui", level: "View", tabs: ["Dashboard", "Pengurus", "Event", "Inventaris", "Keuangan"] };

describe("gaya tabel di semua menu", () => {
  const html = renderDashboard(acc);
  it("kotak tabel bisa digeser dan header menempel (tablebox, tw, inventaris)", () => {
    expect(html).toContain(".tablebox, .tw, .inv-tw { overflow: auto; max-height: 70vh;");
    expect(html).toMatch(/\.tablebox thead th, \.tw thead th, \.inv-tw thead th \{ position: sticky; top: 0;[^}]*font-size: 15px; font-weight: 700/);
    expect(html).toContain("border-collapse: separate; border-spacing: 0");
  });
  it("baris selang-seling tidak menimpa baris grup dan baris detail, termasuk pasangan klik+detail", () => {
    expect(html).toContain(":not(.grp, .grp2, .det, .inv-g1, .inv-g2)) td { background: var(--bg); }");
    expect(html).toContain("tbody:has(> tr.det)) > tr.clk:where(:nth-child(4n+3)) > td { background: var(--bg); }");
  });
  it("hover baris inventaris memakai warna aksen, bukan warna selang-seling", async () => {
    const { INVENTARIS_JS } = await import("@/ui/inventaris-js");
    expect(INVENTARIS_JS).toContain(".inv-tw tr.clk:hover td{background:var(--accent-soft)}");
  });
});
