import { NextResponse } from "next/server";
import { z } from "zod";
import { getSourceVideos } from "@/lib/source";
import { analyzeFromDocument, analyzeSource } from "@/lib/studio";
import { GeneratedDocument } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const schema = z.object({ sourceUrl: z.string().min(1), language: z.string().default("en"), maxVideos: z.number().int().min(1).max(30).default(12), doc: z.any() });

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const doc = body.doc as GeneratedDocument;
    if (!process.env.SUPADATA_API_KEY || !process.env.GEMINI_API_KEY) return NextResponse.json(analyzeFromDocument(doc));
    const source = await getSourceVideos(body.sourceUrl, body.maxVideos, body.language);
    return NextResponse.json(await analyzeSource(source.videos, doc));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Analysis failed." }, { status: 400 });
  }
}
