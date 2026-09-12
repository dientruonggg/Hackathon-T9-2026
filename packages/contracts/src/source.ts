import { z } from "zod";
import type { IsoTimestamp } from "./common.js";

export const SourceTypeSchema = z.enum([
  "HTML_ARTICLE",
  "DOCUMENTATION",
  "BLOG",
  "SEARCH_RESULTS",
  "PDF",
  "VIDEO_PLATFORM",
  "SOCIAL_FEED",
  "PRIVATE_CHAT",
  "WEBMAIL",
  "SENSITIVE_PORTAL",
  "UNKNOWN"
]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const SourcePolicyDecisionSchema = z.enum(["ALLOW", "BLOCK", "ASK"]);
export type SourcePolicyDecision = z.infer<typeof SourcePolicyDecisionSchema>;

export const SourcePolicyReasonCodeSchema = z.enum([
  "SUPPORTED_HTML",
  "USER_ALLOWED_DOMAIN",
  "USER_BLOCKED_DOMAIN",
  "NON_HTTP_PROTOCOL",
  "PDF_NOT_SUPPORTED",
  "VIDEO_NOT_SUPPORTED",
  "SOCIAL_NOT_SUPPORTED",
  "PRIVATE_CONTENT_BLOCKED",
  "SENSITIVE_CONTENT_BLOCKED",
  "UNKNOWN_SOURCE"
]);
export type SourcePolicyReasonCode = z.infer<typeof SourcePolicyReasonCodeSchema>;

export const SourcePolicySettingsSchema = z.object({
  allowedDomains: z.array(z.string()),
  blockedDomains: z.array(z.string()),
  updatedAt: z.string().datetime()
});
export interface SourcePolicySettings {
  allowedDomains: string[];
  blockedDomains: string[];
  updatedAt: IsoTimestamp;
}

export const SourcePolicyInputSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  contentType: z.string().optional(),
  settings: SourcePolicySettingsSchema
});
export type SourcePolicyInput = z.infer<typeof SourcePolicyInputSchema>;

export const SourcePolicyResultSchema = z.object({
  decision: SourcePolicyDecisionSchema,
  sourceType: SourceTypeSchema,
  reasonCode: SourcePolicyReasonCodeSchema,
  safeUrl: z.string(),
  hostname: z.string().optional(),
  userMessage: z.string()
});
export type SourcePolicyResult = z.infer<typeof SourcePolicyResultSchema>;

export const UpdateSourcePolicyInputSchema = z.object({
  domain: z.string(),
  action: z.enum(["ALLOW", "BLOCK", "RESET"]),
  userConfirmed: z.literal(true)
});
export type UpdateSourcePolicyInput = z.infer<typeof UpdateSourcePolicyInputSchema>;
