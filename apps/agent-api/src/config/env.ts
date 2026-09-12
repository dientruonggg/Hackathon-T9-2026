import { z } from "zod";

const EnvSchema = z.object({
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 8000))
    .pipe(z.number().int().positive()),
  CORS_ORIGIN: z.string().default("moz-extension://*,http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().optional().default("https://api.openai.com/v1"),
  OPENAI_MODEL: z.string().default("openai/gpt-4o-mini")
});

export interface EnvConfig {
  apiHost: string;
  apiPort: number;
  corsOrigins: string[];
  openaiApiKey?: string | undefined;
  openaiBaseUrl: string;
  openaiModel: string;
}

export function loadEnvConfig(env: NodeJS.ProcessEnv = process.env): EnvConfig {
  const parsed = EnvSchema.parse(env);

  const corsOrigins = parsed.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    apiHost: parsed.API_HOST,
    apiPort: parsed.API_PORT,
    corsOrigins,
    openaiApiKey: parsed.OPENAI_API_KEY,
    openaiBaseUrl: parsed.OPENAI_BASE_URL,
    openaiModel: parsed.OPENAI_MODEL
  };
}
