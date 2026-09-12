import type {
  AgentTurnRequest,
  AgentTurnResponse,
  Result,
} from "@vlc/contracts";
import {
  isAgentTurnRequest,
  isAgentTurnResponse,
  isAppError,
} from "./contract-guards";

export const DEFAULT_AGENT_API_URL = "http://127.0.0.1:8787/v1/agent/turn";
// Slightly longer than the provider timeout so the API can return a structured error.
const DEFAULT_TIMEOUT_MS = 65_000;

export interface AgentApiClientOptions {
  endpoint?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export function requestAgentTurn(
  input: AgentTurnRequest,
): Promise<Result<AgentTurnResponse>> {
  return requestAgentTurnWithOptions(input);
}

export async function requestAgentTurnWithOptions(
  input: AgentTurnRequest,
  options: AgentApiClientOptions = {},
): Promise<Result<AgentTurnResponse>> {
  if (!isAgentTurnRequest(input)) {
    return failure("VALIDATION_ERROR", "Lượt hỏi không đúng contract.", false);
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await (options.fetchImpl ?? fetch)(
      options.endpoint ?? DEFAULT_AGENT_API_URL,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit",
      },
    );
    const payload: unknown = await response.json().catch(() => undefined);

    if (!response.ok) {
      if (isAppError(payload)) return { ok: false, error: payload };
      return failure(
        response.status === 503 ? "AGENT_UNAVAILABLE" : "NETWORK_ERROR",
        `Agent API trả HTTP ${response.status}.`,
        response.status >= 500,
      );
    }

    if (!isAgentTurnResponse(payload)) {
      return failure("VALIDATION_ERROR", "Phản hồi Agent không đúng contract.", false);
    }
    return { ok: true, data: payload };
  } catch (error: unknown) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    return failure(
      timedOut ? "AGENT_UNAVAILABLE" : "NETWORK_ERROR",
      timedOut
        ? "Agent API phản hồi quá lâu. Hãy thử lại."
        : "Không kết nối được Agent API tại máy local.",
      true,
    );
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

function failure(
  code: "VALIDATION_ERROR" | "AGENT_UNAVAILABLE" | "NETWORK_ERROR",
  message: string,
  retryable: boolean,
): Result<never> {
  return { ok: false, error: { code, message, retryable } };
}
