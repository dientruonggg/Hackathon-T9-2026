
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
  MemorySummary,
  ShortSession,
} from "@vlc/contracts";
import { checkSourcePolicy } from "../policy/check-source-policy";
import { runAskAgentPipeline } from "../pipeline/ask-agent-pipeline";
import { executeConfirmedMemoryWithRecapture } from "../pipeline/confirmed-memory-command";
import { runOpenSidebarPipeline } from "../pipeline/open-sidebar-pipeline";
import { canonicalTabUrl, createContextGeneration } from "./active-tab-context";
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
const groundingSources = requireElement<HTMLElement>("#grounding-sources");
const noteInput = requireElement<HTMLTextAreaElement>("#memory-note-input");
const agentProposalPanel = requireElement<HTMLElement>("#agent-proposal-panel");
const agentProposalText = requireElement<HTMLElement>("#agent-proposal-text");
const acceptProposalButton = requireElement<HTMLButtonElement>("#accept-proposal-button");
const refreshContextButton = requireElement<HTMLButtonElement>("#refresh-context-button");
const markerButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-memory-status]"),
);

let session: ShortSession | undefined;
let busy = false;
const contextGeneration = createContextGeneration();

browser.tabs.onActivated.addListener(() => { if (!document.hidden) void syncActiveTab(); });
browser.tabs.onUpdated.addListener((tabId, change) => {
  if (!document.hidden && (!session || tabId === session.tabId) &&
      (change.url !== undefined || change.status === "complete")) void syncActiveTab();
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void syncActiveTab();
});

refreshContextButton.addEventListener("click", () => {
  void refreshViewportContext();
});

const currentDomainLabel = requireElement<HTMLSpanElement>("#current-domain-label");
const blockCurrentDomainButton = requireElement<HTMLButtonElement>("#block-current-domain-button");
const blockedDomainsList = requireElement<HTMLUListElement>("#blocked-domains-list");
const emptyBlockedDomains = requireElement<HTMLParagraphElement>("#empty-blocked-domains");
const pageMarkersList = requireElement<HTMLUListElement>("#page-markers-list");
const emptyPageMarkers = requireElement<HTMLParagraphElement>("#empty-page-markers");

blockCurrentDomainButton.addEventListener("click", async () => {
  if (!session?.context || busy) return;
  setBusy(true);
  const bound = await bindActiveSession();
  if (!bound.ok || bound.changed || !session?.context) {
    if (bound.ok) {
      renderShellStatus("Trang đã đổi. Kiểm tra domain rồi bấm chặn lại.", "danger");
      setBusy(false);
    }
    return;
  }
  const requestSession = session;
  const result = await blockCurrentDomain({ domain: requestSession.context!.source.hostname || requestSession.context!.source.canonicalUrl, userConfirmed: true }, { memoryRepository });
  if (!(await stillOnBoundPage(requestSession, bound.generation))) return;
  if (result.ok) {
    renderShellStatus("Đã chặn website này.", "success");
    blockCurrentDomainButton.disabled = true;
    await refreshPrivacyMemoryState();
    void syncActiveTab();
  } else {
    renderShellStatus("Lỗi khi chặn website.", "danger");
  }
  setBusy(false);
});

