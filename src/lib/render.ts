import { GeneratedDocument } from "./types";

function escapeHtml(input: string) {
  return input.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
}

export function renderHtml(doc: GeneratedDocument) {
  const sections = doc.sections.map((section, index) => `
    <section class="section">
      <div class="eyebrow">${doc.format === "course" ? `SECTION ${String(index + 1).padStart(2, "0")}` : `PART ${String(index + 1).padStart(2, "0")}`}</div>
      <h2>${escapeHtml(section.title)}</h2>
      ${section.intro ? `<p class="intro">${escapeHtml(section.intro)}</p>` : ""}
      ${section.lessons?.map((lesson, lessonIndex) => `
        <article class="lesson">
          <div class="lesson-number">${lessonIndex + 1}</div>
          <div>
            <h3>${escapeHtml(lesson.title)}</h3>
            ${lesson.objective ? `<p><strong>Objective:</strong> ${escapeHtml(lesson.objective)}</p>` : ""}
            <p>${escapeHtml(lesson.summary)}</p>
            ${lesson.keyPoints?.length ? `<h4>Key points</h4><ul>${lesson.keyPoints.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : ""}
            ${lesson.examples?.length ? `<h4>Examples</h4><ul>${lesson.examples.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : ""}
            ${lesson.exercise && doc.format === "course" ? `<div class="exercise"><strong>Practice</strong><p>${escapeHtml(lesson.exercise)}</p></div>` : ""}
          </div>
        </article>
      `).join("") || ""}
      ${section.body?.map(p => `<p>${escapeHtml(p)}</p>`).join("") || ""}
      ${section.keyTakeaways?.length ? `<div class="takeaways"><h4>Key takeaways</h4><ul>${section.keyTakeaways.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul></div>` : ""}
    </section>`).join("");

  const outcomesBlock = doc.learningOutcomes?.length
    ? `<section class="section"><div class="eyebrow">LEARNING OUTCOMES</div><ul>${doc.learningOutcomes.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul></section>`
    : "";

  const conclusionBlock = doc.conclusion
    ? `<section class="section"><div class="eyebrow">CONCLUSION</div><p>${escapeHtml(doc.conclusion)}</p></section>`
    : "";

  const glossaryBlock = doc.glossary?.length
    ? `<section class="section"><div class="eyebrow">GLOSSARY</div>${doc.glossary.map(x => `<p><strong>${escapeHtml(x.term)}</strong><br/>${escapeHtml(x.definition)}</p>`).join("")}</section>`
    : "";

  const checklistBlock = doc.finalChecklist?.length
    ? `<section class="section"><div class="eyebrow">FINAL CHECKLIST</div><ul>${doc.finalChecklist.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul></section>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(doc.title)}</title>
<style>
@page { size: A4; margin: 18mm; }
* { box-sizing: border-box; }
body { margin: 0; color: #16181d; font-family: Inter, Arial, sans-serif; line-height: 1.7; background: #f4f5f7; }
main { max-width: 820px; margin: 0 auto; background: #fff; padding: 52px; }
.cover { padding: 42px 0 60px; border-bottom: 2px solid #111; }
.kicker,.eyebrow { color: #6f43ff; font-size: 12px; letter-spacing: .18em; font-weight: 700; }
h1 { font-size: 44px; line-height: 1.05; margin: 14px 0 18px; letter-spacing: -.04em; }
h2 { font-size: 27px; line-height: 1.15; margin: 8px 0 10px; }
h3 { font-size: 19px; margin: 0 0 8px; }
h4 { font-size: 13px; text-transform: uppercase; letter-spacing: .12em; margin: 20px 0 6px; }
p { margin: 8px 0; }
.muted { color: #737984; }
.meta { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-top: 26px; }
.meta div { border: 1px solid #e4e6ea; border-radius: 12px; padding: 12px; font-size: 12px; }
.section { margin-top: 48px; break-inside: avoid; }
.intro { font-size: 17px; color: #545b67; }
.lesson { display: grid; grid-template-columns: 42px 1fr; gap: 18px; margin: 25px 0; }
.lesson-number { width: 32px; height: 32px; border: 1px solid #111; border-radius: 50%; display: grid; place-items: center; font-weight: 700; }
ul { padding-left: 18px; }
li { margin: 4px 0; }
.exercise,.takeaways { margin-top: 18px; padding: 14px 16px; background: #f5f2ff; border-left: 3px solid #6f43ff; }
.takeaways { background: #f2fbff; border-left-color: #00a4c8; }
.small { font-size: 12px; }
@media print { body { background:#fff; } main { padding:0; } }
</style>
</head>
<body>
<main>
<section class="cover">
<div class="kicker">COURSEFORGE · ${escapeHtml(doc.format.toUpperCase())}</div>
<h1>${escapeHtml(doc.title)}</h1>
<p class="muted">${escapeHtml(doc.subtitle)}</p>
<div class="meta">
<div><strong>Format</strong><br/>${escapeHtml(doc.format)}</div>
<div><strong>Audience</strong><br/>${escapeHtml(doc.audience)}</div>
<div><strong>Estimated time</strong><br/>${escapeHtml(doc.estimatedTime)}</div>
</div>
<p class="small muted" style="margin-top:22px">Source: ${escapeHtml(doc.source?.title || doc.source?.url || "Custom Input")} · ${doc.source?.videoCount || 1} video(s)</p>
</section>
<section class="section"><div class="eyebrow">OVERVIEW</div><p>${escapeHtml(doc.summary)}</p></section>
${outcomesBlock}
${sections}
${conclusionBlock}
${glossaryBlock}
${checklistBlock}
</main>
</body>
</html>`;
}

export function renderMarkdown(doc: GeneratedDocument): string {
  const parts: string[] = [];
  parts.push(`# ${doc.title}`);
  if (doc.subtitle) parts.push(`\n*${doc.subtitle}*\n`);
  parts.push(`> **Format**: ${doc.format.toUpperCase()} | **Audience**: ${doc.audience} | **Estimated time**: ${doc.estimatedTime}\n`);
  parts.push(`## Summary\n\n${doc.summary}\n`);

  if (doc.learningOutcomes?.length) {
    parts.push(`### Learning Outcomes\n`);
    for (const outcome of doc.learningOutcomes) {
      parts.push(`- ${outcome}`);
    }
    parts.push("");
  }

  for (let i = 0; i < doc.sections.length; i++) {
    const section = doc.sections[i];
    parts.push(`## Section ${String(i + 1).padStart(2, "0")}: ${section.title}\n`);
    if (section.intro) parts.push(`${section.intro}\n`);

    if (section.lessons?.length) {
      for (let j = 0; j < section.lessons.length; j++) {
        const lesson = section.lessons[j];
        parts.push(`### Lesson ${j + 1}: ${lesson.title}\n`);
        if (lesson.objective) parts.push(`**Objective**: ${lesson.objective}\n`);
        parts.push(`${lesson.summary}\n`);
        if (lesson.keyPoints?.length) {
          parts.push(`**Key Points:**`);
          for (const kp of lesson.keyPoints) parts.push(`- ${kp}`);
          parts.push("");
        }
        if (lesson.examples?.length) {
          parts.push(`**Examples:**`);
          for (const ex of lesson.examples) parts.push(`- ${ex}`);
          parts.push("");
        }
        if (lesson.exercise && doc.format === "course") {
          parts.push(`> **Practice Task**: ${lesson.exercise}\n`);
        }
      }
    }

    if (section.body?.length) {
      for (const p of section.body) parts.push(`${p}\n`);
    }

    if (section.keyTakeaways?.length) {
      parts.push(`**Key Takeaways:**`);
      for (const t of section.keyTakeaways) parts.push(`- ${t}`);
      parts.push("");
    }
  }

  if (doc.conclusion) {
    parts.push(`## Conclusion\n\n${doc.conclusion}\n`);
  }

  if (doc.glossary?.length) {
    parts.push(`## Glossary\n`);
    for (const g of doc.glossary) {
      parts.push(`- **${g.term}**: ${g.definition}`);
    }
    parts.push("");
  }

  if (doc.finalChecklist?.length) {
    parts.push(`## Final Checklist\n`);
    for (const item of doc.finalChecklist) {
      parts.push(`- [ ] ${item}`);
    }
    parts.push("");
  }

  parts.push(`---\n*Source: ${doc.source?.title || doc.source?.url || "YouTube"} (${doc.source?.videoCount || 1} video(s)) · Generated by CourseForge*`);
  return parts.join("\n");
}
