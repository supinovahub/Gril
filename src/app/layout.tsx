import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const interfaceFont = Geist({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-interface",
});

const monoFont = Geist_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Gril | Operação imobiliária",
    template: "%s | Gril",
  },
  description: "Conversas, agenda e operação comercial imobiliária em um único workspace.",
  applicationName: "Gril",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Gril" },
};

export const viewport = { themeColor: "#f3f6fb" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${interfaceFont.variable} ${monoFont.variable}`}>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
