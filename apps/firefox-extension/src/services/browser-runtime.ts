import type {
  CaptureViewportInput,
  HighlightOrResumeInput,
  HighlightOrResumeOutput,
  Result,
  ViewportContext,
} from "@vlc/contracts";
import {
  createBrowserStorageMemoryRepository,
  type Clock,
  type IdGenerator,
  type MemoryRepository,
  type StorageAreaLike,
  type ExclusiveLock,
} from "@vlc/memory";
import {
  isAppError,
  isHighlightOrResumeOutput,
  isViewportContext,
} from "./contract-guards";

export interface ActiveTabInfo {
  id: number;
  url: string;
  title?: string;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export const browserIdGenerator: IdGenerator = {
  createId: () =>
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `vlc-${Date.now()}-${Math.random().toString(16).slice(2)}`,
};

const storageAdapter: StorageAreaLike = {
  get: async (keys) => browser.storage.local.get(keys ?? null),
  set: async (items) => browser.storage.local.set(items),
  remove: async (keys) => browser.storage.local.remove(keys),
};

const markerLock: ExclusiveLock = {
  run: (operation) => navigator.locks.request("vlc:markers:v1", operation),
};

export const memoryRepository: MemoryRepository =
  createBrowserStorageMemoryRepository(storageAdapter, systemClock, browserIdGenerator, markerLock);

export interface BrowserRuntimeServices {
  sendTabMessage?: (tabId: number, message: unknown) => Promise<unknown>;
  sendRuntimeMessage?: (message: unknown) => Promise<unknown>;
}

export async function getActiveTab(
  services?: BrowserRuntimeServices,
): Promise<Result<ActiveTabInfo>> {
  const sendRuntime = services?.sendRuntimeMessage ?? ((msg) => browser.runtime.sendMessage(msg));
  try {
    const response: unknown = await sendRuntime({ type: "GET_ACTIVE_TAB" });
    if (!isRecord(response) || !Number.isInteger(response.id) || typeof response.url !== "string") {
      return failure("PERMISSION_DENIED", "Không đọc được tab Firefox hiện tại.", false);
    }
    return {
      ok: true,
      data: {
        id: response.id as number,
        url: response.url,
        ...(typeof response.title === "string" ? { title: response.title } : {}),
      },
    };
  } catch {
    return failure("PERMISSION_DENIED", "Không kết nối được với tab Firefox hiện tại.", true);
  }
}

export async function captureTabViewport(
  input: CaptureViewportInput,
  services?: BrowserRuntimeServices,
): Promise<Result<ViewportContext>> {
  const sendTab = services?.sendTabMessage ?? ((tabId, msg) => browser.tabs.sendMessage(tabId, msg));
  const sendRuntime = services?.sendRuntimeMessage ?? ((msg) => browser.runtime.sendMessage(msg));

  let response: unknown;
  let initialSendError: unknown = null;

  try {
    response = await sendTab(input.tabId, {
      type: "CAPTURE_CURRENT_VIEWPORT",
      payload: input,
    });
  } catch (err) {
    initialSendError = err;
  }

  // If initial send failed, tab might not have content script injected yet.
  if (initialSendError !== null) {
    let ensureResult: unknown;
    try {
      ensureResult = await sendRuntime({
        type: "ENSURE_CONTENT_SCRIPT",
        tabId: input.tabId,
      });
    } catch (runtimeErr) {
      return failure(
        "INTERNAL_ERROR",
        `Không thể kết nối với background script: ${safeErrorMessage(runtimeErr)}`,
        true,
      );
    }

    if (isRecord(ensureResult) && ensureResult.ok === false) {
      const errObj = isRecord(ensureResult.error) ? ensureResult.error : {};
      const code = typeof errObj.code === "string" ? errObj.code : "INJECTION_FAILED";
      const message = typeof errObj.message === "string" ? errObj.message : "Nạp content script thất bại.";
      const retryable = typeof errObj.retryable === "boolean" ? errObj.retryable : false;
      return failure(
        code === "INJECTION_FAILED" ? "PERMISSION_DENIED" : "INTERNAL_ERROR",
        message,
        retryable,
      );
    }

    // Retry capture after handshake ensures content script is ready
    try {
      response = await sendTab(input.tabId, {
        type: "CAPTURE_CURRENT_VIEWPORT",
        payload: input,
      });
    } catch (retryErr) {
      return failure(
        "PERMISSION_DENIED",
        `Không thể đọc trang sau khi nạp script: ${safeErrorMessage(retryErr)}`,
        false,
      );
    }
  }

  if (!isRecord(response) || typeof response.ok !== "boolean") {
    return failure("INTERNAL_ERROR", "Content script trả phản hồi capture không hợp lệ.", false);
  }
  if (!response.ok) return parseRemoteError(response.error);

  return isViewportContext(response.data)
    ? { ok: true, data: response.data }
    : failure("VALIDATION_ERROR", "Viewport context không đúng contract.", false);
}

export async function resumeTabAtMarker(
  input: HighlightOrResumeInput,
  services?: BrowserRuntimeServices,
): Promise<Result<HighlightOrResumeOutput>> {
  const sendTab = services?.sendTabMessage ?? ((tabId, msg) => browser.tabs.sendMessage(tabId, msg));
  try {
    const response: unknown = await sendTab(input.tabId, {
      type: "HIGHLIGHT_OR_RESUME",
      payload: input,
    });
    if (!isRecord(response) || typeof response.ok !== "boolean") {
      return failure("INTERNAL_ERROR", "Content script trả phản hồi resume không hợp lệ.", false);
    }
    if (!response.ok) return parseRemoteError(response.error);

    return isHighlightOrResumeOutput(response.data)
      ? { ok: true, data: response.data }
      : failure("VALIDATION_ERROR", "Kết quả resume không đúng contract.", false);
  } catch (err) {
    return failure(
      "PERMISSION_DENIED",
      `Không thể quay lại dấu mốc trên tab hiện tại: ${safeErrorMessage(err)}`,
      true,
    );
  }
}

function safeErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return sanitizeText(err.message);
  }
  if (typeof err === "string") {
    return sanitizeText(err);
  }
  return "Lỗi kết nối không xác định";
}

function sanitizeText(str: string): string {
  return str.replace(/https?:\/\/[^\s]+/g, (url) => {
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.hostname}${u.pathname}`;
    } catch {
      return "[url]";
    }
  });
}

function parseRemoteError(value: unknown): Result<never> {
  return isAppError(value)
    ? { ok: false, error: value }
    : failure("INTERNAL_ERROR", "Content script trả lỗi không đúng contract.", false);
}

function failure(
  code: "PERMISSION_DENIED" | "INTERNAL_ERROR" | "VALIDATION_ERROR",
  message: string,
  retryable: boolean,
): Result<never> {
  return { ok: false, error: { code, message, retryable } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
