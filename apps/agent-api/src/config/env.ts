import { z } from "zod";

const EnvSchema = z.object({
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 8787))
    .pipe(z.number().int().positive()),
  ALLOWED_ORIGIN_PREFIXES: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().optional().default("http://127.0.0.1:11434/v1"),
  OPENAI_MODEL: z.string().default("qwen3:8b"),
  OPENAI_TIMEOUT_MS: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 60_000))
    .pipe(z.number().int().positive()),
  OPENROUTER_HTTP_REFERER: z.string().optional(),
  OPENROUTER_APP_TITLE: z.string().optional()
});

export interface EnvConfig {
  apiHost: string;
  apiPort: number;
  corsOrigins: string[];
  openaiApiKey?: string | undefined;
  openaiBaseUrl: string;
  openaiModel: string;
  openaiTimeoutMs: number;
  openaiDefaultHeaders?: Record<string, string> | undefined;
}

export function loadEnvConfig(env: NodeJS.ProcessEnv = process.env): EnvConfig {
  const parsed = EnvSchema.parse(env);

  const corsValue =
    parsed.ALLOWED_ORIGIN_PREFIXES ??
    parsed.CORS_ORIGIN ??
    "moz-extension://*,http://localhost:*,http://127.0.0.1:*";
  const corsOrigins = corsValue.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const openaiDefaultHeaders: Record<string, string> = {};
  if (parsed.OPENROUTER_HTTP_REFERER) {
    openaiDefaultHeaders["HTTP-Referer"] = parsed.OPENROUTER_HTTP_REFERER;
  }
  if (parsed.OPENROUTER_APP_TITLE) {
    openaiDefaultHeaders["X-Title"] = parsed.OPENROUTER_APP_TITLE;
  }

  return {
    apiHost: parsed.API_HOST,
    apiPort: parsed.API_PORT,
    corsOrigins,
    openaiApiKey: parsed.OPENAI_API_KEY,
    openaiBaseUrl: parsed.OPENAI_BASE_URL,
    openaiModel: parsed.OPENAI_MODEL,
    openaiTimeoutMs: parsed.OPENAI_TIMEOUT_MS,
    ...(Object.keys(openaiDefaultHeaders).length === 0 ? {} : { openaiDefaultHeaders })
  };
}
