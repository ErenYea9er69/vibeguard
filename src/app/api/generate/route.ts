import { NextResponse } from "next/server";
import { z } from "zod";
import { generateDocument } from "@/lib/ai";
import { getSourceVideos } from "@/lib/source";
import { demoDocument } from "@/lib/demo";
import { generateDesign } from "@/lib/studio";
import { renderMarkdown } from "@/lib/render";
import { renderDesignFallback } from "@/lib/design-fallback";

export const runtime = "nodejs";
export const maxDuration = 300;

const requestSchema = z.object({
  sourceUrl: z.string().optional().default(""),
  deliverableFormat: z.enum(["html", "pdf", "markdown", "json"]).optional().default("html"),
  format: z.enum(["course", "article", "blog"]).optional().default("article"),
  designStyle: z.enum(["auto", "editorial", "workbook", "dashboard", "slides"]).optional().default("auto"),
  audience: z.string().optional().default(""),
  tone: z.enum(["clear", "technical", "academic", "practical"]).optional().default("practical"),
  language: z.string().min(2).optional().default("en"),
  maxVideos: z.number().int().min(1).max(30).optional().default(12),
  strictRules: z.boolean().optional().default(true)
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    
    // Fall back to demo only if URL is explicitly "demo" or blank
    if (!body.sourceUrl || body.sourceUrl === "demo") {
      const baseDoc = {
        ...demoDocument,
        format: body.format,
        deliverableFormat: body.deliverableFormat,
        generatedAt: new Date().toISOString(),
        source: { ...demoDocument.source, url: body.sourceUrl || "https://www.youtube.com/playlist?list=DEMO" }
      };
      const markdown = renderMarkdown(baseDoc);
      let html: string | undefined;
      if (body.deliverableFormat === "html") {
        try {
          const res = await generateDesign(baseDoc, body.designStyle);
          html = res.html;
        } catch {
          html = renderDesignFallback(baseDoc, body.designStyle === "auto" ? "editorial" : body.designStyle);
        }
      }
      return NextResponse.json({
        ...baseDoc,
        generatedMarkdown: markdown,
        ...(html ? { generatedHtml: html } : {})
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

    const generatedMarkdown = renderMarkdown(document);
    let generatedHtml: string | undefined;

    if (body.deliverableFormat === "html") {
      try {
        const designRes = await generateDesign(document, body.designStyle);
        generatedHtml = designRes.html;
      } catch (err) {
        console.error("Design generation fallback used:", err);
        generatedHtml = renderDesignFallback(
          document,
          body.designStyle === "auto" ? (document.format === "course" ? "workbook" : "editorial") : body.designStyle
        );
      }
    }

    return NextResponse.json({
      ...document,
      deliverableFormat: body.deliverableFormat,
      generatedMarkdown,
      ...(generatedHtml ? { generatedHtml } : {})
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
