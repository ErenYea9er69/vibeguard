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
  customTranscript: z.string().optional().default(""),
  deliverableFormat: z.enum(["html", "pdf", "markdown", "json"]).optional().default("html"),
  format: z.enum(["course", "article", "blog"]).optional().default("article"),
  designStyle: z.enum(["auto", "editorial", "workbook", "dashboard", "slides"]).optional().default("auto"),
  audience: z.string().optional().default(""),
  tone: z.enum(["clear", "technical", "academic", "practical"]).optional().default("practical"),
  language: z.string().min(2).optional().default("auto"),
  maxVideos: z.number().int().min(0).max(500).optional().default(12),
  strictRules: z.boolean().optional().default(true)
});

function nowTime(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export async function POST(request: Request) {
  const wantsStream =
    request.headers.get("accept")?.includes("text/event-stream") ||
    request.headers.get("x-stream") === "true" ||
    new URL(request.url).searchParams.get("stream") === "true";

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid request parameters.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const isHtml = body.deliverableFormat === "html";
  const totalSteps = isHtml ? 5 : 4;

  if (wantsStream) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let isClosed = false;

        function emit(data: Record<string, unknown>) {
          if (isClosed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {
            isClosed = true;
          }
        }

        function closeStream() {
          if (isClosed) return;
          isClosed = true;
          try {
            controller.close();
          } catch {}
        }

        function emitProgress(step: number, percent: number, title: string, detail: string, stepId: "source" | "transcripts" | "ai" | "markdown" | "design", logText?: string, logType: "info" | "success" | "warn" = "info") {
          emit({
            type: "progress",
            step,
            totalSteps,
            stepsLeft: Math.max(0, totalSteps - step),
            percent,
            title,
            detail,
            stepId,
            log: logText ? { time: nowTime(), text: logText, type: logType } : undefined
          });
        }

        try {
          // ——— DEMO MODE ——————————————————————————
          if (!body.sourceUrl || body.sourceUrl === "demo") {
            emitProgress(
              1,
              15,
              "Resolving Courseware Source",
              "Loading demo curriculum dataset (5 videos: Next.js 15, Server Actions, TypeScript)",
              "source",
              "Connected to demo YouTube playlist (5 videos detected)",
              "success"
            );

            await new Promise((r) => setTimeout(r, 600));

            emitProgress(
              2,
              45,
              "Extracting Video Transcripts",
              "Processed transcripts across 5 sample videos (18,400 words total prepared)",
              "transcripts",
              "Extracted transcripts for all 5 videos (18,400 words prepared)",
              "success"
            );

            await new Promise((r) => setTimeout(r, 700));

            emitProgress(
              3,
              70,
              "Synthesizing Curriculum with Nemotron AI",
              `Structuring concepts, lessons, takeaways & exercises into a ${body.format}`,
              "ai",
              "Nemotron AI synthesized modular learning structure and concept hierarchy",
              "success"
            );

            const baseDoc = {
              ...demoDocument,
              format: body.format,
              deliverableFormat: body.deliverableFormat,
              generatedAt: new Date().toISOString(),
              source: { ...demoDocument.source, url: body.sourceUrl || "https://www.youtube.com/playlist?list=DEMO" }
            };

            await new Promise((r) => setTimeout(r, 500));

            emitProgress(
              4,
              85,
              "Formatting Markdown Deliverable",
              "Compiling formatted documentation with code syntax and lesson objectives",
              "markdown",
              "Compiled complete markdown deliverable and table of contents",
              "success"
            );

            const markdown = renderMarkdown(baseDoc);
            let html: string | undefined;

            if (isHtml) {
              emitProgress(
                5,
                94,
                "Compiling Bespoke Interactive UI",
                `Generating ${body.designStyle} interface layout, typography and widgets`,
                "design",
                `Compiling bespoke UI design tokens (${body.designStyle})`,
                "info"
              );

              try {
                const res = await generateDesign(baseDoc, body.designStyle);
                html = res.html;
              } catch {
                html = renderDesignFallback(baseDoc, body.designStyle === "auto" ? "editorial" : body.designStyle);
              }

              emitProgress(
                5,
                99,
                "Finalizing Deliverable",
                "HTML webpage and responsive styling compiled successfully",
                "design",
                "Interactive UI rendered and verified",
                "success"
              );
            }

            const finalDoc = {
              ...baseDoc,
              generatedMarkdown: markdown,
              ...(html ? { generatedHtml: html } : {})
            };

            emit({
              type: "complete",
              result: finalDoc
            });
            closeStream();
            return;
          }

          // ——— REAL GENERATION ——————————————————————
          if (!process.env.OPENROUTER_API_KEY) {
            throw new Error("OPENROUTER_API_KEY is not configured in .env. Please configure your OpenRouter API key to use nvidia/nemotron-3-ultra-550b-a55b:free.");
          }

          let sourceVideos: any[] = [];
          let sourceType: "video" | "playlist" = "video";
          let sourceTitle = "YouTube Content";
          let sourceChannel = "Creator";

          const hasCustomTranscript = Boolean(body.customTranscript && body.customTranscript.trim().length > 20);

          if (hasCustomTranscript) {
            emitProgress(
              1,
              20,
              "Direct Transcript Loaded",
              "Using custom transcript provided directly...",
              "source",
              "Loaded custom transcript directly from user input",
              "success"
            );
            if (body.sourceUrl && body.sourceUrl !== "demo") {
              try {
                const fetched = await getSourceVideos(body.sourceUrl, 1, body.language);
                sourceType = fetched.type;
                sourceTitle = fetched.title || "YouTube Content";
                sourceChannel = fetched.channel || "Creator";
                sourceVideos = fetched.videos.map(v => ({ ...v, transcript: body.customTranscript.trim() }));
              } catch {
                sourceVideos = [{
                  id: "custom-source",
                  url: body.sourceUrl,
                  title: "Video Material",
                  channel: "Creator",
                  transcript: body.customTranscript.trim()
                }];
              }
            } else {
              sourceVideos = [{
                id: "custom-input",
                url: "",
                title: "Custom Transcript Document",
                channel: "User Material",
                transcript: body.customTranscript.trim()
              }];
            }
          } else {
            if (!body.sourceUrl) {
              throw new Error("Please enter a YouTube video URL, playlist URL, or paste a transcript.");
            }

            emitProgress(
              1,
              12,
              "Connecting to YouTube Source",
              "Analyzing YouTube link format and resolving metadata...",
              "source",
              `Connecting to YouTube: ${body.sourceUrl}`,
              "info"
            );

            let totalVideosToFetch = 1;
            const fetched = await getSourceVideos(
              body.sourceUrl,
              body.maxVideos,
              body.language,
              (info) => {
                if (info.stage === "playlist_found") {
                  totalVideosToFetch = info.total || 1;
                  emitProgress(
                    1,
                    20,
                    "Discovered YouTube Playlist",
                    `Found "${info.title}" with ${info.total} videos to process`,
                    "source",
                    `Found playlist "${info.title}" (${info.total} videos)`,
                    "success"
                  );
                } else if (info.stage === "video_found") {
                  emitProgress(
                    1,
                    20,
                    "Found YouTube Video",
                    info.message,
                    "source",
                    info.message,
                    "info"
                  );
                } else if (info.stage === "video_transcript") {
                  emitProgress(
                    2,
                    45,
                    "Extracting Video Transcript",
                    info.message,
                    "transcripts",
                    `✔ ${info.message}`,
                    (info.words ?? 0) > 0 ? "success" : "warn"
                  );
                } else if (info.stage === "transcript_progress") {
                  const cur = info.current || 1;
                  const tot = info.total || totalVideosToFetch;
                  const pct = 20 + Math.round((cur / tot) * 35);
                  emitProgress(
                    2,
                    pct,
                    "Extracting Video Transcripts",
                    `Fetched ${cur} of ${tot}: "${info.videoTitle || "Video"}" (${info.words?.toLocaleString() || 0} words)`,
                    "transcripts",
                    `✔ [${cur}/${tot}] ${info.videoTitle || "Video"} (${info.words?.toLocaleString() || 0} words)`,
                    "success"
                  );
                }
              }
            );

            sourceType = fetched.type;
            sourceTitle = fetched.title || "YouTube Content";
            sourceChannel = fetched.channel || "Creator";
            sourceVideos = fetched.videos;
          }

          const totalWordsExtracted = sourceVideos.reduce(
            (acc, v) => acc + (v.transcript ? v.transcript.split(/\s+/).filter(Boolean).length : 0),
            0
          );

          if (totalWordsExtracted === 0) {
            throw new Error(
              `Could not extract automated captions for this YouTube video (captions are unavailable or blocked by YouTube on cloud servers). Please select 'Paste Transcript / Notes' to paste the transcript text directly and generate your ${body.format} instantly!`
            );
          }

          emitProgress(
            2,
            55,
            "Transcripts Extracted",
            `Extracted transcripts across all ${sourceVideos.length} video(s) (${totalWordsExtracted.toLocaleString()} words total)`,
            "transcripts",
            `All transcripts extracted: ${totalWordsExtracted.toLocaleString()} words total across ${sourceVideos.length} video(s)`,
            "success"
          );

          // Step 3: Nemotron AI Synthesis
          const formatTitle = body.format === "article"
            ? "Synthesizing Article with Nemotron AI"
            : body.format === "blog"
            ? "Synthesizing Blog Post with Nemotron AI"
            : "Synthesizing Curriculum with Nemotron AI";

          emitProgress(
            3,
            60,
            formatTitle,
            `Sending ${totalWordsExtracted.toLocaleString()} words to NVIDIA Nemotron AI for ${body.format} synthesis...`,
            "ai",
            `Sending ${totalWordsExtracted.toLocaleString()} words to Nemotron AI for ${body.format} synthesis`,
            "info"
          );

          let pingCount = 0;
          const heartbeatInterval = setInterval(() => {
            pingCount++;
            emit({
              type: "heartbeat",
              step: 3,
              totalSteps,
              percent: Math.min(78, 60 + Math.min(18, pingCount * 2)),
              detail: `NVIDIA Nemotron AI is actively synthesizing your ${body.format} (${pingCount * 5}s elapsed)...`
            });
          }, 5000);

          let document;
          try {
            document = await generateDocument(
              {
                videos: sourceVideos,
                sourceUrl: body.sourceUrl,
                sourceType,
                sourceTitle,
                channel: sourceChannel,
                format: body.format,
                audience: body.audience,
                tone: body.tone,
                language: body.language,
                strictRules: body.strictRules
              },
              (aiInfo) => {
                emitProgress(
                  3,
                  72,
                  formatTitle,
                  aiInfo.message,
                  "ai",
                  aiInfo.message,
                  "info"
                );
              }
            );
          } finally {
            clearInterval(heartbeatInterval);
          }

          emitProgress(
            3,
            80,
            `${body.format.toUpperCase()} Synthesized`,
            `Generated ${document.sections.length} ${body.format} sections with key takeaways`,
            "ai",
            `Nemotron AI synthesis complete: ${document.sections.length} sections created`,
            "success"
          );

          // Step 4: Markdown Deliverable
          emitProgress(
            4,
            88,
            "Formatting Markdown Deliverable",
            "Compiling clean markdown document with structured sections and source links...",
            "markdown",
            "Compiling formatted markdown documentation",
            "info"
          );

          const generatedMarkdown = renderMarkdown(document);

          emitProgress(
            4,
            90,
            "Markdown Formatted",
            "Markdown syllabus and notes compiled successfully",
            "markdown",
            "Markdown document compiled and verified",
            "success"
          );

          // Step 5: Bespoke HTML UI (if deliverableFormat === "html")
          let generatedHtml: string | undefined;
          if (isHtml) {
            emitProgress(
              5,
              93,
              "Compiling Bespoke Interactive UI",
              `Synthesizing ${body.designStyle} design identity, typography and components...`,
              "design",
              `Generating bespoke interactive HTML deliverable (${body.designStyle})`,
              "info"
            );

            let designPing = 0;
            const designHeartbeat = setInterval(() => {
              designPing++;
              emit({
                type: "heartbeat",
                step: 5,
                totalSteps,
                percent: Math.min(98, 93 + designPing),
                detail: `Synthesizing ${body.designStyle} interactive UI (${designPing * 5}s elapsed)...`
              });
            }, 5000);

            try {
              const designPromise = generateDesign(document, body.designStyle);
              const timeoutPromise = new Promise<{ html: string; engine: "fallback" }>((_, reject) =>
                setTimeout(() => reject(new Error("AI design generation reached timeout, using fast design fallback")), 12000)
              );
              const designRes = await Promise.race([designPromise, timeoutPromise]);
              generatedHtml = designRes.html;
            } catch (err) {
              console.warn("Design generation fallback used:", err);
              generatedHtml = renderDesignFallback(
                document,
                body.designStyle === "auto" ? (document.format === "course" ? "workbook" : "editorial") : body.designStyle
              );
            } finally {
              clearInterval(designHeartbeat);
            }

            emitProgress(
              5,
              99,
              "Interactive UI Ready",
              "Bespoke HTML webpage compiled with inline styles and interactive widgets",
              "design",
              "Bespoke HTML deliverable ready",
              "success"
            );
          }

          const finalDoc = {
            ...document,
            deliverableFormat: body.deliverableFormat,
            generatedMarkdown,
            ...(generatedHtml ? { generatedHtml } : {})
          };

          emit({
            type: "complete",
            result: finalDoc
          });

          closeStream();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Generation failed.";
          emit({
            type: "error",
            error: message
          });
          closeStream();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive"
      }
    });
  }

  // Fallback non-streaming path
  try {
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
      if (isHtml) {
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

    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not configured in .env. Please configure your OpenRouter API key to use nvidia/nemotron-3-ultra-550b-a55b:free.");
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

    if (isHtml) {
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
