
import {
  loadPrivacyMemoryState,
  blockCurrentDomain,
  unblockDomain,
  forgetConfirmedMarker,
  type PrivacyMemoryState
} from "../pipeline/privacy-memory-controls.js";
import type {
  AgentTurnResponse,
  ChatMessage,
  MemoryStatus,
  ShortSession,
} from "@vlc/contracts";
import { checkSourcePolicy } from "../policy/check-source-policy";
import { runAskAgentPipeline } from "../pipeline/ask-agent-pipeline";
import {
  executeConfirmedMemoryCommand,
  executeConfirmedMemoryWithRecapture,
} from "../pipeline/confirmed-memory-command";
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
const agentProposalPanel = requireElement<HTMLElement>("#agent-proposal-panel");
const agentProposalText = requireElement<HTMLElement>("#agent-proposal-text");
const acceptProposalButton = requireElement<HTMLButtonElement>("#accept-proposal-button");
const markerButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-memory-status]"),
);

let session: ShortSession | undefined;
let busy = false;

const currentDomainLabel = requireElement<HTMLSpanElement>("#current-domain-label");
const blockCurrentDomainButton = requireElement<HTMLButtonElement>("#block-current-domain-button");
const blockedDomainsList = requireElement<HTMLUListElement>("#blocked-domains-list");
const emptyBlockedDomains = requireElement<HTMLParagraphElement>("#empty-blocked-domains");
const pageMarkersList = requireElement<HTMLUListElement>("#page-markers-list");
const emptyPageMarkers = requireElement<HTMLParagraphElement>("#empty-page-markers");

blockCurrentDomainButton.addEventListener("click", async () => {
  if (!session?.context || busy) return;
  setBusy(true);
  const result = await blockCurrentDomain({ domain: session.context.source.hostname || session.context.source.canonicalUrl, userConfirmed: true }, { memoryRepository });
  if (result.ok) {
    renderShellStatus("Đã chặn website này. Mở lại sidebar để áp dụng.", "success");
    blockCurrentDomainButton.disabled = true;
    await refreshPrivacyMemoryState();
  } else {
    renderShellStatus("Lỗi khi chặn website.", "danger");
  }
  setBusy(false);
});

async function refreshPrivacyMemoryState() {
  if (!session?.context) return;
  const result = await loadPrivacyMemoryState({
    currentDomain: session.context.source.hostname || session.context.source.canonicalUrl,
    relatedMemories: session.relatedMemories
  }, { memoryRepository });
  if (result.ok) {
    renderPrivacyState(result.data);
  }
}

function renderPrivacyState(state: PrivacyMemoryState) {
  currentDomainLabel.textContent = state.currentDomain;
  blockCurrentDomainButton.disabled = state.isCurrentDomainUserBlocked;
  
  if (state.blockedDomains.length === 0) {
    emptyBlockedDomains.hidden = false;
    blockedDomainsList.replaceChildren();
  } else {
    emptyBlockedDomains.hidden = true;
    blockedDomainsList.replaceChildren();
    for (const domain of state.blockedDomains) {
      const li = document.createElement("li");
      li.textContent = domain + " ";
      const btn = document.createElement("button");
      btn.textContent = "Gỡ";
      btn.className = "text-button";
      btn.onclick = async () => {
        setBusy(true);
        const res = await unblockDomain({ domain, userConfirmed: true }, { memoryRepository });
        if (res.ok) await refreshPrivacyMemoryState();
        setBusy(false);
      };
      li.appendChild(btn);
      blockedDomainsList.appendChild(li);
    }
  }

  if (state.relatedMemories.length === 0) {
    emptyPageMarkers.hidden = false;
    pageMarkersList.replaceChildren();
  } else {
    emptyPageMarkers.hidden = true;
    pageMarkersList.replaceChildren();
    for (const mem of state.relatedMemories) {
      const li = document.createElement("li");
      const strong = document.createElement("strong");
      strong.textContent = formatMemoryStatus(mem.status);
      li.appendChild(strong);
      li.appendChild(document.createTextNode(` - ${mem.anchor.heading || 'Text'} (rev ${mem.revision}, ${new Date(mem.updatedAt).toLocaleTimeString()})`));
      
      const resumeBtn = document.createElement("button");
      resumeBtn.textContent = "Resume";
      resumeBtn.className = "text-button";
      resumeBtn.onclick = async () => {
        if (!session || busy) return;
        setBusy(true);
        const resumed = await resumeTabAtMarker({
          tabId: session.tabId,
          expectedCanonicalUrl: mem.source.canonicalUrl,
          anchor: mem.anchor,
        });
        setBusy(false);
      };

      const delBtn = document.createElement("button");
      delBtn.textContent = "Xóa";
      delBtn.className = "text-button";
      delBtn.onclick = async () => {
        if (!confirm("Bạn có chắc muốn xóa dấu mốc này?")) return;
        setBusy(true);
        const res = await forgetConfirmedMarker({ memoryId: mem.id, userConfirmed: true }, { memoryRepository });
        if (res.ok && res.data.deletedCount === 1) {
          session!.relatedMemories = session!.relatedMemories.filter(m => m.id !== mem.id);
          await refreshPrivacyMemoryState();
        }
        setBusy(false);
      };
      
      li.appendChild(document.createTextNode(" "));
      li.appendChild(resumeBtn);
      li.appendChild(document.createTextNode(" "));
      li.appendChild(delBtn);
      pageMarkersList.appendChild(li);
    }
  }
}

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

acceptProposalButton.addEventListener("click", () => {
  const suggestedStatus = session?.pendingAction?.payload.status;
  if (suggestedStatus) void saveMarker(suggestedStatus);
});

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

  const saved = await executeConfirmedMemoryWithRecapture(
    {
      status,
      session,
      userConfirmed: true,
      ...(suggestedNote === undefined ? {} : { note: suggestedNote }),
    },
    {
      capture: captureTabViewport,
      memoryRepository,
      clock: systemClock,
    },
  );

  if (!saved.ok) {
    session.status = "ERROR";
    renderShellStatus(saved.error.message, "danger");
    setBusy(false);
    return;
  }

  contextHeading.textContent = session.context.anchor.heading || session.context.source.title;
  contextPreview.textContent = session.context.visibleText;

  const recalled = await memoryRepository.searchMemory({
    source: session.context.source,
    anchor: session.context.anchor,
    limit: 5,
  });
  if (recalled.ok) session.relatedMemories = recalled.data;
  delete session.pendingAction;
  agentProposalPanel.hidden = true;
  session.status = "READY_WITH_MEMORY";
  renderMemory(session);
  void refreshPrivacyMemoryState();
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
    void refreshPrivacyMemoryState();
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

  const suggestedAction = response.suggestedActions[0];
  if (suggestedAction && suggestedAction.type === "CONFIRM_MARKER") {
    agentProposalPanel.hidden = false;
    const statusLabel = formatMemoryStatus(suggestedAction.payload.status);
    const note = suggestedAction.payload.note || suggestedAction.confirmationText;
    agentProposalText.textContent = `Agent đề xuất: ${statusLabel} — ${note}`;
  } else {
    agentProposalPanel.hidden = true;
  }
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
  acceptProposalButton.disabled = busy || !session?.pendingAction;
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
