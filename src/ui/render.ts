import { PRE, MAIN_HEAD, RAW, TAIL } from "./dashboard-html";
import { Access, TAB_IDS } from "@/lib/policy";

const safeJson = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c").replace(new RegExp("[\\u2028\\u2029]", "g"), "");

export function renderDashboard(acc: Access) {
  const tabs = acc.tabs.map((t) => TAB_IDS[t]).filter(Boolean);
  const me = { email: acc.email, nama: acc.nama, level: acc.level === "Edit" ? "Edit" : "View", tabs };
  // Daftar pengurus hanya dikirim ke pengguna yang punya tab Pengurus.
  const raw = tabs.includes("pengurus") ? RAW : "";
  const body = (PRE + MAIN_HEAD).replace("__ME_JSON__", safeJson(me)) + raw + TAIL;
  return '<!doctype html><html lang="id"><head><meta charset="utf-8"></head><body>' + body + "</body></html>";
}
