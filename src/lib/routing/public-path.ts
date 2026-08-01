const publicPrefixes = [
  "/auth",
  "/convite",
  "/login",
  "/cadastro",
  "/recuperar-senha",
  "/redefinir-senha",
  "/acesso-suspenso",
  "/api/webhooks",
  "/api/internal/workers",
];

const publicExactPaths = new Set(["/", "/manifest.webmanifest", "/sw.js"]);

export function isPublicPath(pathname: string) {
  return (
    publicExactPaths.has(pathname) ||
    publicPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  );
}
