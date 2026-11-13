import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { effectiveAccess } from "@/lib/viewas";
import { acaraAbsensi, bolehAbsen } from "@/lib/absen";

export const dynamic = "force-dynamic";

export default async function Absen() {
  const email = (await auth())?.user?.email?.toLowerCase();
  if (!email) redirect("/masuk?next=" + encodeURIComponent("/absen"));
  const { real } = await effectiveAccess(email, null);
  if (!bolehAbsen(real)) return <main style={{ maxWidth: 480, margin: "14vh auto", padding: 20 }}><h1 style={{ fontSize: 20 }}>Belum punya akses Absensi</h1><p>Akun ini belum diberi menu Absensi. Hubungi sekretariat BPKPKK Bandung.</p></main>;
  const list = await acaraAbsensi().catch(() => null);
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px", fontFamily: "system-ui,sans-serif" }}>
      <h1 style={{ fontSize: 20 }}>Absensi kehadiran</h1>
      <p style={{ color: "#5b6773", fontSize: 14 }}>Pilih acara untuk mencatat siapa yang hadir. Hanya acara sekitar hari ini (7 hari sebelum sampai sesudah) yang tampil.</p>
      {list === null ? <p>Gagal memuat daftar acara. Coba muat ulang.</p> : list.length === 0 ? <p>Belum ada acara dalam jendela absensi.</p> : list.map((e) => (
        <a key={e.id} href={"/absen/" + e.token} style={{ display: "block", background: "#fff", border: "1px solid #e1e6eb", borderRadius: 10, padding: 12, margin: "0 0 8px", color: "inherit", textDecoration: "none" }}>
          <b>{e.nama}</b><br /><small style={{ color: "#5b6773" }}>{e.tgl}</small>
        </a>
      ))}
    </main>
  );
}
