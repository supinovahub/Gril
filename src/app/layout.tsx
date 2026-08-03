import type { Metadata } from "next";
import { Manrope, Newsreader } from "next/font/google";

import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const interfaceFont = Manrope({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-interface",
});

const displayFont = Newsreader({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-display",
});

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
      <body className={`${interfaceFont.variable} ${displayFont.variable}`}>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
