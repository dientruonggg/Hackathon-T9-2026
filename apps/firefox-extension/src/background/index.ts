export interface TabsLike {
  sendMessage(tabId: number, message: unknown): Promise<unknown>;
  executeScript(tabId: number, details: { file: string }): Promise<unknown>;
}

export type EnsureContentScriptResult =
  | { ok: true; injected: boolean }
  | { ok: false; error: { code: string; message: string; retryable: boolean } };

export async function ensureContentScriptOnTab(
  tabId: number,
  tabs: TabsLike = browser.tabs,
): Promise<EnsureContentScriptResult> {
  try {
    const initialRes = await tabs.sendMessage(tabId, { type: "PING_CONTENT_SCRIPT" }).catch(() => null);
    if (isRecord(initialRes) && initialRes.ok === true) {
      return { ok: true, injected: false };
    }
  } catch {
    // Proceed to inject
  }

  try {
    await tabs.executeScript(tabId, { file: "src/content/index.js" });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: {
        code: "INJECTION_FAILED",
        message: `Không thể nạp script vào trang: ${errorMsg}`,
        retryable: false,
      },
    };
  }

  try {
    const retryRes = await tabs.sendMessage(tabId, { type: "PING_CONTENT_SCRIPT" }).catch(() => null);
    if (isRecord(retryRes) && retryRes.ok === true) {
      return { ok: true, injected: true };
    }
  } catch {
    // Fall through to error
  }

  return {
    ok: false,
    error: {
      code: "CONTENT_SCRIPT_UNAVAILABLE",
      message: "Content script không phản hồi sau khi nạp vào trang.",
      retryable: true,
    },
  };
}

if (typeof browser !== "undefined") {
  browser.browserAction?.onClicked?.addListener(async (tab) => {
    if (typeof tab.windowId !== "number") return;

    try {
      await browser.sidebarAction.open();
    } catch (error: unknown) {
      console.error("[sidebar] Unable to open from browser action", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
    }
  });

  browser.runtime?.onMessage?.addListener((message: unknown) => {
    if (!isRecord(message) || typeof message.type !== "string") return undefined;

    if (message.type === "GET_ACTIVE_TAB") {
      return browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => ({
        id: tab?.id,
        url: tab?.url,
        title: tab?.title,
      }));
    }

    if (message.type === "ENSURE_CONTENT_SCRIPT") {
      const tabId = message.tabId;
      if (typeof tabId !== "number") {
        return Promise.resolve({
          ok: false,
          error: { code: "VALIDATION_ERROR", message: "Thiếu tabId hợp lệ.", retryable: false },
        });
      }
      return ensureContentScriptOnTab(tabId);
    }

    return undefined;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
