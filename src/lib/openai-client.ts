import "server-only";

import OpenAI from "openai";

export const aiModel = process.env.OPENAI_MODEL?.trim() || "";

export function isAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim() && aiModel);
}

export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY_NOT_CONFIGURED");
  return new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL?.trim() || undefined,
    timeout: 60_000,
    maxRetries: 1,
  });
}
