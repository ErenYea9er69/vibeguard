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

export type AiProgressCallback = (info: {
  stage: "preparing" | "synthesizing" | "complete";
  message: string;
}) => void;

export async function generateDocument(
  args: {
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
  },
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

  const parsedJson = await askOpenRouterJson({
    system: `You are CourseForge, an expert technical and editorial author. Return ONLY a valid JSON object matching the requested schema. ${rulesSection}`,
    prompt: `${prompt}\n\nTarget JSON Schema Structure:\n${JSON.stringify(targetSchema, null, 2)}`,
    model: modelName,
    schema: targetSchema,
    maxTokens: 12000
  });

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
