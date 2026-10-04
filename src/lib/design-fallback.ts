import { DesignStyle, GeneratedDocument } from "./types";

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));

const THEME: Record<DesignStyle, { bg: string; ink: string; accent: string; card: string; font: string }> = {
  editorial: { bg: "#fbfaf7", ink: "#1b1d22", accent: "#2f5d8a", card: "#ffffff", font: "Georgia, 'Times New Roman', serif" },
  workbook: { bg: "#f3f7f4", ink: "#14231b", accent: "#1f7a4d", card: "#ffffff", font: "system-ui, sans-serif" },
  dashboard: { bg: "#10131a", ink: "#e8ecf4", accent: "#6aa8ff", card: "#181c26", font: "system-ui, sans-serif" },
  slides: { bg: "#17120f", ink: "#f4ede4", accent: "#e0a458", card: "#221a15", font: "Georgia, serif" }
};

export function renderDesignFallback(doc: GeneratedDocument, style: DesignStyle): string {
  const t = THEME[style];
  const lessons = doc.sections.flatMap((s, si) => (s.lessons ?? []).map((l, li) => ({ ...l, si, li })));
  const lessonHtml = (l: (typeof lessons)[number], idx: number) => `
    <article class="card lesson" data-i="${idx}">
      <h3>${esc(l.title)}</h3>
      <p class="obj">${esc(l.objective)}</p>
      <p>${esc(l.summary)}</p>
      <ul>${l.keyPoints.map(k => `<li>${esc(k)}</li>`).join("")}</ul>
      ${l.exercise ? `<details><summary>Practice</summary><p>${esc(l.exercise)}</p></details>` : ""}
      ${style === "workbook" || style === "dashboard" ? `<label class="done"><input type="checkbox" onchange="prog()"> Mark as done</label>` : ""}
      <div class="tags">${l.sourceVideoIds.map(id => `<span>${esc(id)}</span>`).join("")}</div>
    </article>`;
  const body = doc.sections.map((s, si) => `
    <section id="s${si}" class="slide">
      <h2>${esc(s.title)}</h2><p class="intro">${esc(s.intro)}</p>
      ${lessons.filter(l => l.si === si).map(l => lessonHtml(l, lessons.indexOf(l))).join("")}
      ${(s.body ?? []).map(p => `<p>${esc(p)}</p>`).join("")}
      <div class="take"><b>Takeaways</b><ul>${s.keyTakeaways.map(k => `<li>${esc(k)}</li>`).join("")}</ul></div>
    </section>`).join("");
  const toc = doc.sections.map((s, i) => `<a href="#s${i}">${esc(s.title)}</a>`).join("");
  const gloss = doc.glossary.map(g => `<div class="term"><b>${esc(g.term)}</b><span>${esc(g.definition)}</span></div>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(doc.title)}</title>
<style>
:root{--bg:${t.bg};--ink:${t.ink};--accent:${t.accent};--card:${t.card}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.7 ${t.font}}
header{padding:56px 6vw 28px;max-width:980px}h1{font-size:clamp(32px,6vw,58px);line-height:1.05;margin:0 0 12px;letter-spacing:-.02em}
.sub{opacity:.7;max-width:60ch}nav{display:flex;flex-wrap:wrap;gap:8px;padding:0 6vw 20px}nav a{color:var(--ink);border:1px solid color-mix(in srgb,var(--ink) 25%,transparent);padding:6px 12px;border-radius:999px;text-decoration:none;font:14px system-ui}nav a:hover,a:focus-visible{border-color:var(--accent);outline:2px solid var(--accent);outline-offset:2px}
main{padding:0 6vw 80px;max-width:980px}.slide{padding-top:36px}h2{font-size:28px;margin:0 0 6px}.intro{opacity:.75;max-width:62ch}
.card{background:var(--card);border:1px solid color-mix(in srgb,var(--ink) 12%,transparent);border-radius:10px;padding:18px 20px;margin:16px 0}
h3{margin:0 0 4px;font-size:20px}.obj{color:var(--accent);margin:0 0 8px;font-style:italic}ul{padding-left:20px}
details summary{cursor:pointer;color:var(--accent);font:600 14px system-ui}.tags span{display:inline-block;font:12px ui-monospace,monospace;opacity:.6;margin-right:8px}
.take{border-left:3px solid var(--accent);padding-left:14px;margin-top:18px}.done{display:block;margin-top:8px;font:14px system-ui}
.term{display:grid;gap:2px;padding:10px 0;border-bottom:1px solid color-mix(in srgb,var(--ink) 12%,transparent)}.term span{opacity:.75}
#bar{position:sticky;top:0;height:4px;background:color-mix(in srgb,var(--ink) 12%,transparent)}#bar i{display:block;height:100%;width:0;background:var(--accent);transition:width .3s}
input[type=search]{width:100%;padding:10px 12px;border-radius:8px;border:1px solid color-mix(in srgb,var(--ink) 25%,transparent);background:var(--card);color:var(--ink);font:15px system-ui}
${style === "slides" ? `.slide{display:none;min-height:70vh}.slide.on{display:block}.ctl{position:fixed;bottom:16px;right:16px;display:flex;gap:8px;align-items:center;font:14px system-ui}.ctl button{background:var(--accent);color:#111;border:0;border-radius:8px;padding:10px 16px;font-weight:700;cursor:pointer}nav{display:none}` : ""}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style></head><body>
<div id="bar"><i></i></div>
<header><h1>${esc(doc.title)}</h1><p class="sub">${esc(doc.subtitle)}</p><p class="sub">${esc(doc.estimatedTime)} for ${esc(doc.audience)}</p></header>
<nav>${toc}</nav>
<main>
<p class="intro">${esc(doc.summary)}</p>
${style === "dashboard" ? `<div class="card"><b>Progress</b> <span id="pct">0%</span></div><input type="search" id="q" placeholder="Filter glossary" oninput="flt()">` : ""}
${body}
<section class="slide"><h2>Glossary</h2><div id="g">${gloss}</div></section>
<section class="slide"><h2>Final checklist</h2><ul>${doc.finalChecklist.map(c => `<li>${esc(c)}</li>`).join("")}</ul></section>
</main>
${style === "slides" ? `<div class="ctl"><button onclick="go(-1)">Back</button><span id="n"></span><button onclick="go(1)">Next</button></div>` : ""}
<script>
function prog(){var a=document.querySelectorAll('.done input'),d=document.querySelectorAll('.done input:checked').length;var p=a.length?Math.round(d/a.length*100):0;document.querySelector('#bar i').style.width=p+'%';var e=document.getElementById('pct');if(e)e.textContent=p+'%'}
function flt(){var v=document.getElementById('q').value.toLowerCase();document.querySelectorAll('.term').forEach(function(t){t.style.display=t.textContent.toLowerCase().includes(v)?'':'none'})}
${style === "slides" ? `var s=[].slice.call(document.querySelectorAll('.slide')),k=0;function go(d){k=Math.max(0,Math.min(s.length-1,k+d));s.forEach(function(x,i){x.classList.toggle('on',i===k)});document.getElementById('n').textContent=(k+1)+' / '+s.length;document.querySelector('#bar i').style.width=((k+1)/s.length*100)+'%'}document.addEventListener('keydown',function(e){if(e.key==='ArrowRight')go(1);if(e.key==='ArrowLeft')go(-1)});go(0);` : ""}
</script></body></html>`;
}
