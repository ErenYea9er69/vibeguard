"use client";

import React, { useEffect, useRef } from "react";
import {
  CheckCircle2,
  Loader2,
  Circle,
  Play,
  FileText,
  Sparkles,
  FileCode,
  Palette,
  Terminal,
  Clock,
  ArrowRight
} from "lucide-react";

export interface GenerationProgressState {
  step: number;
  totalSteps: number;
  stepsLeft: number;
  percent: number;
  title: string;
  detail: string;
  stepId: "source" | "transcripts" | "ai" | "markdown" | "design";
  logs: { time: string; text: string; type: "info" | "success" | "warn" }[];
  deliverableFormat: string;
}

interface StepDefinition {
  id: "source" | "transcripts" | "ai" | "markdown" | "design";
  number: number;
  label: string;
  desc: string;
  Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>;
}

export default function GenerationProgress({
  progress,
  format,
}: {
  progress: GenerationProgressState;
  format: string;
}) {
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log feed to bottom on new events
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [progress.logs]);

  const isHtml = progress.deliverableFormat === "html";

  const allSteps: StepDefinition[] = [
    {
      id: "source",
      number: 1,
      label: "Source Discovery & Validation",
      desc: "Resolving YouTube metadata, channel info & playlist structure",
      Icon: Play,
    },
    {
      id: "transcripts",
      number: 2,
      label: "Transcript Extraction",
      desc: "Fetching video transcripts, captions and spoken word content",
      Icon: FileText,
    },
    {
      id: "ai",
      number: 3,
      label: "Curriculum Synthesis (Nemotron AI)",
      desc: "Structuring concepts, modules, key takeaways & exercises",
      Icon: Sparkles,
    },
    {
      id: "markdown",
      number: 4,
      label: "Markdown Deliverable Assembly",
      desc: "Compiling formatted documentation with code blocks & source anchors",
      Icon: FileCode,
    },
    ...(isHtml
      ? [
          {
            id: "design" as const,
            number: 5,
            label: "Bespoke Interactive UI",
            desc: "Compiling HTML page layout, design tokens & interactive widgets",
            Icon: Palette,
          },
        ]
      : []),
  ];

  return (
    <div
      id="generation-progress-card"
      style={{
        marginTop: "2rem",
        background: "var(--surface)",
        border: "1px solid var(--line-2)",
        borderRadius: 16,
        padding: "2rem",
        boxShadow: "0 20px 50px rgba(0, 0, 0, 0.4)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient background glow orb */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -60,
          right: -60,
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(192,57,43,0.14) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Top Banner: Status + Big Badges */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.35rem" }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "var(--red-2)",
                boxShadow: "0 0 10px var(--red)",
                display: "inline-block",
                animation: "pulse 1.8s infinite",
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--red-2)",
              }}
            >
              Generating {format}
            </span>
          </div>

          <h2
            style={{
              fontSize: "clamp(1.25rem, 2.5vw, 1.6rem)",
              fontWeight: 700,
              color: "var(--text)",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            {progress.title || "Processing..."}
          </h2>

          <p
            style={{
              fontSize: 13,
              color: "var(--muted)",
              marginTop: "0.35rem",
              lineHeight: 1.45,
              maxWidth: 640,
            }}
          >
            {progress.detail || "Communicating with backend pipeline..."}
          </p>
        </div>

        {/* Step counter pill badges */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <div
            style={{
              padding: "0.4rem 0.85rem",
              borderRadius: 8,
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--line-2)",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text)",
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
            }}
          >
            <Clock size={13} style={{ color: "var(--muted)" }} />
            Step <strong style={{ color: "var(--red-2)" }}>{progress.step}</strong> of {progress.totalSteps}
          </div>

          <div
            style={{
              padding: "0.4rem 0.85rem",
              borderRadius: 8,
              background: "var(--red-dim)",
              border: "1px solid rgba(192, 57, 43, 0.35)",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--red-2)",
            }}
          >
            {progress.stepsLeft === 0
              ? "Final step"
              : `${progress.stepsLeft} step${progress.stepsLeft === 1 ? "" : "s"} left`}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ marginBottom: "2rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 11,
            color: "var(--muted)",
            marginBottom: "0.375rem",
            fontWeight: 500,
          }}
        >
          <span>Pipeline execution</span>
          <span style={{ color: "var(--red-2)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {progress.percent}%
          </span>
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 3,
            background: "var(--surface-2)",
            border: "1px solid var(--line)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, Math.max(5, progress.percent))}%`,
              background: "linear-gradient(90deg, var(--red) 0%, var(--red-2) 100%)",
              borderRadius: 3,
              boxShadow: "0 0 12px var(--red-glow)",
              transition: "width 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </div>
      </div>

      {/* Grid: 2 columns on wide: Steps Checklist + Live Activity Stream */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "1.5rem",
          alignItems: "start",
        }}
      >
        {/* Left Column: Real Step Timeline */}
        <div
          style={{
            background: "var(--field-bg)",
            border: "1px solid var(--line-2)",
            borderRadius: 12,
            padding: "1.25rem",
          }}
        >
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: "1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>Execution steps</span>
            <span style={{ fontSize: 11, color: "var(--subtle)" }}>
              {progress.totalSteps} phases
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {allSteps.map((s) => {
              const isPast = s.number < progress.step;
              const isCurrent = s.number === progress.step;
              const isFuture = s.number > progress.step;

              return (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                    padding: "0.75rem 0.85rem",
                    borderRadius: 9,
                    background: isCurrent
                      ? "var(--red-dim)"
                      : isPast
                      ? "rgba(255, 255, 255, 0.02)"
                      : "transparent",
                    border: isCurrent
                      ? "1px solid rgba(192, 57, 43, 0.35)"
                      : isPast
                      ? "1px solid rgba(255, 255, 255, 0.05)"
                      : "1px solid transparent",
                    transition: "all 0.2s ease",
                  }}
                >
                  {/* Status Icon */}
                  <div style={{ marginTop: 2, flexShrink: 0 }}>
                    {isPast ? (
                      <CheckCircle2 size={16} style={{ color: "#2fa56a" }} />
                    ) : isCurrent ? (
                      <Loader2 size={16} className="spin" style={{ color: "var(--red-2)" }} />
                    ) : (
                      <Circle size={15} style={{ color: "var(--subtle)" }} />
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: isCurrent ? 700 : isPast ? 600 : 500,
                          color: isCurrent ? "var(--text)" : isPast ? "var(--text-2)" : "var(--muted)",
                        }}
                      >
                        {s.number}. {s.label}
                      </div>

                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 600,
                          padding: "1px 6px",
                          borderRadius: 4,
                          flexShrink: 0,
                          background: isPast
                            ? "rgba(47, 165, 106, 0.12)"
                            : isCurrent
                            ? "var(--red-dim)"
                            : "rgba(255, 255, 255, 0.03)",
                          color: isPast
                            ? "#2fa56a"
                            : isCurrent
                            ? "var(--red-2)"
                            : "var(--muted)",
                          border: isPast
                            ? "1px solid rgba(47, 165, 106, 0.25)"
                            : isCurrent
                            ? "1px solid rgba(192, 57, 43, 0.35)"
                            : "1px solid var(--line)",
                        }}
                      >
                        {isPast ? "Done" : isCurrent ? "In progress" : "Pending"}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        color: isCurrent ? "var(--text-2)" : "var(--muted)",
                        marginTop: 2,
                        lineHeight: 1.35,
                      }}
                    >
                      {isCurrent ? progress.detail : s.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Live Activity Stream (Terminal Feed) */}
        <div
          style={{
            background: "#080808",
            border: "1px solid var(--line-2)",
            borderRadius: 12,
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            minHeight: 280,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid var(--line)",
              paddingBottom: "0.75rem",
              marginBottom: "0.75rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Terminal size={13} style={{ color: "var(--red-2)" }} />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--text-2)",
                }}
              >
                Live activity feed
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#2fa56a",
                  boxShadow: "0 0 6px #2fa56a",
                  display: "inline-block",
                }}
              />
              <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 500 }}>Live streaming</span>
            </div>
          </div>

          {/* Log messages scrollbox */}
          <div
            ref={logContainerRef}
            style={{
              flex: 1,
              maxHeight: 230,
              overflowY: "auto",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: 11,
              lineHeight: 1.6,
              display: "flex",
              flexDirection: "column",
              gap: "0.4rem",
              paddingRight: "0.25rem",
            }}
          >
            {progress.logs.length === 0 ? (
              <div style={{ color: "var(--subtle)", fontStyle: "italic", padding: "1rem 0" }}>
                Waiting for backend pipeline events...
              </div>
            ) : (
              progress.logs.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.5rem",
                    wordBreak: "break-word",
                  }}
                >
                  <span style={{ color: "var(--subtle)", flexShrink: 0, userSelect: "none" }}>
                    [{item.time}]
                  </span>
                  <span
                    style={{
                      color:
                        item.type === "success"
                          ? "#4ade80"
                          : item.type === "warn"
                          ? "#facc15"
                          : "var(--text-2)",
                    }}
                  >
                    {item.text}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
