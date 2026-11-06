import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { registerLogin } from "@/lib/access";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/masuk" },
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email;
      if (!email || profile?.email_verified === false) return false;
      try { await registerLogin(email, (profile?.name as string) || ""); } catch (e) { console.error("registerLogin gagal", e); }
      return true;
    },
  },
});
