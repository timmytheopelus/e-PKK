import { describe, it, expect } from "vitest";
import { checkWrite, checkRead, PEND_READ, HttpError, TABLES, T } from "@/lib/policy";
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

describe("event / pendaftaran", () => {
  const acc = (tabs: string[]) => ({ email: "a@b.c", nama: "A", status: "Disetujui", level: "View", tabs }) as any;
  it("tab Event boleh membaca kolom demografis saja", () => {
    const spec = TABLES[T.pendaftaran];
    expect(() => checkRead(spec, T.pendaftaran, { fieldIds: PEND_READ }, acc(["Event"]))).not.toThrow();
    expect(() => checkRead(spec, T.pendaftaran, { fieldIds: ["fldoq0H8LdWFsOA05"] }, acc(["Event"]))).toThrow();
    expect(() => checkRead(spec, T.pendaftaran, { fieldIds: [PEND_READ[0]], filters: { operands: [{ operator: "contains", operands: ["fldoq0H8LdWFsOA05", "x"] }] } }, acc(["Event"]))).toThrow();
  });
  it("tanpa tab Event ditolak dan tidak bisa menulis", () => {
    const spec = TABLES[T.pendaftaran];
    expect(() => checkRead(spec, T.pendaftaran, { fieldIds: PEND_READ }, acc(["PD"]))).toThrow();
    expect(() => checkWrite(spec, "update", [{ id: "rec", fields: {} }], acc(["Event"]))).toThrow();
  });
});

describe("inventaris", () => {
  const inv = (TABLES as any)[T.inventaris], log = (TABLES as any)[T.logPinjam];
  const ed = { ...base, level: "Edit", tabs: ["Inventaris"] };
  it("tanpa tab Inventaris tidak boleh membaca", () => {
    expect(() => checkRead(inv, T.inventaris, { fieldIds: ["fldKqnNoXp9p8tbe5"] }, base)).toThrow(HttpError);
  });
  it("foto barang boleh dibaca tapi tidak diubah; telepon dan selfie tidak boleh dibaca", () => {
    expect(() => checkRead(inv, T.inventaris, { fieldIds: ["fldxfDpPt6Qc0bGIa"] }, ed)).not.toThrow();
    expect(() => checkWrite(inv, "update", [{ id: "rec1", fields: { fldxfDpPt6Qc0bGIa: [{ url: "https://x.y/z.jpg" }] } }], ed)).toThrow(HttpError);
    expect(() => checkRead(log, T.logPinjam, { fieldIds: ["fldiGyKXKXpxPrfKG"] }, ed)).toThrow(HttpError);
    expect(() => checkRead(log, T.logPinjam, { fieldIds: ["fldoFtkzmv5yzHWvb"] }, ed)).toThrow(HttpError);
  });
  it("View hanya baca, Edit boleh ubah status barang", () => {
    const body = [{ id: "rec1", fields: { fldKqnNoXp9p8tbe5: "Rusak" } }];
    expect(() => checkWrite(inv, "update", body, { ...ed, level: "View" })).toThrow(HttpError);
    expect(() => checkWrite(inv, "update", body, ed)).not.toThrow();
  });
  it("kode, nama, harga tidak boleh diubah lewat update; boleh saat tambah", () => {
    expect(() => checkWrite(inv, "update", [{ id: "rec1", fields: { fld1BFGhqPuYraTQW: "x" } }], ed)).toThrow(HttpError);
    expect(() => checkWrite(inv, "create", [{ fields: { fld1BFGhqPuYraTQW: "Kursi", fldKqnNoXp9p8tbe5: "Bisa Dipinjam" } }], ed)).not.toThrow();
  });
  it("status peminjaman: hanya persetujuan/cancel; tidak ada create; formula Status ditolak", () => {
    expect(() => checkWrite(log, "update", [{ id: "rec1", fields: { fld3rE3bLovKfljQ0: "Disetujui", flds1ccMDkZdRrhfz: true } }], ed)).not.toThrow();
    expect(() => checkWrite(log, "update", [{ id: "rec1", fields: { fldGGhED24A4QWwzz: "DISETUJUI" } }], ed)).toThrow(HttpError);
    expect(() => checkWrite(log, "create", [{ fields: {} }], ed)).toThrow(HttpError);
  });
  it("render: skrip Inventaris hanya untuk yang punya tab", () => {
    expect(renderDashboard(base)).not.toContain("Tambah barang inventaris");
    expect(renderDashboard({ ...base, tabs: ["Inventaris"] })).toContain("Tambah barang inventaris");
  });
});
