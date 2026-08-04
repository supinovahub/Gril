import { describe, expect, it } from "vitest";

import {
  buildSchedulingAvailabilityReply,
  guardUncommittedCallClaim,
  hasExplicitCallConfirmation,
  isSchedulingAvailabilityRequest,
  validCallRequest,
} from "./call-request";

const now = Date.parse("2026-08-04T12:00:00-03:00");
const request = { starts_at: "2026-08-04T16:00:00-03:00", format: "phone" as const };

describe("call request confirmation", () => {
  it("combines date, time and format confirmed across consecutive messages", () => {
    const messages = [
      { role: "user" as const, text: "Eu teria disponibilidade hoje lá pelas 16h" },
      { role: "assistant" as const, text: "Você prefere vídeo ou telefone?" },
      { role: "user" as const, text: "Por telefone" },
    ];
    expect(hasExplicitCallConfirmation(messages)).toBe(true);
    expect(validCallRequest(request, messages, now)).toEqual(request);
  });

  it("does not interpret an unrelated date and time as a call confirmation", () => {
    expect(hasExplicitCallConfirmation([{ role: "user", text: "O filme de hoje começa às 16h" }])).toBe(false);
  });

  it("honors a cancellation in the latest lead message", () => {
    const messages = [
      { role: "user" as const, text: "Pode ser hoje às 16h" },
      { role: "user" as const, text: "Não posso, cancela" },
    ];
    expect(validCallRequest(request, messages, now)).toBeNull();
  });

  it("rejects past or implausibly distant calls", () => {
    const messages = [{ role: "user" as const, text: "Sim, pode agendar hoje às 16h" }];
    expect(validCallRequest({ ...request, starts_at: "2026-08-04T11:00:00-03:00" }, messages, now)).toBeNull();
    expect(validCallRequest({ ...request, starts_at: "2028-08-04T16:00:00-03:00" }, messages, now)).toBeNull();
  });

  it("replaces a reservation claim when no transactional call exists", () => {
    expect(guardUncommittedCallClaim("Combinado, deixei solicitado hoje às 16h.", null)).toContain("confirme");
    expect(guardUncommittedCallClaim("Qual horário funciona melhor?", null)).toBe("Qual horário funciona melhor?");
  });

  it("recognizes a request for availability without treating it as a confirmed call", () => {
    const messages = [{ role: "user" as const, text: "Vocês têm disponibilidade hoje à tarde?" }];
    expect(isSchedulingAvailabilityRequest(messages)).toBe(true);
    expect(hasExplicitCallConfirmation(messages)).toBe(false);
  });

  it("builds a deterministic reply from approved slots", () => {
    const reply = buildSchedulingAvailabilityReply([
      { starts_at: "2026-08-04T18:00:00Z", available_members: 1 },
      { starts_at: "2026-08-04T18:30:00Z", available_members: 1 },
    ]);
    expect(reply).toContain("15:00");
    expect(reply).toContain("15:30");
    expect(reply).toContain("Qual desses horários");
  });
});
