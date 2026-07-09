"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";

const INTERVAL = 5000;

const slides = [
  {
    gradient: "linear-gradient(135deg, #0d1a2e 0%, #1a2d52 50%, #2e5090 100%)",
    glowColor: "rgba(46,80,144,0.40)",
    tag: "Asset & IT Maintenance",
    tagColor: "#7ba3e0",
    tagBorder: "rgba(46,80,144,0.30)",
    tagBg: "rgba(46,80,144,0.12)",
    lines: ["Full Visibility Over", "Your IT Infrastructure"],
    accentWord: 1,
    sub: "Track every asset from purchase to retirement, across all locations and companies.",
  },
  {
    gradient: "linear-gradient(135deg, #160a00 0%, #3a1f00 60%, #6b3a08 100%)",
    glowColor: "rgba(200,122,28,0.38)",
    tag: "Employee Management",
    tagColor: "#f0a845",
    tagBorder: "rgba(200,122,28,0.30)",
    tagBg: "rgba(200,122,28,0.10)",
    lines: ["People-First", "Workplace Operations"],
    accentWord: 1,
    sub: "Profiles, clearances, leave workflows, QR records and handover packs — in one place.",
  },
  {
    gradient: "linear-gradient(135deg, #070e1a 0%, #0a1828 55%, #0e2540 100%)",
    glowColor: "rgba(60,140,220,0.28)",
    tag: "Security Operations",
    tagColor: "#60b4f8",
    tagBorder: "rgba(60,140,220,0.30)",
    tagBg: "rgba(60,140,220,0.10)",
    lines: ["Risk Under Control,", "Always."],
    accentWord: 1,
    sub: "Vulnerability tracking, incident response, and a live risk register — all connected.",
  },
  {
    gradient: "linear-gradient(135deg, #091509 0%, #142814 55%, #1e401e 100%)",
    glowColor: "rgba(50,140,70,0.25)",
    tag: "Project Governance",
    tagColor: "#6dd86d",
    tagBorder: "rgba(50,140,70,0.30)",
    tagBg: "rgba(50,140,70,0.10)",
    lines: ["Deliver Projects", "With Confidence."],
    accentWord: 1,
    sub: "Milestones, gap tracking, and deliverable control across every initiative.",
  },
];

export function LoginSlider() {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrent((c) => (c + 1) % slides.length);
        setVisible(true);
      }, 420);
    }, INTERVAL);
    return () => clearInterval(timer);
  }, []);

  const slide = slides[current];

  return (
    <div
      className="relative hidden flex-col justify-between overflow-hidden lg:flex lg:w-[58%]"
      style={{ background: slide.gradient, transition: "background 0.7s ease" }}
    >
      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Radial glow top-left */}
      <div
        className="pointer-events-none absolute -left-32 -top-32 h-[520px] w-[520px] rounded-full"
        style={{
          background: `radial-gradient(circle, ${slide.glowColor} 0%, transparent 70%)`,
          transition: "background 0.7s ease",
        }}
      />

      {/* Radial glow bottom-right */}
      <div
        className="pointer-events-none absolute -bottom-32 -right-16 h-[420px] w-[420px] rounded-full"
        style={{
          background: `radial-gradient(circle, ${slide.glowColor} 0%, transparent 65%)`,
          transition: "background 0.7s ease",
        }}
      />

      {/* ── Logo ── */}
      <div className="relative z-10 p-10">
        <div className="text-xl font-bold tracking-tight text-white">JASCOMiyaar</div>
        <div className="text-xs mt-0.5" style={{ color: "rgba(148,163,184,0.55)" }}>
          By Horizon Business Solutions Est.
        </div>
      </div>

      {/* ── Slide content ── */}
      <div
        className="relative z-10 flex flex-col justify-center px-10 space-y-6"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(14px)",
          transition: "opacity 0.42s ease, transform 0.42s ease",
        }}
      >
        {/* Module tag */}
        <div
          className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
          style={{
            background: slide.tagBg,
            border: `1px solid ${slide.tagBorder}`,
            color: slide.tagColor,
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: slide.tagColor }}
          />
          {slide.tag}
        </div>

        {/* Headline */}
        <h1 className="text-4xl font-bold leading-tight text-white xl:text-[46px]">
          {slide.lines[0]}
          <br />
          <span style={{ color: slide.tagColor }}>{slide.lines[1]}</span>
        </h1>

        {/* Accent rule */}
        <div
          className="h-0.5 w-16 rounded-full"
          style={{ backgroundColor: slide.tagColor, opacity: 0.6 }}
        />

        {/* Sub-text */}
        <p
          className="max-w-[340px] text-sm leading-relaxed"
          style={{ color: "rgba(148,163,184,0.85)" }}
        >
          {slide.sub}
        </p>

        {/* Progress dots */}
        <div className="flex items-center gap-2 pt-2">
          {slides.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-400"
              style={{
                width: i === current ? 22 : 6,
                height: 6,
                backgroundColor:
                  i === current ? slide.tagColor : "rgba(255,255,255,0.18)",
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="relative z-10 p-10">
        <div className="flex items-center gap-2">
          <Lock className="h-3 w-3" style={{ color: "rgba(100,116,139,0.75)" }} />
          <span className="text-xs" style={{ color: "rgba(100,116,139,0.75)" }}>
            ISO 27001-aligned · Role-based access control · End-to-end encrypted
          </span>
        </div>
      </div>
    </div>
  );
}
