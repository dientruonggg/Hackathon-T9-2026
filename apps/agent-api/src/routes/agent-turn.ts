import type { FastifyPluginAsync } from "fastify";
import { AgentTurnRequestSchema, type AgentTurnRequest, type AppError } from "@vlc/contracts";
import type { LlmProvider } from "../providers/llm-provider.js";
import { runAgentTurn } from "../agent/run-agent-turn.js";

export interface AgentTurnRouteOptions {
  provider?: LlmProvider | undefined;
}

export const agentTurnRoutes: FastifyPluginAsync<AgentTurnRouteOptions> = async (fastify, opts) => {
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

    // 2. Check if provider is available
    if (!opts.provider) {
      const error: AppError = {
        code: "AGENT_UNAVAILABLE",
        message: "Dịch vụ mô hình AI (LLM Provider) chưa được cấu hình",
        retryable: true
      };
      return reply.status(503).send(error);
    }

    // 3. Execute agent loop
    const input = parsed.data as unknown as AgentTurnRequest;
    const result = await runAgentTurn(input, { provider: opts.provider });

    if (!result.ok) {
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

    return reply.status(200).send(result.data);
  });
};
