import { PRE, MAIN_HEAD, RAW, TAIL } from "./dashboard-html";
import { Access, TAB_IDS } from "@/lib/policy";
import { ADMIN_JS } from "./admin-js";
import { canApprove } from "@/lib/approval";

const safeJson = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c").replace(new RegExp("[\\u2028\\u2029]", "g"), "");

export function renderDashboard(acc: Access, openKelola = false, sekjen: { nama: string; wa: string } | null = null) {
  const tabs = acc.tabs.map((t) => TAB_IDS[t]).filter(Boolean);
  const level = ["Superadmin", "Edit", "Admin"].includes(acc.level) ? acc.level : "View";
  const me = { email: acc.email, nama: acc.nama, level, tabs, tabNames: acc.tabs, jabatan: acc.jabatan || "", login: acc.login || "", openKelola: level === "Superadmin" && acc.tabs.includes("Administrasi") && openKelola && !acc.viewAs, tabsOwned: acc.tabs, viewAs: acc.viewAs ? { by: acc.viewAs } : null, approver: canApprove(acc), sekjen: ["Superadmin", "Admin"].includes(acc.level) ? sekjen : null };
  // Daftar pengurus hanya dikirim ke pengguna yang punya tab Pengurus.
  const raw = tabs.includes("pengurus") ? RAW : "";
  const admin = !acc.viewAs && acc.tabs.includes("Administrasi") && (level === "Superadmin" || level === "Admin") ? "<script>" + ADMIN_JS + "</script>\n" : "";
  const body = (PRE + admin + MAIN_HEAD).replace("__ME_JSON__", safeJson(me)) + raw + TAIL;
  return '<!doctype html><html lang="id"><head><meta charset="utf-8"></head><body>' + body + "</body></html>";
}
