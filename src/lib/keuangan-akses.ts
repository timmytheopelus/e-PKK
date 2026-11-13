// Menu Keuangan hanya untuk level Bendahara ke atas: Bendahara, Sekretaris Jenderal, Koordinator (Pimpinan Inti), Penasihat, dan Superadmin.
// Ditegakkan di server berdasarkan jabatan Pengurus periode 2026, bukan hanya dengan menyembunyikan tab.
import { Access, HttpError } from "./policy";
import { peranOf } from "./proker-roles";

export async function keuanganBoleh(acc: Pick<Access, "email" | "level" | "jabatan">): Promise<boolean> {
  if (acc.level === "Superadmin") return true;
  const p = await peranOf(acc);
  return p.bendahara || p.sekjen || p.pimpinan;
}

export async function pastikanKeuangan(acc: Pick<Access, "email" | "level" | "jabatan" | "viewAs">) {
  if (!(await keuanganBoleh(acc))) throw new HttpError(403, "Menu Keuangan hanya untuk Bendahara, Sekretaris Jenderal, Koordinator, dan Penasihat.");
}
