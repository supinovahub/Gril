import type { Metadata } from "next";

import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Pedro | Operação imobiliária",
    template: "%s | Pedro",
  },
  description: "Operação imobiliária assistida pelo Pedro.",
  applicationName: "Pedro",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Pedro" },
};

export const viewport = { themeColor: "#1f1b17" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body><PwaRegister />{children}</body>
    </html>
  );
}
