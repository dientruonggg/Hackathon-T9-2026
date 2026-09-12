import { z } from "zod";
import type { AppErrorCode } from "./common.js";
import { AppErrorCodeSchema, AppErrorSchema } from "./common.js";
import type { AppError } from "./common.js";
import { ViewportContextSchema } from "./context.js";
import type { ViewportContext } from "./context.js";
import { MemorySummarySchema, MemoryStatusSchema } from "./memory.js";
import type { MemorySummary, MemoryStatus } from "./memory.js";
import { SourcePolicyResultSchema } from "./source.js";
import type { SourcePolicyResult } from "./source.js";

export const SidebarStatusSchema = z.enum([
  "IDLE",
  "CHECKING_SOURCE",
  "BLOCKED",
  "CAPTURING",
  "READY",
  "ASKING",
  "READY_WITH_ANSWER",
  "SAVING",
  "READY_WITH_MEMORY",
  "ERROR"
]);
export type SidebarStatus = z.infer<typeof SidebarStatusSchema>;

export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(2000)
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const PendingUserActionSchema = z.object({
  id: z.string(),
  type: z.literal("CONFIRM_MARKER"),
  payload: z.object({
    status: MemoryStatusSchema,
    note: z.string().max(500).optional()
  }),
  confirmationText: z.string()
});
export type PendingUserAction = z.infer<typeof PendingUserActionSchema>;

export const ShortSessionSchema = z.object({
  sessionId: z.string(),
  tabId: z.number().int().nonnegative(),
  status: SidebarStatusSchema,
  policy: SourcePolicyResultSchema.optional(),
  context: ViewportContextSchema.optional(),
  relatedMemories: z.array(MemorySummarySchema).max(5),
  messages: z.array(ChatMessageSchema).max(10),
  pendingAction: PendingUserActionSchema.optional(),
  lastError: AppErrorSchema.optional()
});
export interface ShortSession {
  sessionId: string;
  tabId: number;
  status: SidebarStatus;
  policy?: SourcePolicyResult | undefined;
  context?: ViewportContext | undefined;
  relatedMemories: MemorySummary[];
  messages: ChatMessage[];
  pendingAction?: PendingUserAction | undefined;
  lastError?: AppError | undefined;
}

export const AgentPermissionsSchema = z.object({
  allowWebSearch: z.boolean()
});
export type AgentPermissions = z.infer<typeof AgentPermissionsSchema>;

export const AgentTurnRequestSchema = z.object({
  contractVersion: z.literal("0.1"),
  turnId: z.string(),
  question: z.string().min(1).max(2000),
  context: ViewportContextSchema,
  relatedMemories: z.array(MemorySummarySchema).max(5),
  history: z.array(ChatMessageSchema).max(10),
  permissions: AgentPermissionsSchema
});
export interface AgentTurnRequest {
  contractVersion: "0.1";
  turnId: string;
  question: string;
  context: ViewportContext;
  relatedMemories: MemorySummary[];
  history: ChatMessage[];
  permissions: AgentPermissions;
}

export const GroundingKindSchema = z.enum([
  "VIEWPORT",
  "MEMORY",
  "WEB",
  "INSUFFICIENT"
]);
export type GroundingKind = z.infer<typeof GroundingKindSchema>;

export const GroundingRefSchema = z.object({
  kind: z.enum(["VIEWPORT", "MEMORY", "WEB"]),
  refId: z.string(),
  label: z.string(),
  url: z.string().optional()
});
export interface GroundingRef {
  kind: Exclude<GroundingKind, "INSUFFICIENT">;
  refId: string;
  label: string;
  url?: string | undefined;
}

export const AgentToolNameSchema = z.enum([
  "get_viewport_context",
  "search_memory",
  "read_memory",
  "propose_marker",
  "search_web"
]);
export type AgentToolName = z.infer<typeof AgentToolNameSchema>;

export const ToolTraceEntrySchema = z.object({
  step: z.number().int().min(1),
  toolName: AgentToolNameSchema,
  status: z.enum(["SUCCESS", "ERROR"]),
  errorCode: AppErrorCodeSchema.optional()
});
export interface ToolTraceEntry {
  step: number;
  toolName: AgentToolName;
  status: "SUCCESS" | "ERROR";
  errorCode?: AppErrorCode | undefined;
}

export const AgentTurnResponseSchema = z.object({
  contractVersion: z.literal("0.1"),
  turnId: z.string(),
  answer: z.string().max(4000),
  grounding: GroundingKindSchema,
  groundingRefs: z.array(GroundingRefSchema),
  suggestedActions: z.array(PendingUserActionSchema).max(3),
  toolTrace: z.array(ToolTraceEntrySchema).max(10),
  model: z.object({
    provider: z.string(),
    name: z.string()
  })
});
export interface AgentTurnResponse {
  contractVersion: "0.1";
  turnId: string;
  answer: string;
  grounding: GroundingKind;
  groundingRefs: GroundingRef[];
  suggestedActions: PendingUserAction[];
  toolTrace: ToolTraceEntry[];
  model: {
    provider: string;
    name: string;
  };
}

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("viewport-learning-agent-api"),
  contractVersion: z.literal("0.1")
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
