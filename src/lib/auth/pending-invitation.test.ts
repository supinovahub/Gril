import { describe, expect, it } from "vitest";

import {
  invitationGatewayPath,
  isInvitationGatewayPath,
  pendingInvitationPath,
  resolveAuthNext,
} from "./pending-invitation";

const token = "a".repeat(43);

describe("pending invitation handoff", () => {
  it("accepts only a bounded invitation gateway path", () => {
    expect(pendingInvitationPath(invitationGatewayPath(token))).toBe(`/convite/${token}`);
    expect(pendingInvitationPath("/convite/curto")).toBeNull();
    expect(pendingInvitationPath(`//evil.test/convite/${token}`)).toBeNull();
  });

  it("prioritizes an explicit safe next path", () => {
    expect(resolveAuthNext("/app/perfil", `/convite/${token}`, "/app")).toBe("/app/perfil");
  });

  it("falls back to the pending invitation when next is absent or unsafe", () => {
    expect(resolveAuthNext(undefined, `/convite/${token}`, "/app")).toBe(`/convite/${token}`);
    expect(resolveAuthNext("https://evil.test", `/convite/${token}`, "/app")).toBe(`/convite/${token}`);
  });

  it("identifies only safe invitation return paths", () => {
    expect(isInvitationGatewayPath(`/convite/${token}`)).toBe(true);
    expect(isInvitationGatewayPath("/app")).toBe(false);
    expect(isInvitationGatewayPath("//evil.test/convite/token")).toBe(false);
  });
});
