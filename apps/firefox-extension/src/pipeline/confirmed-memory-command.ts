import type {
  MemoryMarker,
  MemoryStatus,
  Result,
  ShortSession,
} from "@vlc/contracts";
import type { Clock, MemoryRepository } from "@vlc/memory";

export interface ConfirmedMemoryCommandInput {
  status: MemoryStatus;
  session: ShortSession;
  note?: string;
  userConfirmed: true;
}

export interface ConfirmedMemoryCommandDependencies {
  memoryRepository: MemoryRepository;
  clock: Clock;
}

export async function executeConfirmedMemoryCommand(
  input: ConfirmedMemoryCommandInput,
  deps: ConfirmedMemoryCommandDependencies,
): Promise<Result<MemoryMarker>> {
  if (input.userConfirmed !== true) {
    return failure("Chỉ lưu dấu mốc sau khi người dùng xác nhận.");
  }
  if (!input.session.context) {
    return failure("Không có viewport context để lưu dấu mốc.");
  }

  const lastQuestion = [...input.session.messages]
    .reverse()
    .find((message) => message.role === "user")?.content;
  const lastAnswer = [...input.session.messages]
    .reverse()
    .find((message) => message.role === "assistant")?.content;
  const createdAt = deps.clock.now().toISOString();
  const note = input.note?.trim();

  const markerInput = {
    source: input.session.context.source,
    anchor: input.session.context.anchor,
    status: input.status,
    ...(note ? { note: note.slice(0, 500) } : {}),
    ...(lastQuestion ? { question: lastQuestion.slice(0, 500) } : {}),
    ...(lastAnswer ? { answerSummary: lastAnswer.slice(0, 500) } : {}),
    evidence: {
      kind: "USER_MARK",
      summary: `Người dùng xác nhận trạng thái ${input.status}.`,
      createdAt,
    },
    userConfirmed: true,
  } as const;

  return deps.memoryRepository.saveMarker(markerInput);
}

function failure(message: string): Result<never> {
  return {
    ok: false,
    error: { code: "VALIDATION_ERROR", message, retryable: false },
  };
}
