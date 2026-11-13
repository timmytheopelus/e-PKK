import { signIn } from "@/auth";

export const dynamic = "force-dynamic";

export default async function Masuk({ searchParams }: { searchParams: Promise<{ kelola?: string; next?: string }> }) {
  const sp = await searchParams;
  const dest = sp?.kelola === "1" ? "/dashboard?kelola=1" : /^\/absen(\/[A-Za-z0-9._-]+)?$/.test(sp?.next || "") ? (sp.next as string) : "/";
  return (
    <main style={{ maxWidth: 420, margin: "14vh auto", padding: 24, background: "#fff", borderRadius: 12, border: "1px solid #dde2e7", textAlign: "center" }}>
      <h1 style={{ fontSize: 22, marginTop: 0 }}>BPKPKK Bandung</h1>
      <p style={{ color: "#5b6672" }}>Dashboard pengurus, pewarta, PD, dan kegiatan. Masuk dengan akun Google yang sudah didaftarkan sekretariat.</p>
      <form action={async () => { "use server"; await signIn("google", { redirectTo: dest }); }}>
        <button type="submit" style={{ padding: "11px 18px", borderRadius: 8, border: "1px solid #aab4bf", background: "#fff", fontSize: 15, cursor: "pointer" }}>Masuk dengan Google</button>
      </form>
    </main>
  );
}
