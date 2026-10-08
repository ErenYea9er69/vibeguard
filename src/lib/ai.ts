import { GeneratedDocument, OutputFormat, SourceVideo, Tone } from "./types";
import { askOpenRouterJson, hasOpenRouter, getOpenRouterModel } from "./openrouter";
import { WRITING_RULES_PROMPT, BANNED_WORDS } from "./rules";

export { WRITING_RULES_PROMPT, BANNED_WORDS };

const articleSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    format: { type: "string", enum: ["article"] },
    audience: { type: "string" },
    estimatedTime: { type: "string" },
    summary: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          intro: { type: "string" },
          body: { type: "array", items: { type: "string" } },
          keyTakeaways: { type: "array", items: { type: "string" } },
          sourceVideoIds: { type: "array", items: { type: "string" } }
        },
        required: ["title", "body", "keyTakeaways", "sourceVideoIds"]
      }
    },
    conclusion: { type: "string" }
  },
  required: ["title", "subtitle", "format", "audience", "estimatedTime", "summary", "sections", "conclusion"]
};

const blogSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    format: { type: "string", enum: ["blog"] },
    audience: { type: "string" },
    estimatedTime: { type: "string" },
    summary: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          body: { type: "array", items: { type: "string" } },
          keyTakeaways: { type: "array", items: { type: "string" } },
          sourceVideoIds: { type: "array", items: { type: "string" } }
        },
        required: ["title", "body", "keyTakeaways", "sourceVideoIds"]
      }
    },
    conclusion: { type: "string" }
  },
  required: ["title", "subtitle", "format", "audience", "estimatedTime", "summary", "sections", "conclusion"]
};

const courseSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    format: { type: "string", enum: ["course"] },
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
  required: ["title", "subtitle", "format", "audience", "estimatedTime", "summary", "learningOutcomes", "sections"]
};

function cleanText(text: string): string {
  if (typeof text !== "string") return text;
  return text
    .replace(/[\u2014\u2013]/g, ", ")
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/[*#]/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .trim();
}

function sanitizeDocument<T>(value: T): T {
  if (typeof value === "string") {
    return cleanText(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeDocument) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      res[k] = sanitizeDocument(v);
    }
    return res as T;
  }
  return value;
}

export type GenerateDocumentArgs = {
  videos: SourceVideo[];
  sourceUrl: string;
  sourceType: "video" | "playlist";
  sourceTitle?: string;
  channel?: string;
  format: OutputFormat;
  audience: string;
  tone: Tone;
  language: string;
  strictRules?: boolean;
};

export type AiProgressCallback = (info: {
  stage: "preparing" | "synthesizing" | "complete";
  message: string;
}) => void;

function generateStructuredFallback(args: GenerateDocumentArgs): any {
  const primaryVideo = args.videos[0];
  const fullTranscript = args.videos.map(v => v.transcript).filter(Boolean).join("\n\n") || primaryVideo?.description || "";
  const title = args.sourceTitle || primaryVideo?.title || "Video Analysis";
  const channel = args.channel || primaryVideo?.channel || "Featured Creator";
  const audience = args.audience && args.audience.trim() ? args.audience.trim() : "General Readers & Learners";

  // Split transcript into sentences
  const sentences = fullTranscript
    .split(/(?<=[.!?؟\n])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 20);

  const totalSentences = sentences.length;
  const numSections = Math.min(4, Math.max(2, Math.floor(totalSentences / 8)));
  const chunkSize = Math.max(4, Math.ceil(totalSentences / numSections));

  const sections: any[] = [];
  for (let i = 0; i < numSections; i++) {
    const chunk = sentences.slice(i * chunkSize, (i + 1) * chunkSize);
    if (chunk.length === 0) continue;

    const sectionTitle = i === 0
      ? `Introduction & Foundational Context`
      : i === numSections - 1
      ? `Core Insights & Final Perspectives`
      : `Key Arguments & Detailed Exploration (${i + 1})`;

    const half = Math.ceil(chunk.length / 2);
    const body = [
      chunk.slice(0, half).join(" "),
      chunk.slice(half).join(" ")
    ].filter(p => p.trim().length > 30);

    const takeaways = chunk.slice(0, 3).map(s => {
      const clean = s.replace(/^[•\-*]\s*/, "");
      return clean.length > 120 ? clean.slice(0, 117) + "..." : clean;
    });

    if (takeaways.length === 0) {
      takeaways.push(`Key discussion on ${title} and associated principles.`);
    }

    sections.push({
      id: `sec-${i + 1}`,
      title: sectionTitle,
      intro: chunk[0] || "",
      body: body.length > 0 ? body : [chunk.join(" ")],
      keyTakeaways: takeaways,
      sourceVideoIds: primaryVideo ? [primaryVideo.id] : []
    });
  }

  const summary = sentences.slice(0, 3).join(" ") || `Comprehensive overview of ${title} presented by ${channel}.`;
  const conclusion = sentences.slice(-3).join(" ") || `In conclusion, this material highlights foundational aspects and critical insights into ${title}.`;

  if (args.format === "course") {
    return {
      title,
      subtitle: `Structured courseware derived from ${channel}`,
      format: "course",
      audience,
      estimatedTime: "25 min",
      summary,
      learningOutcomes: [
        `Understand core mechanisms explored in ${title}`,
        `Analyze key principles and context from source transcripts`,
        `Apply theoretical and practical insights to real-world scenarios`
      ],
      sections: sections.map(s => ({
        ...s,
        lessons: [
          {
            title: s.title,
            objective: `Understand the primary concepts outlined in this section`,
            summary: s.intro,
            keyPoints: s.keyTakeaways,
            examples: [s.body[0] || s.intro],
            sourceVideoIds: s.sourceVideoIds
          }
        ]
      })),
      glossary: [],
      finalChecklist: [
        `Reviewed all core ideas of ${title}`,
        `Synthesized key takeaways into actionable notes`
      ]
    };
  }

  return {
    title,
    subtitle: `In-depth exploration and synthesis based on ${channel}`,
    format: args.format,
    audience,
    estimatedTime: `${Math.max(5, Math.round(fullTranscript.split(/\s+/).length / 200))} min read`,
    summary,
    sections,
    conclusion
  };
}

