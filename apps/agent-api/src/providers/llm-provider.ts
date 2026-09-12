import type { Result } from "@vlc/contracts";

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | undefined;
  toolCallId?: string | undefined;
  toolCalls?: LlmToolCall[] | undefined;
}

export interface LlmToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LlmGenerateInput {
  messages: LlmMessage[];
  tools?: LlmToolDefinition[] | undefined;
}

export interface LlmGenerateOutput {
  text?: string | undefined;
  toolCalls?: LlmToolCall[] | undefined;
  model: {
    provider: string;
    name: string;
  };
}

export interface LlmProvider {
  generate(input: LlmGenerateInput): Promise<Result<LlmGenerateOutput>>;
}
