import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { renderDashboard } from "@/ui/render";

const acc: any = { email: "a@b.c", nama: "A", status: "Disetujui", level: "View", tabs: ["Dashboard", "Pewarta", "Pengurus", "PD", "Luar kota", "Umat", "KEP", "Event", "Inventaris", "Keuangan"] };
const doc = new JSDOM(renderDashboard(acc)).window.document;
const HTML = renderDashboard(acc);
const tab = (id: string) => doc.getElementById("tab-" + id)!;

describe("menu Pewarta: dashboard pendek + tab Laporan", () => {
  const t = tab("pewarta");
  it("punya baris tab laporan pwRptTabs dengan enam laporan, Daftar paling depan", () => {
    const bar = t.querySelector("#pwRptTabs")!;
    expect(bar).toBeTruthy();
    const labels = Array.from(bar.querySelectorAll("button")).map((b: any) => b.textContent!.trim());
    expect(labels.slice(0, 6)).toEqual(["Daftar", "Per PD", "Per modul", "Pastor & suster", "Permohonan & tema", "Kuesioner"]);
  });
  it("saat awal hanya Daftar yang tampil", () => {
    const ids = ["Daftar", "Pd", "Modul", "Pastor", "Lk", "Kui", "Ring"];
    const shown = ids.filter((i) => !(t.querySelector("#pwSec" + i) as HTMLElement).hidden);
    expect(shown).toEqual(["Daftar"]);
  });
  it("dashboard pendek: paling banyak 4 kartu angka", () => {
    expect(t.querySelectorAll("#pwTiles .tile").length).toBeLessThanOrEqual(4);
  });
  it("filter dilipat dalam satu tombol Filter", () => {
    expect(t.querySelector("#pwFilterBtn")).toBeTruthy();
    expect((t.querySelector("#pwFilterBox") as HTMLElement).hidden).toBe(true);
  });
  it("Per modul berbentuk satu tabel gulir, bukan tumpukan kartu", () => {
    expect(t.querySelector("#pwSecModul .tw table #pwModulBody")).toBeTruthy();
    expect(t.querySelector("#pwModulBox")).toBeNull();
  });
  it("tabel Pewarta ada di dalam .tw", () => {
    const loose = Array.from(t.querySelectorAll("table")).filter((x: any) => !x.closest(".tw"));
    expect(loose.length).toBe(0);
  });
});

const hid = (t: Element, id: string) => (t.querySelector("#" + id) as HTMLElement).hidden;

describe("menu Pengurus", () => {
  it("Bagan terbuka dulu dalam model Pohon (lebar) di semua lebar layar", () => {
    expect(HTML).not.toMatch(/innerWidth <= 860 \? "v" : "t"/);
    expect(HTML).toMatch(/return "t";\s*\}\)\(\);/);
    expect(tab("pengurus").querySelector('#viewChips [data-v="bagan"]')!.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("menu Pewarta luar kota", () => {
  const t = tab("luar");
  it("tab laporan: tabel pewarta dulu, lainnya tersembunyi", () => {
    expect(t.querySelector("#luRptTabs")).toBeTruthy();
    expect(hid(t, "luSecDaftar")).toBe(false);
    expect(hid(t, "luSecTop")).toBe(true);
    expect(hid(t, "luSecTamu")).toBe(true);
  });
  it("filter dilipat dalam satu tombol", () => {
    expect(t.querySelector("#luFilterBtn")).toBeTruthy();
    expect(hid(t, "luFilterBox")).toBe(true);
  });
});

describe("menu PD", () => {
  const t = tab("pd");
  it("tab laporan: tabel PD dulu, peta dan dekanat tersembunyi", () => {
    expect(t.querySelector("#pdRptTabs")).toBeTruthy();
    expect(hid(t, "pdSecDaftar")).toBe(false);
    expect(hid(t, "pdSecPeta")).toBe(true);
  });
  it("filter dilipat dalam satu tombol", () => {
    expect(t.querySelector("#pdFilterBtn")).toBeTruthy();
    expect(hid(t, "pdFilterBox")).toBe(true);
  });
});

describe("menu Umat", () => {
  it("kontrol filter tampil paling banyak dua (cari + PD)", () => {
    const t = tab("umat");
    expect(t.querySelectorAll(".sel2 input, .sel2 select").length).toBeLessThanOrEqual(2);
  });
});

describe("menu KEP", () => {
  it("beranda KEP memuat tabel kegiatan; grafik pindah ke tampilan Grafik", () => {
    expect(HTML).toContain("function kpTabelKeg(");
    expect(HTML).toMatch(/\["lap", "Grafik"\]/);
    expect(HTML).toContain('KP.v === "lap"');
  });
});
