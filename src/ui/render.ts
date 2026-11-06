import { PRE, MAIN_HEAD, RAW, TAIL } from "./dashboard-html";
import { Access, TAB_IDS } from "@/lib/policy";
import { ADMIN_JS } from "./admin-js";

const safeJson = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c").replace(new RegExp("[\\u2028\\u2029]", "g"), "");

export function renderDashboard(acc: Access, openKelola = false) {
  const tabs = acc.tabs.map((t) => TAB_IDS[t]).filter(Boolean);
  const level = acc.level === "Superadmin" ? "Superadmin" : acc.level === "Edit" ? "Edit" : "View";
  const me = { email: acc.email, nama: acc.nama, level, tabs, tabNames: acc.tabs, jabatan: acc.jabatan || "", login: acc.login || "", openKelola: level === "Superadmin" && openKelola };
  // Daftar pengurus hanya dikirim ke pengguna yang punya tab Pengurus.
  const raw = tabs.includes("pengurus") ? RAW : "";
  const admin = level === "Superadmin" ? "<script>" + ADMIN_JS + "</script>\n" : "";
  const body = (PRE + admin + MAIN_HEAD).replace("__ME_JSON__", safeJson(me)) + raw + TAIL;
  return '<!doctype html><html lang="id"><head><meta charset="utf-8"></head><body>' + body + "</body></html>";
}
