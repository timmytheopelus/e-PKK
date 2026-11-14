import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

describe("urutan Forkom 2", () => {
  it("jabatan ber-urut di Forkom 2 diurutkan setelah anggota lain, menurut urut", () => {
    const html = readFileSync("docs/prototipe-artifact.html", "utf8");
    expect(html).toContain('best.seksi === "Forkom 2" && best.urut < 999 ? 1000 + best.urut : best.pr');
  });
});

describe("urutan baris alias Forkom 2", () => {
  it("baris ↳ memakai aturan urut yang sama", () => {
    const html = readFileSync("docs/prototipe-artifact.html", "utf8");
    expect(html).toContain('j.seksi === "Forkom 2" && j.urut < 999 ? 1000 + j.urut : rankOf(ORDER.peran, j.peran)');
  });
});
