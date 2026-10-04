import { GoogleGenAI } from "@google/genai";
import { GeneratedDocument, OutputFormat, SourceVideo, Tone } from "./types";

const schema = {
  type: "object",
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    format: { type: "string", enum: ["course", "article", "blog"] },
    audience: { type: "string" },
    estimatedTime: { type: "string" },
    summary: { type: "string" },
    learningOutcomes: { type: "array", items: { type: "string" } },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          intro: { type: "string" },
          lessons: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                objective: { type: "string" },
                summary: { type: "string" },
                keyPoints: { type: "array", items: { type: "string" } },
                examples: { type: "array", items: { type: "string" } },
                exercise: { type: "string" },
                sourceVideoIds: { type: "array", items: { type: "string" } }
              },
              required: ["title", "objective", "summary", "keyPoints", "examples", "sourceVideoIds"]
            }
          },
          body: { type: "array", items: { type: "string" } },
          keyTakeaways: { type: "array", items: { type: "string" } },
          sourceVideoIds: { type: "array", items: { type: "string" } }
        },
        required: ["title", "intro", "keyTakeaways", "sourceVideoIds"]
      }
    },
    glossary: {
      type: "array",
      items: {
        type: "object",
        properties: { term: { type: "string" }, definition: { type: "string" } },
        required: ["term", "definition"]
      }
    },
    finalChecklist: { type: "array", items: { type: "string" } }
  },
  required: ["title", "subtitle", "format", "audience", "estimatedTime", "summary", "learningOutcomes", "sections", "glossary", "finalChecklist"]
};

export async function generateDocument(args: {
  videos: SourceVideo[];
  sourceUrl: string;
  sourceType: "video" | "playlist";
  sourceTitle?: string;
  channel?: string;
  format: OutputFormat;
  audience: string;
  tone: Tone;
  language: string;
}): Promise<GeneratedDocument> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing.");
  const ai = new GoogleGenAI({ apiKey });

  const prepared = args.videos
    .filter(v => v.transcript.trim())
    .map(v => `VIDEO_ID: ${v.id}\nTITLE: ${v.title}\nDESCRIPTION: ${v.description || ""}\nTRANSCRIPT:\n${v.transcript.slice(0, 16000)}`)
    .join("\n\n--- VIDEO ---\n\n");

  if (!prepared.trim()) throw new Error("No usable transcripts were found for this source.");

  const prompt = `You are CourseForge, a senior instructional designer and technical editor. Transform the provided YouTube material into a coherent ${args.format}. Preserve factual meaning. Do not invent facts that the source does not support. Resolve repetition, remove filler, and reorder ideas when this creates a better learning sequence.\n\nOutput format: ${args.format}\nAudience: ${args.audience}\nTone: ${args.tone}\nLanguage: ${args.language}\n\nFor course output, organize sections into lessons with objectives, key points, examples, and an exercise when the source provides enough material. For article or blog output, use body paragraphs and still preserve useful takeaways. Include sourceVideoIds so each major section remains traceable.\n\nSOURCE MATERIAL:\n${prepared}`;

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.25,
      maxOutputTokens: 12000
    }
  });

  const raw = response.text?.trim();
  if (!raw) throw new Error("The model returned an empty response.");
  const parsed = JSON.parse(raw) as Omit<GeneratedDocument, "source" | "generatedAt">;

  return {
    ...parsed,
    source: {
      url: args.sourceUrl,
      type: args.sourceType,
      title: args.sourceTitle,
      channel: args.channel,
      videoCount: args.videos.length
    },
    generatedAt: new Date().toISOString()
  };
}
