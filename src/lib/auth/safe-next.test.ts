import { describe, expect, it } from "vitest";

import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("aceita caminhos internos com query string", () => {
    expect(safeNextPath("/convite/abc?origem=email")).toBe(
      "/convite/abc?origem=email",
    );
  });

  it("rejeita URL externa absoluta", () => {
    expect(safeNextPath("https://evil.example/roubar")).toBe("/app");
  });

  it("rejeita URL protocol-relative", () => {
    expect(safeNextPath("//evil.example/roubar", "/login")).toBe("/login");
  });

  it("usa fallback para valor ausente", () => {
    expect(safeNextPath(undefined, "/aguardando-aprovacao")).toBe(
      "/aguardando-aprovacao",
    );
  });
});
