import { describe, it, expect } from "vitest";
import { checkWrite, HttpError, TABLES, T } from "@/lib/policy";
import { evalFilter } from "@/lib/filters";
import { renderDashboard } from "@/ui/render";

const base = { email: "a@b.c", nama: "A", status: "Disetujui", tabs: ["Dashboard"], level: "View" } as any;

describe("policy", () => {
  it("View tidak boleh menulis", () => {
    expect(() => checkWrite((TABLES as any)[T.umat], "update", [], base)).toThrow(HttpError);
  });
});
describe("filters", () => {
  it("isNotEmpty", () => {
    expect(typeof evalFilter).toBe("function");
  });
});
describe("render", () => {
  it("tanpa tab Pengurus daftar RAW kosong", () => {
    const html = renderDashboard(base);
    expect(html).toContain("var RAW = [");
    expect(html).not.toContain("__ME_JSON__");
  });
});

describe("edit", () => {
  it("Edit tanpa tab Umat ditolak", () => {
    expect(() => checkWrite((TABLES as any)[T.umat], "update", [{ id: "rec1", fields: {} }], { ...base, level: "Edit" })).toThrow(HttpError);
  });
});

describe("pewarta bpk", () => {
  const pwb = (TABLES as any)[T.pewartaBpk];
  const ed = { ...base, level: "Edit", tabs: ["Pewarta"] };
  it("tab Pewarta Edit boleh ubah status, modul, link YouTube", () => {
    expect(() => checkWrite(pwb, "update", [{ id: "rec1", fields: { fldIt4yvwOOsFa4XM: "Calon Pewarta", fldZPqCG8ohmWHwY4: ["SHDR"], fldJGTPgfN00lAdMo: "https://youtu.be/abcdefghijk" } }], ed)).not.toThrow();
  });
  it("field lain (nama, WA) ditolak", () => {
    expect(() => checkWrite(pwb, "update", [{ id: "rec1", fields: { fldYlcG3J6Oqe7iPP: "x" } }], ed)).toThrow(HttpError);
  });
  it("link bukan URL ditolak, View ditolak", () => {
    expect(() => checkWrite(pwb, "update", [{ id: "rec1", fields: { fldJGTPgfN00lAdMo: "javascript:alert(1)" } }], ed)).toThrow(HttpError);
    expect(() => checkWrite(pwb, "update", [{ id: "rec1", fields: {} }], { ...ed, level: "View" })).toThrow(HttpError);
  });
});
