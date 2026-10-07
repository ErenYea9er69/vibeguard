"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Code2,
  Download,
  ExternalLink,
  Loader2,
  Maximize2,
  Monitor,
  RefreshCw,
  Smartphone,
  Sparkles,
  Tablet,
} from "lucide-react";
import { Analysis, DesignStyle, DesignStyleOption, GeneratedDocument, StudyKit } from "@/lib/types";

export type StudioTab = "analysis" | "design" | "quiz" | "cards";
type Props = { tab: StudioTab; doc: GeneratedDocument; sourceUrl: string; language: string; maxVideos: number };

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await res.text().catch(() => "");
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(text || `Request failed (${res.status})`);
  }
  if (!res.ok) throw new Error(data?.error || text || "Request failed.");
  return data as T;
}

function Busy({ label }: { label: string }) {
  return <div className="studio-busy"><Loader2 size={16} className="spin" /> {label}</div>;
}

function AnalysisPanel({ doc, sourceUrl, language, maxVideos }: Omit<Props, "tab">) {
  const [data, setData] = useState<Analysis | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    post<Analysis>("/api/analyze", { sourceUrl, language, maxVideos, doc }).then(setData).catch(e => setErr(e.message));
  }, [doc, sourceUrl, language, maxVideos]);
  if (err) return <div className="studio-err">{err}</div>;
  if (!data) return <Busy label="Analyzing the source" />;
  const max = Math.max(...data.concepts.map(c => c.weight), 1);
  return (
    <div className="studio-grid">
      <div className="studio-card wide">
        <h3>{data.topic}</h3>
        <p>{data.verdict}</p>
        <div className="studio-stats">
          <div><b>{data.level}</b><span>level</span></div>
          <div><b>{data.readingMinutes} min</b><span>reading time</span></div>
          <div><b>{data.concepts.length}</b><span>concepts</span></div>
          <div><b>{data.recommendedFormat}</b><span>best format</span></div>
        </div>
      </div>
      <div className="studio-card">
        <h4>Concept weight</h4>
        {data.concepts.map(c => (
          <div key={c.name} className="bar-row" title={c.dependsOn.length ? `Needs: ${c.dependsOn.join(", ")}` : "No prerequisite"}>
            <span>{c.name}</span>
            <div className="bar"><i style={{ width: `${(c.weight / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
      <div className="studio-card">
        <h4>Video coverage</h4>
        {data.coverage.map(v => (
          <div key={v.videoId} className="bar-row" title={v.note}>
            <span>{v.title}</span>
            <div className="bar"><i style={{ width: `${v.score}%` }} /></div>
          </div>
        ))}
      </div>
      <div className="studio-card">
        <h4>Prerequisites</h4>
        <ul>{data.prerequisites.map((p, i) => <li key={i}>{p}</li>)}</ul>
        <h4>Gaps</h4>
        <ul>{data.gaps.map((p, i) => <li key={i}>{p}</li>)}</ul>
        {data.redundancy.length > 0 && (<><h4>Skip this</h4><ul>{data.redundancy.map((p, i) => <li key={i}>{p}</li>)}</ul></>)}
      </div>
    </div>
  );
}

const STYLES: Array<{ id: DesignStyleOption; label: string; hint: string }> = [
  { id: "auto", label: "Auto (Subject Skill)", hint: "Bespoke palette, type, and layout grounded in the topic" },
  { id: "editorial", label: "Editorial", hint: "Long read with typographic hierarchy and sticky contents bar" },
  { id: "workbook", label: "Workbook", hint: "Interactive checklist and exercise answer reveals" },
  { id: "dashboard", label: "Dashboard", hint: "Progress tracker and real-time glossary filter" },
  { id: "slides", label: "Slides", hint: "Arrow key presentation deck" },
];

function DesignPanel({ doc }: { doc: GeneratedDocument }) {
  const [style, setStyle] = useState<DesignStyleOption>("auto");
  const [html, setHtml] = useState<string>(doc.generatedHtml || "");
  const [engine, setEngine] = useState<string>(doc.generatedHtml ? "ai" : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [viewCode, setViewCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  async function build(next: DesignStyleOption) {
    setStyle(next);
    setBusy(true);
    setErr("");
    try {
      const r = await post<{ html: string; engine: string }>("/api/studio", { kind: "design", style: next, doc });
      setHtml(r.html);
      setEngine(r.engine);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Design failed.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (doc.generatedHtml) {
      setHtml(doc.generatedHtml);
      setEngine("ai");
      setStyle("auto");
    } else {
      build("auto");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  function downloadHtml() {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = (doc.title || "artifact")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "page";
    a.href = url;
    a.download = `${slug}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openNewTab() {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  function copyCode() {
    if (!html) return;
    navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const frameWidth = viewport === "mobile" ? "375px" : viewport === "tablet" ? "768px" : "100%";

  return (
    <div>
      <div className="studio-toolbar" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        {STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`chip ${style === s.id ? "on" : ""}`}
            onClick={() => build(s.id)}
            disabled={busy}
            title={s.hint}
          >
            {s.label}
          </button>
        ))}

        <span className="grow" />

        <span className="muted-s" style={{ marginRight: "0.25rem" }}>
          {engine === "ai" ? "Frontend Skill (AI)" : engine ? "Template" : ""}
        </span>

        {/* Viewport switchers */}
        <div style={{ display: "flex", gap: "2px", background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 8, padding: 2 }}>
          <button
            type="button"
            className="chip"
            style={{ padding: "4px 8px", border: "none", background: viewport === "desktop" ? "var(--red-dim)" : "transparent" }}
            onClick={() => setViewport("desktop")}
            title="Desktop view (100%)"
          >
            <Monitor size={13} />
          </button>
          <button
            type="button"
            className="chip"
            style={{ padding: "4px 8px", border: "none", background: viewport === "tablet" ? "var(--red-dim)" : "transparent" }}
            onClick={() => setViewport("tablet")}
            title="Tablet view (768px)"
          >
            <Tablet size={13} />
          </button>
          <button
            type="button"
            className="chip"
            style={{ padding: "4px 8px", border: "none", background: viewport === "mobile" ? "var(--red-dim)" : "transparent" }}
            onClick={() => setViewport("mobile")}
            title="Mobile view (375px)"
          >
            <Smartphone size={13} />
          </button>
        </div>

        {/* Code toggle */}
        <button
          type="button"
          className={`chip ${viewCode ? "on" : ""}`}
          onClick={() => setViewCode(!viewCode)}
          title="Toggle HTML source code"
        >
          <Code2 size={13} /> {viewCode ? "Preview" : "Code"}
        </button>

        {/* Download HTML */}
        <button type="button" className="chip on" onClick={downloadHtml} disabled={!html} title="Download standalone HTML file">
          <Download size={13} /> Save .html
        </button>

        <button type="button" className="chip" onClick={openNewTab} disabled={!html} title="Open in new window">
          <ExternalLink size={13} />
        </button>

        <button type="button" className="chip" onClick={() => build(style)} disabled={busy} title="Generate another version">
          <RefreshCw size={12} className={busy ? "spin" : ""} /> Redo
        </button>

        <button type="button" className="chip" onClick={() => frame.current?.requestFullscreen?.()} disabled={!html} title="Fullscreen">
          <Maximize2 size={12} />
        </button>
      </div>

      {err && <div className="studio-err">{err}</div>}

      {busy ? (
        <Busy label="Analyzing subject & crafting bespoke UI with Frontend Skill…" />
      ) : viewCode ? (
        <div style={{ position: "relative", marginTop: "0.5rem" }}>
          <div style={{ position: "absolute", top: 12, right: 12, zIndex: 10 }}>
            <button type="button" className="chip on" onClick={copyCode}>
              {copied ? <><Check size={12} /> Copied</> : "Copy code"}
            </button>
          </div>
          <pre
            style={{
              maxHeight: "75vh",
              overflow: "auto",
              padding: "1.25rem",
              borderRadius: 12,
              background: "var(--field-bg)",
              border: "1px solid var(--line-2)",
              fontSize: 12,
              fontFamily: "ui-monospace, monospace",
              color: "var(--text-2)",
              lineHeight: 1.5,
            }}
          >
            <code>{html}</code>
          </pre>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            width: "100%",
            background: viewport !== "desktop" ? "rgba(0,0,0,0.15)" : "transparent",
            padding: viewport !== "desktop" ? "1.25rem 0" : 0,
            borderRadius: 12,
            transition: "all 0.2s",
          }}
        >
          <iframe
            ref={frame}
            title="AI designed course"
            className="studio-frame"
            sandbox="allow-scripts"
            srcDoc={html}
            style={{
              width: frameWidth,
              maxWidth: "100%",
              boxShadow: viewport !== "desktop" ? "0 10px 30px rgba(0,0,0,0.4)" : "none",
              transition: "width 0.25s ease",
            }}
          />
        </div>
      )}
    </div>
  );
}

function useKit(doc: GeneratedDocument) {
  const [kit, setKit] = useState<StudyKit | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    post<StudyKit>("/api/studio", { kind: "kit", doc }).then(setKit).catch(e => setErr(e.message));
  }, [doc]);
  return { kit, err };
}

