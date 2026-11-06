import { signOut } from "@/auth";

export const dynamic = "force-dynamic";

export default function Keluar() {
  return (
    <main style={{ maxWidth: 420, margin: "14vh auto", padding: 24, background: "#fff", borderRadius: 12, border: "1px solid #dde2e7", textAlign: "center" }}>
      <p>Keluar dari dashboard?</p>
      <form action={async () => { "use server"; await signOut({ redirectTo: "/masuk" }); }}>
        <button type="submit" style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #aab4bf", background: "#fff", cursor: "pointer" }}>Ya, keluar</button>
      </form>
    </main>
  );
}
