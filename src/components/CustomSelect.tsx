"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface CustomSelectOption<T extends string = string> {
  value: T;
  label: string;
  sublabel?: string;
  desc?: string;
  badge?: string;
  icon?: React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>;
}

export interface CustomSelectProps<T extends string = string> {
  id?: string;
  value: T;
  onChange: (value: T) => void;
  options: CustomSelectOption<T>[];
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
  menuPlacement?: "bottom" | "top" | "auto";
}

export default function CustomSelect<T extends string = string>({
  id,
  value,
  onChange,
  options,
  placeholder = "Select...",
  style,
  className,
  menuPlacement = "auto",
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const computePlacement = useCallback((): "top" | "bottom" => {
    if (menuPlacement === "top") return "top";
    if (menuPlacement === "bottom") return "bottom";
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow < 320 && spaceAbove > spaceBelow) {
        return "top";
      }
    }
    return "bottom";
  }, [menuPlacement]);

  const [actualPlacement, setActualPlacement] = useState<"top" | "bottom">(
    menuPlacement === "top" ? "top" : "bottom"
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const hasAnyIcon = options.some((opt) => !!opt.icon);

  // Sync placement on scroll/resize when open
  useEffect(() => {
    if (!isOpen) return;
    const handleRecalc = () => {
      setActualPlacement(computePlacement());
    };
    window.addEventListener("scroll", handleRecalc, true);
    window.addEventListener("resize", handleRecalc);
    return () => {
      window.removeEventListener("scroll", handleRecalc, true);
      window.removeEventListener("resize", handleRecalc);
    };
  }, [isOpen, computePlacement]);

  const openMenu = () => {
    setActualPlacement(computePlacement());
    const idx = options.findIndex((opt) => opt.value === value);
    setHighlightedIndex(idx >= 0 ? idx : 0);
    setIsOpen(true);
  };

  const toggleMenu = () => {
    if (!isOpen) {
      openMenu();
    } else {
      setIsOpen(false);
    }
  };

  // Close when clicking outside
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("pointerdown", handlePointerDown);
      return () => document.removeEventListener("pointerdown", handlePointerDown);
    }
  }, [isOpen]);

  // Keep highlighted item in view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && menuRef.current) {
      const item = menuRef.current.children[highlightedIndex] as HTMLElement | undefined;
      if (item) {
        item.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [isOpen, highlightedIndex]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          openMenu();
        }
        return;
      }

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          break;
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev + 1 < options.length ? prev + 1 : 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : options.length - 1));
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < options.length) {
            onChange(options[highlightedIndex].value);
            setIsOpen(false);
          }
          break;
        case "Tab":
          setIsOpen(false);
          break;
      }
    },
    [isOpen, highlightedIndex, options, value, onChange, computePlacement]
  );

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        zIndex: isOpen ? 60 : undefined,
        ...style,
      }}
      className={className}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger button */}
      <button
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={toggleMenu}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          background: "var(--field-bg)",
          border: isOpen ? "1px solid var(--red-2)" : "1px solid var(--line)",
          boxShadow: isOpen ? "0 0 0 3px var(--red-dim)" : "none",
          borderRadius: 9,
          padding: "0.55rem 0.75rem",
          color: "var(--text)",
          fontSize: 12.5,
          fontWeight: 500,
          textAlign: "left",
          cursor: "pointer",
          outline: "none",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {selectedOption ? (
            <>
              {selectedOption.icon && (
                <selectedOption.icon
                  size={14}
                  style={{ color: "var(--red-2)", flexShrink: 0 }}
                />
              )}
              <span style={{ fontWeight: 600, color: "var(--text)" }}>
                {selectedOption.label}
              </span>
              {selectedOption.badge && (
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                    padding: "1px 5px",
                    borderRadius: 4,
                    background: "var(--red-dim)",
                    color: "var(--red-2)",
                    border: "1px solid rgba(192, 57, 43, 0.3)",
                    flexShrink: 0,
                  }}
                >
                  {selectedOption.badge}
                </span>
              )}
              {selectedOption.sublabel && (
                <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>
                  ({selectedOption.sublabel})
                </span>
              )}
            </>
          ) : (
            <span style={{ color: "var(--subtle)" }}>{placeholder}</span>
          )}
        </span>

        <ChevronDown
          size={14}
          style={{
            color: isOpen ? "var(--red-2)" : "var(--muted)",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), color 0.15s ease",
            flexShrink: 0,
          }}
        />
      </button>

      {/* Floating Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          role="listbox"
          tabIndex={-1}
          style={{
            position: "absolute",
            [actualPlacement === "top" ? "bottom" : "top"]: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 150,
            background: "var(--surface-2)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid var(--line-3)",
            borderRadius: 10,
            boxShadow: "0 16px 48px rgba(0, 0, 0, 0.8), 0 4px 14px rgba(0, 0, 0, 0.4)",
            maxHeight: 340,
            overflowY: "auto",
            padding: "0.35rem",
            animation: actualPlacement === "top"
              ? "selectPopInUp 0.16s cubic-bezier(0.16, 1, 0.3, 1)"
              : "selectPopIn 0.16s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isHighlighted = idx === highlightedIndex;
            const Icon = opt.icon;

            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                  padding: "0.5rem 0.65rem",
                  borderRadius: 7,
                  cursor: "pointer",
                  background: isSelected
                    ? "var(--red-dim)"
                    : isHighlighted
                    ? "rgba(255, 255, 255, 0.06)"
                    : "transparent",
                  border: isSelected ? "1px solid rgba(192, 57, 43, 0.3)" : "1px solid transparent",
                  color: isSelected ? "var(--text)" : isHighlighted ? "var(--text)" : "var(--muted)",
                  transition: "background 0.12s ease, border-color 0.12s ease, color 0.12s ease",
                  marginBottom: idx < options.length - 1 ? 2 : 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0, flex: 1 }}>
                  {hasAnyIcon && (
                    Icon ? (
                      <Icon
                        size={14}
                        style={{
                          color: isSelected ? "var(--red-2)" : "var(--muted)",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <span style={{ width: 14, flexShrink: 0, display: "inline-block" }} />
                    )
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.375rem" }}>
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: isSelected ? 700 : 500,
                          color: isSelected ? "var(--text)" : "inherit",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {opt.label}
                      </span>
                      {opt.sublabel && (
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>
                          ({opt.sublabel})
                        </span>
                      )}
                    </div>
                    {opt.desc && (
                      <div
                        style={{
                          fontSize: 10,
                          color: isSelected ? "var(--text-2)" : "var(--muted)",
                          marginTop: 1,
                          lineHeight: 1.3,
                        }}
                      >
                        {opt.desc}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexShrink: 0 }}>
                  {opt.badge && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: "1px 5px",
                        borderRadius: 4,
                        background: "var(--red-dim)",
                        color: "var(--red-2)",
                        border: "1px solid rgba(192, 57, 43, 0.3)",
                      }}
                    >
                      {opt.badge}
                    </span>
                  )}
                  {isSelected && (
                    <Check
                      size={13}
                      style={{
                        color: "var(--red-2)",
                        strokeWidth: 2.75,
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
