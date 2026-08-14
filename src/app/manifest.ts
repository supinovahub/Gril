import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gril — Operação imobiliária",
    short_name: "Gril",
    description: "Conversas, agenda e operação comercial imobiliária em um único workspace.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f3f6fb",
    theme_color: "#2f6fed",
    lang: "pt-BR",
    orientation: "any",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }],
  };
}
