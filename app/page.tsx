"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
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
  X,
  TimerReset,
  XCircle
} from "lucide-react";
import { DragEvent, FormEvent, useEffect, useMemo, useState } from "react";
import type { AnalysisResponse, FiltrReport } from "@/lib/types";
import { toMarkdown } from "@/lib/markdown";

type StoredAnalysis = AnalysisResponse & {
  id: string;
  createdAt: string;
};

const sampleUrl = "https://www.reuters.com/";

const sourceChips = [
  { label: "Reuters", url: "https://www.reuters.com/" },
  { label: "Research", url: "https://www.nature.com/articles/d41586-024-00000-0" },
  { label: "Forum", url: "https://news.ycombinator.com/" }
];

const loadingSteps = ["Extract", "Clean", "Analyze", "Brief"];

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
          <p className="text-xs uppercase tracking-[0.18em] text-steel">Bias Score</p>
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
  const groups = [
    ["Verifiable Claims", report.keyFacts.verifiableClaims],
    ["Important Numbers", report.keyFacts.importantNumbers],
    ["Named Entities", report.keyFacts.namedEntities],
    ["Dates and Timelines", report.keyFacts.datesAndTimelines]
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {groups.map(([title, items]) => (
        <div key={title as string} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">{title as string}</h3>
          <BulletList items={items as string[]} />
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [analysis, setAnalysis] = useState<StoredAnalysis | null>(null);
  const [history, setHistory] = useState<StoredAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("filtr-history");
    if (stored) {
      const parsed = JSON.parse(stored) as StoredAnalysis[];
      setHistory(parsed);
      setAnalysis(parsed[0] || null);
    }
  }, []);

  const markdown = useMemo(() => (analysis ? toMarkdown(analysis) : ""), [analysis]);
  const trimmedUrl = url.trim();
  const urlState = useMemo(() => {
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
  }, [trimmedUrl]);

  function saveHistory(item: StoredAnalysis) {
    const next = [item, ...history.filter((entry) => entry.source.url !== item.source.url)].slice(0, 8);
    setHistory(next);
    window.localStorage.setItem("filtr-history", JSON.stringify(next));
  }

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url })
      });
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

  function handleDrop(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    setDragging(false);
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

  return (
    <main className="min-h-screen bg-ink text-zinc-50">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.04]">
              <Radar className="h-5 w-5 text-signal" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Filtr</h1>
              <p className="text-sm text-steel">Signal briefs from noisy pages.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-steel">
            <Moon className="h-4 w-4" />
            Dark
          </div>
        </header>

        <div className="grid flex-1 gap-6 py-6 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-5">
            <form
              onSubmit={analyze}
              onDragEnter={() => setDragging(true)}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={cx(
                "rounded-md border bg-panel p-4 shadow-glow transition",
                focused || dragging ? "border-signal/50 bg-[#171d27]" : "border-white/10"
              )}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <label htmlFor="url" className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                  <Link2 className="h-4 w-4 text-signal" />
                  Source URL
                </label>
                <span className={cx("max-w-[170px] truncate rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs", urlState.tone)}>
                  {urlState.label}
                </span>
              </div>

              <div
                className={cx(
                  "rounded-md border p-2 transition",
                  dragging ? "border-signal bg-signal/10" : "border-white/10 bg-ink"
                )}
              >
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel" />
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
                      className="h-12 w-full rounded-md border border-transparent bg-white/[0.03] pl-9 pr-9 text-sm text-white outline-none transition placeholder:text-steel/70 focus:border-signal/50"
                      required
                    />
                    {url && (
                      <button
                        type="button"
                        onClick={() => {
                          setUrl("");
                          setError("");
                        }}
                        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-steel transition hover:bg-white/10 hover:text-white"
                        title="Clear URL"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={pasteFromClipboard}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-white/10 text-steel transition hover:border-white/25 hover:text-white"
                    title="Paste URL"
                  >
                    <ClipboardPaste className="h-5 w-5" />
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !urlState.valid}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-signal text-ink transition hover:bg-[#ffd978] disabled:cursor-not-allowed disabled:opacity-45"
                    title="Analyze"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {sourceChips.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => {
                        setUrl(chip.url);
                        setError("");
                      }}
                      className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-steel transition hover:border-signal/40 hover:bg-signal/10 hover:text-white"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2">
                {loadingSteps.map((step, index) => (
                  <div
                    key={step}
                    className={cx(
                      "rounded-md border px-2 py-2 text-center text-[11px] font-medium uppercase tracking-[0.12em] transition",
                      loading
                        ? "border-signal/30 bg-signal/10 text-signal"
                        : index === 0
                          ? "border-white/10 bg-white/[0.03] text-zinc-300"
                          : "border-white/10 text-steel"
                    )}
                    style={loading ? { transitionDelay: `${index * 100}ms` } : undefined}
                  >
                    {step}
                  </div>
                ))}
              </div>

              {error && (
                <div className="mt-3 flex gap-2 rounded-md border border-risk/30 bg-risk/10 p-3 text-sm text-red-100">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-risk" />
                  <span>{error}</span>
                </div>
              )}
            </form>

            <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
                <History className="h-4 w-4 text-steel" />
                Recent Analyses
              </div>
              <div className="space-y-2">
                {history.length === 0 ? (
                  <p className="text-sm leading-6 text-steel">Analyses stay in this browser. No accounts, no server-side history.</p>
                ) : (
                  history.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => setAnalysis(entry)}
                      className={cx(
                        "w-full rounded-md border p-3 text-left transition",
                        analysis?.id === entry.id
                          ? "border-signal/50 bg-signal/10"
                          : "border-white/10 bg-white/[0.03] hover:border-white/20"
                      )}
                    >
                      <p className="line-clamp-2 text-sm font-medium text-white">{entry.source.title}</p>
                      <p className="mt-1 text-xs text-steel">{entry.source.siteName || entry.source.url}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </aside>

          <section className="min-w-0 rounded-md border border-white/10 bg-panel shadow-glow">
            {!analysis ? (
              <div className="flex min-h-[620px] flex-col justify-center p-8">
                <div className="max-w-2xl">
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-md border border-white/10 bg-white/[0.04]">
                    <Newspaper className="h-6 w-6 text-signal" />
                  </div>
                  <p className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-steel">Reuters discipline. Analyst edge.</p>
                  <h2 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                    Strip the story down to what matters.
                  </h2>
                  <p className="mt-5 max-w-xl text-base leading-7 text-zinc-300">
                    Filtr extracts the article, removes clutter, scores narrative framing, flags weak claims, and returns a practical brief built for decisions.
                  </p>
                </div>
              </div>
            ) : (
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
                    {Object.entries(analysis.report.bsDetector).map(([key, items]) => (
                      <div key={key} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                        <h3 className="mb-3 text-sm font-semibold capitalize text-white">{key.replace(/([A-Z])/g, " $1")}</h3>
                        <BulletList items={(items as string[]).length ? (items as string[]) : ["None detected."]} />
                      </div>
                    ))}
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
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
