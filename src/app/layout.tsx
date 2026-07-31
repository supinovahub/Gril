import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Pedro | Operação imobiliária",
    template: "%s | Pedro",
  },
  description: "Operação imobiliária assistida pelo Pedro.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
