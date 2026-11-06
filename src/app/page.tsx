import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function Home() {
  const s = await auth();
  const email = s?.user?.email;
  if (!email) redirect("/masuk");
  const acc = await getAccess(email);
  if (acc && acc.status === "Disetujui" && acc.tabs.length) redirect("/dashboard");
  const pesan = !acc || acc.status === "Menunggu"
    ? "Permintaan akses Anda sudah tercatat dan menunggu persetujuan sekretariat BPKPKK Bandung."
    : acc.status === "Ditolak" ? "Akses untuk akun ini tidak disetujui." : "Akun Anda disetujui, tetapi belum diberi tab apa pun. Hubungi sekretariat.";
  return (
    <main style={{ maxWidth: 460, margin: "12vh auto", padding: 24, background: "#fff", borderRadius: 12, border: "1px solid #dde2e7" }}>
      <h1 style={{ fontSize: 22, marginTop: 0 }}>BPKPKK Bandung</h1>
      <p>Masuk sebagai <strong>{email}</strong>.</p>
      <p>{pesan}</p>
      <form action={async () => { "use server"; await signOut({ redirectTo: "/masuk" }); }}>
        <button type="submit" style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #aab4bf", background: "#fff", cursor: "pointer" }}>Keluar</button>
      </form>
    </main>
  );
}
