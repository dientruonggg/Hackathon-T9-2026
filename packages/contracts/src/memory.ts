import { z } from "zod";
import type { IsoTimestamp } from "./common.js";
import { SourceRefSchema, ViewportAnchorSchema } from "./context.js";
import type { SourceRef, ViewportAnchor } from "./context.js";

export const MemoryStatusSchema = z.enum([
  "UNDERSTOOD",
  "NOT_UNDERSTOOD",
  "REVIEW_LATER"
]);
export type MemoryStatus = z.infer<typeof MemoryStatusSchema>;

export const MemoryEvidenceKindSchema = z.enum([
  "USER_MARK",
  "USER_CHECKPOINT"
]);
export type MemoryEvidenceKind = z.infer<typeof MemoryEvidenceKindSchema>;

export const MemoryEvidenceSchema = z.object({
  kind: MemoryEvidenceKindSchema,
  summary: z.string().max(500),
  createdAt: z.string().datetime()
});
export interface MemoryEvidence {
  kind: MemoryEvidenceKind;
  summary: string;
  createdAt: IsoTimestamp;
}

export const MemoryMarkerSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  source: SourceRefSchema,
  anchor: ViewportAnchorSchema,
  status: MemoryStatusSchema,
  note: z.string().max(500).optional(),
  question: z.string().max(500).optional(),
  answerSummary: z.string().max(500).optional(),
  evidence: z.array(MemoryEvidenceSchema).max(20),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastVisitedAt: z.string().datetime(),
  revision: z.number().int().min(1)
});
export interface MemoryMarker {
  schemaVersion: 1;
  id: string;
  source: SourceRef;
  anchor: ViewportAnchor;
  status: MemoryStatus;
  note?: string;
  question?: string;
  answerSummary?: string;
  evidence: MemoryEvidence[];
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  lastVisitedAt: IsoTimestamp;
  revision: number;
}

export const MemoryMatchReasonSchema = z.enum([
  "EXACT_FINGERPRINT",
  "SAME_PAGE_HEADING",
  "SAME_PAGE"
]);
export type MemoryMatchReason = z.infer<typeof MemoryMatchReasonSchema>;

export const MemorySummarySchema = z.object({
  id: z.string(),
  source: SourceRefSchema,
  anchor: ViewportAnchorSchema,
  status: MemoryStatusSchema,
  note: z.string().max(500).optional(),
  question: z.string().max(500).optional(),
  answerSummary: z.string().max(500).optional(),
  updatedAt: z.string().datetime(),
  revision: z.number().int().min(1),
  matchScore: z.number().min(0).max(1),
  matchReason: MemoryMatchReasonSchema
});
export interface MemorySummary {
  id: string;
  source: SourceRef;
  anchor: ViewportAnchor;
  status: MemoryStatus;
  note?: string;
  question?: string;
  answerSummary?: string;
  updatedAt: IsoTimestamp;
  revision: number;
  matchScore: number;
  matchReason: MemoryMatchReason;
}

export const SaveMarkerInputSchema = z.object({
  source: SourceRefSchema,
  anchor: ViewportAnchorSchema,
  status: MemoryStatusSchema,
  note: z.string().max(500).optional(),
  question: z.string().max(500).optional(),
  answerSummary: z.string().max(500).optional(),
  evidence: MemoryEvidenceSchema,
  userConfirmed: z.literal(true)
});
export type SaveMarkerInput = z.infer<typeof SaveMarkerInputSchema>;

export const SearchMemoryInputSchema = z.object({
  source: SourceRefSchema,
  anchor: ViewportAnchorSchema,
  query: z.string().optional(),
  status: MemoryStatusSchema.optional(),
  limit: z.number().int().min(1).max(5).optional()
});
export type SearchMemoryInput = z.infer<typeof SearchMemoryInputSchema>;

export const UpdateUnderstandingInputSchema = z.object({
  memoryId: z.string(),
  nextStatus: MemoryStatusSchema,
  note: z.string().max(500).optional(),
  evidence: MemoryEvidenceSchema,
  userConfirmed: z.literal(true)
});
export type UpdateUnderstandingInput = z.infer<typeof UpdateUnderstandingInputSchema>;

export const ForgetMemoryInputSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("ONE"), memoryId: z.string(), userConfirmed: z.literal(true) }),
  z.object({ scope: z.literal("SOURCE"), canonicalUrl: z.string(), userConfirmed: z.literal(true) }),
  z.object({ scope: z.literal("ALL"), userConfirmed: z.literal(true) })
]);
export type ForgetMemoryInput = z.infer<typeof ForgetMemoryInputSchema>;

export const ForgetMemoryOutputSchema = z.object({
  deletedCount: z.number().int().min(0)
});
export type ForgetMemoryOutput = z.infer<typeof ForgetMemoryOutputSchema>;
