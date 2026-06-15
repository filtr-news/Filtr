import OpenAI from "openai";
import type { FiltrReport, Highlight, NarrativeFlag, SourceInfo } from "./types";

const narrativeTerms = [
  "shocking",
  "explosive",
  "devastating",
  "slams",
  "crisis",
  "outrage",
  "bombshell",
  "terrifying",
  "humiliating",
  "radical",
  "woke",
  "far-right",
  "far-left",
  "elite",
  "establishment",
  "unprecedented",
  "secretly",
  "what they don't want you to know"
];

function sentences(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 30);
}

function extractNumbers(text: string) {
  return Array.from(
    new Set(text.match(/\b(?:\$|€|£)?\d[\d,.]*(?:%| million| billion| trillion| basis points| bps)?\b/gi) || [])
  ).slice(0, 8);
}

function extractDates(text: string) {
  return Array.from(
    new Set(
      text.match(
        /\b(?:Jan\.?|January|Feb\.?|February|Mar\.?|March|Apr\.?|April|May|Jun\.?|June|Jul\.?|July|Aug\.?|August|Sep\.?|September|Oct\.?|October|Nov\.?|November|Dec\.?|December)\s+\d{1,2},?\s+\d{0,4}|\b20\d{2}\b|\b19\d{2}\b/gi
      ) || []
    )
  ).slice(0, 8);
}

function extractEntities(text: string) {
  const matches = text.match(/\b[A-Z][a-z]+(?:\s+(?:[A-Z][a-z]+|[A-Z]{2,}|&)){1,4}/g) || [];
  return Array.from(new Set(matches.filter((item) => !item.startsWith("The ")))).slice(0, 12);
}

function narrativeHighlights(text: string): Highlight[] {
  return sentences(text)
    .map((sentence) => {
      const lower = sentence.toLowerCase();
      const term = narrativeTerms.find((candidate) => lower.includes(candidate));
      return term ? { sentence, reason: `Uses loaded or framing language: "${term}".` } : null;
    })
    .filter(Boolean)
    .slice(0, 5) as Highlight[];
}

function localAnalyze(content: string, source: SourceInfo): FiltrReport {
  const allSentences = sentences(content);
  const highlights = narrativeHighlights(content);
  const numbers = extractNumbers(content);
  const entities = extractEntities(content);
  const dates = extractDates(content);
  const biasScore = Math.min(10, Math.max(1, highlights.length * 2 + (content.match(/anonymous|sources said|insider|critics say/gi)?.length || 0)));

  const flags: NarrativeFlag[] = highlights.length
    ? highlights.slice(0, 4).map((highlight) => ({
        label: "Sensational or emotional framing",
        severity: biasScore > 6 ? "high" : "medium",
        evidence: highlight.sentence
      }))
    : [
        {
          label: "Mostly informational language",
          severity: "low",
          evidence: "No repeated high-intensity framing terms were detected in the extracted text."
        }
      ];

  return {
    tldr: allSentences[0] || source.excerpt || "The page was extracted, but the core argument was thin.",
    summary: allSentences.slice(0, 5),
    keyFacts: {
      verifiableClaims: allSentences.slice(0, 5),
      importantNumbers: numbers.length ? numbers : ["No prominent numbers detected."],
      namedEntities: entities.length ? entities : [source.siteName || new URL(source.url).hostname],
      datesAndTimelines: dates.length ? dates : ["No clear dates detected."]
    },
    whatActuallyMatters: {
      whyItMatters:
        "The useful signal is the concrete claim being made, who is affected, and whether the evidence is strong enough to change a decision.",
      secondOrderImplications: [
        "Readers should separate the reported facts from the author's implied conclusion.",
        "If the claims are material, look for primary documents, direct quotes, or original data before acting.",
        "The biggest uncertainty is what relevant context may have been omitted."
      ],
      impact: [
        "Consumers: watch for practical changes in cost, access, safety, or choice.",
        "Businesses: evaluate operational, reputational, and regulatory exposure.",
        "Investors: distinguish durable fundamentals from short-term narrative pressure."
      ]
    },
    narrativeDetection: {
      biasScore,
      flags,
      highlightedSentences: highlights
    },
    bsDetector: {
      missingContext: ["Check whether the piece compares this event against historical baselines or peer examples."],
      cherryPickedData: numbers.length ? ["Numbers appear in the piece; verify denominators, time periods, and source methodology."] : [],
      unsupportedClaims: allSentences.filter((sentence) => /may|might|could|critics|experts|some say/i.test(sentence)).slice(0, 4),
      anonymousSourcing: allSentences.filter((sentence) => /anonymous|sources said|insider|person familiar/i.test(sentence)).slice(0, 4),
      conflictsOfInterest: ["Look for ownership, sponsor, affiliate, or author incentives that could shape framing."],
      sponsoredIndicators: allSentences.filter((sentence) => /sponsored|partner|affiliate|presented by|brand studio/i.test(sentence)).slice(0, 4)
    },
    alternateLens: [
      "Market perspective: ask whether this changes cash flows, competitive position, regulation, or risk pricing.",
      "Consumer perspective: ask whether everyday choices, costs, or protections actually change.",
      "Industry perspective: ask whether incumbents, suppliers, or regulators gain leverage.",
      "Skeptical perspective: ask what evidence would disprove the article's implied conclusion."
    ],
    finalVerdict:
      "A smart reader would treat this as a starting brief, not a final judgment: keep the verifiable claims, discount the framing, and look for primary evidence before changing a belief or decision."
  };
}

