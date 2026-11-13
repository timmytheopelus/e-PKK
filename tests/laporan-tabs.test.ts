import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { renderDashboard } from "@/ui/render";

const acc: any = { email: "a@b.c", nama: "A", status: "Disetujui", level: "View", tabs: ["Dashboard", "Pewarta"] };

function boot(throwStorage = false) {
  const html = renderDashboard(acc);
  const m = html.match(/function reportTabs\([\s\S]*?\/\* end reportTabs \*\//);
  const dom = new JSDOM(
    '<body><div id="r"><div id="s1">satu</div><div id="s2">dua</div><div id="s3">tiga</div></div></body>',
    { runScripts: "outside-only", url: "https://e.test/" },
  );
  const w: any = dom.window;
  if (throwStorage) Object.defineProperty(w, "localStorage", { get() { throw new Error("blocked"); } });
  w.eval(m ? m[0] + "; window.reportTabs = reportTabs;" : "window.reportTabs = undefined;");
  return { w, html };
}
const TABS = [
  { id: "a", label: "Satu", sectionId: "s1" },
  { id: "b", label: "Dua", sectionId: "s2" },
  { id: "c", label: "Tiga", sectionId: "s3" },
];
const vis = (w: any) => ["s1", "s2", "s3"].filter((i) => !w.document.getElementById(i).hidden);

describe("reportTabs", () => {
  it("fungsi ada di prototipe", () => {
    expect(typeof boot().w.reportTabs).toBe("function");
  });
  it("hanya satu section tampil, klik tab kedua menggantinya, aria-selected benar", () => {
    const { w } = boot();
    const root = w.document.getElementById("r");
    w.reportTabs(root, TABS, { storeKey: "k1" });
    expect(vis(w)).toEqual(["s1"]);
    const btns = root.querySelectorAll('[role="tablist"] [role="tab"]');
    expect(btns.length).toBe(3);
    expect(btns[0].getAttribute("aria-selected")).toBe("true");
    btns[1].click();
    expect(vis(w)).toEqual(["s2"]);
    expect(btns[0].getAttribute("aria-selected")).toBe("false");
    expect(btns[1].getAttribute("aria-selected")).toBe("true");
  });
  it("mengingat pilihan terakhir", () => {
    const { w } = boot();
    w.localStorage.setItem("k2", "c");
    w.reportTabs(w.document.getElementById("r"), TABS, { storeKey: "k2" });
    expect(vis(w)).toEqual(["s3"]);
  });
  it("tetap bekerja bila localStorage melempar error", () => {
    const { w } = boot(true);
    const root = w.document.getElementById("r");
    w.reportTabs(root, TABS, { storeKey: "k3" });
    root.querySelectorAll('[role="tab"]')[2].click();
    expect(vis(w)).toEqual(["s3"]);
  });
  it("CSS .rtabs dan .dash-short ada", () => {
    const { html } = boot();
    expect(html).toMatch(/\.rtabs \{[^}]*overflow-x: auto/);
    expect(html).toContain(".dash-short {");
  });
  it("baris tab tidak melebarkan halaman HP (min-width 0 pada pembungkus)", () => {
    const { html } = boot();
    expect(html).toContain('[id$="RptTabs"] { min-width: 0; max-width: 100%; }');
    expect(html).toContain(".tab > * { min-width: 0; }");
    expect(html).toContain(".evdetail > * { min-width: 0; }");
    expect(html).toContain(".pan { grid-template-columns: minmax(0, 1fr); }");
  });
});
