import { describe, expect, it } from "vitest";

import { isPublicPath } from "./public-path";

describe("isPublicPath", () => {
  it.each([
    "/",
    "/login",
    "/auth/callback",
    "/api/webhooks/whatsapp/connection-id",
    "/api/webhooks/meta/forms/form-id",
    "/api/internal/workers/drain",
  ])("permite a rota publica %s", (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
  });

  it.each(["/app", "/api/private", "/api/internal/other", "/api/webhookish"])(
    "mantem a rota protegida %s",
    (pathname) => {
      expect(isPublicPath(pathname)).toBe(false);
    },
  );
});
