import type {
  AgentPermissions,
  AgentTurnRequest,
  AgentTurnResponse,
  CaptureViewportInput,
  Result,
  ShortSession,
  ViewportContext,
  MemoryMarker,
  MemorySummary,
} from "@vlc/contracts";
import type { Clock, IdGenerator, MemoryRepository } from "@vlc/memory";
import { checkSourcePolicy } from "../policy/check-source-policy";
import { selectTurnMemories } from "./select-turn-memories";

export interface AskAgentPipelineInput {
  question: string;
  session: ShortSession;
}

export interface AskAgentPipelineDependencies {
  capture(input: CaptureViewportInput): Promise<Result<ViewportContext>>;
  requestAgentTurn(input: AgentTurnRequest): Promise<Result<AgentTurnResponse>>;
  clock: Clock;
  idGenerator: IdGenerator;
  memoryRepository: MemoryRepository;
}

export interface BuildAgentTurnRequestInput {
  turnId: string;
  question: string;
  session: ShortSession;
  relatedMemories?: MemorySummary[];
  permissions: AgentPermissions;
}

export function buildAgentTurnRequest(input: BuildAgentTurnRequestInput): AgentTurnRequest {
  if (!input.session.context) {
    throw new Error("Không có viewport context để tạo lượt hỏi.");
  }

  return {
    contractVersion: "0.1",
    turnId: input.turnId,
    question: input.question.trim(),
    context: input.session.context,
    relatedMemories: (input.relatedMemories ?? input.session.relatedMemories).slice(0, 5),
    history: input.session.messages.slice(-10),
    permissions: input.permissions,
  };
}

export async function runAskAgentPipeline(
  input: AskAgentPipelineInput,
  deps: AskAgentPipelineDependencies,
): Promise<Result<AgentTurnResponse>> {
  const question = input.question.trim();
  if (!question || question.length > 2000) {
    return failure("Câu hỏi phải có từ 1 đến 2000 ký tự.");
  }

  if (input.session.policy?.decision !== "ALLOW" || !input.session.context) {
    return failure("Trang hiện tại chưa sẵn sàng để hỏi Agent.", "SOURCE_BLOCKED");
  }

  // Ask is an explicit user action, so recapture every turn to follow scrolling
  // without introducing background tracking. URL mismatch still stops before HTTP.
  const refreshed = await deps.capture({
    tabId: input.session.tabId,
    expectedUrl: input.session.context.source.canonicalUrl,
  });
  if (!refreshed.ok) return refreshed;
  input.session.context = refreshed.data;

  const memoryResult = await deps.memoryRepository.searchMemory({
    source: refreshed.data.source,
    anchor: refreshed.data.anchor,
    limit: 5,
  });
  if (!memoryResult.ok) {
    input.session.relatedMemories = [];
    return memoryResult;
  }
  input.session.relatedMemories = memoryResult.data;

  const catalog = await deps.memoryRepository.listMarkers();
  if (!catalog.ok) return catalog;
  const settings = await deps.memoryRepository.getSourcePolicySettings();
  if (!settings.ok) return settings;
  const inspected = await Promise.all(catalog.data.map(async marker => {
    const policy = await checkSourcePolicy({ url: marker.source.canonicalUrl, settings: settings.data });
    return policy.ok && policy.data.decision === "ALLOW" ? marker : null;
  }));
  const allowedMarkers = inspected.filter((marker): marker is MemoryMarker => marker !== null);
  const turnMemories = selectTurnMemories(memoryResult.data, allowedMarkers, refreshed.data, question);

  let request: AgentTurnRequest;
  try {
    request = buildAgentTurnRequest({
      turnId: deps.idGenerator.createId(),
      question,
      session: input.session,
      relatedMemories: turnMemories,
      permissions: { allowWebSearch: false },
    });
  } catch (error: unknown) {
    return failure(error instanceof Error ? error.message : "Không tạo được lượt hỏi.");
  }

  return deps.requestAgentTurn(request);
}

function failure(
  message: string,
  code: "VALIDATION_ERROR" | "SOURCE_BLOCKED" = "VALIDATION_ERROR",
): Result<never> {
  return { ok: false, error: { code, message, retryable: false } };
}
