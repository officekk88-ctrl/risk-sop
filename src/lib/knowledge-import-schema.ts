import { z } from "zod";

export const knowledgeImportEntrySchema = z.object({
  category: z.enum(["SITE_PROPERTY", "PLANNING_USE", "FIRE_SAFETY", "CONSTRUCTION", "LEASE_LEGAL", "LICENSE_COMPLIANCE", "SPORTS_OPERATION", "SAFETY_INSURANCE", "FINANCE_TAX", "ENVIRONMENT_NEIGHBOR", "OTHER"]),
  title: z.string().min(2).max(100),
  summary: z.string().min(5).max(300),
  content: z.string().min(10).max(6000),
  keywords: z.array(z.string().min(1).max(30)).max(20),
}).strict();

export const knowledgeImportOutputSchema = z.object({
  documentSummary: z.string().min(1).max(1000),
  warnings: z.array(z.string().min(1).max(300)).max(10),
  entries: z.array(knowledgeImportEntrySchema).max(8),
}).strict();

export type KnowledgeImportOutput = z.infer<typeof knowledgeImportOutputSchema>;
