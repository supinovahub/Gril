import { z } from "zod";

import type { Json } from "@/lib/database.types";

import { mergeQualificationValues, pedroTurnSchema, type QualificationValue } from "./pedro-turn";

const simulatorExecutionSnapshotSchema = z.object({
  input: z.string().trim().min(1).max(12000),
  initial_state: z.unknown().optional(),
  simulator_session_id: z.string().uuid(),
  simulator_turn_index: z.number().int().positive(),
});

export type SimulatorPriorTurn = {
  turn_index: number;
  simulated_input: string;
  output_text: string | null;
  output_structured: Json | null;
  status: string;
};

export function parseSimulatorExecutionSnapshot(snapshot: Json) {
  const parsed = simulatorExecutionSnapshotSchema.safeParse(snapshot);
  return parsed.success ? parsed.data : null;
}

export function buildSimulatorConversation(
  currentInput: string,
  priorTurns: SimulatorPriorTurn[],
) {
  const messages: Array<{ role: "user" | "assistant"; text: string }> = [];
  for (const turn of [...priorTurns].sort((left, right) => left.turn_index - right.turn_index)) {
    if (turn.status !== "completed" || !turn.output_text?.trim()) continue;
    messages.push({ role: "user", text: turn.simulated_input });
    messages.push({ role: "assistant", text: turn.output_text });
  }
  messages.push({ role: "user", text: currentInput });
  return messages;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function initialQualificationValues(initialState: unknown): QualificationValue[] {
  const state = recordValue(initialState);
  const qualification = recordValue(state?.qualification);
  if (!qualification) return [];

  const values: QualificationValue[] = [];
  for (const [code, rawValue] of Object.entries(qualification)) {
    const structured = recordValue(rawValue);
    if (typeof rawValue === "string") {
      values.push({ code, valueText: rawValue, valueNumber: null, valueBoolean: null });
    } else if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      values.push({ code, valueText: null, valueNumber: rawValue, valueBoolean: null });
    } else if (typeof rawValue === "boolean") {
      values.push({ code, valueText: null, valueNumber: null, valueBoolean: rawValue });
    } else if (structured) {
      values.push({
        code,
        valueText: typeof structured.value_text === "string" ? structured.value_text : null,
        valueNumber: typeof structured.value_number === "number" && Number.isFinite(structured.value_number)
          ? structured.value_number
          : null,
        valueBoolean: typeof structured.value_boolean === "boolean" ? structured.value_boolean : null,
      });
    }
  }
  return values;
}

export function buildSimulatorQualificationValues(
  initialState: unknown,
  priorTurns: SimulatorPriorTurn[],
) {
  let merged = new Map(initialQualificationValues(initialState).map((value) => [value.code, value]));
  for (const turn of [...priorTurns].sort((left, right) => left.turn_index - right.turn_index)) {
    if (turn.status !== "completed") continue;
    const output = recordValue(turn.output_structured);
    const updates = pedroTurnSchema.shape.qualification_updates.safeParse(output?.qualification_updates);
    if (updates.success) merged = mergeQualificationValues([...merged.values()], updates.data);
  }
  return [...merged.values()];
}

export function latestSimulatorSummary(priorTurns: SimulatorPriorTurn[]) {
  for (const turn of [...priorTurns].sort((left, right) => right.turn_index - left.turn_index)) {
    if (turn.status !== "completed") continue;
    const output = recordValue(turn.output_structured);
    const summary = pedroTurnSchema.shape.conversation_summary.safeParse(output?.conversation_summary);
    if (summary.success) return summary.data;
  }
  return null;
}