function QuizPanel({ doc }: { doc: GeneratedDocument }) {
  const { kit, err } = useKit(doc);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  if (err) return <div className="studio-err">{err}</div>;
  if (!kit) return <Busy label="Writing questions" />;
  if (i >= kit.quiz.length) return (
    <div className="studio-card center">
      <Sparkles size={22} />
      <h3>{score} of {kit.quiz.length} correct</h3>
      <button className="chip on" onClick={() => { setI(0); setPicked(null); setScore(0); }}>Try again</button>
    </div>
  );
  const q = kit.quiz[i];
  return (
    <div className="studio-card">
      <div className="muted-s">Question {i + 1} of {kit.quiz.length}</div>
      <h3>{q.question}</h3>
      <div className="opts">
        {q.options.map((o, k) => {
          const state = picked === null ? "" : k === q.answerIndex ? "right" : k === picked ? "wrong" : "dim";
          return <button key={k} className={`opt ${state}`} disabled={picked !== null} onClick={() => { setPicked(k); if (k === q.answerIndex) setScore(s => s + 1); }}>{o}</button>;
        })}
      </div>
      {picked !== null && (
        <div className="explain">
          <p>{q.explanation}</p>
          <button className="chip on" onClick={() => { setI(i + 1); setPicked(null); }}>{i + 1 === kit.quiz.length ? "See score" : "Next question"}</button>
        </div>
      )}
    </div>
  );
}

