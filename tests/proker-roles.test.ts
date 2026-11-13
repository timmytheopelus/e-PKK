import { it, expect } from "vitest";
import { peranFromRows } from "../src/lib/proker-roles";

it("peran Koordinator (nama baru dari Pimpinan) juga dianggap grup koordinator", () => {
  expect(peranFromRows([{ bidang: "Koordinator", seksi: "Koordinator Inti", peran: "Koordinator" }], false).pimpinan).toBe(true);
  expect(peranFromRows([{ bidang: "Pimpinan", seksi: "Pimpinan Inti", peran: "Pimpinan" }], false).pimpinan).toBe(true);
});
it("Ketua seksi 'Koordinator <Bidang>' = koordBidang", () => {
  expect(peranFromRows([{ bidang: "Outreach", seksi: "Koordinator Outreach", peran: "Ketua" }], false).koordBidang).toEqual(["Outreach"]);
});
