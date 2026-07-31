export type CapacitySource = "inbound" | "proactive";

export function capacityAdmission(activeCount: number, source: CapacitySource) {
  if (!Number.isInteger(activeCount) || activeCount < 0 || activeCount > 30) {
    throw new RangeError("activeCount deve estar entre 0 e 30.");
  }

  if (source === "inbound") {
    return activeCount < 30 ? "admit" : "backlog";
  }

  return activeCount < 25 ? "admit" : "pause";
}

export function canResumeProactive(input: {
  activeCount: number;
  belowTenForSeconds: number;
  inboundQuietForSeconds: number;
}) {
  return (
    input.activeCount < 10 &&
    input.belowTenForSeconds >= 300 &&
    input.inboundQuietForSeconds >= 120
  );
}

export function nextCampaignWaveSize(waveNumber: number, remaining: number) {
  if (!Number.isInteger(waveNumber) || waveNumber < 1) {
    throw new RangeError("waveNumber deve ser positivo.");
  }
  if (!Number.isInteger(remaining) || remaining < 0 || remaining > 500) {
    throw new RangeError("remaining deve estar entre 0 e 500.");
  }

  const reference = waveNumber === 1 ? 20 : waveNumber === 2 ? 50 : remaining;
  return Math.min(reference, remaining);
}

export function requiredReviewRate(waveNumber: number, priorImproveRate = 0) {
  if (waveNumber <= 1) return 1;
  if (priorImproveRate >= 0.2) return 0.5;
  return waveNumber === 2 ? 0.3 : 0.1;
}

export function campaignSafetyDecision(input: {
  attempts: number;
  failures: number;
  optOuts: number;
  reviewed: number;
  incorrect: number;
}) {
  const deliverySampleReady = input.attempts >= 30;
  const optOutRate = input.attempts === 0 ? 0 : input.optOuts / input.attempts;
  const failureRate = input.attempts === 0 ? 0 : input.failures / input.attempts;
  const incorrectRate = input.reviewed === 0 ? 0 : input.incorrect / input.reviewed;

  return {
    pauseCampaign:
      deliverySampleReady && (optOutRate > 0.1 || failureRate > 0.2),
    blockNextWave: input.reviewed > 0 && incorrectRate >= 0.1,
    optOutRate,
    failureRate,
    incorrectRate,
  };
}

export function callBlockEndsAt(start: Date) {
  if (Number.isNaN(start.getTime())) throw new RangeError("Data inválida.");
  return new Date(start.getTime() + 30 * 60 * 1000);
}