function reportPrompt(content: string, source: SourceInfo) {
  return [
    {
      role: "system" as const,
      content:
        "You are Filtr: Reuters discipline, Breaking Points skepticism, hedge fund analyst practicality. Remove narrative padding and produce concise intelligence. Return only valid JSON matching the requested schema. Be specific, cautious, and useful."
    },
    {
      role: "user" as const,
      content: `Analyze this extracted page content.

Source:
${JSON.stringify(source, null, 2)}

Return JSON with this exact shape:
{
  "tldr": "string",
  "summary": ["3-5 bullets"],
  "keyFacts": {
    "verifiableClaims": ["claims that can be checked"],
    "importantNumbers": ["numbers with context"],
    "namedEntities": ["people, orgs, places, products"],
    "datesAndTimelines": ["dates or timeline points"]
  },
  "whatActuallyMatters": {
    "whyItMatters": "string",
    "secondOrderImplications": ["2-4 implications"],
    "impact": ["consumer/investor/business/society impacts"]
  },
  "narrativeDetection": {
    "biasScore": 0,
    "flags": [{"label":"Emotional language | Fear framing | Political framing | Corporate framing | Ideological framing | Selective omission | Sensationalism", "severity":"low | medium | high", "evidence":"short evidence"}],
    "highlightedSentences": [{"sentence":"exact sentence from text", "reason":"why it is narrative framing"}]
  },
  "bsDetector": {
    "missingContext": [],
    "cherryPickedData": [],
    "unsupportedClaims": [],
    "anonymousSourcing": [],
    "conflictsOfInterest": [],
    "sponsoredIndicators": []
  },
  "alternateLens": ["2-4 alternative interpretations labeled by perspective"],
  "finalVerdict": "One paragraph: What would a smart person conclude after reading this?"
}

Content:
${content}`
    }
  ];
}

export async function analyzeContent(content: string, source: SourceInfo): Promise<FiltrReport> {
  if (!process.env.OPENAI_API_KEY) {
    return localAnalyze(content, source);
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: reportPrompt(content, source),
    response_format: { type: "json_object" },
    temperature: 0.2
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    return localAnalyze(content, source);
  }

  try {
    const parsed = JSON.parse(raw) as FiltrReport;
    parsed.narrativeDetection.biasScore = Math.max(0, Math.min(10, Number(parsed.narrativeDetection.biasScore) || 0));
    return parsed;
  } catch {
    return localAnalyze(content, source);
  }
}
