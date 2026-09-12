import { z } from "zod";
import type { IsoTimestamp } from "./common.js";

export const CaptureLimitsSchema = z.object({
  maxTextChars: z.literal(4000),
  maxCodeBlocks: z.literal(3),
  maxCodeCharsPerBlock: z.literal(1000),
  maxAnchorQuoteChars: z.literal(240)
});
export type CaptureLimits = z.infer<typeof CaptureLimitsSchema>;

export const CaptureViewportInputSchema = z.object({
  tabId: z.number(),
  expectedUrl: z.string(),
  limits: CaptureLimitsSchema.optional()
});
export type CaptureViewportInput = z.infer<typeof CaptureViewportInputSchema>;

export const SourceRefSchema = z.object({
  canonicalUrl: z.string(),
  safeUrl: z.string(),
  hostname: z.string(),
  title: z.string()
});
export type SourceRef = z.infer<typeof SourceRefSchema>;

export const ViewportAnchorSchema = z.object({
  heading: z.string().trim(),
  textQuote: z.string().trim(),
  scrollRatio: z.number().min(0).max(1),
  fingerprint: z.string().trim()
});
export type ViewportAnchor = z.infer<typeof ViewportAnchorSchema>;

export const ViewportContextSchema = z.object({
  contextId: z.string(),
  source: SourceRefSchema,
  anchor: ViewportAnchorSchema,
  visibleText: z.string().trim().min(1),
  visibleCodeBlocks: z.array(z.string().trim()),
  capturedAt: z.string().datetime()
});
export interface ViewportContext {
  contextId: string;
  source: SourceRef;
  anchor: ViewportAnchor;
  visibleText: string;
  visibleCodeBlocks: string[];
  capturedAt: IsoTimestamp;
}

export const HighlightOrResumeInputSchema = z.object({
  tabId: z.number(),
  expectedCanonicalUrl: z.string(),
  anchor: ViewportAnchorSchema
});
export type HighlightOrResumeInput = z.infer<typeof HighlightOrResumeInputSchema>;

export const HighlightOrResumeOutputSchema = z.object({
  found: z.boolean(),
  strategy: z.enum(["TEXT_QUOTE", "HEADING", "SCROLL_RATIO", "NONE"]),
  appliedScrollRatio: z.number().min(0).max(1).optional()
});
export type HighlightOrResumeOutput = z.infer<typeof HighlightOrResumeOutputSchema>;
