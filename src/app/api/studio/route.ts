import { NextResponse } from "next/server";
import { z } from "zod";
import { generateDesign, generateStudyKit } from "@/lib/studio";
import { GeneratedDocument } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const schema = z.object({
  kind: z.enum(["kit", "design"]),
  style: z.enum(["auto", "editorial", "workbook", "dashboard", "slides"]).default("auto"),
  doc: z.any()
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const doc = body.doc as GeneratedDocument;
    if (body.kind === "kit") return NextResponse.json(await generateStudyKit(doc));
    return NextResponse.json(await generateDesign(doc, body.style));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Studio request failed." }, { status: 400 });
  }
}
