"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Studio, { StudioTab } from "./Studio";
import CustomSelect, { CustomSelectOption } from "./CustomSelect";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileCode2,
  FileText,
  Globe,
  Loader2,
  Moon,
  Newspaper,
  PenLine,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { DeliverableFormat, DesignStyleOption, GeneratedDocument, OutputFormat, Tone } from "@/lib/types";
import { WRITING_RULES_ITEMS, BANNED_WORDS } from "@/lib/rules";
import { renderMarkdown } from "@/lib/render";

const DELIVERABLE_PRESETS = {
  html: {
    label: "HTML Webpage",
    badge: "Bespoke UI Skill",
    Icon: Globe,
    desc: "Self-contained webpage with custom UI tailored to the topic",
  },
  pdf: {
    label: "PDF Document",
    badge: "Printable / Clean",
    Icon: FileText,
    desc: "Formatted PDF ready to read, print, or share",
  },
  markdown: {
    label: "Markdown (.md)",
    badge: "Notes & Docs",
    Icon: FileCode2,
    desc: "Clean markdown for Obsidian, Notion, or blog posts",
  },
  json: {
    label: "JSON Data",
    badge: "Full Schema",
    Icon: FileCode2,
    desc: "Structured schema with traceable source video IDs",
  },
} as const;

const CONTENT_PRESETS = {
  article: {
    label: "Article",
    Icon: Newspaper,
    desc: "Structured long-form reading with deep dives & takeaways",
  },
  blog: {
    label: "Blog Post",
    Icon: PenLine,
    desc: "Scannable sections, fast highlights, and takeaways",
  },
  course: {
    label: "Course",
    Icon: BookOpen,
    desc: "Lessons, objectives, examples, practice tasks",
  },
} satisfies Record<OutputFormat, { label: string; Icon: typeof BookOpen; desc: string }>;

const UI_STYLE_DROPDOWN_OPTIONS: CustomSelectOption<DesignStyleOption>[] = [
  {
    value: "auto",
    label: "Auto-Adaptive",
    desc: "Analyzes topic to tailor palette, typography & layout",
    badge: "AI",
    icon: Sparkles,
  },
  {
    value: "editorial",
    label: "Editorial Magazine",
    desc: "Long-form reading with typography hierarchy & contents bar",
  },
  {
    value: "workbook",
    label: "Interactive Workbook",
    desc: "Checkable tasks and reveal-on-click exercise answers",
  },
  {
    value: "dashboard",
    label: "Modern Dashboard",
    desc: "Modular developer components & live glossary search",
  },
  {
    value: "slides",
    label: "Slide Deck",
    desc: "Keyboard-driven presentation deck",
  },
];

const TONE_DROPDOWN_OPTIONS: CustomSelectOption<Tone>[] = [
  {
    value: "practical",
    label: "Practical",
    desc: "Applied real-world examples & actionable advice",
  },
  {
    value: "clear",
    label: "Clear",
    desc: "Direct, plainspoken, and beginner-friendly",
  },
  {
    value: "technical",
    label: "Technical",
    desc: "In-depth engineering architecture & code precision",
  },
  {
    value: "academic",
    label: "Academic",
    desc: "Rigorous pedagogical concepts & theoretical depth",
  },
];

const LANGUAGE_DROPDOWN_OPTIONS: CustomSelectOption[] = [
  {
    value: "auto",
    label: "Auto Detect",
    sublabel: "Video Language",
    desc: "Matches original video language automatically",
    badge: "AI",
    icon: Sparkles,
  },
  { value: "en", label: "English", sublabel: "English", desc: "Universal standard" },
  { value: "es", label: "Spanish", sublabel: "Español" },
  { value: "fr", label: "French", sublabel: "Français" },
  { value: "de", label: "German", sublabel: "Deutsch" },
  { value: "ar", label: "Arabic", sublabel: "العربية" },
  { value: "pt", label: "Portuguese", sublabel: "Português" },
  { value: "ja", label: "Japanese", sublabel: "日本語" },
  { value: "zh", label: "Chinese", sublabel: "中文" },
  { value: "hi", label: "Hindi", sublabel: "हिन्दी" },
  { value: "it", label: "Italian", sublabel: "Italiano" },
  { value: "ru", label: "Russian", sublabel: "Русский" },
];

const EXPORT_OPTIONS = [
  { format: "html" as const, label: "HTML file (.html)", Icon: Globe },
  { format: "pdf" as const, label: "PDF document (.pdf)", Icon: FileText },
  { format: "markdown" as const, label: "Markdown (.md)", Icon: FileCode2 },
  { format: "json" as const, label: "JSON data (.json)", Icon: FileCode2 },
];

const SAMPLE_URLS = [
  { label: "Next.js course", url: "https://www.youtube.com/playlist?list=PL4cUxeGkcC9jZIVqmy_QhfQdi6mzzvP7l" },
  { label: "TypeScript crash", url: "https://www.youtube.com/watch?v=BCg4U1FzODs" },
  { label: "System design", url: "https://www.youtube.com/playlist?list=PLMCXHnjXnTnvo6alSjVkgxV-VH6EPyvoX" },
];

