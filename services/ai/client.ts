import "server-only";

import OpenAI from "openai";
import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";

import { getRuntimeSettingValue } from "@/services/settings/runtime";

// ─── Provider Detection ──────────────────────────────────────────────────────

export type AiProvider = "openai" | "gemini";

export async function getAiProvider(): Promise<AiProvider> {
  const provider = await getRuntimeSettingValue<string>("ai.provider", "gemini");
  return provider === "openai" ? "openai" : "gemini";
}

// ─── OpenAI Client ───────────────────────────────────────────────────────────

let cachedOpenAIClient: OpenAI | null = null;
let cachedOpenAIKey: string | null = null;

export async function getOpenAIClient(): Promise<OpenAI> {
  const settingsKey = await getRuntimeSettingValue<string>("ai.openai_api_key", "");
  const apiKey = (settingsKey && settingsKey.trim().length > 0 ? settingsKey.trim() : process.env.OPENAI_API_KEY) ?? "";

  if (!apiKey || apiKey.length < 10) {
    throw new Error(
      "OpenAI API key is not configured. Set it in Settings → AI Features or via the OPENAI_API_KEY environment variable.",
    );
  }

  if (cachedOpenAIClient && cachedOpenAIKey === apiKey) {
    return cachedOpenAIClient;
  }

  cachedOpenAIClient = new OpenAI({ apiKey });
  cachedOpenAIKey = apiKey;
  return cachedOpenAIClient;
}

// ─── Gemini Client ───────────────────────────────────────────────────────────

let cachedGeminiModel: GenerativeModel | null = null;
let cachedGeminiKey: string | null = null;
let cachedGeminiModelName: string | null = null;

export async function getGeminiModel(): Promise<GenerativeModel> {
  const settingsKey = await getRuntimeSettingValue<string>("ai.gemini_api_key", "");
  const apiKey = (settingsKey && settingsKey.trim().length > 0 ? settingsKey.trim() : process.env.GEMINI_API_KEY) ?? "";

  if (!apiKey || apiKey.length < 10) {
    throw new Error(
      "Gemini API key is not configured. Set it in Settings → AI Features or via the GEMINI_API_KEY environment variable.",
    );
  }

  const modelName = await getAiModelName();

  if (cachedGeminiModel && cachedGeminiKey === apiKey && cachedGeminiModelName === modelName) {
    return cachedGeminiModel;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  cachedGeminiModel = genAI.getGenerativeModel({ model: modelName });
  cachedGeminiKey = apiKey;
  cachedGeminiModelName = modelName;
  return cachedGeminiModel;
}

// ─── Shared Helpers ──────────────────────────────────────────────────────────

/** Get the AI model name from settings with a safe fallback. */
export async function getAiModelName(): Promise<string> {
  return getRuntimeSettingValue<string>("ai.default_model", "gemini-2.0-flash");
}

/** Get the max questions per request limit from settings. */
export async function getMaxQuestionsPerRequest(): Promise<number> {
  const value = await getRuntimeSettingValue<number>("ai.max_questions_per_request", 10);
  return Math.max(1, Math.min(50, Number(value) || 10));
}
