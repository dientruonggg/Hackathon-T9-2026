import { loadEnvConfig } from "./config/env.js";
import { createOpenAICompatibleProvider } from "./providers/openai-compatible-provider.js";
import { buildApp } from "./app.js";

async function startServer(): Promise<void> {
  const config = loadEnvConfig();

  const provider = createOpenAICompatibleProvider({
    apiKey: config.openaiApiKey,
    baseURL: config.openaiBaseUrl,
    model: config.openaiModel
  });

  const app = buildApp({ config, provider });

  try {
    const address = await app.listen({
      port: config.apiPort,
      host: config.apiHost
    });
    console.log(`[Agent API] Server listening at ${address}`);
  } catch (err) {
    console.error("[Agent API] Failed to start server:", err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== "test") {
  startServer();
}
