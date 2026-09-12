import { spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import process from "node:process";

type CheckStatus = "PASS" | "FAIL" | "SKIPPED_OPTIONAL";

interface CheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
  durationMs: number;
}

interface ModelListResponse {
  data?: Array<{ id?: string }>;
}

interface ChatCompletionResponse {
  model?: string;
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string | null;
      tool_calls?: Array<{ function?: { name?: string } }>;
    };
  }>;
}

// Keep the local Ollama smoke independent from the provider selected for Agent API.
// OPENAI_MODEL can be an OpenRouter slug that does not exist in local Ollama.
const requiredOllamaModel = process.env.DEMO_OLLAMA_MODEL?.trim() || "qwen3:8b";
const requireLocalOllama =
  process.env.DEMO_REQUIRE_LOCAL_OLLAMA?.trim().toLowerCase() !== "false";
const ollamaBaseUrl = normalizeBaseUrl(
  process.env.DEMO_OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1",
);
const agentApiBaseUrl = normalizeBaseUrl(
  process.env.DEMO_AGENT_API_BASE_URL || "http://127.0.0.1:8787",
);
const tunnelBaseUrl = process.env.TUNNEL_BASE_URL?.trim()
  ? normalizeBaseUrl(process.env.TUNNEL_BASE_URL)
  : undefined;

const results: CheckResult[] = [];

await runCheck("runtime.node", async () => {
  const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  if (major < 22) throw new Error(`Node ${process.versions.node}; cần Node >=22`);
  return `Node ${process.versions.node}`;
});

await runCheck("runtime.npm", async () => {
  const userAgent = process.env.npm_config_user_agent || "";
  const match = /npm\/(\d+(?:\.\d+)*)/.exec(userAgent);
  if (!match?.[1]) throw new Error("Hãy chạy script bằng npm run demo:preflight");
  const major = Number.parseInt(match[1].split(".")[0] ?? "0", 10);
  if (major < 10) throw new Error(`npm ${match[1]}; cần npm >=10`);
  return `npm ${match[1]}`;
});

await runCheck("project.verify", async () => {
  const npmCliPath = process.env.npm_execpath;
  if (!npmCliPath) throw new Error("Không xác định được npm CLI path");
  const child = spawnSync(process.execPath, [npmCliPath, "run", "verify"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe",
    timeout: 120_000,
  });

  if (child.error) throw child.error;
  if (child.status !== 0) {
    const tail = `${child.stdout ?? ""}\n${child.stderr ?? ""}`
      .trim()
      .split(/\r?\n/)
      .slice(-8)
      .join(" | ");
    throw new Error(`npm run verify exit ${child.status ?? "unknown"}: ${tail}`);
  }
  await access("apps/firefox-extension/dist/manifest.json");
  return "typecheck + tests + builds + web-ext lint; dist/manifest.json exists";
});

if (requireLocalOllama) {
  await runCheck("ollama.models", async () => {
    const payload = await fetchJson<ModelListResponse>(`${ollamaBaseUrl}/models`, 15_000);
    const models = payload.data?.flatMap((item) => (item.id ? [item.id] : [])) ?? [];
    if (!models.includes(requiredOllamaModel)) {
      throw new Error(`Không có ${requiredOllamaModel}; models=${models.join(",") || "none"}`);
    }
    return `${requiredOllamaModel} available`;
  });

  await runCheck("ollama.tool_call", async () => {
    const payload = await callToolSmoke(ollamaBaseUrl, requiredOllamaModel, 180_000);
    const toolName = payload.choices?.[0]?.message?.tool_calls?.[0]?.function?.name;
    if (toolName !== "get_viewport_context") {
      throw new Error(`Expected get_viewport_context; received ${toolName || "no tool call"}`);
    }
    return `model=${payload.model || requiredOllamaModel}; tool=${toolName}`;
  });
} else {
  results.push({
    name: "ollama.local",
    status: "SKIPPED_OPTIONAL",
    detail: "DEMO_REQUIRE_LOCAL_OLLAMA=false; using tunnel provider",
    durationMs: 0,
  });
}

await runCheck("agent_api.health", async () => {
  const payload = await fetchJson<Record<string, unknown>>(`${agentApiBaseUrl}/health`, 10_000);
  if (payload.status !== "ok" || payload.contractVersion !== "0.1") {
    throw new Error("Health response không đúng contractVersion 0.1");
  }
  return "status=ok; contractVersion=0.1";
});

if (tunnelBaseUrl) {
  await runCheck("tunnel.models", async () => {
    const payload = await fetchJson<ModelListResponse>(`${tunnelBaseUrl}/models`, 30_000);
    const models = payload.data?.flatMap((item) => (item.id ? [item.id] : [])) ?? [];
    if (!models.includes(requiredOllamaModel)) throw new Error(`Tunnel thiếu ${requiredOllamaModel}`);
    return `${requiredOllamaModel} available`;
  });

  await runCheck("tunnel.inference", async () => {
    const payload = await fetchJson<ChatCompletionResponse>(
      `${tunnelBaseUrl}/chat/completions`,
      180_000,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: requiredOllamaModel,
          messages: [{ role: "user", content: "Reply with exactly TUNNEL_OK" }],
          stream: false,
        }),
      },
    );
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (content !== "TUNNEL_OK") throw new Error("Tunnel inference không trả TUNNEL_OK");
    return `model=${payload.model || requiredOllamaModel}; response=TUNNEL_OK`;
  });
} else {
  results.push({
    name: "tunnel",
    status: "SKIPPED_OPTIONAL",
    detail: "TUNNEL_BASE_URL is not configured",
    durationMs: 0,
  });
}

printSummary(results);
if (results.some((result) => result.status === "FAIL")) process.exitCode = 1;

async function runCheck(name: string, check: () => Promise<string>): Promise<void> {
  const startedAt = performance.now();
  try {
    const detail = await check();
    results.push({
      name,
      status: "PASS",
      detail,
      durationMs: Math.round(performance.now() - startedAt),
    });
  } catch (error: unknown) {
    results.push({
      name,
      status: "FAIL",
      detail: safeErrorMessage(error),
      durationMs: Math.round(performance.now() - startedAt),
    });
  }
}

async function callToolSmoke(
  baseUrl: string,
  model: string,
  timeoutMs: number,
): Promise<ChatCompletionResponse> {
  return fetchJson<ChatCompletionResponse>(`${baseUrl}/chat/completions`, timeoutMs, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Call get_viewport_context once, then stop." }],
      tools: [
        {
          type: "function",
          function: {
            name: "get_viewport_context",
            description: "Read the already-sanitized current viewport context",
            parameters: { type: "object", properties: {}, additionalProperties: false },
          },
        },
      ],
      tool_choice: "auto",
      stream: false,
    }),
  });
}

async function fetchJson<T>(
  url: string,
  timeoutMs: number,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "TimeoutError") return "Timed out";
    return error.message.slice(0, 300);
  }
  return "Unknown error";
}

function printSummary(checks: readonly CheckResult[]): void {
  console.log("\nViewport Learning Companion — demo preflight\n");
  for (const check of checks) {
    console.log(
      `${check.status.padEnd(16)} ${check.name.padEnd(22)} ${String(check.durationMs).padStart(6)} ms  ${check.detail}`,
    );
  }
  const passed = checks.filter((check) => check.status === "PASS").length;
  const failed = checks.filter((check) => check.status === "FAIL").length;
  const skipped = checks.filter((check) => check.status === "SKIPPED_OPTIONAL").length;
  console.log(`\nSummary: ${passed} pass, ${failed} fail, ${skipped} optional skipped.`);
}
