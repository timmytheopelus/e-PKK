import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { peranOf, validatePendaftar, templateXlsx } from "../src/lib/sep";

describe("SEP", () => {
  it("peran: Superadmin dan Tim SEP = tim, PIC = pic, lainnya view", () => {
    expect(peranOf({ level: "Superadmin", sepPeran: "" } as any)).toBe("tim");
    expect(peranOf({ level: "View", sepPeran: "Tim SEP BPK" } as any)).toBe("tim");
    expect(peranOf({ level: "Edit", sepPeran: "PIC SEP Paroki" } as any)).toBe("pic");
    expect(peranOf({ level: "Admin", sepPeran: "" } as any)).toBe("view");
  });
  it("validasi pendaftar", () => {
    const ok = validatePendaftar({ nama: "Maria S", lahir: "1985-04-23", alamat: "Jl A", paroki: "Cicadas", jk: "Wanita", email: "a@b.co", wa: "0812345678" });
    expect(ok.fields).toBeTruthy();
    expect(Object.values(ok.fields!)).toContain("62812345678");
    expect(validatePendaftar({ nama: "M", lahir: "1985-04-23", alamat: "x", paroki: "x", jk: "Pria", email: "a@b.co", wa: "0812345678" }).error).toMatch(/Nama/);
    expect(validatePendaftar({ nama: "Maria", lahir: "2999-01-01", alamat: "x", paroki: "x", jk: "Pria", email: "a@b.co", wa: "0812345678" }).error).toMatch(/lahir/);
    expect(validatePendaftar({ nama: "Maria", lahir: "1990-01-01", alamat: "x", paroki: "x", jk: "?", email: "a@b.co", wa: "0812345678" }).error).toMatch(/kelamin/);
  });
  it("template xlsx bisa dibaca", () => {
    const wb = XLSX.read(templateXlsx(), { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as any[][];
    expect(rows[0][0]).toMatch(/Nama/);
  });
});
