import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Offer.ai — Smarter university applications",
    template: "%s | Offer.ai",
  },
  description:
    "Build stronger university applications with AI guidance: personal statements, CVs and applications through a guided process.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
