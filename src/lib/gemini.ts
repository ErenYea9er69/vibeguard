import { GoogleGenAI } from "@google/genai";

export const hasGemini = () => Boolean(process.env.GEMINI_API_KEY);

export async function askJson<T>(args: { system: string; prompt: string; schema: object; maxTokens?: number }): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing.");
  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    contents: args.prompt,
    config: { systemInstruction: args.system, responseMimeType: "application/json", responseSchema: args.schema, temperature: 0.3, maxOutputTokens: args.maxTokens ?? 8000 }
  });
  const raw = res.text?.trim();
  if (!raw) throw new Error("The model returned an empty response.");
  return JSON.parse(raw) as T;
}

export async function askText(args: { system: string; prompt: string; maxTokens?: number }): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing.");
  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    contents: args.prompt,
    config: { systemInstruction: args.system, temperature: 0.6, maxOutputTokens: args.maxTokens ?? 16000 }
  });
  return res.text?.trim() || "";
}

export function extractHtml(text: string): string {
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.search(/<!doctype html|<html/i);
  return start >= 0 ? body.slice(start) : "";
}
