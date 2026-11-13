import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { renderDashboard } from "@/ui/render";

const acc: any = { email: "a@b.c", nama: "A", status: "Disetujui", level: "View", tabs: ["Dashboard", "Pewarta", "Pengurus", "PD", "Luar kota", "Umat", "KEP", "Event", "Inventaris", "Keuangan"] };
const doc = new JSDOM(renderDashboard(acc)).window.document;
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