async function refreshPrivacyMemoryState() {
  const current = session;
  if (!current?.context) return;
  const result = await loadPrivacyMemoryState({
    currentDomain: current.context.source.hostname || current.context.source.canonicalUrl,
    relatedMemories: current.relatedMemories
  }, { memoryRepository });
  if (session === current && result.ok) {
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
      resumeBtn.onclick = () => { void resumeMemory(mem); };

      const delBtn = document.createElement("button");
      delBtn.textContent = "Xóa";
      delBtn.className = "text-button";
      delBtn.onclick = async () => {
        if (busy) return;
        setBusy(true);
        const bound = await bindActiveSession();
        if (!bound.ok || bound.changed || !session?.relatedMemories.some(item => item.id === mem.id)) {
          if (bound.ok) {
            renderShellStatus("Trang đã đổi. Kiểm tra mốc rồi bấm xóa lại.", "danger");
            setBusy(false);
          }
          return;
        }
        if (!confirm("Bạn có chắc muốn xóa dấu mốc này?")) { setBusy(false); return; }
        const requestSession = session;
        const res = await forgetConfirmedMarker({ memoryId: mem.id, userConfirmed: true }, { memoryRepository });
        if (!(await stillOnBoundPage(requestSession, bound.generation))) return;
        if (res.ok && res.data.deletedCount === 1) {
          requestSession.relatedMemories = requestSession.relatedMemories.filter(item => item.id !== mem.id);
          renderMemory(requestSession);
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
  await syncActiveTab();
}

async function syncActiveTab(): Promise<void> {
  const generation = contextGeneration.next();
  session = undefined;
  clearPagePanels();
  sourceBadge.textContent = "Đang kiểm tra";
  sourceBadge.dataset.tone = "idle";
  contextHeading.textContent = "Đang đọc trang hiện tại…";
  contextPreview.textContent = "";
  renderShellStatus("Đang chuyển ngữ cảnh sang tab hiện tại…");
  setBusy(true);
  await bindActiveSession(generation);
  if (contextGeneration.isCurrent(generation)) setBusy(false);
}

async function bindActiveSession(generation = contextGeneration.next()): Promise<{ ok: true; changed: boolean; generation: number } | { ok: false }> {
  const active = await getActiveTab();
  if (!contextGeneration.isCurrent(generation)) return { ok: false };
  if (!active.ok) {
    renderFatalError(active.error.message);
    return { ok: false };
  }
  const opened = await runOpenSidebarPipeline(
    { tabId: active.data.id, url: active.data.url,
      ...(active.data.title === undefined ? {} : { title: active.data.title }) },
    { getPolicySettings: () => memoryRepository.getSourcePolicySettings(),
      checkPolicy: checkSourcePolicy, capture: captureTabViewport,
      memoryRepository, clock: systemClock, idGenerator: browserIdGenerator },
  );
  if (!contextGeneration.isCurrent(generation)) return { ok: false };
  if (!opened.ok) {
    session = undefined;
    clearPagePanels();
    renderFatalError(opened.error.message);
    return { ok: false };
  }
  const previous = session;
  const next = opened.data.session;
  const changed = !previous || previous.tabId !== next.tabId ||
    previous.context?.source.canonicalUrl !== next.context?.source.canonicalUrl ||
    previous.policy?.safeUrl !== next.policy?.safeUrl;
  if (!changed && previous) {
    next.messages = previous.messages;
    if (previous.pendingAction) next.pendingAction = previous.pendingAction;
  } else {
    clearPagePanels();
    noteInput.value = "";
  }
  session = next;
  renderSession(next);
  return { ok: true, changed, generation };
}

async function stillOnBoundPage(bound: ShortSession, generation: number): Promise<boolean> {
  const active = await getActiveTab();
  return contextGeneration.isCurrent(generation) && active.ok && session === bound &&
    active.data.id === bound.tabId &&
    canonicalTabUrl(active.data.url) === bound.context?.source.canonicalUrl;
}

function clearPagePanels(): void {
  answerPanel.hidden = true;
  agentProposalPanel.hidden = true;
  memoryCard.hidden = true;
  pageMarkersList.replaceChildren();
  emptyPageMarkers.hidden = false;
  groundingSources.textContent = "";
}

async function askCurrentContext(): Promise<void> {
  if (busy) return;
  const question = questionInput.value.trim();
  if (!question) {
    renderShellStatus("Hãy nhập một câu hỏi về đoạn đang thấy.", "danger");
    return;
  }

  setBusy(true);
  const bound = await bindActiveSession();
  if (!bound.ok || !session?.context || session.policy?.decision !== "ALLOW") {
    if (bound.ok) setBusy(false);
    return;
  }
  const requestSession = session;
  requestSession.status = "ASKING";
  renderShellStatus("Agent đang đọc context và suy nghĩ…");

  const response = await runAskAgentPipeline(
    { question, session: requestSession },
    {
      capture: captureTabViewport,
      requestAgentTurn,
      clock: systemClock,
      idGenerator: browserIdGenerator,
      memoryRepository,
    },
  );

  if (!(await stillOnBoundPage(requestSession, bound.generation))) return;

  if (!response.ok) {
    requestSession.status = requestSession.relatedMemories.length > 0 ? "READY_WITH_MEMORY" : "READY";
    renderShellStatus(response.error.message, "danger");
    setBusy(false);
    return;
  }

  // Cập nhật giao diện vị trí mới nhất đã recapture
  if (requestSession.context) {
    contextHeading.textContent = requestSession.context.anchor.heading || requestSession.context.source.title;
    contextPreview.textContent = requestSession.context.visibleText;
    renderMemory(requestSession);
  }

  const nextMessages: ChatMessage[] = [
    ...requestSession.messages,
    { role: "user", content: question },
    { role: "assistant", content: response.data.answer.slice(0, 2000) },
  ];
  requestSession.messages = nextMessages.slice(-10);
  const suggestedAction = response.data.suggestedActions[0];
  if (suggestedAction) requestSession.pendingAction = suggestedAction;
  else delete requestSession.pendingAction;
  requestSession.status = "READY_WITH_ANSWER";
  questionInput.value = "";
  renderAnswer(response.data);
  renderShellStatus("Câu trả lời dựa trên viewport và tối đa 5 mốc đã xác nhận từ website được phép.", "success");
  setBusy(false);
}

async function refreshViewportContext(): Promise<void> {
  if (busy) return;
  setBusy(true);
  const bound = await bindActiveSession();
  if (bound.ok) {
    renderShellStatus("Đã cập nhật trang và vị trí hiện tại.", "success");
    setBusy(false);
  }
}

async function saveMarker(status: MemoryStatus): Promise<void> {
  if (!session?.context || busy) return;
  setBusy(true);
  const bound = await bindActiveSession();
  if (!bound.ok || !session?.context || session.policy?.decision !== "ALLOW") {
    if (bound.ok) setBusy(false);
    return;
  }
  if (bound.changed) {
    renderShellStatus("Trang đã đổi. Hãy xem lại nội dung rồi bấm lưu lần nữa.", "danger");
    setBusy(false);
    return;
  }
  const requestSession = session;
  requestSession.status = "SAVING";
  renderShellStatus("Đang lưu dấu mốc vào Firefox…");

  const suggestedNote =
    requestSession.pendingAction?.payload.status === status
      ? requestSession.pendingAction.payload.note
      : undefined;
  const note = noteInput.value.trim().slice(0, 500) || suggestedNote;

  const saved = await executeConfirmedMemoryWithRecapture(
    {
      status,
      session: requestSession,
      userConfirmed: true,
      ...(note ? { note } : {}),
    },
    {
      capture: captureTabViewport,
      memoryRepository,
      clock: systemClock,
    },
  );

  if (!(await stillOnBoundPage(requestSession, bound.generation))) return;

  if (!saved.ok) {
    requestSession.status = "ERROR";
    renderShellStatus(saved.error.message, "danger");
    setBusy(false);
    return;
  }

  contextHeading.textContent = requestSession.context!.anchor.heading || requestSession.context!.source.title;
  contextPreview.textContent = requestSession.context!.visibleText;

  const recalled = await memoryRepository.searchMemory({
    source: requestSession.context!.source,
    anchor: requestSession.context!.anchor,
    limit: 5,
  });
  if (!(await stillOnBoundPage(requestSession, bound.generation))) return;
  if (recalled.ok) requestSession.relatedMemories = recalled.data;
  delete requestSession.pendingAction;
  agentProposalPanel.hidden = true;
  requestSession.status = "READY_WITH_MEMORY";
  noteInput.value = "";
  renderMemory(requestSession);
  void refreshPrivacyMemoryState();
  renderShellStatus(`Đã lưu trên Firefox • revision ${saved.data.revision}`, "success");
  setBusy(false);
}

async function resumeFirstMemory(): Promise<void> {
  await resumeMemory(session?.relatedMemories[0]);
}

async function resumeMemory(memory: MemorySummary | undefined): Promise<void> {
  if (!memory || busy) return;
  setBusy(true);
  const bound = await bindActiveSession();
  if (!bound.ok || bound.changed || !session?.context ||
      !session.relatedMemories.some(item => item.id === memory.id)) {
    if (bound.ok) {
      renderShellStatus("Trang đã đổi. Hãy kiểm tra mốc rồi bấm lại.", "danger");
      setBusy(false);
    }
    return;
  }
  const requestSession = session;
  const resumed = await resumeTabAtMarker({
    tabId: requestSession.tabId,
    expectedCanonicalUrl: memory.source.canonicalUrl,
    anchor: memory.anchor,
  });
  if (!(await stillOnBoundPage(requestSession, bound.generation))) return;
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
    clearPagePanels();
    contextHeading.textContent = "Trang này nằm ngoài phạm vi demo";
    contextPreview.textContent = value.policy?.userMessage ?? "Extension không đọc nguồn này.";
    renderShellStatus(contextPreview.textContent, "danger");
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
  const sources = response.groundingRefs.map(ref => {
    let hostname = "";
    if (ref.url) {
      try { hostname = new URL(ref.url).hostname; } catch { /* invalid source URL */ }
    }
    const kind = ref.kind === "MEMORY" ? "Mốc đã lưu" : ref.kind === "WEB" ? "Web" : "Trang hiện tại";
    return `${kind}: ${ref.label}${hostname ? ` (${hostname})` : ""}`;
  });
  groundingSources.textContent = sources.length > 0
    ? `Nguồn được truy hồi: ${sources.join(" • ")}`
    : "Không có nguồn được truy hồi.";

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
  refreshContextButton.disabled = busy;
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
