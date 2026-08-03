import { describe, expect, it } from "vitest";

import type { Json } from "@/lib/database.types";

import {
  buildSimulatorConversation,
  buildSimulatorQualificationValues,
  latestSimulatorSummary,
  parseSimulatorExecutionSnapshot,
  type SimulatorPriorTurn,
} from "./simulator-session";

const completedTurn: SimulatorPriorTurn = {
  turn_index: 1,
  simulated_input: "Quero um apartamento no Centro.",
  output_text: "Qual é o seu orçamento?",
  status: "completed",
  output_structured: {
    qualification_updates: [{
      code: "region",
      value_kind: "text",
      value_text: "Centro",
      value_number: null,
      value_boolean: null,
      confidence: 0.98,
    }],
    conversation_summary: { summary: "Busca apartamento no Centro.", facts: ["Região: Centro"] },
  },
};

describe("simulator session context", () => {
  it("accepts only snapshots tied to an ordered session turn", () => {
    expect(parseSimulatorExecutionSnapshot({
      input: "Oi",
      initial_state: {},
      simulator_session_id: "550e8400-e29b-41d4-a716-446655440000",
      simulator_turn_index: 2,
    })).toMatchObject({ input: "Oi", simulator_turn_index: 2 });
    expect(parseSimulatorExecutionSnapshot({ input: "Oi" })).toBeNull();
  });

  it("replays completed user and assistant messages before the current input", () => {
    const failedTurn: SimulatorPriorTurn = {
      ...completedTurn,
      turn_index: 2,
      simulated_input: "mensagem sem resposta",
      output_text: null,
      output_structured: null,
      status: "failed",
    };
    expect(buildSimulatorConversation("Tenho até 500 mil.", [failedTurn, completedTurn])).toEqual([
      { role: "user", text: "Quero um apartamento no Centro." },
      { role: "assistant", text: "Qual é o seu orçamento?" },
      { role: "user", text: "Tenho até 500 mil." },
    ]);
  });

  it("accumulates qualification from initial state and completed turns", () => {
    const values = buildSimulatorQualificationValues({ qualification: { total_price: 450000 } }, [completedTurn]);
    expect(values).toEqual(expect.arrayContaining([
      { code: "total_price", valueText: null, valueNumber: 450000, valueBoolean: null },
      { code: "region", valueText: "Centro", valueNumber: null, valueBoolean: null },
    ]));
  });

  it("uses the latest valid cumulative summary", () => {
    expect(latestSimulatorSummary([completedTurn])?.summary).toBe("Busca apartamento no Centro.");
    expect(latestSimulatorSummary([{ ...completedTurn, output_structured: {} as Json }])).toBeNull();
  });
});
