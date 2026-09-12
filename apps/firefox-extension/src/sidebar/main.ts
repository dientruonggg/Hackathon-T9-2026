import type {
  AgentTurnResponse,
  ChatMessage,
  MemoryStatus,
  ShortSession,
} from "@vlc/contracts";
import { checkSourcePolicy } from "../policy/check-source-policy";
import { runAskAgentPipeline } from "../pipeline/ask-agent-pipeline";
import { executeConfirmedMemoryCommand } from "../pipeline/confirmed-memory-command";
import { runOpenSidebarPipeline } from "../pipeline/open-sidebar-pipeline";
import { requestAgentTurn } from "../services/agent-api-client";
import {
  browserIdGenerator,
  captureTabViewport,
  getActiveTab,
  memoryRepository,
  resumeTabAtMarker,
  systemClock,
} from "../services/browser-runtime";

const statusMessage = requireElement<HTMLElement>("#status-message");
const sourceBadge = requireElement<HTMLElement>("#source-badge");
const contextHeading = requireElement<HTMLElement>("#context-heading");
const contextPreview = requireElement<HTMLElement>("#context-preview");
const memoryCard = requireElement<HTMLElement>("#memory-card");
const memoryStatus = requireElement<HTMLElement>("#memory-status");
const resumeButton = requireElement<HTMLButtonElement>("#resume-button");
const questionForm = requireElement<HTMLFormElement>("#question-form");
const questionInput = requireElement<HTMLTextAreaElement>("#question-input");
const askButton = requireElement<HTMLButtonElement>("#ask-button");
const answerPanel = requireElement<HTMLElement>("#answer-panel");
const answerContent = requireElement<HTMLElement>("#answer-content");
const groundingLabel = requireElement<HTMLElement>("#grounding-label");
const markerButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-memory-status]"),
);

let session: ShortSession | undefined;
let busy = false;

questionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void askCurrentContext();
});

for (const button of markerButtons) {
  button.addEventListener("click", () => {
    const status = button.dataset.memoryStatus as MemoryStatus | undefined;
    if (status) void saveMarker(status);
  });
}

resumeButton.addEventListener("click", () => void resumeFirstMemory());

void initializeSidebar();

async function initializeSidebar(): Promise<void> {
  setBusy(true);
  renderShellStatus("Đang kiểm tra trang hiện tại…");

  const tabResult = await getActiveTab();
  if (!tabResult.ok) {
    renderFatalError(tabResult.error.message);
    return;
  }

  const opened = await runOpenSidebarPipeline(
    {
      tabId: tabResult.data.id,
      url: tabResult.data.url,
      ...(tabResult.data.title === undefined ? {} : { title: tabResult.data.title }),
    },
    {
      getPolicySettings: () => memoryRepository.getSourcePolicySettings(),
      checkPolicy: checkSourcePolicy,
      capture: captureTabViewport,
      memoryRepository,
      clock: systemClock,
      idGenerator: browserIdGenerator,
    },
  );

  if (!opened.ok) {
    renderFatalError(opened.error.message);
    return;
  }

  session = opened.data.session;
  renderSession(session);
  setBusy(false);
}

async function askCurrentContext(): Promise<void> {
  if (!session || busy) return;
  const question = questionInput.value.trim();
  if (!question) {
    renderShellStatus("Hãy nhập một câu hỏi về đoạn đang thấy.", "danger");
    return;
  }

  setBusy(true);
  session.status = "ASKING";
  renderShellStatus("Agent đang đọc context và suy nghĩ…");

  const response = await runAskAgentPipeline(
    { question, session },
    {
      capture: captureTabViewport,
      requestAgentTurn,
      clock: systemClock,
      idGenerator: browserIdGenerator,
    },
  );

  if (!response.ok) {
    session.status = session.relatedMemories.length > 0 ? "READY_WITH_MEMORY" : "READY";
    renderShellStatus(response.error.message, "danger");
    setBusy(false);
    return;
  }

  const nextMessages: ChatMessage[] = [
    ...session.messages,
    { role: "user", content: question },
    { role: "assistant", content: response.data.answer.slice(0, 2000) },
  ];
  session.messages = nextMessages.slice(-10);
  const suggestedAction = response.data.suggestedActions[0];
  if (suggestedAction) session.pendingAction = suggestedAction;
  else delete session.pendingAction;
  session.status = "READY_WITH_ANSWER";
  questionInput.value = "";
  renderAnswer(response.data);
  renderShellStatus("Câu trả lời chỉ dùng viewport và bộ nhớ được hiển thị.", "success");
  setBusy(false);
}

