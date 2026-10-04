"use client";

import { FormEvent, useMemo, useState } from "react";
import { ArrowRight, Check, ChevronDown, Download, FileJson, FileText, Globe2, Loader2, PlaySquare, Sparkles } from "lucide-react";
import { GeneratedDocument, OutputFormat, Tone } from "@/lib/types";

const presets = {
  course: { label: "Course", icon: PlaySquare, desc: "Lessons, objectives, examples, exercises" },
  article: { label: "Article", icon: FileText, desc: "Structured long-form reading" },
  blog: { label: "Blog", icon: Sparkles, desc: "Scannable sections and takeaways" }
} satisfies Record<OutputFormat, { label: string; icon: typeof PlaySquare; desc: string }>;

export default function Builder() {
  const [sourceUrl, setSourceUrl] = useState("");
  const [format, setFormat] = useState<OutputFormat>("course");
  const [tone, setTone] = useState<Tone>("practical");
  const [audience, setAudience] = useState("Developers who know the basics and want a practical, structured path.");
  const [language, setLanguage] = useState("en");
  const [maxVideos, setMaxVideos] = useState(12);
  const [doc, setDoc] = useState<GeneratedDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState("");

  const stats = useMemo(() => ({
    sections: doc?.sections.length || 0,
    lessons: doc?.sections.reduce((sum, section) => sum + (section.lessons?.length || 0), 0) || 0,
    sources: doc?.source.videoCount || 0
  }), [doc]);

  async function generate(event?: FormEvent) {
    event?.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: sourceUrl || "https://www.youtube.com/playlist?list=DEMO", format, tone, audience, language, maxVideos })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed.");
      setDoc(data);
      window.scrollTo({ top: window.innerHeight + 500, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function exportDocument(format: "pdf" | "html" | "json") {
    if (!doc) return;
    setExporting(format);
    try {
      const res = await fetch(`/api/export/${format}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(doc) });
      if (!res.ok) throw new Error("Export failed.");
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `courseforge.${format}`;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting("");
    }
  }

  return <div className="min-h-screen">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
      <div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl bg-white text-black font-black">C</div><div><div className="font-semibold tracking-tight">CourseForge</div><div className="text-[11px] text-zinc-500">source → learning artifact</div></div></div>
      <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5 text-xs text-zinc-400 md:flex"><Globe2 size={13}/> Next.js · Tailwind · Gemini</div>
    </header>

    <main className="mx-auto max-w-7xl px-6 pb-20 lg:px-10">
      <section className="grid-bg glow overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.025] px-6 py-10 md:px-10 md:py-14">
        <div className="max-w-4xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-xs text-violet-200"><Sparkles size={13}/> Turn long-form video into something you can actually study</div>
          <h1 className="text-4xl font-semibold tracking-[-0.05em] text-white md:text-6xl">Drop a YouTube course.<br/><span className="text-zinc-500">Get a real learning artifact.</span></h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400">CourseForge pulls video structure and transcripts, removes repetition, rebuilds the knowledge in a coherent order, then exports it as a course, article, blog, JSON, HTML, or PDF.</p>
        </div>

        <form onSubmit={generate} className="mt-10 grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
          <div className="rounded-2xl border border-white/10 bg-[#08090d]/90 p-5">
            <label className="text-xs font-medium text-zinc-400">YouTube source</label>
            <div className="mt-2 flex rounded-xl border border-white/10 bg-black/20 px-4 py-3 focus-within:border-violet-400/60"><PlaySquare className="mr-3 mt-0.5 text-zinc-600" size={18}/><input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://youtube.com/playlist?list=..." className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-700"/></div>
            <div className="mt-3 text-xs text-zinc-600">Accepts a playlist URL, a single video URL, playlist ID, or video ID.</div>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {(Object.keys(presets) as OutputFormat[]).map(key => {
                const preset = presets[key]; const Icon = preset.icon; const active = format === key;
                return <button key={key} type="button" onClick={() => setFormat(key)} className={`rounded-xl border p-4 text-left transition ${active ? "border-violet-400/60 bg-violet-400/10" : "border-white/8 bg-white/[.02] hover:bg-white/[.04]"}`}><Icon size={17} className={active ? "text-violet-300" : "text-zinc-500"}/><div className="mt-3 text-sm font-medium">{preset.label}</div><div className="mt-1 text-xs leading-5 text-zinc-500">{preset.desc}</div></button>
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#08090d]/90 p-5">
            <div className="text-xs font-medium text-zinc-400">Generation settings</div>
            <label className="mt-5 block text-xs text-zinc-600">Audience</label>
            <textarea value={audience} onChange={e => setAudience(e.target.value)} rows={3} className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-zinc-200 outline-none focus:border-violet-400/60"/>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="relative"><span className="text-xs text-zinc-600">Tone</span><select value={tone} onChange={e => setTone(e.target.value as Tone)} className="mt-2 w-full appearance-none rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none"><option value="practical">Practical</option><option value="clear">Clear</option><option value="technical">Technical</option><option value="academic">Academic</option></select><ChevronDown className="pointer-events-none absolute right-3 top-9 text-zinc-600" size={15}/></label>
              <label className="relative"><span className="text-xs text-zinc-600">Language</span><select value={language} onChange={e => setLanguage(e.target.value)} className="mt-2 w-full appearance-none rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none"><option value="en">English</option><option value="fr">French</option><option value="ar">Arabic</option><option value="es">Spanish</option></select><ChevronDown className="pointer-events-none absolute right-3 top-9 text-zinc-600" size={15}/></label>
            </div>
            <label className="mt-4 block text-xs text-zinc-600">Max videos: <span className="text-zinc-300">{maxVideos}</span></label>
            <input type="range" min="1" max="30" value={maxVideos} onChange={e => setMaxVideos(Number(e.target.value))} className="mt-2 w-full accent-violet-500"/>
            <button disabled={loading} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60">{loading ? <><Loader2 size={16} className="animate-spin"/> Building...</> : <>Build artifact <ArrowRight size={16}/></>}</button>
            <div className="mt-3 text-center text-[11px] text-zinc-600">No API keys? The project ships with a local demo mode.</div>
          </div>
        </form>
        {error && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-200">{error}</div>}
      </section>

      {doc && <section className="mt-10 grid gap-6 lg:grid-cols-[.72fr_1.28fr]">
        <aside className="lg:sticky lg:top-5 lg:self-start">
          <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5">
            <div className="text-xs uppercase tracking-[.18em] text-violet-300">Generated</div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">{doc.title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">{doc.subtitle}</p>
            <div className="mt-5 grid grid-cols-3 gap-2"><div className="rounded-xl border border-white/8 bg-white/[.02] p-3"><div className="text-xl font-semibold">{stats.sections}</div><div className="text-[11px] text-zinc-600">sections</div></div><div className="rounded-xl border border-white/8 bg-white/[.02] p-3"><div className="text-xl font-semibold">{stats.lessons}</div><div className="text-[11px] text-zinc-600">lessons</div></div><div className="rounded-xl border border-white/8 bg-white/[.02] p-3"><div className="text-xl font-semibold">{stats.sources}</div><div className="text-[11px] text-zinc-600">videos</div></div></div>
            <div className="mt-5 space-y-2 text-sm text-zinc-500"><div className="flex justify-between"><span>Audience</span><span className="max-w-[55%] text-right text-zinc-300">{doc.audience}</span></div><div className="flex justify-between"><span>Time</span><span className="text-zinc-300">{doc.estimatedTime}</span></div></div>
            <div className="mt-6 grid gap-2">
              {(["pdf", "html", "json"] as const).map(item => <button key={item} onClick={() => exportDocument(item)} disabled={Boolean(exporting)} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-zinc-300 hover:bg-white/[.04] disabled:opacity-50"><span className="flex items-center gap-2">{item === "pdf" ? <FileText size={15}/> : item === "html" ? <Globe2 size={15}/> : <FileJson size={15}/>} Download {item.toUpperCase()}</span>{exporting === item ? <Loader2 size={14} className="animate-spin"/> : <Download size={14}/>}</button>)}
            </div>
          </div>
        </aside>

        <article className="rounded-2xl border border-white/10 bg-[#fbfbfa] p-7 text-[#18191f] md:p-10">
          <div className="text-[11px] font-semibold tracking-[.18em] text-violet-600">{doc.format.toUpperCase()}</div>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-.04em]">{doc.title}</h2>
          <p className="mt-3 text-zinc-500">{doc.subtitle}</p>
          <div className="mt-8 border-y border-zinc-200 py-6"><div className="text-sm font-semibold">Overview</div><p className="mt-2 text-[15px] leading-7 text-zinc-600">{doc.summary}</p><div className="mt-4 grid gap-2">{doc.learningOutcomes.map((x, i) => <div key={i} className="flex gap-2 text-sm text-zinc-600"><Check className="mt-0.5 shrink-0 text-violet-600" size={16}/>{x}</div>)}</div></div>
          {doc.sections.map((section, index) => <section key={index} className="mt-10 border-b border-zinc-200 pb-8 last:border-0"><div className="text-[10px] font-bold tracking-[.18em] text-violet-600">SECTION {String(index + 1).padStart(2, "0")}</div><h3 className="mt-2 text-2xl font-semibold tracking-tight">{section.title}</h3><p className="mt-2 leading-7 text-zinc-600">{section.intro}</p>{section.lessons?.map((lesson, j) => <div key={j} className="mt-6 rounded-2xl border border-zinc-200 p-5"><div className="flex gap-3"><div className="grid size-8 shrink-0 place-items-center rounded-full border border-zinc-300 text-sm font-semibold">{j + 1}</div><div className="min-w-0"><div className="text-lg font-semibold">{lesson.title}</div><div className="mt-2 text-sm leading-6 text-zinc-600">{lesson.summary}</div><div className="mt-4 text-[10px] font-bold uppercase tracking-[.14em] text-zinc-400">Objective</div><div className="mt-1 text-sm text-zinc-700">{lesson.objective}</div>{lesson.keyPoints.length > 0 && <><div className="mt-4 text-[10px] font-bold uppercase tracking-[.14em] text-zinc-400">Key points</div><ul className="mt-2 space-y-1 text-sm text-zinc-600">{lesson.keyPoints.map((x, k) => <li key={k}>• {x}</li>)}</ul></>}{lesson.exercise && <div className="mt-4 rounded-xl bg-violet-50 p-4"><div className="text-[10px] font-bold uppercase tracking-[.14em] text-violet-700">Practice</div><div className="mt-1 text-sm text-violet-950">{lesson.exercise}</div></div>}</div></div></div>)}{section.body?.map((x, j) => <p key={j} className="mt-5 text-[15px] leading-7 text-zinc-600">{x}</p>)}<div className="mt-5 rounded-xl bg-cyan-50 p-4"><div className="text-[10px] font-bold uppercase tracking-[.14em] text-cyan-700">Key takeaways</div><ul className="mt-2 space-y-1 text-sm text-cyan-950">{section.keyTakeaways.map((x, j) => <li key={j}>• {x}</li>)}</ul></div></section>)}
          <section className="mt-8"><div className="text-[10px] font-bold tracking-[.18em] text-violet-600">GLOSSARY</div>{doc.glossary.map((item, i) => <div key={i} className="mt-4"><div className="font-semibold">{item.term}</div><div className="mt-1 text-sm leading-6 text-zinc-600">{item.definition}</div></div>)}</section>
        </article>
      </section>}
    </main>
  </div>;
}
