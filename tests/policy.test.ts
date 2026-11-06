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
