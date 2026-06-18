"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Clipboard,
  ClipboardPaste,
  Download,
  FileText,
  Gauge,
  History,
  Link2,
  Loader2,
  Moon,
  Newspaper,
  Radar,
  Search,
  ShieldAlert,
  Sparkles,
  Upload,
  X,
  TimerReset,
  XCircle
} from "lucide-react";
import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { AnalysisResponse, FiltrReport } from "@/lib/types";
import { toMarkdown } from "@/lib/markdown";

type StoredAnalysis = AnalysisResponse & {
  id: string;
  createdAt: string;
};

type InputMode = "url" | "pdf";

const sampleUrl = "https://www.reuters.com/";
const samplePdfUrl = "https://example.com/document.pdf";

const sourceChips = [
  { label: "Reuters", url: "https://www.reuters.com/" },
  { label: "Research", url: "https://www.nature.com/articles/d41586-024-00000-0" },
  { label: "Forum", url: "https://news.ycombinator.com/" }
];

const processSteps = [
  { key: "extract", label: "Extract Content" },
  { key: "clean", label: "Clean Text" },
  { key: "analyze", label: "Analyze Framing" },
  { key: "brief", label: "Generate Brief" }
];

const whatYouGet = ["TL;DR", "Key Facts", "Narrative Analysis", "Alternate Perspective", "Confidence Assessment"];

const supportedSources = ["News sites", "Blogs", "Research papers", "PDFs"];

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Section({
  title,
  icon,
  children,
  className
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("border-t border-white/10 py-6", className)}>
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-steel">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (!items.filter(Boolean).length) return null;
  return (
    <ul className="space-y-2 text-sm leading-6 text-zinc-200">
      {items.filter(Boolean).map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-3">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function BiasMeter({ score }: { score: number }) {
  const level = score <= 3 ? "Mostly factual" : score <= 6 ? "Mixed framing" : "Narrative-heavy";
  const color = score <= 3 ? "bg-mint" : score <= 6 ? "bg-signal" : "bg-risk";

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-steel">Narrative Load</p>
          <p className="mt-1 text-sm text-zinc-300">{level}</p>
        </div>
        <p className="font-mono text-4xl font-semibold">{score}<span className="text-lg text-steel">/10</span></p>
      </div>
      <div className="h-2 rounded-full bg-white/10">
        <div className={cx("h-full rounded-full", color)} style={{ width: `${Math.max(0, Math.min(10, score)) * 10}%` }} />
      </div>
    </div>
  );
}

function FactGrid({ report }: { report: FiltrReport }) {
  const factGroups = [
    ["Verifiable Claims", report.keyFacts.verifiableClaims],
    ["Important Numbers", report.keyFacts.importantNumbers],
    ["Named Entities", report.keyFacts.namedEntities]
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {factGroups.map(([title, items]) => (
        <div key={title as string} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">{title as string}</h3>
          <BulletList items={items as string[]} />
        </div>
      ))}
    </div>
  );
}

function NarrativeLoadTag({ score }: { score: number }) {
  const level = score <= 3 ? "Low" : score <= 6 ? "Moderate" : "High";
  const dotColor = score <= 3 ? "bg-loadLow" : score <= 6 ? "bg-loadMed" : "bg-loadHigh";
  const textColor = score <= 3 ? "text-loadLow" : score <= 6 ? "text-loadMed" : "text-loadHigh";

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className={cx("h-1.5 w-1.5 rounded-full", dotColor)} />
      <span className="text-steel">Narrative Load</span>
      <span className={textColor}>{level}</span>
    </span>
  );
}

