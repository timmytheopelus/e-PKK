import { describe, it, expect } from "vitest";
import * as S from "../src/lib/proker-schema";

const TBL = /^tbl[A-Za-z0-9]{14}$/;
const FLD = /^fld[A-Za-z0-9]{14}$/;

describe("proker-schema", () => {
  it("ID tabel berpola tbl…", () => {
    for (const t of [S.T_PROGRAM, S.T_ANGGARAN, S.T_SETUJU, S.T_NOTIF]) expect(t).toMatch(TBL);
  });
  it("semua ID field berpola fld…", () => {
    for (const o of [S.PK, S.AG, S.ST, S.NT]) for (const v of Object.values(o)) expect(v).toMatch(FLD);
  });
  it("STATUS berisi 8 nilai berurutan", () => {
    expect([...S.STATUS]).toEqual([
      "Draft", "Menunggu Koord Bidang", "Menunggu Kolaborasi", "Menunggu Sekjen",
      "Disetujui", "Berjalan", "Selesai", "Ditolak",
    ]);
  });
  it("JENIS berisi Pemasukan dan Pengeluaran", () => {
    expect([...S.JENIS]).toEqual(["Pemasukan", "Pengeluaran"]);
  });
});
