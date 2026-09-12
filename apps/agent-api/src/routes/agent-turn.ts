import type { FastifyPluginAsync } from "fastify";
import { AgentTurnRequestSchema, type AgentTurnRequest, type AppError } from "@vlc/contracts";
import type { LlmProvider } from "../providers/llm-provider.js";
import { runAgentTurn } from "../agent/run-agent-turn.js";
import {
  type AgentObserver,
  ConsoleJsonAgentObserver
} from "../observability/agent-observer.js";

export interface AgentTurnRouteOptions {
  provider?: LlmProvider | undefined;
  observer?: AgentObserver | undefined;
}

export const agentTurnRoutes: FastifyPluginAsync<AgentTurnRouteOptions> = async (fastify, opts) => {
  const baseObserver = opts.observer ?? new ConsoleJsonAgentObserver();

  fastify.post("/v1/agent/turn", async (request, reply) => {
    // 1. Validate request body against shared contract
    const parsed = AgentTurnRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      // Check if the validation failure is due to empty visibleText (mapped to 422)
      const isVisibleTextEmpty = parsed.error.issues.some(
        (issue) => issue.path.includes("visibleText")
      );
      if (isVisibleTextEmpty) {
        const error: AppError = {
          code: "NO_READABLE_CONTENT",
          message: "Ngữ cảnh viewport trống hoặc không thể đọc được nội dung văn bản",
          retryable: false
        };
        return reply.status(422).send(error);
      }

      const error: AppError = {
        code: "VALIDATION_ERROR",
        message: `Dữ liệu lượt hỏi không hợp lệ: ${parsed.error.message}`,
        retryable: false
      };
      return reply.status(400).send(error);
    }

    const input: AgentTurnRequest = parsed.data;
    const startTime = Date.now();

    // Emit turn.started only after request parsed and valid turnId confirmed
    baseObserver.emit({
      event: "agent.turn.started",
      turnId: input.turnId
    });

    // 2. Check if provider is available
    if (!opts.provider) {
      const durationMs = Math.max(0, Date.now() - startTime);
      baseObserver.emit({
        event: "agent.turn.failed",
        turnId: input.turnId,
        durationMs,
        errorCode: "AGENT_UNAVAILABLE",
        retryable: true
      });

      const error: AppError = {
        code: "AGENT_UNAVAILABLE",
        message: "Dịch vụ mô hình AI (LLM Provider) chưa được cấu hình",
        retryable: true
      };
      return reply.status(503).send(error);
    }

    // 3. Execute agent loop with tool-counting observer
    let turnToolCount = 0;
    const turnObserver: AgentObserver = {
      emit(event) {
        if (event.event === "agent.tool.completed") {
          turnToolCount++;
        }
        baseObserver.emit(event);
      }
    };

    try {
      const result = await runAgentTurn(input, {
        provider: opts.provider,
        observer: turnObserver
      });

      const durationMs = Math.max(0, Date.now() - startTime);

      if (!result.ok) {
        baseObserver.emit({
          event: "agent.turn.failed",
          turnId: input.turnId,
          durationMs,
          errorCode: result.error.code,
          retryable: result.error.retryable ?? false
        });

        let statusCode = 500;
        switch (result.error.code) {
          case "VALIDATION_ERROR":
            statusCode = 400;
            break;
          case "NO_READABLE_CONTENT":
          case "CONTEXT_STALE":
            statusCode = 422;
            break;
          case "AGENT_UNAVAILABLE":
          case "MODEL_ERROR":
            statusCode = 503;
            break;
          default:
            statusCode = 500;
            break;
        }
        return reply.status(statusCode).send(result.error);
      }

      baseObserver.emit({
        event: "agent.turn.completed",
        turnId: input.turnId,
        durationMs,
        grounding: result.data.grounding,
        toolCount: turnToolCount,
        modelName: result.data.model.name
      });

      return reply.status(200).send(result.data);
    } catch {
      const durationMs = Math.max(0, Date.now() - startTime);
      baseObserver.emit({
        event: "agent.turn.failed",
        turnId: input.turnId,
        durationMs,
        errorCode: "INTERNAL_ERROR",
        retryable: false
      });

      const error: AppError = {
        code: "INTERNAL_ERROR",
        message: "Lỗi hệ thống không xác định trong lượt xử lý",
        retryable: false
      };
      return reply.status(500).send(error);
    }
  });
};
