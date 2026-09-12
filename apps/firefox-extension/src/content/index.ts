import { captureCurrentViewport } from "./capture-current-viewport";
import { highlightOrResume } from "./highlight-or-resume";

interface VlcContentWindow {
  __VLC_CONTENT_SCRIPT_LOADED__?: boolean;
}

const contentWindow = (typeof window !== "undefined" ? window : globalThis) as unknown as VlcContentWindow;

if (!contentWindow.__VLC_CONTENT_SCRIPT_LOADED__) {
  contentWindow.__VLC_CONTENT_SCRIPT_LOADED__ = true;

  browser.runtime.onMessage.addListener((message: unknown) => {
    if (!isRecord(message) || typeof message.type !== "string") return undefined;

    if (message.type === "PING_CONTENT_SCRIPT") {
      return Promise.resolve({ ok: true, pong: true });
    }

    if (message.type === "CAPTURE_CURRENT_VIEWPORT") {
      return captureCurrentViewport(message.payload);
    }

    if (message.type === "HIGHLIGHT_OR_RESUME") {
      return highlightOrResume(message.payload);
    }

    return undefined;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

