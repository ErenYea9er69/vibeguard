import { NextResponse } from "next/server";
import { z } from "zod";
import { generateDocument } from "@/lib/ai";
import { getSourceVideos } from "@/lib/source";
import { demoDocument } from "@/lib/demo";

export const runtime = "nodejs";
export const maxDuration = 300;

const requestSchema = z.object({
  sourceUrl: z.string().optional().default(""),
  format: z.enum(["course", "article", "blog"]),
  audience: z.string().optional().default(""),
  tone: z.enum(["clear", "technical", "academic", "practical"]),
  language: z.string().min(2),
  maxVideos: z.number().int().min(1).max(30).optional().default(12),
  strictRules: z.boolean().optional().default(true)
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    
    // Fall back to demo only if URL is explicitly "demo" or blank
    if (!body.sourceUrl || body.sourceUrl === "demo") {
      return NextResponse.json({
        ...demoDocument,
        format: body.format,
        generatedAt: new Date().toISOString(),
        source: { ...demoDocument.source, url: body.sourceUrl || "https://www.youtube.com/playlist?list=DEMO" }
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured in .env. Please set your Gemini API key.");
    }

    const source = await getSourceVideos(body.sourceUrl, body.maxVideos, body.language);
    const document = await generateDocument({
      videos: source.videos,
      sourceUrl: body.sourceUrl,
      sourceType: source.type,
      sourceTitle: source.title,
      channel: source.channel,
      format: body.format,
      audience: body.audience,
      tone: body.tone,
      language: body.language,
      strictRules: body.strictRules
    });
    return NextResponse.json(document);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
