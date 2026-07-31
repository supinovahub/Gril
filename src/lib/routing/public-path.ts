const publicPrefixes = [
  "/auth",
  "/convite",
  "/login",
  "/cadastro",
  "/recuperar-senha",
  "/redefinir-senha",
  "/api/webhooks",
  "/api/internal/workers",
];

export function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    publicPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  );
}
