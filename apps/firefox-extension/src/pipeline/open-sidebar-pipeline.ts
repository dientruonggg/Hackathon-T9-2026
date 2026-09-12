import type {
  CaptureViewportInput,
  Result,
  ShortSession,
  SourcePolicyInput,
  SourcePolicyResult,
  SourcePolicySettings,
  ViewportContext,
} from "@vlc/contracts";
import type { Clock, IdGenerator, MemoryRepository } from "@vlc/memory";

export interface OpenSidebarPipelineInput {
  tabId: number;
  url: string;
  title?: string;
  contentType?: string;
}

export interface OpenSidebarPipelineOutput {
  session: ShortSession;
}

export interface OpenSidebarPipelineDependencies {
  getPolicySettings(): Promise<Result<SourcePolicySettings>>;
  checkPolicy(input: SourcePolicyInput): Promise<Result<SourcePolicyResult>>;
  capture(input: CaptureViewportInput): Promise<Result<ViewportContext>>;
  memoryRepository: MemoryRepository;
  clock: Clock;
  idGenerator: IdGenerator;
}

export async function runOpenSidebarPipeline(
  input: OpenSidebarPipelineInput,
  deps: OpenSidebarPipelineDependencies,
): Promise<Result<OpenSidebarPipelineOutput>> {
  if (!Number.isInteger(input.tabId) || input.tabId < 0 || !input.url.trim()) {
    return failure("Không xác định được tab Firefox đang mở.");
  }

  const session: ShortSession = {
    sessionId: deps.idGenerator.createId(),
    tabId: input.tabId,
    status: "CHECKING_SOURCE",
    relatedMemories: [],
    messages: [],
  };

  const settingsResult = await deps.getPolicySettings();
  if (!settingsResult.ok) return settingsResult;

  const policyInput: SourcePolicyInput = {
    url: input.url,
    settings: settingsResult.data,
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.contentType === undefined ? {} : { contentType: input.contentType }),
  };
  const policyResult = await deps.checkPolicy(policyInput);
  if (!policyResult.ok) return policyResult;

  session.policy = policyResult.data;
  if (policyResult.data.decision !== "ALLOW") {
    session.status = "BLOCKED";
    return { ok: true, data: { session } };
  }

  session.status = "CAPTURING";
  const captureResult = await deps.capture({
    tabId: input.tabId,
    expectedUrl: input.url,
  });
  if (!captureResult.ok) return captureResult;

  session.context = captureResult.data;
  const memoryResult = await deps.memoryRepository.searchMemory({
    source: captureResult.data.source,
    anchor: captureResult.data.anchor,
    limit: 5,
  });
  if (!memoryResult.ok) return memoryResult;

  session.relatedMemories = memoryResult.data;
  session.status = memoryResult.data.length > 0 ? "READY_WITH_MEMORY" : "READY";
  return { ok: true, data: { session } };
}

function failure(message: string): Result<never> {
  return {
    ok: false,
    error: { code: "VALIDATION_ERROR", message, retryable: false },
  };
}
