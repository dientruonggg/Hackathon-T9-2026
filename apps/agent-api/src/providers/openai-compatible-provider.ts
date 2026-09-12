import OpenAI from "openai";
import type { Result, AppError } from "@vlc/contracts";
import type {
  LlmProvider,
  LlmGenerateInput,
  LlmGenerateOutput,
  LlmToolCall
} from "./llm-provider.js";

export interface OpenAICompatibleProviderOptions {
  apiKey?: string | undefined;
  baseURL?: string | undefined;
  model: string;
  timeoutMs?: number | undefined;
  defaultHeaders?: Record<string, string> | undefined;
  client?: OpenAI | undefined;
}

export function createOpenAICompatibleProvider(
  options: OpenAICompatibleProviderOptions
): LlmProvider {
  const client =
    options.client ??
    new OpenAI({
      apiKey: options.apiKey || "dummy-key-for-local-testing",
      baseURL: options.baseURL,
      timeout: options.timeoutMs,
      defaultHeaders: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
        ...options.defaultHeaders
      }
    });

  return {
    async generate(input: LlmGenerateInput): Promise<Result<LlmGenerateOutput>> {
      try {
        const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

        for (const msg of input.messages) {
          if (msg.role === "tool") {
            openAiMessages.push({
              role: "tool",
              tool_call_id: msg.toolCallId ?? "",
              content: msg.content ?? ""
            });
          } else if (msg.role === "assistant") {
            if (msg.toolCalls && msg.toolCalls.length > 0) {
              openAiMessages.push({
                role: "assistant",
                content: msg.content ?? null,
                tool_calls: msg.toolCalls.map((tc) => ({
                  id: tc.id,
                  type: "function",
                  function: {
                    name: tc.name,
                    arguments: JSON.stringify(tc.arguments)
                  }
                }))
              });
            } else {
              openAiMessages.push({
                role: "assistant",
                content: msg.content ?? null
              });
            }
          } else if (msg.role === "system") {
            openAiMessages.push({
              role: "system",
              content: msg.content ?? ""
            });
          } else {
            openAiMessages.push({
              role: "user",
              content: msg.content ?? ""
            });
          }
        }

        const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
          model: options.model,
          messages: openAiMessages
        };

        if (input.tools && input.tools.length > 0) {
          params.tools = input.tools.map((tool) => ({
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters
            }
          }));
          params.tool_choice = "auto";
        }

        const completion = await client.chat.completions.create(params);
        const choice = completion.choices[0];
        const message = choice?.message;

        const toolCalls: LlmToolCall[] = [];
        if (message?.tool_calls) {
          for (const tc of message.tool_calls) {
            if (tc.type === "function" && "function" in tc) {
              let parsedArgs: Record<string, unknown> = {};
              try {
                parsedArgs = JSON.parse(tc.function.arguments || "{}");
              } catch {
                parsedArgs = {};
              }
              toolCalls.push({
                id: tc.id,
                name: tc.function.name,
                arguments: parsedArgs
              });
            }
          }
        }

        const output: LlmGenerateOutput = {
          text: message?.content ?? undefined,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          model: {
            provider: "openai-compatible",
            name: options.model
          }
        };

        return {
          ok: true,
          data: output
        };
      } catch (err: unknown) {
        const error = err as Error;
        const msgLower = (error.message || "").toLowerCase();
        const isTimeout =
          error.name === "TimeoutError" ||
          error.name === "APIConnectionTimeoutError" ||
          msgLower.includes("timeout") ||
          msgLower.includes("timed out");
        const isConnectionFailure =
          error.name === "APIConnectionError" ||
          msgLower.includes("connection error") ||
          msgLower.includes("connect econnrefused") ||
          msgLower.includes("fetch failed");
        const appError: AppError = {
          code: isTimeout || isConnectionFailure ? "AGENT_UNAVAILABLE" : "MODEL_ERROR",
          message: error.message || "LLM provider invocation failed",
          retryable: isTimeout || isConnectionFailure
        };
        return { ok: false, error: appError };
      }
    }
  };
}
