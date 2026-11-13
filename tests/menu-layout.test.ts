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

describe("menu Beranda", () => {
  const t = tab("beranda");
  it("bagian atas pendek (dash-short) dan laporan di tab berRptTabs", () => {
    expect(t.querySelector(".dash-short #dashAgenda")).toBeTruthy();
    expect(t.querySelector("#berRptTabs")).toBeTruthy();
    expect(hid(t, "berSecTren")).toBe(false);
    expect(hid(t, "berSecLk")).toBe(true);
    expect(hid(t, "berSecTema")).toBe(true);
  });
  it("kartu angka dilipat: empat pertama saja, sisanya lewat tombol", () => {
    expect(t.querySelector("#dashTiles.collapsed")).toBeTruthy();
    expect(t.querySelector("#dashTilesMore")).toBeTruthy();
    expect(HTML).toContain("#dashTiles.collapsed .tile:nth-child(n+5) { display: none; }");
  });
  it("panel laporan tidak ada di dalam dash-short", () => {
    expect(t.querySelector(".dash-short #dashTren, .dash-short #dashLk, .dash-short #dashTemaTop")).toBeNull();
  });
  it("dash-short tidak memotong isi: daftar di dalamnya bergulir sendiri", () => {
    expect(HTML).toContain(".dash-short .lst { max-height: 36vh; overflow-y: auto; }");
    expect(HTML).not.toMatch(/\.dash-short \{[^}]*overflow: hidden/);
  });
});

describe("menu Event", () => {
  it("daftar event berbentuk tabel gulir (.tw), bukan kartu", () => {
    const t = tab("event");
    expect(t.querySelector(".tw table #evBody")).toBeTruthy();
    expect(t.querySelector("#evList")).toBeNull();
  });
  it("grafik pendaftar per event dilipat dalam details", () => {
    expect(HTML).toContain('<details class="evgraf"><summary class="btn">Grafik pendaftar per event</summary>');
  });
});

describe("menu Program Kerja (tab proker)", () => {
  const acc2: any = { ...acc, tabs: [...acc.tabs, "Program Kerja"] };
  const d2 = new JSDOM(renderDashboard(acc2)).window.document;
  const t = d2.getElementById("tab-proker")!;
  it("tab proker dan baris tab proRptTabs ada", () => {
    expect(d2.getElementById("tabbtn-proker")).toBeTruthy();
    expect(t).toBeTruthy();
    expect(t.querySelector("#proRptTabs")).toBeTruthy();
  });
  it("saat awal hanya Daftar yang tampil", () => {
    expect((t.querySelector("#proSecDaftar") as HTMLElement).hidden).toBe(false);
    expect((t.querySelector("#proSecAjukan") as HTMLElement).hidden).toBe(true);
  });
  it("kontrol filter tampil paling banyak dua; sisanya dilipat", () => {
    const vis = Array.from(t.querySelectorAll("#proSecDaftar input, #proSecDaftar select, #proSecDaftar button")).filter((x: any) => !x.closest("[hidden]"));
    expect(vis.length).toBeLessThanOrEqual(2);
    expect((t.querySelector("#proFilterBox") as HTMLElement).hidden).toBe(true);
  });
  it("semua tabel di dalam .tw dan tabel Daftar paling atas (sebelum formulir)", () => {
    expect(Array.from(t.querySelectorAll("table")).filter((x: any) => !x.closest(".tw")).length).toBe(0);
    const tbl = t.querySelector("#proTbl")!, form = t.querySelector("#proForm")!;
    expect(tbl.compareDocumentPosition(form) & 4).toBeTruthy(); // formulir sesudah tabel
  });
  it("formulir tidak punya isian seksi pengaju", () => {
    const form = t.querySelector("#proForm")!;
    expect(form.querySelector("[name=seksiPengaju], #proSeksiPengaju")).toBeNull();
  });
  it("tab proker hanya terdaftar di __ME__.tabs untuk akun yang punya akses", () => {
    const re = /"tabs":\[[^\]]*"proker"/;
    expect(renderDashboard(acc)).not.toMatch(re);
    expect(renderDashboard(acc2)).toMatch(re);
  });
});
