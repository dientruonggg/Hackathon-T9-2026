import type {
  AgentTurnRequest,
  AgentTurnResponse,
  AppError,
  HighlightOrResumeOutput,
  ViewportContext,
} from "@vlc/contracts";

const ERROR_CODES = new Set([
  "VALIDATION_ERROR",
  "SOURCE_BLOCKED",
  "SOURCE_UNSUPPORTED",
  "NO_READABLE_CONTENT",
  "CONTEXT_STALE",
  "MEMORY_NOT_FOUND",
  "MEMORY_WRITE_FAILED",
  "PERMISSION_DENIED",
  "AGENT_UNAVAILABLE",
  "AGENT_MAX_STEPS",
  "MODEL_ERROR",
  "NETWORK_ERROR",
  "TOOL_NOT_FOUND",
  "TOOL_EXECUTION_ERROR",
  "INTERNAL_ERROR",
]);

const MEMORY_STATUSES = new Set(["UNDERSTOOD", "NOT_UNDERSTOOD", "REVIEW_LATER"]);
const GROUNDING_KINDS = new Set(["VIEWPORT", "MEMORY", "WEB", "INSUFFICIENT"]);
const RESUME_STRATEGIES = new Set(["TEXT_QUOTE", "HEADING", "SCROLL_RATIO", "NONE"]);

export function isAppError(value: unknown): value is AppError {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    ERROR_CODES.has(value.code) &&
    typeof value.message === "string" &&
    typeof value.retryable === "boolean"
  );
}

export function isViewportContext(value: unknown): value is ViewportContext {
  if (!isRecord(value) || !isRecord(value.source) || !isRecord(value.anchor)) return false;
  return (
    typeof value.contextId === "string" &&
    typeof value.source.canonicalUrl === "string" &&
    typeof value.source.safeUrl === "string" &&
    typeof value.source.hostname === "string" &&
    typeof value.source.title === "string" &&
    typeof value.anchor.heading === "string" &&
    typeof value.anchor.textQuote === "string" &&
    typeof value.anchor.fingerprint === "string" &&
    typeof value.anchor.scrollRatio === "number" &&
    value.anchor.scrollRatio >= 0 &&
    value.anchor.scrollRatio <= 1 &&
    typeof value.visibleText === "string" &&
    value.visibleText.trim().length > 0 &&
    Array.isArray(value.visibleCodeBlocks) &&
    value.visibleCodeBlocks.every((block) => typeof block === "string") &&
    typeof value.capturedAt === "string" &&
    Number.isFinite(Date.parse(value.capturedAt))
  );
}

export function isHighlightOrResumeOutput(value: unknown): value is HighlightOrResumeOutput {
  return (
    isRecord(value) &&
    typeof value.found === "boolean" &&
    typeof value.strategy === "string" &&
    RESUME_STRATEGIES.has(value.strategy) &&
    (value.appliedScrollRatio === undefined ||
      (typeof value.appliedScrollRatio === "number" &&
        value.appliedScrollRatio >= 0 &&
        value.appliedScrollRatio <= 1))
  );
}

export function isAgentTurnRequest(value: unknown): value is AgentTurnRequest {
  if (!isRecord(value) || !isViewportContext(value.context)) return false;
  return (
    value.contractVersion === "0.1" &&
    typeof value.turnId === "string" &&
    typeof value.question === "string" &&
    value.question.trim().length > 0 &&
    value.question.length <= 2000 &&
    Array.isArray(value.relatedMemories) &&
    value.relatedMemories.length <= 5 &&
    Array.isArray(value.history) &&
    value.history.length <= 10 &&
    value.history.every(
      (message) =>
        isRecord(message) &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.length <= 2000,
    ) &&
    isRecord(value.permissions) &&
    typeof value.permissions.allowWebSearch === "boolean"
  );
}

export function isAgentTurnResponse(value: unknown): value is AgentTurnResponse {
  if (!isRecord(value) || !isRecord(value.model)) return false;
  return (
    value.contractVersion === "0.1" &&
    typeof value.turnId === "string" &&
    typeof value.answer === "string" &&
    value.answer.length <= 4000 &&
    typeof value.grounding === "string" &&
    GROUNDING_KINDS.has(value.grounding) &&
    Array.isArray(value.groundingRefs) &&
    value.groundingRefs.every(isGroundingRef) &&
    Array.isArray(value.suggestedActions) &&
    value.suggestedActions.length <= 3 &&
    value.suggestedActions.every(isPendingAction) &&
    Array.isArray(value.toolTrace) &&
    value.toolTrace.length <= 10 &&
    value.toolTrace.every(isToolTrace) &&
    typeof value.model.provider === "string" &&
    typeof value.model.name === "string"
  );
}

function isGroundingRef(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.kind === "VIEWPORT" || value.kind === "MEMORY" || value.kind === "WEB") &&
    typeof value.refId === "string" &&
    typeof value.label === "string" &&
    (value.url === undefined || typeof value.url === "string")
  );
}

function isPendingAction(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.type === "CONFIRM_MARKER" &&
    typeof value.id === "string" &&
    typeof value.confirmationText === "string" &&
    isRecord(value.payload) &&
    typeof value.payload.status === "string" &&
    MEMORY_STATUSES.has(value.payload.status) &&
    (value.payload.note === undefined ||
      (typeof value.payload.note === "string" && value.payload.note.length <= 500))
  );
}

function isToolTrace(value: unknown): boolean {
  return (
    isRecord(value) &&
    Number.isInteger(value.step) &&
    typeof value.step === "number" &&
    value.step >= 1 &&
    typeof value.toolName === "string" &&
    (value.status === "SUCCESS" || value.status === "ERROR") &&
    (value.errorCode === undefined ||
      (typeof value.errorCode === "string" && ERROR_CODES.has(value.errorCode)))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
