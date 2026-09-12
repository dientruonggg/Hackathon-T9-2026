import { z } from "zod";
import { MemoryStatusSchema } from "./memory.js";
import type { MemoryStatus, MemorySummary } from "./memory.js";
import { ViewportContextSchema } from "./context.js";
import type { ViewportContext } from "./context.js";
import { PendingUserActionSchema } from "./agent-api.js";
import type { PendingUserAction } from "./agent-api.js";

export const GetViewportContextToolInputSchema = z.object({});
export type GetViewportContextToolInput = z.infer<typeof GetViewportContextToolInputSchema>;
export type GetViewportContextToolOutput = ViewportContext;

export const SearchMemoryToolInputSchema = z.object({
  query: z.string(),
  status: MemoryStatusSchema.optional(),
  limit: z.number().int().min(1).max(5).optional()
});
export type SearchMemoryToolInput = z.infer<typeof SearchMemoryToolInputSchema>;
export type SearchMemoryToolOutput = MemorySummary[];

export const ReadMemoryToolInputSchema = z.object({
  memoryId: z.string()
});
export type ReadMemoryToolInput = z.infer<typeof ReadMemoryToolInputSchema>;
export type ReadMemoryToolOutput = MemorySummary | null;

export const ProposeMarkerToolInputSchema = z.object({
  status: MemoryStatusSchema,
  note: z.string().max(500).optional(),
  reason: z.string().max(500)
});
export type ProposeMarkerToolInput = z.infer<typeof ProposeMarkerToolInputSchema>;
export type ProposeMarkerToolOutput = PendingUserAction;

export const SearchWebToolInputSchema = z.object({
  query: z.string()
});
export type SearchWebToolInput = z.infer<typeof SearchWebToolInputSchema>;

export const SearchWebResultItemSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string()
});
export type SearchWebResultItem = z.infer<typeof SearchWebResultItemSchema>;

export const SearchWebToolOutputSchema = z.object({
  results: z.array(SearchWebResultItemSchema)
});
export interface SearchWebToolOutput {
  results: SearchWebResultItem[];
}
