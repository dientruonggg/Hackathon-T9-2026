import { captureCurrentViewport } from "./capture-current-viewport";
import { highlightOrResume } from "./highlight-or-resume";

browser.runtime.onMessage.addListener((message: unknown) => {
  if (!isRecord(message) || typeof message.type !== "string") return undefined;

  if (message.type === "CAPTURE_CURRENT_VIEWPORT") {
    return captureCurrentViewport(message.payload);
  }

  if (message.type === "HIGHLIGHT_OR_RESUME") {
    return highlightOrResume(message.payload);
  }

  return undefined;
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