function CardsPanel({ doc }: { doc: GeneratedDocument }) {
  const { kit, err } = useKit(doc);
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  if (err) return <div className="studio-err">{err}</div>;
  if (!kit) return <Busy label="Making flashcards" />;
  const c = kit.flashcards[i];
  if (!c) return <div className="studio-card">No flashcards for this source.</div>;
  const move = (d: number) => { setFlip(false); setI((i + d + kit.flashcards.length) % kit.flashcards.length); };
  return (
    <div className="card-wrap">
      <button className={`flash ${flip ? "flip" : ""}`} onClick={() => setFlip(!flip)} aria-live="polite">
        <span>{flip ? c.back : c.front}</span>
      </button>
      <div className="studio-toolbar">
        <button className="chip" onClick={() => move(-1)}>Back</button>
        <span className="muted-s">{i + 1} / {kit.flashcards.length}</span>
        <button className="chip" onClick={() => move(1)}>Next</button>
      </div>
    </div>
  );
}

export default function Studio({ tab, doc, sourceUrl, language, maxVideos }: Props) {
  if (tab === "analysis") return <AnalysisPanel doc={doc} sourceUrl={sourceUrl} language={language} maxVideos={maxVideos} />;
  if (tab === "design") return <DesignPanel doc={doc} />;
  if (tab === "quiz") return <QuizPanel doc={doc} />;
  return <CardsPanel doc={doc} />;
}
