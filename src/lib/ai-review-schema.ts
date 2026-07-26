import { z } from "zod";

export const confidenceSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);

export const aiReviewCandidateSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(3).max(2000),
  level: z.enum(["CRITICAL", "HIGH", "MEDIUM", "INFO"]),
  evidence: z.string().max(2000),
  recommendation: z.string().max(2000),
  confidence: confidenceSchema,
  requiresExpertReview: z.boolean(),
}).strict();

export const aiReviewOutputSchema = z.object({
  documentType: z.string().min(1).max(100),
  summary: z.string().min(3).max(3000),
  extractedFields: z.array(z.object({
    label: z.string().min(1).max(80),
    value: z.string().max(500),
    evidence: z.string().max(1000),
    confidence: confidenceSchema,
  }).strict()).max(20),
  missingItems: z.array(z.object({
    item: z.string().min(1).max(200),
    reason: z.string().max(1000),
    riskLevel: z.enum(["CRITICAL", "HIGH", "MEDIUM", "INFO"]),
  }).strict()).max(20),
  findings: z.array(aiReviewCandidateSchema).max(12),
  overallConfidence: confidenceSchema,
  expertReviewRequired: z.boolean(),
  limitations: z.array(z.string().min(1).max(500)).max(12),
}).strict();

export type AIReviewOutput = z.infer<typeof aiReviewOutputSchema>;
export type AIReviewCandidate = z.infer<typeof aiReviewCandidateSchema>;
export type Confidence = z.infer<typeof confidenceSchema>;
