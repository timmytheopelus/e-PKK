import type { ReactNode } from "react";

export const metadata = { title: "BPKPKK Bandung", robots: { index: false, follow: false }, icons: { icon: "/favicon.png" } };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, background: "#f6f7f8", color: "#1b2430" }}>{children}</body>
    </html>
  );
}
