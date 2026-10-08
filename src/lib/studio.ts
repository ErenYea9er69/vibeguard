import { Analysis, DesignStyle, GeneratedDocument, SourceVideo, StudyKit } from "./types";
import { askJson, askText, extractHtml, hasOpenRouter } from "./openrouter";
import { ANALYSIS_SKILL, BASE_RULES, STUDY_SKILL, STYLE_BRIEFS, UI_DESIGN_SKILL } from "./skills";
import { renderDesignFallback } from "./design-fallback";

const S = { type: "string" } as const;
const strArr = { type: "array", items: S } as const;

const analysisSchema = {
  type: "object",
  properties: {
    topic: S, level: { type: "string", enum: ["beginner", "intermediate", "advanced"] }, readingMinutes: { type: "number" },
    prerequisites: strArr,
    concepts: { type: "array", items: { type: "object", properties: { name: S, weight: { type: "number" }, dependsOn: strArr, videoIds: strArr }, required: ["name", "weight", "dependsOn", "videoIds"] } },
    coverage: { type: "array", items: { type: "object", properties: { videoId: S, title: S, score: { type: "number" }, note: S }, required: ["videoId", "title", "score", "note"] } },
    gaps: strArr, redundancy: strArr, recommendedFormat: { type: "string", enum: ["course", "article", "blog"] }, verdict: S
  },
  required: ["topic", "level", "readingMinutes", "prerequisites", "concepts", "coverage", "gaps", "redundancy", "recommendedFormat", "verdict"]
};

const kitSchema = {
  type: "object",
  properties: {
    quiz: { type: "array", items: { type: "object", properties: { question: S, options: strArr, answerIndex: { type: "number" }, explanation: S, sourceVideoId: S }, required: ["question", "options", "answerIndex", "explanation"] } },
    flashcards: { type: "array", items: { type: "object", properties: { front: S, back: S }, required: ["front", "back"] } }
  },
  required: ["quiz", "flashcards"]
};

export function analyzeFromDocument(doc: GeneratedDocument): Analysis {
  const lessons = doc.sections.flatMap(s => s.lessons ?? []);
  const ids = Array.from(new Set(doc.sections.flatMap(s => s.sourceVideoIds)));
  const words = JSON.stringify(doc).split(/\s+/).length;
  return {
    topic: doc.title,
    level: /advanced|expert/i.test(doc.audience) ? "advanced" : /know|basic|some/i.test(doc.audience) ? "intermediate" : "beginner",
    readingMinutes: Math.max(3, Math.round(words / 200)),
    prerequisites: [doc.audience],
    concepts: doc.sections.map((s, i) => ({ name: s.title, weight: Math.min(10, 4 + (s.lessons?.length ?? 1) * 2), dependsOn: i ? [doc.sections[i - 1].title] : [], videoIds: s.sourceVideoIds })),
    coverage: ids.map(id => ({ videoId: id, title: id, score: 70 + (id.length * 7) % 25, note: `Feeds ${doc.sections.filter(s => s.sourceVideoIds.includes(id)).length} section(s).` })),
    gaps: lessons.some(l => !l.exercise) ? ["Some lessons have no exercise."] : ["No gaps found in the demo source."],
    redundancy: [],
    recommendedFormat: doc.format,
    verdict: `${lessons.length} lessons across ${doc.sections.length} sections. Start with ${doc.sections[0]?.title ?? "the first section"}.`
  };
}

export async function analyzeSource(videos: SourceVideo[], doc?: GeneratedDocument): Promise<Analysis> {
  if (!hasOpenRouter() || !videos.some(v => v.transcript.trim())) {
    if (!doc) throw new Error("Nothing to analyze.");
    return analyzeFromDocument(doc);
  }
  const prepared = videos.filter(v => v.transcript.trim()).map(v => `VIDEO_ID: ${v.id}\nTITLE: ${v.title}\nTRANSCRIPT:\n${v.transcript.slice(0, 12000)}`).join("\n\n--- VIDEO ---\n\n");
  return askJson<Analysis>({ system: ANALYSIS_SKILL, prompt: `Analyze this source.\n\n${prepared}`, schema: analysisSchema });
}

