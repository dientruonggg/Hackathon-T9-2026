import { z } from "zod";

export const CONTRACT_VERSION = "0.1" as const;
export type ContractVersion = typeof CONTRACT_VERSION;
export type IsoTimestamp = string;

export const AppErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "SOURCE_BLOCKED",
  "SOURCE_UNSUPPORTED",
  "NO_READABLE_CONTENT",
  "CONTEXT_STALE",
  "MEMORY_NOT_FOUND",
  "MEMORY_WRITE_FAILED",
  "PERMISSION_DENIED",
  "AGENT_UNAVAILABLE",
  "AGENT_MAX_STEPS",
  "MODEL_ERROR",
  "NETWORK_ERROR",
  "TOOL_NOT_FOUND",
  "TOOL_EXECUTION_ERROR",
  "INTERNAL_ERROR"
]);
export type AppErrorCode = z.infer<typeof AppErrorCodeSchema>;

export const AppErrorSchema = z.object({
  code: AppErrorCodeSchema,
  message: z.string(),
  retryable: z.boolean(),
  details: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional()
});
export type AppError = z.infer<typeof AppErrorSchema>;

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError };
