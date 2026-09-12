browser.browserAction.onClicked.addListener(async (tab) => {
  if (typeof tab.windowId !== "number") return;

  try {
    await browser.sidebarAction.open();
  } catch (error: unknown) {
    console.error("[sidebar] Unable to open from browser action", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
  }
});

browser.runtime.onMessage.addListener((message: unknown) => {
  if (!isRecord(message) || message.type !== "GET_ACTIVE_TAB") return undefined;

  return browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => ({
    id: tab?.id,
    url: tab?.url,
    title: tab?.title,
  }));
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
