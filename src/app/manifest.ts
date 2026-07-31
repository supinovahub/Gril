import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pedro — Operação imobiliária",
    short_name: "Pedro",
    description: "Atendimento, qualificação e operação comercial imobiliária.",
    start_url: "/app",
    display: "standalone",
    background_color: "#fffdf9",
    theme_color: "#1f1b17",
    lang: "pt-BR",
    orientation: "any",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }],
  };
}
