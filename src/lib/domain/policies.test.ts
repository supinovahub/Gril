import { describe, expect, it } from "vitest";

import {
  callBlockEndsAt,
  campaignSafetyDecision,
  canResumeProactive,
  capacityAdmission,
  nextCampaignWaveSize,
  requiredReviewRate,
} from "./policies";

describe("capacidade 10/25/30", () => {
  it("admite proativo abaixo de 25", () => {
    expect(capacityAdmission(24, "proactive")).toBe("admit");
  });

  it("pausa proativo a partir de 25", () => {
    expect(capacityAdmission(25, "proactive")).toBe("pause");
  });

  it("mantém inbound até a trigésima vaga", () => {
    expect(capacityAdmission(29, "inbound")).toBe("admit");
    expect(capacityAdmission(30, "inbound")).toBe("backlog");
  });

  it("rejeita contagem impossível", () => {
    expect(() => capacityAdmission(31, "inbound")).toThrow(RangeError);
  });

  it("só retoma após as duas janelas de estabilidade", () => {
    expect(
      canResumeProactive({
        activeCount: 9,
        belowTenForSeconds: 300,
        inboundQuietForSeconds: 120,
      }),
    ).toBe(true);
    expect(
      canResumeProactive({
        activeCount: 9,
        belowTenForSeconds: 299,
        inboundQuietForSeconds: 120,
      }),
    ).toBe(false);
  });
});

describe("ondas e amostragem", () => {
  it("limita as ondas iniciais a 20 e 50", () => {
    expect(nextCampaignWaveSize(1, 100)).toBe(20);
    expect(nextCampaignWaveSize(2, 80)).toBe(50);
  });

  it("não ultrapassa os contatos restantes", () => {
    expect(nextCampaignWaveSize(1, 7)).toBe(7);
    expect(nextCampaignWaveSize(3, 30)).toBe(30);
  });

  it("exige 100%, 30% e 10% de revisão", () => {
    expect(requiredReviewRate(1)).toBe(1);
    expect(requiredReviewRate(2)).toBe(0.3);
    expect(requiredReviewRate(3)).toBe(0.1);
  });

  it("amplia a amostra seguinte quando pode melhorar chega a 20%", () => {
    expect(requiredReviewRate(3, 0.2)).toBe(0.5);
  });
});

describe("gates de segurança da campanha", () => {
  it("não pausa antes da amostra mínima de 30 tentativas", () => {
    expect(
      campaignSafetyDecision({
        attempts: 29,
        failures: 29,
        optOuts: 29,
        reviewed: 0,
        incorrect: 0,
      }).pauseCampaign,
    ).toBe(false);
  });

  it("pausa acima de 10% de opt-out", () => {
    expect(
      campaignSafetyDecision({
        attempts: 30,
        failures: 0,
        optOuts: 4,
        reviewed: 30,
        incorrect: 0,
      }).pauseCampaign,
    ).toBe(true);
  });

  it("pausa acima de 20% de falha", () => {
    expect(
      campaignSafetyDecision({
        attempts: 30,
        failures: 7,
        optOuts: 0,
        reviewed: 30,
        incorrect: 0,
      }).pauseCampaign,
    ).toBe(true);
  });

  it("bloqueia a próxima onda em 10% de incorretas", () => {
    expect(
      campaignSafetyDecision({
        attempts: 20,
        failures: 0,
        optOuts: 0,
        reviewed: 20,
        incorrect: 2,
      }).blockNextWave,
    ).toBe(true);
  });
});

describe("agenda", () => {
  it("reserva 20 minutos de call e 10 de intervalo", () => {
    const start = new Date("2026-08-01T13:00:00.000Z");
    expect(callBlockEndsAt(start).toISOString()).toBe("2026-08-01T13:30:00.000Z");
  });
});
