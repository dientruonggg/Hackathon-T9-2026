// TODO(Agent 1 integration): bind these stable DOM seams to open/ask/memory pipelines
// after @vlc/contracts and @vlc/memory are available from Agent 3.

const statusMessage = document.querySelector<HTMLElement>("#status-message");
const sourceBadge = document.querySelector<HTMLElement>("#source-badge");

export function renderShellStatus(
  message: string,
  tone: "idle" | "success" | "danger" = "idle",
): void {
  if (statusMessage) {
    statusMessage.textContent = message;
    statusMessage.dataset.tone = tone;
  }

  if (sourceBadge) {
    sourceBadge.dataset.tone = tone;
  }
}

renderShellStatus("Đang kết nối với trang hiện tại…");
