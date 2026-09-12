import type {
  AgentTurnRequest,
  AgentTurnResponse,
  Result,
  ToolTraceEntry,
  PendingUserAction,
  GroundingKind,
  GroundingRef,
  AgentToolName
} from "@vlc/contracts";
import { AgentTurnResponseSchema } from "@vlc/contracts";
import type { LlmProvider, LlmMessage, LlmToolDefinition } from "../providers/llm-provider.js";
import { buildSystemPrompt } from "./system-prompt.js";
import {
  createAgentToolRegistry,
  type TurnToolContext,
  type AgentToolDependencies
} from "./tool-registry.js";

export interface AgentDependencies {
  provider: LlmProvider;
  toolDeps?: AgentToolDependencies;
}

export async function runAgentTurn(
  input: AgentTurnRequest,
  deps: AgentDependencies
): Promise<Result<AgentTurnResponse>> {
  // Check empty viewport
  if (!input.context || !input.context.visibleText || input.context.visibleText.trim() === "") {
    return {
      ok: false,
      error: {
        code: "NO_READABLE_CONTENT",
        message: "Ngữ cảnh viewport trống hoặc không thể đọc được nội dung văn bản",
        retryable: false
      }
    };
  }

  const turnContext: TurnToolContext = {
    turnId: input.turnId,
    context: input.context,
    relatedMemories: input.relatedMemories,
    permissions: input.permissions
  };

  const registry = createAgentToolRegistry(turnContext, deps.toolDeps);

  const toolDefs: LlmToolDefinition[] = Array.from(registry.values()).map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }));

  const messages: LlmMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt()
    },
    ...input.history.map((h) => ({
      role: h.role,
      content: h.content
    })),
    {
      role: "user",
      content: input.question
    }
  ];

  const toolTrace: ToolTraceEntry[] = [];
  const suggestedActions: PendingUserAction[] = [];
  let finalAnswer: string | undefined;
  let lastModel = { provider: "unknown", name: "unknown" };

  // Loop maximum 3 model steps
  for (let step = 1; step <= 3; step++) {
    const res = await deps.provider.generate({
      messages,
      tools: toolDefs
    });

    if (!res.ok) {
      return { ok: false, error: res.error };
    }

    lastModel = res.data.model;

    // Check if model returned tool calls
    if (res.data.toolCalls && res.data.toolCalls.length > 0) {
      messages.push({
        role: "assistant",
        content: res.data.text ?? undefined,
        toolCalls: res.data.toolCalls
      });

      for (const tc of res.data.toolCalls) {
        const tool = registry.get(tc.name as AgentToolName);
        if (!tool) {
          // Tool not in registry: feed controlled error back to model
          messages.push({
            role: "tool",
            toolCallId: tc.id,
            content: JSON.stringify({ error: `Tool ${tc.name} không tồn tại` })
          });
          continue;
        }

        const toolResult = await tool.execute(tc.arguments);
        if (toolResult.ok) {
          toolTrace.push({
            step,
            toolName: tc.name as AgentToolName,
            status: "SUCCESS"
          });

          if (tc.name === "propose_marker") {
            suggestedActions.push(toolResult.data as PendingUserAction);
          }

          messages.push({
            role: "tool",
            toolCallId: tc.id,
            content: JSON.stringify(toolResult.data)
          });
        } else {
          toolTrace.push({
            step,
            toolName: tc.name as AgentToolName,
            status: "ERROR",
            errorCode: toolResult.error.code
          });
          messages.push({
            role: "tool",
            toolCallId: tc.id,
            content: JSON.stringify({ error: toolResult.error.message })
          });
        }
      }
    } else {
      // Model returned final text answer
      finalAnswer = res.data.text ?? "";
      break;
    }
  }

  if (finalAnswer === undefined) {
    return {
      ok: false,
      error: {
        code: "AGENT_MAX_STEPS",
        message: "Vòng lặp ReAct đã vượt quá giới hạn tối đa 3 bước mô hình",
        retryable: false
      }
    };
  }

  // Determine GroundingKind
  let grounding: GroundingKind = "VIEWPORT";
  const hasMemoryTool = toolTrace.some(
    (t) => (t.toolName === "search_memory" || t.toolName === "read_memory") && t.status === "SUCCESS"
  );
  const hasWebTool = toolTrace.some(
    (t) => t.toolName === "search_web" && t.status === "SUCCESS"
  );

  if (finalAnswer.toUpperCase().includes("INSUFFICIENT") || finalAnswer.toLowerCase().includes("thiếu dữ kiện")) {
    grounding = "INSUFFICIENT";
  } else if (hasMemoryTool) {
    grounding = "MEMORY";
  } else if (hasWebTool) {
    grounding = "WEB";
  } else {
    grounding = "VIEWPORT";
  }

  const groundingRefs: GroundingRef[] = [];
  if (grounding === "VIEWPORT") {
    groundingRefs.push({
      kind: "VIEWPORT",
      refId: input.context.contextId,
      label: input.context.anchor.heading || input.context.source.title,
      url: input.context.source.safeUrl
    });
  } else if (grounding === "MEMORY") {
    const mem = input.relatedMemories[0];
    groundingRefs.push({
      kind: "MEMORY",
      refId: mem?.id ?? "memory-ref",
      label: mem?.anchor.heading || "Ký ức liên quan"
    });
  } else if (grounding === "WEB") {
    groundingRefs.push({
      kind: "WEB",
      refId: "web-ref",
      label: "Tìm kiếm ngoài"
    });
  }

  const responsePayload: AgentTurnResponse = {
    contractVersion: "0.1",
    turnId: input.turnId,
    answer: finalAnswer,
    grounding,
    groundingRefs,
    suggestedActions: suggestedActions.slice(0, 3),
    toolTrace: toolTrace.slice(0, 10),
    model: {
      provider: lastModel.provider,
      name: lastModel.name
    }
  };

  // Validate response with shared contract
  AgentTurnResponseSchema.parse(responsePayload);

  return {
    ok: true,
    data: responsePayload
  };
}
