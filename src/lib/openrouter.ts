export const DEFAULT_OPENROUTER_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";

export function getOpenRouterApiKey(): string {
  return process.env.OPENROUTER_API_KEY || "";
}

export function getOpenRouterModel(): string {
  return process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;
}

export function hasOpenRouter(): boolean {
  return Boolean(getOpenRouterApiKey());
}

export function extractJsonString(text: string): string {
  let cleaned = text.trim();
  // Remove markdown code fences if wrapped in ```json ... ``` or ``` ... ```
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }
  // Trim any prefix or suffix outside of the outermost JSON object or array
  const firstCurly = cleaned.indexOf("{");
  const firstSquare = cleaned.indexOf("[");
  let startIdx = -1;
  if (firstCurly !== -1 && firstSquare !== -1) {
    startIdx = Math.min(firstCurly, firstSquare);
  } else if (firstCurly !== -1) {
    startIdx = firstCurly;
  } else {
    startIdx = firstSquare;
  }

  const lastCurly = cleaned.lastIndexOf("}");
  const lastSquare = cleaned.lastIndexOf("]");
  const endIdx = Math.max(lastCurly, lastSquare);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.slice(startIdx, endIdx + 1);
  }

  return cleaned;
}

export function extractHtml(text: string): string {
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.search(/<!doctype html|<html/i);
  return start >= 0 ? body.slice(start) : "";
}

export async function askOpenRouterText(args: {
  system?: string;
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not configured in .env. Please configure your OpenRouter API key to use Nvidia Nemotron AI."
    );
  }

  const requestedModel = args.model || getOpenRouterModel();
  const models = [
    requestedModel,
    "openrouter/free",
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
  ].filter((v, i, a) => a.indexOf(v) === i);

  const messages: { role: string; content: string }[] = [];

  if (args.system) {
    messages.push({ role: "system", content: args.system });
  }
  messages.push({ role: "user", content: args.prompt });

  let lastError: unknown;
  for (let attempt = 1; attempt <= 1; attempt++) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "CourseForge",
        },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          models,
          messages,
          include_reasoning: false,
          temperature: args.temperature ?? 0.3,
          max_tokens: args.maxTokens ?? 3500,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`OpenRouter API error (${res.status}): ${errText || res.statusText}`);
      }

      const data = await res.json();
      if (data.error) {
        const errMessage = typeof data.error === "string" ? data.error : data.error.message || JSON.stringify(data.error);
        throw new Error(`OpenRouter model error (${data.error.code || res.status}): ${errMessage}`);
      }

      const content = data.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string" || !content.trim()) {
        throw new Error("OpenRouter model returned an empty response.");
      }

      return content.trim();
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("OpenRouter request failed.");
}

export async function askOpenRouterJson<T>(args: {
  system?: string;
  prompt: string;
  schema?: object;
  model?: string;
  maxTokens?: number;
}): Promise<T> {
  const systemPrompt = `${args.system || ""}\n\nIMPORTANT: You MUST respond ONLY with valid JSON matching the requested structure. Do not output markdown code blocks, conversational introductions, or commentary. Output pure, parseable JSON.`;

  const raw = await askOpenRouterText({
    system: systemPrompt,
    prompt: args.prompt,
    model: args.model,
    temperature: 0.2,
    maxTokens: args.maxTokens ?? 12000,
  });

  const cleaned = extractJsonString(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    console.error("Failed to parse OpenRouter JSON output:", raw);
    throw new Error(`Failed to parse AI output as JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function askJson<T>(args: {
  system: string;
  prompt: string;
  schema?: object;
  maxTokens?: number;
}): Promise<T> {
  return askOpenRouterJson<T>({
    system: args.system,
    prompt: args.schema
      ? `${args.prompt}\n\nTarget Schema Structure:\n${JSON.stringify(args.schema, null, 2)}`
      : args.prompt,
    schema: args.schema,
    model: getOpenRouterModel(),
    maxTokens: args.maxTokens,
  });
}

export async function askText(args: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string> {
  return askOpenRouterText({
    system: args.system,
    prompt: args.prompt,
    model: getOpenRouterModel(),
    temperature: 0.5,
    maxTokens: args.maxTokens ?? 16000,
  });
}