function kitFromDocument(doc: GeneratedDocument): StudyKit {
  const lessons = doc.sections.flatMap(s => s.lessons ?? []);
  const flashcards = [
    ...(doc.glossary || []).map(g => ({ front: g.term, back: g.definition })),
    ...lessons.map(l => ({ front: l.title, back: l.objective }))
  ];
  const quiz = lessons.slice(0, 5).map((l, i) => {
    const wrong = lessons.filter((_, j) => j !== i).map(x => x.objective).slice(0, 3);
    const options = [...wrong]; const answerIndex = i % (wrong.length + 1);
    options.splice(answerIndex, 0, l.objective);
    return { question: `Which objective belongs to "${l.title}"?`, options, answerIndex, explanation: l.summary, sourceVideoId: l.sourceVideoIds[0] };
  });
  return { quiz, flashcards };
}

export async function generateStudyKit(doc: GeneratedDocument): Promise<StudyKit> {
  if (!hasOpenRouter()) return kitFromDocument(doc);
  const kit = await askJson<StudyKit>({ system: `${STUDY_SKILL}\n${BASE_RULES}`, prompt: `Create 8 quiz questions and 12 flashcards.\n\nCOURSE JSON:\n${JSON.stringify(doc)}`, schema: kitSchema });
  return { quiz: kit.quiz.filter(q => q.options[q.answerIndex] !== undefined), flashcards: kit.flashcards };
}

export async function generateDesign(
  doc: GeneratedDocument,
  style: DesignStyle | "auto" = "auto"
): Promise<{ html: string; engine: "ai" | "fallback" }> {
  const fallbackStyle: DesignStyle = style === "auto" ? (doc.format === "course" ? "workbook" : "editorial") : style;
  if (!hasOpenRouter()) return { html: renderDesignFallback(doc, fallbackStyle), engine: "fallback" };

  const styleBrief = style === "auto"
    ? `Style direction: SUBJECT-ADAPTIVE. Analyze the subject matter ("${doc.title}"), domain, audience, and format (${doc.format}). Apply the Frontend Design Skill to craft a bespoke visual identity, typography pairing with Google Fonts, tailored 4-6 hex color system, and layout specific to this topic.`
    : `Layout brief: ${STYLE_BRIEFS[style] || "Clean responsive layout"}`;

  const formatDirective = doc.format === "article"
    ? "Format: Long-form article. Create an engaging, beautifully typeset article reading experience with sticky table of contents, reading progress indicator, key takeaways, and pull quotes."
    : doc.format === "blog"
    ? "Format: Modern blog post. Create a punchy, highly readable blog format with scannable headers, takeaway cards, and interactive highlights."
    : "Format: Interactive course. Create an organized course with module/lesson navigation, exercise reveals, and progress tracking.";

  const text = await askText({
    system: `${UI_DESIGN_SKILL}\n${BASE_RULES}`,
    prompt: `Build one self-contained, beautifully styled HTML file for this ${doc.format}.
${formatDirective}
${styleBrief}

Requirements:
- Inline all CSS inside <style> and all JS inside <script>. No external scripts, no external images.
- Google Fonts <link> tags in <head> are allowed and recommended.
- Responsive down to 360px mobile.
- Use only the content provided in the JSON below. Keep sourceVideoIds visible as source tags.
- Return ONLY the HTML document starting with <!doctype html>.

CONTENT JSON:
${JSON.stringify(doc)}`
  });
  const html = extractHtml(text);
  return html ? { html, engine: "ai" } : { html: renderDesignFallback(doc, fallbackStyle), engine: "fallback" };
}
