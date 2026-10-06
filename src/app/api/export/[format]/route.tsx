import { NextResponse } from "next/server";
import { renderHtml, renderMarkdown } from "@/lib/render";
import { CoursePdf } from "@/lib/pdf";
import { GeneratedDocument } from "@/lib/types";
import { renderToBuffer } from "@react-pdf/renderer";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ format: string }> }) {
  const { format } = await params;
  const doc = (await request.json()) as GeneratedDocument;

  const slug = (doc.title || "artifact")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "courseforge";

  if (format === "json") {
    return new Response(JSON.stringify(doc, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}.json"`
      }
    });
  }

  if (format === "html") {
    const html = doc.generatedHtml || renderHtml(doc);
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}.html"`
      }
    });
  }

  if (format === "markdown" || format === "md") {
    const md = doc.generatedMarkdown || renderMarkdown(doc);
    return new Response(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}.md"`
      }
    });
  }

  if (format === "pdf") {
    const buffer = await renderToBuffer(<CoursePdf doc={doc} />);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${slug}.pdf"`
      }
    });
  }

  return NextResponse.json({ error: "Unknown export format." }, { status: 404 });
}
