import { NextResponse } from "next/server";
import { renderHtml } from "@/lib/render";
import { CoursePdf } from "@/lib/pdf";
import { GeneratedDocument } from "@/lib/types";
import { renderToBuffer } from "@react-pdf/renderer";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ format: string }> }) {
  const { format } = await params;
  const doc = (await request.json()) as GeneratedDocument;

  if (format === "json") {
    return new Response(JSON.stringify(doc, null, 2), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="courseforge.json"` }
    });
  }

  if (format === "html") {
    return new Response(renderHtml(doc), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": `attachment; filename="courseforge.html"` }
    });
  }

  if (format === "pdf") {
    const buffer = await renderToBuffer(<CoursePdf doc={doc} />);
    return new Response(buffer, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="courseforge.pdf"` }
    });
  }

  return NextResponse.json({ error: "Unknown export format." }, { status: 404 });
}