async function saveMarker(status: MemoryStatus): Promise<void> {
  if (!session?.context || busy) return;
  setBusy(true);
  session.status = "SAVING";
  renderShellStatus("Đang lưu dấu mốc vào Firefox…");

  const suggestedNote =
    session.pendingAction?.payload.status === status
      ? session.pendingAction.payload.note
      : undefined;
  const saved = await executeConfirmedMemoryCommand(
    {
      status,
      session,
      userConfirmed: true,
      ...(suggestedNote === undefined ? {} : { note: suggestedNote }),
    },
    { memoryRepository, clock: systemClock },
  );

  if (!saved.ok) {
    session.status = "ERROR";
    renderShellStatus(saved.error.message, "danger");
    setBusy(false);
    return;
  }

  const recalled = await memoryRepository.searchMemory({
    source: session.context.source,
    anchor: session.context.anchor,
    limit: 5,
  });
  if (recalled.ok) session.relatedMemories = recalled.data;
  delete session.pendingAction;
  session.status = "READY_WITH_MEMORY";
  renderMemory(session);
  renderShellStatus(`Đã lưu trên Firefox • revision ${saved.data.revision}`, "success");
  setBusy(false);
}

async function resumeFirstMemory(): Promise<void> {
  const memory = session?.relatedMemories[0];
  if (!session || !memory || busy) return;

  setBusy(true);
  const resumed = await resumeTabAtMarker({
    tabId: session.tabId,
    expectedCanonicalUrl: memory.source.canonicalUrl,
    anchor: memory.anchor,
  });
  if (!resumed.ok) {
    renderShellStatus(resumed.error.message, "danger");
  } else {
    renderShellStatus(
      resumed.data.found
        ? `Đã quay lại bằng ${formatResumeStrategy(resumed.data.strategy)}.`
        : "Không tìm lại được vị trí trên trang.",
      resumed.data.found ? "success" : "danger",
    );
  }
  setBusy(false);
}

function renderSession(value: ShortSession): void {
  const blocked = value.status === "BLOCKED";
  sourceBadge.textContent = blocked ? "Không đọc" : "Được đọc";
  sourceBadge.dataset.tone = blocked ? "danger" : "success";

  if (blocked) {
    contextHeading.textContent = "Trang này nằm ngoài phạm vi demo";
    contextPreview.textContent = value.policy?.userMessage ?? "Extension không đọc nguồn này.";
    renderShellStatus(contextPreview.textContent, "danger");
    setBusy(false);
    return;
  }

  if (value.context) {
    contextHeading.textContent = value.context.anchor.heading || value.context.source.title;
    contextPreview.textContent = value.context.visibleText;
    renderMemory(value);
    renderShellStatus("Sẵn sàng. Mở sidebar không tự gọi AI.", "success");
  }
}

function renderMemory(value: ShortSession): void {
  const memory = value.relatedMemories[0];
  memoryCard.hidden = !memory;
  if (!memory) return;
  memoryStatus.textContent = `${formatMemoryStatus(memory.status)} • revision ${memory.revision}`;
}

function renderAnswer(response: AgentTurnResponse): void {
  answerPanel.hidden = false;
  answerContent.textContent = response.answer;
  groundingLabel.textContent = formatGrounding(response.grounding);
}

function renderFatalError(message: string): void {
  sourceBadge.textContent = "Có lỗi";
  sourceBadge.dataset.tone = "danger";
  contextHeading.textContent = "Chưa thể mở Learning Companion";
  contextPreview.textContent = message;
  renderShellStatus(message, "danger");
  busy = false;
  updateControls();
}

export function renderShellStatus(
  message: string,
  tone: "idle" | "success" | "danger" = "idle",
): void {
  statusMessage.textContent = message;
  statusMessage.dataset.tone = tone;
}

function setBusy(value: boolean): void {
  busy = value;
  updateControls();
}

function updateControls(): void {
  const canUseContext = Boolean(session?.context && session.policy?.decision === "ALLOW");
  questionInput.disabled = busy || !canUseContext;
  askButton.disabled = busy || !canUseContext;
  for (const button of markerButtons) button.disabled = busy || !canUseContext;
  resumeButton.disabled = busy || !session || session.relatedMemories.length === 0;
}

function formatMemoryStatus(status: MemoryStatus): string {
  if (status === "UNDERSTOOD") return "Đã hiểu";
  if (status === "NOT_UNDERSTOOD") return "Chưa hiểu";
  return "Xem lại sau";
}

function formatGrounding(grounding: AgentTurnResponse["grounding"]): string {
  if (grounding === "MEMORY") return "Viewport + bộ nhớ";
  if (grounding === "WEB") return "Có nguồn web";
  if (grounding === "INSUFFICIENT") return "Chưa đủ dữ liệu";
  return "Theo viewport";
}

function formatResumeStrategy(strategy: string): string {
  if (strategy === "TEXT_QUOTE") return "đoạn chữ";
  if (strategy === "HEADING") return "tiêu đề";
  return "vị trí cuộn";
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Thiếu UI element: ${selector}`);
  return element;
}
