import fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import type { LlmProvider } from "./providers/llm-provider.js";
import { type EnvConfig, loadEnvConfig } from "./config/env.js";
import { healthRoutes } from "./routes/health.js";
import { agentTurnRoutes } from "./routes/agent-turn.js";

export interface AppDependencies {
  provider?: LlmProvider | undefined;
  config?: EnvConfig | undefined;
}

export function buildApp(deps: AppDependencies = {}): FastifyInstance {
  const config = deps.config ?? loadEnvConfig();
  const app = fastify({ logger: false });

  // Register CORS with configured whitelist
  app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, or tests)
      if (!origin) {
        cb(null, true);
        return;
      }

      const isAllowed = config.corsOrigins.some((pattern) => {
        if (pattern === origin) return true;
        if (pattern.endsWith("*") && origin.startsWith(pattern.slice(0, -1))) return true;
        return false;
      });

      if (isAllowed) {
        cb(null, true);
      } else {
        cb(new Error(`CORS origin not allowed: ${origin}`), false);
      }
    }
  });

  // Register endpoints
  app.register(healthRoutes);
  if (deps.provider) {
    app.register(agentTurnRoutes, { provider: deps.provider });
  } else {
    app.register(agentTurnRoutes);
  }

  return app;
}
