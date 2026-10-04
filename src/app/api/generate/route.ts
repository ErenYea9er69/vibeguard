import { NextResponse } from "next/server";
import { z } from "zod";
import { generateDocument } from "@/lib/ai";
import { getSourceVideos } from "@/lib/source";
import { demoDocument } from "@/lib/demo";

export const runtime = "nodejs";
export const maxDuration = 300;

const requestSchema = z.object({
  sourceUrl: z.string().min(1),
  format: z.enum(["course", "article", "blog"]),
  audience: z.string().min(2),
  tone: z.enum(["clear", "technical", "academic", "practical"]),
  language: z.string().min(2),
  maxVideos: z.number().int().min(1).max(30),
  strictRules: z.boolean().optional().default(true)
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const isConfigured = Boolean(process.env.SUPADATA_API_KEY && process.env.GEMINI_API_KEY);
    if (!isConfigured) {
      return NextResponse.json({
        ...demoDocument,
        format: body.format,
        generatedAt: new Date().toISOString(),
        source: { ...demoDocument.source, url: body.sourceUrl, type: body.sourceUrl.includes("playlist") ? "playlist" : "video" }
      });
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