export async function generateDocument(
  args: GenerateDocumentArgs,
  onProgress?: AiProgressCallback
): Promise<GeneratedDocument> {
  const prepared = args.videos
    .filter(v => v.transcript.trim())
    .map(v => `VIDEO_ID: ${v.id}\nTITLE: ${v.title}\nDESCRIPTION: ${v.description || ""}\nTRANSCRIPT:\n${v.transcript.slice(0, 16000)}`)
    .join("\n\n--- VIDEO ---\n\n");

  if (!prepared.trim()) throw new Error("No usable transcripts were found for this source.");

  const totalWords = args.videos.reduce((acc, v) => acc + (v.transcript ? v.transcript.split(/\s+/).filter(Boolean).length : 0), 0);

  onProgress?.({
    stage: "preparing",
    message: `Prepared ${totalWords.toLocaleString()} words across ${args.videos.length} video(s) for AI synthesis`
  });

  const applyRules = args.strictRules !== false;
  const rulesSection = applyRules ? `\n\n${WRITING_RULES_PROMPT}` : "";

  const audienceDirective = args.audience && args.audience.trim()
    ? `Audience: ${args.audience.trim()}`
    : `Audience: [AUTO-DETECT]. The audience was not specified. Analyze the video topic, depth, and prerequisite knowledge. Deduce the exact target learner/reader persona and write this into the "audience" field in the output document.`;

  const languageDirective = args.language === "auto" || !args.language
    ? "Language: [AUTO-DETECT]. Automatically detect the primary language used in the source video material, and write the complete document in that exact same language (e.g., if the video is in Arabic, generate in Arabic; if French, French; if Spanish, Spanish; if English, English)."
    : `Language: ${args.language}`;

  let formatDirective = "";
  let targetSchema: object = articleSchema;

  if (args.format === "article") {
    targetSchema = articleSchema;
    formatDirective = `CRITICAL FORMAT REQUIREMENT: Transform the source material into an in-depth, publication-quality ARTICLE.
- Organize the article into substantive sections. Each section must feature comprehensive, well-developed body paragraphs that explore the ideas, mechanisms, context, and arguments presented in the source video.
- For each section, provide 2 to 4 bulleted key takeaways capturing the critical insights.
- Provide a summary/introduction at the beginning and a synthesizing conclusion at the end.
- STRICT PROHIBITION: Do NOT include quizzes, exercises, flashcards, lessons, or classroom homework. The user requested an ARTICLE. Deliver pure long-form article prose.`;
  } else if (args.format === "blog") {
    targetSchema = blogSchema;
    formatDirective = `CRITICAL FORMAT REQUIREMENT: Transform the source material into a modern, engaging, and scannable BLOG POST.
- Write punchy, readable body paragraphs grouped under compelling section titles.
- Highlight standout takeaways and quotes for each section.
- Provide an engaging opening hook/summary and a memorable conclusion.
- STRICT PROHIBITION: Do NOT include quizzes, exercises, flashcards, lessons, or classroom tasks. Deliver a clean blog post.`;
  } else {
    targetSchema = courseSchema;
    formatDirective = `CRITICAL FORMAT REQUIREMENT: Transform the source material into a structured COURSE. Organize sections into lessons with objectives, key points, examples, and takeaways. Include sourceVideoIds for traceability.`;
  }

  const prompt = `You are CourseForge, an expert editorial and technical author. Transform the provided YouTube material into a coherent ${args.format}. Preserve factual meaning. Do not invent facts that the source does not support. Resolve repetition, remove filler, and reorder ideas when this creates a better narrative sequence.

Output format: ${args.format}
${audienceDirective}
Tone: ${args.tone}
${languageDirective}

${formatDirective}${rulesSection}

SOURCE MATERIAL:
${prepared}`;

  if (!hasOpenRouter()) {
    throw new Error(
      "OPENROUTER_API_KEY is not configured in .env. Please configure your OpenRouter API key to use Nvidia Nemotron AI."
    );
  }

  const modelName = getOpenRouterModel();
  const formatNoun = args.format === "article" ? "in-depth article sections & takeaways" : args.format === "blog" ? "blog post sections & key insights" : "curriculum modules & lessons";
  onProgress?.({
    stage: "synthesizing",
    message: `NVIDIA Nemotron AI (${modelName}) is structuring ${formatNoun}...`
  });

  let parsedJson: any;
  try {
    parsedJson = await askOpenRouterJson({
      system: `You are CourseForge, an expert technical and editorial author. Return ONLY a valid JSON object matching the requested schema. ${rulesSection}`,
      prompt: `${prompt}\n\nTarget JSON Schema Structure:\n${JSON.stringify(targetSchema, null, 2)}`,
      model: modelName,
      schema: targetSchema,
      maxTokens: 3500
    });
  } catch (err) {
    console.warn("Primary AI synthesis timed out or failed, using robust structured fallback:", err);
    parsedJson = generateStructuredFallback(args);
  }

  const parsed = (applyRules ? sanitizeDocument(parsedJson) : parsedJson) as Omit<GeneratedDocument, "source" | "generatedAt">;

  return {
    ...parsed,
    format: args.format,
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
