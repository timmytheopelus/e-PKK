import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { renderDashboard } from "@/ui/render";

const acc: any = { email: "a@b.c", nama: "A", status: "Disetujui", level: "View", tabs: ["Dashboard", "Kalender"] };
const HTML = renderDashboard(acc);

function load(): any {
  const m = HTML.match(/function agendaItems\([\s\S]*?\/\* end agendaItems \*\//);
  const w: any = new JSDOM("<body></body>", { runScripts: "outside-only" }).window;
  w.eval(m ? m[0] + "; window.agendaItems = agendaItems;" : "window.agendaItems = undefined;");
  return w.agendaItems;
}
const ev = (id: string, date: string, selesai?: string, mulai?: string) => ({ id, nama: id, date, tgl: date, selesai: selesai || "", mulai: mulai || "" });
const TODAY = "2026-11-13";
const E = [
  ev("lewat", "2026-11-12"),
  ev("hariini", "2026-11-13"),
  ev("besok", "2026-11-14"),
  ev("berjalan", "2026-11-12", "2026-11-14T10:00:00.000Z"),
  ev("lama", "2026-10-01", "2026-10-02T10:00:00.000Z"),
];
const ids = (l: any[]) => l.map((e) => e.id);

describe("agendaItems", () => {
  it("fungsi ada di prototipe", () => expect(typeof load()).toBe("function"));
  it("tanpa yang sudah lewat: berjalan, hari ini, besok, urut tanggal mulai", () => {
    expect(ids(load()(E, TODAY, false))).toEqual(["berjalan", "hariini", "besok"]);
  });
  it("dengan yang sudah lewat: semua, urut naik", () => {
    expect(ids(load()(E, TODAY, true))).toEqual(["lama", "lewat", "berjalan", "hariini", "besok"]);
  });
  it("event tanpa selesai pada hari ini tetap masuk, kemarin tidak", () => {
    const l = ids(load()([ev("a", TODAY), ev("b", "2026-11-12")], TODAY, false));
    expect(l).toEqual(["a"]);
  });
  it("event tanpa tanggal tidak muncul di agenda ke depan", () => {
    expect(ids(load()([ev("x", "")], TODAY, false))).toEqual([]);
  });
  it("tidak mengubah array masukan", () => {
    const src = [ev("b", "2026-11-20"), ev("a", "2026-11-15")];
    load()(src, TODAY, false);
    expect(ids(src)).toEqual(["b", "a"]);
  });
});

describe("tab Kalender: Agenda view dan Calendar view", () => {
  const doc = new JSDOM(HTML).window.document;
  const t = doc.getElementById("tab-kalender")!;
  it("label tampilan: Agenda view (aktif awal) dan Calendar view", () => {
    const b = Array.from(t.querySelectorAll(".seg button")) as HTMLElement[];
    expect(b.map((x) => x.textContent!.trim())).toEqual(["Agenda view", "Calendar view"]);
    expect(b[0].getAttribute("aria-pressed")).toBe("true");
  });
  it("tombol tampilkan yang sudah lewat ada, dan cWaktu dihapus", () => {
    expect(t.querySelector("#calPast")).toBeTruthy();
    expect(t.querySelector("#cWaktu")).toBeNull();
  });
  it("filter disederhanakan: kontrol tampil hanya cari + tombol Filter", () => {
    expect(t.querySelector("#calFilterBtn")).toBeTruthy();
    expect((t.querySelector("#calFilterBox") as HTMLElement).hidden).toBe(true);
    const outside = Array.from(t.querySelectorAll("select")).filter((s: any) => !s.closest("#calFilterBox"));
    expect(outside.length).toBe(0);
  });
  it("bawaan skrip: tampilan agenda, yang lewat tersembunyi", () => {
    expect(HTML).toMatch(/view: "agenda"/);
    expect(HTML).toMatch(/showPast: false/);
  });
});

describe("menu Event: yang sudah lewat lewat tombol", () => {
  const t = new JSDOM(renderDashboard({ ...acc, tabs: ["Dashboard", "Event"] })).window.document.getElementById("tab-event")!;
  it("select evWaktu diganti tombol evPast; kontrol tampil: cari + tombol", () => {
    expect(t.querySelector("#evWaktu")).toBeNull();
    expect(t.querySelector("#evPast")).toBeTruthy();
    expect(t.querySelectorAll("#evHome .fil select").length).toBe(0);
  });
});

describe("klik agenda: edit kegiatan", () => {
  const d = new JSDOM(renderDashboard({ ...acc, level: "Edit", tabs: ["Dashboard", "Kalender"] })).window.document;
  it("detail kegiatan punya tombol Edit, tersembunyi awalnya", () => {
    const b = d.getElementById("evEdit") as HTMLElement;
    expect(b).toBeTruthy();
    expect(b.hidden).toBe(true);
  });
  it("formulir edit memakai update_records_for_table ke tabel Event dengan id rekaman", () => {
    expect(HTML).toContain("function openEdit(");
    expect(HTML).toMatch(/call\("update_records_for_table", \{ baseId: BASE, tableId: T_EVENTS, records: \[\{ id: editId, fields: f \}\] \}\)/);
  });
  it("Dibuat oleh tidak pernah dikirim dari browser", () => {
    expect(HTML).not.toContain("fldPHO7qPmtfuxhbQ");
  });
});