export default function Builder() {
  const [sourceUrl, setSourceUrl] = useState("");
  const [deliverableFormat, setDeliverableFormat] = useState<DeliverableFormat>("html");
  const [format, setFormat] = useState<OutputFormat>("article");
  const [designStyle, setDesignStyle] = useState<DesignStyleOption>("auto");
  const [tone, setTone] = useState<Tone>("practical");
  const [audience, setAudience] = useState("");
  const [language, setLanguage] = useState("auto");
  const [maxVideos, setMaxVideos] = useState(12);
  const [isAllVideos, setIsAllVideos] = useState(false);
  const [doc, setDoc] = useState<GeneratedDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [strictRules, setStrictRules] = useState(true);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [tab, setTab] = useState<"design" | "read" | "markdown" | "quiz" | "cards" | "analysis" | "json">("design");
  const [copiedMd, setCopiedMd] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  const inputType = useMemo(() => {
    const trimmed = sourceUrl.trim();
    if (!trimmed) return "empty";
    try {
      const url = new URL(trimmed);
      const list = url.searchParams.get("list");
      const v = url.searchParams.get("v") || (url.hostname === "youtu.be" ? url.pathname.slice(1).split("?")[0] : null);
      if (list && !v) return "playlist";
      if (v) return list ? "video-in-playlist" : "video";
      if (url.pathname.startsWith("/shorts/")) return "video";
      if (list) return "playlist";
    } catch {}
    if (/^PL[a-zA-Z0-9_-]+$/.test(trimmed)) return "playlist";
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return "video";
    return "unknown";
  }, [sourceUrl]);

  const isSingleVideo = inputType === "video" || inputType === "video-in-playlist";
  const effectiveMaxVideos = isSingleVideo ? 1 : (isAllVideos ? 0 : maxVideos);

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("cf-theme")) as "dark" | "light" | null;
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("cf-theme", next);
  }

  const stats = useMemo(
    () => ({
      sections: doc?.sections.length ?? 0,
      lessons: doc?.sections.reduce((s, sec) => s + (sec.lessons?.length ?? 0), 0) ?? 0,
      sources: doc?.source.videoCount ?? 0,
    }),
    [doc]
  );

  async function generate(event?: FormEvent) {
    event?.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl: sourceUrl.trim(),
          deliverableFormat,
          format,
          designStyle,
          tone,
          audience: audience.trim(),
          language,
          maxVideos: effectiveMaxVideos,
          strictRules,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed.");
      setDoc(data);

      // Automatically switch to the matching deliverable tab
      if (deliverableFormat === "html") {
        setTab("design");
      } else if (deliverableFormat === "markdown") {
        setTab("markdown");
      } else if (deliverableFormat === "json") {
        setTab("json");
      } else {
        setTab("read");
      }

      setTimeout(() => {
        document.getElementById("output-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function exportDocument(fmt: "pdf" | "html" | "json" | "markdown") {
    if (!doc) return;
    setExporting(fmt);
    try {
      const res = await fetch(`/api/export/${fmt}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(doc),
      });
      if (!res.ok) throw new Error("Export failed.");
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const slug = (doc.title || "artifact")
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 48) || "courseforge";
      anchor.href = href;
      anchor.download = `${slug}.${fmt === "markdown" ? "md" : fmt}`;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting("");
    }
  }

  function copyMarkdown() {
    if (!doc) return;
    const md = doc.generatedMarkdown || renderMarkdown(doc);
    navigator.clipboard.writeText(md);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  }

  function copyJson() {
    if (!doc) return;
    navigator.clipboard.writeText(JSON.stringify(doc, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  }

  return (
    <div data-theme={theme} style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      {/* ——— Header ————————————————————————————— */}
      <header
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "1.25rem 2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: "var(--red)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(192,57,43,.4)",
            }}
          >
            <Play size={14} color="#fff" fill="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: "-0.01em" }}>CourseForge</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>YouTube → structured learning</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.375rem 0.875rem",
              borderRadius: 999,
              border: "1px solid var(--line-2)",
              background: "rgba(255,255,255,.03)",
              fontSize: 11,
              color: "var(--muted)",
            }}
          >
            <Sparkles size={11} />
            Powered by Gemini
          </div>
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "0 2rem 5rem" }}>
        {/* ——— Hero ——————————————————————————————— */}
        <section
          className="grid-lines hero-glow"
          style={{
            borderRadius: 20,
            border: "1px solid var(--line-2)",
            background: "var(--surface)",
            padding: "3rem 3rem 3.5rem",
            position: "relative",
          }}
        >
          {/* Glow orb container (clips glow to card shape without clipping dropdowns) */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 20,
              overflow: "hidden",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -80,
                left: -60,
                width: 380,
                height: 380,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(192,57,43,.16) 0%, transparent 70%)",
              }}
            />
          </div>

          <div style={{ position: "relative", zIndex: 1, maxWidth: 960 }}>
            {/* Badge */}
            <div className="demo-badge" style={{ marginBottom: "1.5rem" }}>
              <span className="demo-dot" />
              Demo mode active — no API keys needed
            </div>

            <h1
              style={{
                fontSize: "clamp(2rem, 5vw, 3.25rem)",
                fontWeight: 700,
                lineHeight: 1.06,
                letterSpacing: "-0.05em",
                color: "var(--text)",
                maxWidth: 640,
              }}
            >
              Turn YouTube playlists into structured learning.
            </h1>
            <p
              style={{
                marginTop: "1rem",
                fontSize: 15,
                color: "var(--muted)",
                maxWidth: 520,
                lineHeight: 1.7,
              }}
            >
              CourseForge pulls transcripts, removes repetition, rebuilds concepts in a coherent order, and exports a
              course, article, or blog — ready to read or download.
            </p>
          </div>

          {/* ——— Form ——————————————————————————— */}
          <form
            onSubmit={generate}
            style={{
              position: "relative",
              zIndex: 1,
              marginTop: "2.5rem",
              display: "grid",
              gap: "1.25rem",
              gridTemplateColumns: "1fr",
            }}
          >
            {/* Top row: source + settings side by side on wide */}
            <div
              style={{
                display: "grid",
                gap: "1.25rem",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                alignItems: "start",
              }}
            >
              {/* Source panel */}
              <div
                style={{
                  background: "var(--panel-bg)",
                  border: "1px solid var(--line-2)",
                  borderRadius: 14,
                  padding: "1.25rem",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: "0.75rem" }}>
                  YouTube source
                </div>

                {/* URL input */}
                <div
                  className="focus-ring"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    background: "var(--field-bg)",
                    border: "1px solid var(--line-2)",
                    borderRadius: 10,
                    padding: "0 0.875rem",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                >
                  <Play size={14} style={{ color: "var(--subtle)", flexShrink: 0 }} />
                  <input
                    id="source-url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="Paste YouTube video or playlist URL..."
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      padding: "0.75rem 0",
                      fontSize: 13,
                      color: "var(--text)",
                    }}
                  />
                  {sourceUrl && (
                    <button
                      type="button"
                      onClick={() => setSourceUrl("")}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--subtle)",
                        padding: "0.25rem",
                        display: "flex",
                      }}
                      aria-label="Clear URL"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <div style={{ marginTop: "0.5rem", fontSize: 11 }}>
                  {inputType === "video" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", color: "var(--red-2)", fontWeight: 500 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--red-2)" }} />
                      Single video detected (max videos locked to 1)
                    </div>
                  )}
                  {inputType === "playlist" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", color: "var(--red-2)", fontWeight: 500 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--red-2)" }} />
                      Playlist detected (select how many videos to include below)
                    </div>
                  )}
                  {inputType === "video-in-playlist" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", color: "var(--muted)" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--muted)" }} />
                      Video from playlist link detected (processing this single video)
                    </div>
                  )}
                  {inputType === "empty" && (
                    <span style={{ color: "var(--subtle)" }}>
                      Paste a single video or full playlist link.
                    </span>
                  )}
                </div>

                {/* Sample pills */}
                <div
                  style={{
                    marginTop: "0.875rem",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.375rem",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 11, color: "var(--subtle)" }}>Try:</span>
                  {SAMPLE_URLS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      className="sample-pill"
                      onClick={() => setSourceUrl(s.url)}
                    >
                      {s.label}
                      <ChevronRight size={10} />
                    </button>
                  ))}
                </div>

                {/* 1. Deliverable format */}
                <div style={{ marginTop: "1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
                      1. Deliverable format
                    </div>
                    <span style={{ fontSize: 10, color: "var(--red-2)", fontWeight: 500 }}>
                      Target output file
                    </span>
                  </div>
                  <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "repeat(2, 1fr)" }}>
                    {(Object.keys(DELIVERABLE_PRESETS) as DeliverableFormat[]).map((key) => {
                      const { label, badge, Icon, desc } = DELIVERABLE_PRESETS[key];
                      const active = deliverableFormat === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          id={`deliverable-${key}`}
                          onClick={() => setDeliverableFormat(key)}
                          className={`fmt-card${active ? " active" : ""}`}
                          style={{ padding: "0.75rem 0.875rem" }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.375rem" }}>
                            <Icon
                              size={15}
                              style={{ color: active ? "var(--red-2)" : "var(--muted)" }}
                            />
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 600,
                                padding: "1px 5px",
                                borderRadius: 4,
                                background: active ? "var(--red-dim)" : "rgba(255,255,255,0.05)",
                                color: active ? "var(--red-2)" : "var(--muted)",
                                border: `1px solid ${active ? "rgba(192,57,43,0.3)" : "var(--line)"}`,
                              }}
                            >
                              {badge}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: "0.2rem" }}>{label}</div>
                          <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.4 }}>{desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Content structure */}
                <div style={{ marginTop: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
                      2. Content structure
                    </div>
                    <span style={{ fontSize: 10, color: "var(--muted)" }}>
                      Format & depth
                    </span>
                  </div>
                  <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "repeat(3, 1fr)" }}>
                    {(Object.keys(CONTENT_PRESETS) as OutputFormat[]).map((key) => {
                      const { label, Icon, desc } = CONTENT_PRESETS[key];
                      const active = format === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          id={`format-${key}`}
                          onClick={() => setFormat(key)}
                          className={`fmt-card${active ? " active" : ""}`}
                        >
                          <Icon
                            size={14}
                            style={{ color: active ? "var(--red-2)" : "var(--muted)", marginBottom: "0.375rem" }}
                          />
                          <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: "0.2rem" }}>{label}</div>
                          <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.4 }}>{desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. HTML UI Aesthetic (When Deliverable is HTML) */}
                {deliverableFormat === "html" && (
                  <div
                    style={{
                      marginTop: "1rem",
                      padding: "0.75rem 0.875rem",
                      borderRadius: 10,
                      background: "var(--field-bg)",
                      border: "1px solid var(--line-2)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.375rem" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text)" }}>
                        UI Aesthetic (Frontend Design Skill)
                      </span>
                      <span style={{ fontSize: 9.5, color: "var(--red-2)", fontWeight: 500 }}>
                        Grounds UI in subject
                      </span>
                    </div>
                    <CustomSelect<DesignStyleOption>
                      id="design-style-select"
                      value={designStyle}
                      onChange={setDesignStyle}
                      options={UI_STYLE_DROPDOWN_OPTIONS}
                      menuPlacement="top"
                    />
                  </div>
                )}
              </div>

              {/* Settings panel */}
              <div
                style={{
                  background: "var(--panel-bg)",
                  border: "1px solid var(--line-2)",
                  borderRadius: 14,
                  padding: "1.25rem",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: "0.75rem" }}>
                  Generation settings
                </div>

                {/* Audience */}
                <label style={{ display: "block" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.375rem" }}>
                    <span style={{ fontSize: 11, color: "var(--subtle)" }}>
                      Target Audience
                    </span>
                    <span style={{ fontSize: 10, color: "var(--red-2)", fontWeight: 500 }}>
                      Optional • AI auto-detects persona if empty
                    </span>
                  </div>
                  <textarea
                    id="audience-field"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="Leave empty for AI to infer persona automatically, or specify custom..."
                    rows={2}
                    className="field"
                    style={{ resize: "none", fontSize: 13 }}
                  />
                </label>

                {/* Tone + Language */}
                <div style={{ marginTop: "0.875rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <span style={{ fontSize: 11, color: "var(--subtle)", display: "block", marginBottom: "0.375rem" }}>
                      Tone
                    </span>
                    <CustomSelect<Tone>
                      id="tone-select"
                      value={tone}
                      onChange={setTone}
                      options={TONE_DROPDOWN_OPTIONS}
                    />
                  </div>

                  <div>
                    <span style={{ fontSize: 11, color: "var(--subtle)", display: "block", marginBottom: "0.375rem" }}>
                      Language
                    </span>
                    <CustomSelect
                      id="language-select"
                      value={language}
                      onChange={setLanguage}
                      options={LANGUAGE_DROPDOWN_OPTIONS}
                    />
                  </div>
                </div>

                {/* Max videos - semi-auto based on video vs playlist */}
                <div style={{ marginTop: "1rem" }}>
                  {inputType === "video" || inputType === "video-in-playlist" ? (
                    <div
                      style={{
                        padding: "0.625rem 0.75rem",
                        borderRadius: 8,
                        background: "var(--field-bg)",
                        border: "1px solid var(--line-2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)" }}>
                          Single video mode
                        </div>
                        <div style={{ fontSize: 10, color: "var(--muted)" }}>
                          Auto-configured to 1 video
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "var(--red-2)",
                          background: "var(--red-dim)",
                          border: "1px solid rgba(192,57,43,0.3)",
                          padding: "0.2rem 0.5rem",
                          borderRadius: 6,
                        }}
                      >
                        1 video
                      </span>
                    </div>
                  ) : (
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <span style={{ fontSize: 11, color: "var(--subtle)" }}>
                          {inputType === "playlist" ? "Playlist video count" : "Max videos (for playlists)"}
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--red-2)",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {isAllVideos ? "All videos" : `${maxVideos} video${maxVideos === 1 ? "" : "s"}`}
                        </span>
                      </div>
                      <input
                        id="max-videos-range"
                        type="range"
                        min="1"
                        max="100"
                        value={isAllVideos ? 100 : maxVideos}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (val >= 100) {
                            setIsAllVideos(true);
                          } else {
                            setIsAllVideos(false);
                            setMaxVideos(val);
                          }
                        }}
                      />
                      {/* Semi-auto quick presets */}
                      <div style={{ display: "flex", gap: "0.375rem", marginTop: "0.375rem" }}>
                        {[
                          { label: "1 (single)", value: 1, isAll: false },
                          { label: "5 vids", value: 5, isAll: false },
                          { label: "12 vids", value: 12, isAll: false },
                          { label: "20 vids", value: 20, isAll: false },
                          { label: "All", value: 0, isAll: true },
                        ].map((preset) => {
                          const isSelected = preset.isAll ? isAllVideos : (!isAllVideos && maxVideos === preset.value);
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => {
                                if (preset.isAll) {
                                  setIsAllVideos(true);
                                } else {
                                  setIsAllVideos(false);
                                  setMaxVideos(preset.value);
                                }
                              }}
                              style={{
                                flex: 1,
                                padding: "0.2rem 0",
                                fontSize: 10,
                                fontWeight: isSelected ? 700 : 500,
                                color: isSelected ? "var(--text)" : "var(--muted)",
                                background: isSelected ? "var(--red-dim)" : "var(--field-bg)",
                                border: isSelected ? "1px solid var(--red-2)" : "1px solid var(--line)",
                                borderRadius: 4,
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                      {isAllVideos && (
                        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: "0.375rem", textAlign: "right" }}>
                          Includes all videos in playlist (can be 30+)
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* AI Writing Rules & Quality Controls */}
                <div
                  style={{
                    marginTop: "1.125rem",
                    padding: "0.75rem 0.875rem",
                    borderRadius: 10,
                    background: "var(--field-bg)",
                    border: "1px solid var(--line-2)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                    }}
                  >
                    <label
                      htmlFor="strict-rules-toggle"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      <input
                        id="strict-rules-toggle"
                        type="checkbox"
                        checked={strictRules}
                        onChange={(e) => setStrictRules(e.target.checked)}
                        style={{
                          accentColor: "var(--red)",
                          width: 14,
                          height: 14,
                          cursor: "pointer",
                        }}
                      />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                          Strict Writing Rules
                        </div>
                        <div style={{ fontSize: 10.5, color: "var(--muted)" }}>
                          {strictRules ? "19 rules • 64 banned words" : "Standard output without rules"}
                        </div>
                      </div>
                    </label>

                    <button
                      type="button"
                      id="view-rules-btn"
                      onClick={() => setShowRulesModal(true)}
                      style={{
                        padding: "0.25rem 0.5rem",
                        fontSize: 10.5,
                        fontWeight: 500,
                        color: "var(--red-2)",
                        background: "var(--red-dim)",
                        border: "1px solid rgba(192,57,43,0.3)",
                        borderRadius: 6,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                      }}
                    >
                      <ShieldCheck size={11} />
                      Inspect rules
                    </button>
                  </div>
                </div>

                {/* CTA */}
                <button
                  id="build-artifact-btn"
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{ marginTop: "1.25rem" }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={15} className="spin" />
                      Building artifact…
                    </>
                  ) : (
                    <>
                      Build artifact
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>

                <div style={{ marginTop: "0.625rem", textAlign: "center", fontSize: 11, color: "var(--subtle)" }}>
                  Paste any YouTube video or playlist URL above to generate.
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                style={{
                  marginTop: "0.5rem",
                  padding: "0.75rem 1rem",
                  borderRadius: 10,
                  border: "1px solid rgba(239,68,68,.25)",
                  background: "rgba(239,68,68,.06)",
                  color: "#fca5a5",
                  fontSize: 13,
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "flex-start",
                }}
              >
                <X size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                {error}
              </div>
            )}
          </form>
        </section>

        {/* ——— Output section ————————————————————— */}
        {!doc && !loading && (
          <div className="empty-state" style={{ marginTop: "2rem" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "var(--red-dim)",
                border: "1px solid rgba(192,57,43,.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1rem",
              }}
            >
              <BookOpen size={20} style={{ color: "var(--red-3)" }} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: "0.375rem" }}>
              Your artifact will appear here
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              Fill in a YouTube URL (or leave blank for demo) and click{" "}
              <strong style={{ color: "var(--text)" }}>Build artifact</strong>.
            </div>
          </div>
        )}

        {loading && (
          <div className="empty-state" style={{ marginTop: "2rem" }}>
            <Loader2
              size={32}
              className="spin"
              style={{ color: "var(--red-2)", display: "block", margin: "0 auto 1rem" }}
            />
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: "0.375rem" }}>Generating artifact…</div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              Pulling transcripts, restructuring content, building your{" "}
              <strong style={{ color: "var(--text)" }}>{format}</strong>.
            </div>
          </div>
        )}

        {doc && (
          <section
            id="output-section"
            className="fade-up"
            style={{
              marginTop: "2rem",
              display: "grid",
              gap: "1.25rem",
              gridTemplateColumns: "280px 1fr",
              alignItems: "start",
            }}
          >
            {/* ——— Sidebar ————————————————————— */}
            <aside style={{ position: "sticky", top: "1.25rem" }}>
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line-2)",
                  borderRadius: 14,
                  padding: "1.25rem",
                }}
              >
                <div className="doc-eyebrow" style={{ color: "var(--red-2)" }}>
                  Generated
                </div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 16,
                    letterSpacing: "-0.02em",
                    marginTop: "0.25rem",
                    lineHeight: 1.3,
                  }}
                >
                  {doc.title}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: "0.375rem", lineHeight: 1.6 }}>
                  {doc.subtitle}
                </div>

                {/* Stats */}
                <div
                  style={{
                    marginTop: "1rem",
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "0.5rem",
                  }}
                >
                  <div className="stat-cell">
                    <div className="stat-num">{stats.sections}</div>
                    <div className="stat-label">sections</div>
                  </div>
                  <div className="stat-cell">
                    <div className="stat-num">{stats.lessons}</div>
                    <div className="stat-label">lessons</div>
                  </div>
                  <div className="stat-cell">
                    <div className="stat-num">{stats.sources}</div>
                    <div className="stat-label">videos</div>
                  </div>
                </div>

                {/* Meta */}
                <div
                  style={{
                    marginTop: "1rem",
                    paddingTop: "1rem",
                    borderTop: "1px solid var(--line)",
                    display: "grid",
                    gap: "0.5rem",
                  }}
                >
                  {[
                    { label: "Audience", value: doc.audience },
                    { label: "Read time", value: doc.estimatedTime },
                    { label: "Source", value: doc.source.channel || doc.source.title || "—" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div style={{ fontSize: 10, color: "var(--subtle)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                        {label}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: "0.125rem", lineHeight: 1.5 }}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Export */}
                <div
                  style={{
                    marginTop: "1rem",
                    paddingTop: "1rem",
                    borderTop: "1px solid var(--line)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text)",
                      marginBottom: "0.5rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.375rem",
                    }}
                  >
                    <Download size={11} style={{ color: "var(--red-2)" }} />
                    Download Deliverable
                  </div>

                  {/* Primary deliverable download */}
                  <button
                    type="button"
                    id="primary-download-btn"
                    onClick={() => exportDocument(deliverableFormat)}
                    disabled={Boolean(exporting)}
                    style={{
                      width: "100%",
                      padding: "0.625rem 0.75rem",
                      borderRadius: 9,
                      background: "var(--red)",
                      color: "#fff",
                      border: "none",
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.5rem",
                      boxShadow: "0 2px 8px rgba(192,57,43,0.35)",
                      marginBottom: "0.75rem",
                    }}
                  >
                    {exporting === deliverableFormat ? (
                      <Loader2 size={13} className="spin" />
                    ) : (
                      <Download size={13} />
                    )}
                    Save {deliverableFormat === "html" ? "HTML Page (.html)" : deliverableFormat === "pdf" ? "PDF Document (.pdf)" : deliverableFormat === "markdown" ? "Markdown (.md)" : "JSON Data (.json)"}
                  </button>

                  <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: "0.375rem" }}>
                    Other formats:
                  </div>
                  <div style={{ display: "grid", gap: "0.375rem" }}>
                    {EXPORT_OPTIONS.filter((opt) => opt.format !== deliverableFormat).map(({ format: fmt, label, Icon }) => (
                      <button
                        key={fmt}
                        id={`export-${fmt}-btn`}
                        className="export-btn"
                        onClick={() => exportDocument(fmt)}
                        disabled={Boolean(exporting)}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <Icon size={13} style={{ color: "var(--muted)" }} />
                          {label}
                        </span>
                        {exporting === fmt ? (
                          <Loader2 size={12} className="spin" />
                        ) : (
                          <Download size={12} style={{ color: "var(--subtle)" }} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Re-generate */}
                <button
                  id="regenerate-btn"
                  type="button"
                  onClick={() => { setDoc(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  style={{
                    marginTop: "0.875rem",
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.375rem",
                    padding: "0.6rem",
                    border: "1px solid var(--line)",
                    borderRadius: 9,
                    background: "transparent",
                    color: "var(--muted)",
                    fontSize: 12,
                    cursor: "pointer",
                    transition: "border-color 0.15s, color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line-2)";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--text)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line)";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)";
                  }}
                >
                  <RotateCcw size={11} />
                  New artifact
                </button>
              </div>
            </aside>

            {/* ——— Document article & tabs ————————————— */}
            <div style={{ minWidth: 0 }}>
              <div className="studio-tabs" role="tablist">
                {([
                  ["design", "Live HTML", Globe],
                  ["read", "Reading View", BookOpen],
                  ["markdown", "Markdown", FileCode2],
                  ["quiz", "Quiz", Sparkles],
                  ["cards", "Flashcards", CheckSquare],
                  ["analysis", "Analysis", ShieldCheck],
                  ["json", "JSON Data", FileCode2],
                ] as const).map(([id, label, TabIcon]) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={tab === id}
                    className={tab === id ? "on" : ""}
                    onClick={() => setTab(id as typeof tab)}
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.375rem" }}
                  >
                    <TabIcon size={12} />
                    {label}
                  </button>
                ))}
              </div>
              {tab === "read" ? (
                <article
              className="doc-article"
              style={{
                borderRadius: 14,
                padding: "2.5rem 3rem",
                boxShadow: "0 1px 3px rgba(0,0,0,.07)",
              }}
            >
              {/* Cover */}
              <header style={{ paddingBottom: "1.75rem", borderBottom: "1px solid var(--doc-line)" }}>
                <div className="doc-eyebrow">{doc.format}</div>
                <h2 className="display-title" style={{ marginTop: "0.5rem" }}>
                  {doc.title}
                </h2>
                <p style={{ marginTop: "0.625rem", fontSize: 16, color: "var(--doc-muted)", lineHeight: 1.65 }}>
                  {doc.subtitle}
                </p>
                <div
                  style={{
                    marginTop: "1.25rem",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                  }}
                >
                  {[
                    { label: "Read time", value: doc.estimatedTime },
                    { label: "Source", value: `${doc.source.videoCount} video${doc.source.videoCount !== 1 ? "s" : ""}` },
                    { label: "Format", value: doc.format },
                    { label: "Editorial Rules", value: "Anti-Fluff Shield Active" },
                  ].map(({ label, value }) => (
                    <div key={label} className="cover-chip">
                      <span>{label}:</span>
                      <span style={{ fontWeight: 600, color: "var(--doc-text)" }}>{value}</span>
                    </div>
                  ))}
                </div>
              </header>

              {/* Overview */}
              <section style={{ marginTop: "1.75rem", paddingBottom: "1.75rem", borderBottom: "1px solid var(--doc-line)" }}>
                <div className="doc-eyebrow">Overview</div>
                <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--doc-muted)", marginTop: "0.5rem" }}>{doc.summary}</p>

                {doc.learningOutcomes.length > 0 && (
                  <div style={{ marginTop: "1.25rem" }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--doc-text)",
                        marginBottom: "0.625rem",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      Learning outcomes
                    </div>
                    <div style={{ display: "grid", gap: "0.375rem" }}>
                      {doc.learningOutcomes.map((outcome, i) => (
                        <div key={i} className="outcome-item">
                          <Check
                            size={14}
                            style={{ color: "var(--doc-red)", marginTop: 2, flexShrink: 0 }}
                          />
                          {outcome}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* Sections */}
              {doc.sections.map((section, si) => (
                <section
                  key={si}
                  style={{
                    marginTop: "2.5rem",
                    paddingBottom: "2rem",
                    borderBottom: si < doc.sections.length - 1 ? "1px solid var(--doc-line)" : "none",
                  }}
                >
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    <div
                      style={{
                        flexShrink: 0,
                        marginTop: "0.125rem",
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        background: "var(--red-dim)",
                        border: "1px solid rgba(192,57,43,.25)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--doc-red)",
                      }}
                    >
                      {si + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 className="section-heading">{section.title}</h3>
                      <p style={{ marginTop: "0.5rem", fontSize: 14, lineHeight: 1.8, color: "var(--doc-muted)" }}>
                        {section.intro}
                      </p>
                    </div>
                  </div>

                  {/* Lessons */}
                  {section.lessons?.map((lesson, li) => (
                    <div key={li} className="lesson-card">
                      <div style={{ display: "flex", gap: "0.875rem", alignItems: "flex-start" }}>
                        <div
                          style={{
                            flexShrink: 0,
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            border: "1.5px solid var(--doc-line)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 700,
                            color: "var(--doc-muted)",
                          }}
                        >
                          {li + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 15, color: "var(--doc-text)", lineHeight: 1.3 }}>
                            {lesson.title}
                          </div>
                          <p style={{ marginTop: "0.5rem", fontSize: 14, lineHeight: 1.75, color: "var(--doc-muted)" }}>
                            {lesson.summary}
                          </p>

                          {lesson.objective && (
                            <div style={{ marginTop: "1rem" }}>
                              <div
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  letterSpacing: "0.1em",
                                  textTransform: "uppercase",
                                  color: "var(--doc-muted)",
                                  marginBottom: "0.25rem",
                                }}
                              >
                                Objective
                              </div>
                              <div style={{ fontSize: 13, color: "var(--doc-text)" }}>{lesson.objective}</div>
                            </div>
                          )}

                          {lesson.keyPoints.length > 0 && (
                            <div style={{ marginTop: "0.875rem" }}>
                              <div
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  letterSpacing: "0.1em",
                                  textTransform: "uppercase",
                                  color: "var(--doc-muted)",
                                  marginBottom: "0.375rem",
                                }}
                              >
                                Key points
                              </div>
                              <ul style={{ paddingLeft: "1.25rem" }}>
                                {lesson.keyPoints.map((pt, k) => (
                                  <li key={k} style={{ fontSize: 13, color: "var(--doc-muted)", marginBottom: "0.25rem" }}>
                                    {pt}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {lesson.examples.length > 0 && (
                            <div style={{ marginTop: "0.875rem" }}>
                              <div
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  letterSpacing: "0.1em",
                                  textTransform: "uppercase",
                                  color: "var(--doc-muted)",
                                  marginBottom: "0.375rem",
                                }}
                              >
                                Examples
                              </div>
                              <ul style={{ paddingLeft: "1.25rem" }}>
                                {lesson.examples.map((ex, k) => (
                                  <li key={k} style={{ fontSize: 13, color: "var(--doc-muted)", marginBottom: "0.25rem" }}>
                                    {ex}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {lesson.exercise && (
                            <div className="practice-box">
                              <div
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  letterSpacing: "0.1em",
                                  textTransform: "uppercase",
                                  color: "var(--doc-red)",
                                  marginBottom: "0.375rem",
                                }}
                              >
                                Practice
                              </div>
                              <div style={{ fontSize: 13, color: "var(--doc-muted)", lineHeight: 1.7 }}>
                                {lesson.exercise}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Body paragraphs (article/blog) */}
                  {section.body?.map((para, pi) => (
                    <p
                      key={pi}
                      style={{ marginTop: "1rem", fontSize: 15, lineHeight: 1.8, color: "var(--doc-muted)" }}
                    >
                      {para}
                    </p>
                  ))}

                  {/* Key takeaways */}
                  {section.keyTakeaways.length > 0 && (
                    <div className="takeaway-box">
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "var(--red-2)",
                          marginBottom: "0.5rem",
                        }}
                      >
                        Key takeaways
                      </div>
                      <ul style={{ paddingLeft: "1.125rem" }}>
                        {section.keyTakeaways.map((pt, k) => (
                          <li key={k} style={{ fontSize: 13, color: "var(--doc-muted)", marginBottom: "0.25rem", lineHeight: 1.6 }}>
                            {pt}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              ))}

              {/* Glossary */}
              {doc.glossary.length > 0 && (
                <section style={{ marginTop: "2.5rem", paddingTop: "1.75rem", borderTop: "1px solid var(--doc-line)" }}>
                  <div className="doc-eyebrow">Glossary</div>
                  <div style={{ marginTop: "1rem", display: "grid", gap: "1rem" }}>
                    {doc.glossary.map((item, i) => (
                      <div key={i} style={{ display: "flex", gap: "0.75rem" }}>
                        <div
                          style={{
                            flexShrink: 0,
                            width: 3,
                            borderRadius: 2,
                            background: "var(--doc-red)",
                            opacity: 0.5,
                            alignSelf: "stretch",
                          }}
                        />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--doc-text)" }}>{item.term}</div>
                          <div style={{ fontSize: 13, color: "var(--doc-muted)", lineHeight: 1.65, marginTop: "0.25rem" }}>
                            {item.definition}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Final checklist */}
              {doc.finalChecklist.length > 0 && (
                <section style={{ marginTop: "2rem", paddingTop: "1.75rem", borderTop: "1px solid var(--doc-line)" }}>
                  <div className="doc-eyebrow">Final checklist</div>
                  <div style={{ marginTop: "0.875rem", display: "grid", gap: "0.5rem" }}>
                    {doc.finalChecklist.map((item, i) => (
                      <div key={i} className="outcome-item">
                        <CheckSquare
                          size={14}
                          style={{ color: "var(--doc-red)", marginTop: 2, flexShrink: 0 }}
                        />
                        {item}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Footer */}
              <footer
                style={{
                  marginTop: "2.5rem",
                  paddingTop: "1.25rem",
                  borderTop: "1px solid var(--doc-line)",
                  fontSize: 11,
                  color: "var(--doc-muted)",
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                }}
              >
                <span>Generated by CourseForge</span>
                <span>{doc.generatedAt ? new Date(doc.generatedAt).toLocaleDateString() : ""}</span>
              </footer>
            </article>
              ) : tab === "markdown" ? (
                <div
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--line-2)",
                    borderRadius: 14,
                    padding: "1.75rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "1rem",
                      flexWrap: "wrap",
                      gap: "0.75rem",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>Markdown Document</div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: "0.2rem" }}>
                        Clean markdown text ready for Obsidian, Notion, or blog static site generators
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button type="button" className="chip on" onClick={copyMarkdown}>
                        {copiedMd ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy Markdown</>}
                      </button>
                      <button type="button" className="chip" onClick={() => exportDocument("markdown")}>
                        <Download size={12} /> Download .md
                      </button>
                    </div>
                  </div>
                  <pre
                    style={{
                      maxHeight: "75vh",
                      overflow: "auto",
                      padding: "1.25rem",
                      borderRadius: 10,
                      background: "var(--field-bg)",
                      border: "1px solid var(--line-2)",
                      fontSize: 12.5,
                      fontFamily: "ui-monospace, monospace",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      color: "var(--text-2)",
                    }}
                  >
                    <code>{doc.generatedMarkdown || renderMarkdown(doc)}</code>
                  </pre>
                </div>
              ) : tab === "json" ? (
                <div
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--line-2)",
                    borderRadius: 14,
                    padding: "1.75rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "1rem",
                      flexWrap: "wrap",
                      gap: "0.75rem",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>Structured JSON Payload</div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: "0.2rem" }}>
                        Complete schema with learning outcomes, sections, and source traceability
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button type="button" className="chip on" onClick={copyJson}>
                        {copiedJson ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy JSON</>}
                      </button>
                      <button type="button" className="chip" onClick={() => exportDocument("json")}>
                        <Download size={12} /> Download .json
                      </button>
                    </div>
                  </div>
                  <pre
                    style={{
                      maxHeight: "75vh",
                      overflow: "auto",
                      padding: "1.25rem",
                      borderRadius: 10,
                      background: "var(--field-bg)",
                      border: "1px solid var(--line-2)",
                      fontSize: 12,
                      fontFamily: "ui-monospace, monospace",
                      lineHeight: 1.5,
                      color: "var(--text-2)",
                    }}
                  >
                    <code>{JSON.stringify(doc, null, 2)}</code>
                  </pre>
                </div>
              ) : (
                <Studio
                  key={tab}
                  tab={tab as StudioTab}
                  doc={doc}
                  sourceUrl={sourceUrl || "https://www.youtube.com/playlist?list=DEMO"}
                  language={language}
                  maxVideos={effectiveMaxVideos}
                />
              )}
            </div>
          </section>
        )}

      {/* ——— Writing Rules Inspection Modal ————————————————————————————— */}
      {showRulesModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setShowRulesModal(false)}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line-2)",
              borderRadius: 16,
              maxWidth: 720,
              width: "100%",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div
              style={{
                padding: "1.25rem 1.5rem",
                borderBottom: "1px solid var(--line)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    background: "var(--red-dim)",
                    border: "1px solid rgba(192,57,43,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--red)",
                  }}
                >
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text)" }}>
                    AI Editorial Writing Rules
                  </h3>
                  <p style={{ margin: "0.15rem 0 0", fontSize: 12, color: "var(--muted)" }}>
                    Injected into Gemini system instructions and enforced across all generated content
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="close-rules-modal-btn"
                onClick={() => setShowRulesModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--muted)",
                  cursor: "pointer",
                  padding: 6,
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal content */}
            <div
              style={{
                padding: "1.25rem 1.5rem",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem",
              }}
            >
              {/* 19 Rules */}
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--red-2)",
                    marginBottom: "0.625rem",
                  }}
                >
                  19 Core Writing Rules
                </div>
                <div style={{ display: "grid", gap: "0.35rem" }}>
                  {WRITING_RULES_ITEMS.map((rule, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: "0.5rem",
                        fontSize: 12.5,
                        lineHeight: 1.5,
                        padding: "0.4rem 0.6rem",
                        borderRadius: 6,
                        background: "var(--field-bg)",
                        color: "var(--text)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "var(--red)",
                          fontVariantNumeric: "tabular-nums",
                          minWidth: 18,
                        }}
                      >
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span>{rule}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 64 Banned Words */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--red-2)",
                    }}
                  >
                    {BANNED_WORDS.length} Banned Words & Phrases
                  </div>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    Zero tolerance in any form or tense
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.375rem",
                    maxHeight: 180,
                    overflowY: "auto",
                    padding: "0.625rem",
                    background: "var(--field-bg)",
                    border: "1px solid var(--line-2)",
                    borderRadius: 8,
                  }}
                >
                  {BANNED_WORDS.map((word) => (
                    <span
                      key={word}
                      style={{
                        fontSize: 11,
                        padding: "0.2rem 0.45rem",
                        borderRadius: 4,
                        background: "var(--surface)",
                        border: "1px solid var(--line)",
                        color: "var(--muted)",
                        fontFamily: "monospace",
                      }}
                    >
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div
              style={{
                padding: "0.875rem 1.5rem",
                borderTop: "1px solid var(--line)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--panel-bg)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: 11.5, color: "var(--muted)" }}>
                <Check size={13} style={{ color: "var(--red)" }} />
                <span>Active enforcement enabled on next generation</span>
              </div>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="btn-primary"
                style={{ padding: "0.45rem 1rem", fontSize: 12 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}

