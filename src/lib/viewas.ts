// "Lihat sebagai": Superadmin melihat tampilan dan hak akses pengguna lain (pratinjau, tidak bisa menulis).
import { Access } from "./policy";
import { getAccess } from "./access";

export const AS_COOKIE = "epk_as";

/** Hak akses yang berlaku. Hanya Superadmin asli yang bisa memakai cookie epk_as. */
export async function effectiveAccess(email: string, asEmail?: string | null): Promise<{ real: Access | null; acc: Access | null }> {
  const real = await getAccess(email);
  if (!real || real.status !== "Disetujui" || real.level !== "Superadmin" || !asEmail) return { real, acc: real };
  const t = await getAccess(asEmail);
  if (!t || t.status !== "Disetujui" || !t.tabs.length) return { real, acc: real };
  return { real, acc: { ...t, viewAs: real.email } };
}
