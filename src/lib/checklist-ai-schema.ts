import { z } from "zod";

export const checklistAIOutputSchema = z.object({
  judgment: z.enum(["PASSED", "FAILED", "VERIFY"]),
  analysis: z.string().min(3).max(2000),
  evidence: z.string().max(2000),
  recommendation: z.string().max(2000),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  requiresExpertReview: z.boolean(),
}).strict();

export type ChecklistAIOutput = z.infer<typeof checklistAIOutputSchema>;