export default function Home() {
  const [mode, setMode] = useState<InputMode>("url");
  const [url, setUrl] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<StoredAnalysis | null>(null);
  const [history, setHistory] = useState<StoredAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("filtr-history");
    if (stored) {
      const parsed = JSON.parse(stored) as StoredAnalysis[];
      setHistory(parsed);
      setAnalysis(parsed[0] || null);
    }
  }, []);

  useEffect(() => {
    if (!loading) {
      setActiveStep(0);
      return;
    }
    const interval = setInterval(() => {
      setActiveStep((step) => (step < processSteps.length - 1 ? step + 1 : step));
    }, 1400);
    return () => clearInterval(interval);
  }, [loading]);

  const markdown = useMemo(() => (analysis ? toMarkdown(analysis) : ""), [analysis]);
  const trimmedUrl = url.trim();
  const urlState = useMemo(() => {
    if (mode === "pdf" && pdfFile) {
      return { label: pdfFile.name, tone: "text-mint", valid: true };
    }
    if (!trimmedUrl) {
      return { label: "Awaiting source", tone: "text-steel", valid: false };
    }
    try {
      const parsed = new URL(trimmedUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return { label: "HTTP links only", tone: "text-risk", valid: false };
      }
      return { label: parsed.hostname.replace(/^www\./, ""), tone: "text-mint", valid: true };
    } catch {
      return { label: "Needs a full URL", tone: "text-signal", valid: false };
    }
  }, [trimmedUrl, mode, pdfFile]);

  function saveHistory(item: StoredAnalysis) {
    const next = [item, ...history.filter((entry) => entry.source.url !== item.source.url)].slice(0, 8);
    setHistory(next);
    window.localStorage.setItem("filtr-history", JSON.stringify(next));
  }

  function switchMode(next: InputMode) {
    setMode(next);
    setError("");
    setUrl("");
    setPdfFile(null);
  }

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      let response: Response;

      if (mode === "pdf" && pdfFile) {
        const formData = new FormData();
        formData.append("file", pdfFile);
        response = await fetch("/api/analyze", {
          method: "POST",
          body: formData
        });
      } else {
        response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url, mode })
        });
      }

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Analysis failed.");
      }

      const stored: StoredAnalysis = {
        ...payload,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString()
      };
      setAnalysis(stored);
      saveHistory(stored);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function pasteFromClipboard() {
    const text = await navigator.clipboard.readText();
    setUrl(text.trim());
    setError("");
  }

  function handlePdfSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
        setError("Please select a PDF file.");
        return;
      }
      setPdfFile(file);
      setError("");
    }
  }

  function handleDrop(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    setDragging(false);

    if (mode === "pdf") {
      const file = event.dataTransfer.files?.[0];
      if (file && (file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf"))) {
        setPdfFile(file);
        setError("");
      } else if (file) {
        setError("Please drop a PDF file.");
      }
      return;
    }

    const text = event.dataTransfer.getData("text/uri-list") || event.dataTransfer.getData("text/plain");
    if (text) {
      setUrl(text.trim());
      setError("");
    }
  }

  async function copyMarkdown() {
    await navigator.clipboard.writeText(markdown);
  }

  function downloadMarkdown() {
    if (!analysis) return;
    const blob = new Blob([markdown], { type: "text/markdown" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `${analysis.source.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-filtr.md`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  function startNewAnalysis() {
    setAnalysis(null);
    setError("");
  }

  return (
    <main className="min-h-screen bg-ink text-zinc-50">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between pb-4">
          <Link href="/" title="Home" onClick={startNewAnalysis}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-sm.png"
              alt="Filtr"
              style={{ width: 140, height: "auto", cursor: "pointer" }}
            />
          </Link>
          <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-steel">
            <Moon className="h-4 w-4" />
            Dark
          </div>
        </header>

        {!analysis ? (
          <>
            <section className="flex flex-col items-center px-2 py-14 text-center sm:py-20">
              <h1 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-6xl">
                extract what matters.
              </h1>

              <form
                onSubmit={analyze}
                onDragEnter={() => setDragging(true)}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className="mt-10 w-full max-w-2xl"
              >
                <div className="mb-3 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => switchMode("url")}
                    className={cx(
                      "flex h-8 items-center gap-2 rounded-full border px-4 text-xs font-medium uppercase tracking-[0.08em] transition",
                      mode === "url"
                        ? "border-accent/50 bg-accent/10 text-accent"
                        : "border-white/10 text-steel hover:border-white/25 hover:text-white"
                    )}
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    URL
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("pdf")}
                    className={cx(
                      "flex h-8 items-center gap-2 rounded-full border px-4 text-xs font-medium uppercase tracking-[0.08em] transition",
                      mode === "pdf"
                        ? "border-accent/50 bg-accent/10 text-accent"
                        : "border-white/10 text-steel hover:border-white/25 hover:text-white"
                    )}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    PDF
                  </button>
                </div>

                <div
                  className={cx(
                    "rounded-xl border p-2 transition",
                    dragging ? "border-accent bg-accent/10" : focused ? "border-accent/50" : "border-white/10 bg-white/[0.02]"
                  )}
                >
                  {mode === "url" ? (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-steel" />
                        <input
                          id="url"
                          type="url"
                          value={url}
                          onChange={(event) => {
                            setUrl(event.target.value);
                            setError("");
                          }}
                          onFocus={() => setFocused(true)}
                          onBlur={() => setFocused(false)}
                          placeholder={sampleUrl}
                          className="h-14 w-full rounded-lg border border-transparent bg-transparent pl-11 pr-9 text-base text-white outline-none transition placeholder:text-steel/70"
                          required
                        />
                        {url && (
                          <button
                            type="button"
                            onClick={() => {
                              setUrl("");
                              setError("");
                            }}
                            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-steel transition hover:bg-white/10 hover:text-white"
                            title="Clear URL"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={pasteFromClipboard}
                        className="flex h-14 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-sm text-steel transition hover:border-white/25 hover:text-white sm:w-auto"
                        title="Paste URL"
                      >
                        <ClipboardPaste className="h-4 w-4" />
                        <span className="sm:hidden">Paste</span>
                      </button>
                      <button
                        type="submit"
                        disabled={loading || !urlState.valid}
                        className="flex h-14 shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-6 text-base font-medium text-ink transition hover:bg-accentHover disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {loading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            Analyze Article
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 p-1">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="relative flex-1">
                          <Link2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-steel" />
                          <input
                            id="pdf-url"
                            type="url"
                            value={url}
                            onChange={(event) => {
                              setUrl(event.target.value);
                              setPdfFile(null);
                              setError("");
                            }}
                            onFocus={() => setFocused(true)}
                            onBlur={() => setFocused(false)}
                            placeholder={samplePdfUrl}
                            disabled={!!pdfFile}
                            className="h-14 w-full rounded-lg border border-transparent bg-transparent pl-11 pr-9 text-base text-white outline-none transition placeholder:text-steel/70 disabled:opacity-40"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={loading || !urlState.valid}
                          className="flex h-14 shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-6 text-base font-medium text-ink transition hover:bg-accentHover disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {loading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <>
                              Analyze Article
                              <ArrowRight className="h-4 w-4" />
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-2 px-2 text-xs text-steel">
                        <span className="h-px flex-1 bg-white/10" />
                        <span>or</span>
                        <span className="h-px flex-1 bg-white/10" />
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/pdf,.pdf"
                        onChange={handlePdfSelect}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className={cx(
                          "flex h-14 w-full items-center justify-center gap-2 rounded-lg border text-sm transition",
                          pdfFile
                            ? "border-mint/40 bg-mint/10 text-mint"
                            : "border-dashed border-white/15 text-steel hover:border-white/30 hover:text-white"
                        )}
                      >
                        <Upload className="h-4 w-4" />
                        {pdfFile ? pdfFile.name : "Upload a PDF (drag & drop or click)"}
                      </button>
                    </div>
                  )}
                </div>

                {mode === "url" && !loading && (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {sourceChips.map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => {
                          setUrl(chip.url);
                          setError("");
                        }}
                        className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-steel transition hover:border-accent/40 hover:bg-accent/10 hover:text-white"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                )}

                {loading && (
                  <div className="mt-8 flex items-center justify-center gap-2 overflow-x-auto px-1 text-xs sm:gap-3">
                    {processSteps.map((step, index) => {
                      const isDone = index < activeStep;
                      const isActive = index === activeStep;
                      return (
                        <div key={step.key} className="flex items-center gap-2 sm:gap-3">
                          <div
                            className={cx(
                              "flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 font-medium transition",
                              isDone && "text-accent",
                              isActive && "text-white",
                              !isDone && !isActive && "text-steel"
                            )}
                          >
                            {isDone ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
                            ) : isActive ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                            ) : (
                              <Circle className="h-3.5 w-3.5 text-steel/50" />
                            )}
                            {step.label}
                          </div>
                          {index < processSteps.length - 1 && (
                            <span className="h-px w-4 bg-white/10 sm:w-8" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {error && (
                  <div className="mt-4 flex gap-2 rounded-md border border-risk/30 bg-risk/10 p-3 text-left text-sm text-red-100">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-risk" />
                    <span>{error}</span>
                  </div>
                )}
              </form>
            </section>

            <section className="border-t border-white/10 py-12 text-center">
              <h2 className="mb-6 text-sm font-semibold uppercase tracking-[0.22em] text-steel">What you&apos;ll get</h2>
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
                {whatYouGet.map((item) => (
                  <span key={item} className="flex items-center gap-2 text-sm text-zinc-200">
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                    {item}
                  </span>
                ))}
              </div>
            </section>

            <section className="border-t border-white/10 py-8 text-center">
              <p className="text-sm text-steel">
                <span className="text-zinc-400">Works with:</span>{" "}
                {supportedSources.map((item, index) => (
                  <span key={item}>
                    {item}
                    {index < supportedSources.length - 1 && <span className="px-2 text-white/20">·</span>}
                  </span>
                ))}
              </p>
            </section>

            <section className="border-t border-white/10 py-10">
              <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-zinc-200">
                <History className="h-4 w-4 text-steel" />
                Recent Analyses
              </div>
              {history.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-steel">
                  Analyses stay in this browser. No accounts, no server-side history.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {history.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => setAnalysis(entry)}
                      className="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] text-left transition hover:border-white/20"
                    >
                      <div className="flex h-28 items-center justify-center bg-white/[0.03] text-steel/40">
                        <Newspaper className="h-8 w-8" />
                      </div>
                      <div className="flex flex-1 flex-col gap-3 p-4">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-[0.1em] text-steel">
                            {entry.source.siteName || new URL(entry.source.url).hostname}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm font-medium text-white">{entry.source.title}</p>
                        </div>
                        <div className="mt-auto flex items-center justify-between">
                          <NarrativeLoadTag score={entry.report.narrativeDetection.biasScore} />
                          <span className="flex items-center gap-1 text-xs font-medium text-accent opacity-0 transition group-hover:opacity-100">
                            Read Summary
                            <ArrowRight className="h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <div className="py-6">
            <button
              onClick={startNewAnalysis}
              className="mb-5 flex items-center gap-2 text-sm text-steel transition hover:text-white"
            >
              <ArrowRight className="h-3.5 w-3.5 rotate-180" />
              New analysis
            </button>

            <section className="min-w-0 rounded-md border border-white/10 bg-panel shadow-glow">
              <article className="p-5 sm:p-7">
                <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-steel">
                      {analysis.source.siteName || "Source"} · {analysis.source.extractionMethod}
                    </p>
                    <h2 className="max-w-4xl text-2xl font-semibold leading-tight text-white sm:text-3xl">{analysis.source.title}</h2>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-steel">
                      <span className="rounded-md border border-white/10 px-2.5 py-1">{analysis.source.wordCount.toLocaleString()} words extracted</span>
                      <span className="rounded-md border border-white/10 px-2.5 py-1">{analysis.source.originalReadingMinutes} min read</span>
                      <span className="rounded-md border border-mint/30 bg-mint/10 px-2.5 py-1 text-mint">{analysis.source.minutesSaved} min saved</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={copyMarkdown} className="flex h-10 items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-zinc-200 transition hover:border-white/25" title="Copy Markdown">
                      <Clipboard className="h-4 w-4" />
                      Copy
                    </button>
                    <button onClick={downloadMarkdown} className="flex h-10 items-center gap-2 rounded-md bg-white px-3 text-sm font-medium text-ink transition hover:bg-zinc-200" title="Export Markdown">
                      <Download className="h-4 w-4" />
                      Export
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                  <div className="rounded-md border border-white/10 bg-white/[0.03] p-5">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-steel">
                      <Sparkles className="h-4 w-4" />
                      TL;DR
                    </div>
                    <p className="text-xl leading-8 text-white">{analysis.report.tldr}</p>
                  </div>
                  <div className="space-y-4">
                    <BiasMeter score={analysis.report.narrativeDetection.biasScore} />
                    <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-steel">
                        <TimerReset className="h-4 w-4" />
                        Time Saved
                      </div>
                      <p className="font-mono text-4xl font-semibold text-mint">{analysis.source.minutesSaved}</p>
                      <p className="text-sm text-steel">minutes versus the original page</p>
                    </div>
                  </div>
                </div>

                <Section title="3-5 Bullet Summary" icon={<FileText className="h-4 w-4" />}>
                  <BulletList items={analysis.report.summary} />
                </Section>

                <Section title="Key Facts" icon={<CheckCircle2 className="h-4 w-4" />}>
                  <FactGrid report={analysis.report} />
                </Section>

                <Section title="What Actually Matters" icon={<Gauge className="h-4 w-4" />}>
                  <p className="mb-4 text-base leading-7 text-white">{analysis.report.whatActuallyMatters.whyItMatters}</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h3 className="mb-3 text-sm font-semibold text-white">Second-order implications</h3>
                      <BulletList items={analysis.report.whatActuallyMatters.secondOrderImplications} />
                    </div>
                    <div>
                      <h3 className="mb-3 text-sm font-semibold text-white">Impact</h3>
                      <BulletList items={analysis.report.whatActuallyMatters.impact} />
                    </div>
                  </div>
                </Section>

                <Section title="Narrative Detection" icon={<AlertTriangle className="h-4 w-4" />}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      {analysis.report.narrativeDetection.flags.map((flag, index) => (
                        <div key={`${flag.label}-${index}`} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <h3 className="text-sm font-semibold text-white">{flag.label}</h3>
                            <span className="rounded-md border border-white/10 px-2 py-1 text-xs capitalize text-steel">{flag.severity}</span>
                          </div>
                          <p className="text-sm leading-6 text-zinc-300">{flag.evidence}</p>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3">
                      {analysis.report.narrativeDetection.highlightedSentences.length ? (
                        analysis.report.narrativeDetection.highlightedSentences.map((item, index) => (
                          <div key={`${item.sentence}-${index}`} className="rounded-md border border-signal/20 bg-signal/10 p-4">
                            <p className="text-sm leading-6 text-zinc-100">&ldquo;{item.sentence}&rdquo;</p>
                            <p className="mt-2 text-xs text-signal">{item.reason}</p>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-md border border-white/10 bg-white/[0.03] p-4 text-sm text-steel">
                          No obvious narrative-heavy sentences were highlighted.
                        </div>
                      )}
                    </div>
                  </div>
                </Section>

                <Section title="BS Detector" icon={<ShieldAlert className="h-4 w-4" />}>
                  <div className="grid gap-3 md:grid-cols-2">
                    {Object.entries(analysis.report.bsDetector)
                      .filter(([, items]) => (items as string[]).length > 0)
                      .map(([key, items]) => (
                        <div key={key} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                          <h3 className="mb-3 text-sm font-semibold capitalize text-white">{key.replace(/([A-Z])/g, " $1")}</h3>
                          <BulletList items={items as string[]} />
                        </div>
                      ))}
                    {Object.values(analysis.report.bsDetector).every((items) => (items as string[]).length === 0) && (
                      <div className="rounded-md border border-white/10 bg-white/[0.03] p-4 text-sm text-steel md:col-span-2">
                        No significant red flags detected in this piece.
                      </div>
                    )}
                  </div>
                </Section>

                <Section title="Alternate Lens" icon={<Radar className="h-4 w-4" />}>
                  <BulletList items={analysis.report.alternateLens} />
                </Section>

                <Section title="Final Verdict" icon={<Newspaper className="h-4 w-4" />} className="pb-0">
                  <p className="rounded-md border border-white/10 bg-white/[0.03] p-5 text-lg leading-8 text-white">
                    {analysis.report.finalVerdict}
                  </p>
                </Section>
              </article>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
