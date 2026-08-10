import "server-only";

import { z } from "zod";

import { pedroTurnSchema, pedroTurnTool } from "../ai/pedro-turn";

export class OpenAiRuntimeError extends Error {
  constructor(
    public readonly code: string,
    public readonly redactedMessage: string,
    public readonly retryable = false,
  ) {
    super(code);
    this.name = "OpenAiRuntimeError";
  }
}

const responseSchema = z.object({
  id: z.string().min(1),
  status: z.string(),
  model: z.string().optional(),
  output_text: z.string().optional(),
  output: z.array(z.object({
    type: z.string(),
    name: z.string().optional(),
    call_id: z.string().optional(),
    arguments: z.string().optional(),
    content: z.array(z.object({ type: z.string(), text: z.string().optional(), refusal: z.string().optional() }).passthrough()).optional(),
  }).passthrough()).optional(),
  usage: z.object({ input_tokens: z.number().int().nonnegative().optional(), output_tokens: z.number().int().nonnegative().optional() }).optional(),
  error: z.object({ code: z.string().optional(), message: z.string().optional() }).nullable().optional(),
});

function summarizeValidationIssues(error: z.ZodError) {
  return error.issues
    .slice(0, 6)
    .map((issue) => `${issue.path.length > 0 ? issue.path.join(".") : "$"}:${issue.code}`)
    .join(", ");
}

function parsePedroTurn(response: z.infer<typeof responseSchema>, retryable = false) {
  for (const item of response.output ?? []) {
    if (item.type === "function_call" && item.name === pedroTurnTool.name && typeof item.arguments === "string") {
      let rawArguments: unknown;
      try {
        rawArguments = JSON.parse(item.arguments);
      } catch {
        throw new OpenAiRuntimeError(
          "openai_tool_arguments_invalid",
          "A decisão estruturada do Pedro foi rejeitada pelo backend (JSON inválido).",
          retryable,
        );
      }
      const parsed = pedroTurnSchema.safeParse(rawArguments);
      if (!parsed.success) {
        throw new OpenAiRuntimeError(
          "openai_tool_arguments_invalid",
          `A decisão estruturada do Pedro foi rejeitada pelo backend (${summarizeValidationIssues(parsed.error)}).`,
          retryable,
        );
      }
      return parsed.data;
    }
    for (const content of item.content ?? []) {
      if (content.refusal) throw new OpenAiRuntimeError("openai_refusal", "O modelo recusou esta resposta; a conversa foi encaminhada para revisão humana.");
    }
  }
  throw new OpenAiRuntimeError("openai_tool_call_missing", "A OpenAI concluiu sem registrar uma decisão comercial válida.");
}

async function requestOpenAi(input: {
  apiKey: string;
  model: string;
  reasoningEffort?: string | null;
  textVerbosity?: string | null;
  instructions: string;
  messages: Array<{ role: "user" | "assistant"; text: string }>;
  businessContext: Record<string, unknown>;
}, instructions: string) {
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
      headers: {
        authorization: `Bearer ${input.apiKey}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        store: false,
        instructions,
        input: [
          ...input.messages.map((message) => ({
            role: message.role,
            content: message.text,
          })),
          {
            role: "user" as const,
            content: `CONTEXTO OPERACIONAL DO BACKEND (fonte de verdade):\n${JSON.stringify(input.businessContext)}`,
          },
        ],
        max_output_tokens: 1600,
        tools: [pedroTurnTool],
        tool_choice: { type: "function", name: pedroTurnTool.name },
        parallel_tool_calls: false,
        ...(input.reasoningEffort && input.reasoningEffort !== "none"
          ? { reasoning: { effort: input.reasoningEffort } }
          : {}),
        text: { verbosity: input.textVerbosity ?? "low" },
      }),
    });
  } catch {
    throw new OpenAiRuntimeError("openai_unreachable", "A OpenAI não respondeu dentro do limite.", true);
  }

  const raw = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new OpenAiRuntimeError("openai_invalid_json", "A OpenAI devolveu uma resposta inválida.", response.status >= 500);
  }
  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    throw new OpenAiRuntimeError(
      `openai_http_${response.status}`,
      retryable ? "A OpenAI está temporariamente indisponível." : "A OpenAI recusou a execução. Revise a chave e o modelo configurados.",
      retryable,
    );
  }
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success || parsed.data.status !== "completed") {
    throw new OpenAiRuntimeError("openai_response_incomplete", "A OpenAI não concluiu a resposta.", true);
  }
  return parsed.data;
}

function shouldRepairStructuredResponse(error: unknown): error is OpenAiRuntimeError {
  return error instanceof OpenAiRuntimeError
    && (error.code === "openai_tool_arguments_invalid" || error.code === "openai_tool_call_missing");
}

export async function createPedroResponse(input: {
  apiKey: string;
  model: string;
  reasoningEffort?: string | null;
  textVerbosity?: string | null;
  instructions: string;
  messages: Array<{ role: "user" | "assistant"; text: string }>;
  businessContext: Record<string, unknown>;
}) {
  let lastStructuredError: OpenAiRuntimeError | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const instructions = attempt === 0
      ? input.instructions
      : `${input.instructions}\n\nCONTROLE DE FORMATO: a tentativa anterior não respeitou o contrato de decisão. Gere novamente agora usando exclusivamente a ferramenta ${pedroTurnTool.name}, preenchendo todos os campos obrigatórios, sem propriedades extras e sem texto fora da chamada.`;

    try {
      const response = await requestOpenAi(input, instructions);
      const turn = parsePedroTurn(response, attempt === 0);
      return {
        responseId: response.id,
        model: response.model ?? input.model,
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
        outputText: turn.reply ?? turn.escalation?.reason ?? "Escalada sem mensagem ao lead.",
        structured: turn,
      };
    } catch (error) {
      if (attempt === 0 && shouldRepairStructuredResponse(error)) {
        lastStructuredError = error;
        continue;
      }
      throw error;
    }
  }

  throw lastStructuredError ?? new OpenAiRuntimeError("openai_tool_arguments_invalid", "A decisão estruturada do Pedro foi rejeitada pelo backend.");
}
