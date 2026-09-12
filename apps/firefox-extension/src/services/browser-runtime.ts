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

export const memoryRepository: MemoryRepository =
  createBrowserStorageMemoryRepository(storageAdapter, systemClock, browserIdGenerator);

export async function getActiveTab(): Promise<Result<ActiveTabInfo>> {
  try {
    const response: unknown = await browser.runtime.sendMessage({ type: "GET_ACTIVE_TAB" });
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
): Promise<Result<ViewportContext>> {
  try {
    let response: unknown;
    try {
      response = await requestViewportCapture(input);
    } catch {
      // web-ext can open the start URL before the temporary add-on finishes
      // installing. Inject once on the explicit sidebar action, then retry.
      await browser.tabs.executeScript(input.tabId, {
        file: "src/content/index.js",
      });
      response = await requestViewportCapture(input);
    }
    if (!isRecord(response) || typeof response.ok !== "boolean") {
      return failure("INTERNAL_ERROR", "Content script trả phản hồi capture không hợp lệ.", false);
    }
    if (!response.ok) return parseRemoteError(response.error);

    return isViewportContext(response.data)
      ? { ok: true, data: response.data }
      : failure("VALIDATION_ERROR", "Viewport context không đúng contract.", false);
  } catch {
    return failure(
      "PERMISSION_DENIED",
      "Không thể đọc trang này. Hãy thử một bài viết HTML thông thường.",
      false,
    );
  }
}

function requestViewportCapture(input: CaptureViewportInput): Promise<unknown> {
  return browser.tabs.sendMessage(input.tabId, {
    type: "CAPTURE_CURRENT_VIEWPORT",
    payload: input,
  });
}

export async function resumeTabAtMarker(
  input: HighlightOrResumeInput,
): Promise<Result<HighlightOrResumeOutput>> {
  try {
    const response: unknown = await browser.tabs.sendMessage(input.tabId, {
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
  } catch {
    return failure("PERMISSION_DENIED", "Không thể quay lại dấu mốc trên tab hiện tại.", true);
  }
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
