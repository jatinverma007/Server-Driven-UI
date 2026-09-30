import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OmniCard SDUI Admin",
  description: "Server-Driven UI admin portal — draft, validate, publish and preview the OmniCard home screen.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
