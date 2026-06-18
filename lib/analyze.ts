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

// Common words that get capitalized at sentence starts or in headlines —
// these are not entities and pollute naive regex-based extraction.
const ENTITY_STOPWORDS = new Set([
  "The", "This", "That", "These", "Those", "It", "He", "She", "They", "We", "You", "I",
  "A", "An", "In", "On", "At", "By", "For", "With", "From", "After", "Before", "During",
  "However", "Meanwhile", "Additionally", "Furthermore", "Moreover", "Despite", "Although",
  "According", "Officials", "Authorities", "Reports", "Sources", "Monday", "Tuesday",
  "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "January", "February", "March",
  "April", "May", "June", "July", "August", "September", "October", "November", "December"
]);

function extractEntities(text: string) {
  const matches = text.match(/\b[A-Z][a-z]+(?:\s+(?:[A-Z][a-z]+|[A-Z]{2,}|&)){1,4}/g) || [];
  const filtered = matches.filter((item) => {
    const firstWord = item.split(" ")[0];
    if (ENTITY_STOPWORDS.has(firstWord)) return false;
    // Require at least one capitalized word of length 3+ to avoid catching short noise like "Mr A"
    if (item.replace(/\s+/g, "").length < 5) return false;
    return true;
  });
  return Array.from(new Set(filtered)).slice(0, 6);
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

// Caps every BS Detector category at maxItems entries.
// Keeps the most relevant ones since callers already slice for relevance.
function capBsDetector(bsDetector: FiltrReport["bsDetector"], maxItems = 3): FiltrReport["bsDetector"] {
  const capped = {} as FiltrReport["bsDetector"];
  for (const key of Object.keys(bsDetector) as Array<keyof FiltrReport["bsDetector"]>) {
    capped[key] = (bsDetector[key] || []).slice(0, maxItems);
  }
  return capped;
}

function localAnalyze(content: string, source: SourceInfo): FiltrReport {
  const allSentences = sentences(content);
  const highlights = narrativeHighlights(content);
  const entities = extractEntities(content);
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

  // Build a verdict that actually reflects this article's signal,
  // rather than a fixed boilerplate sentence.
  const topClaim = allSentences[0] || source.excerpt || "the central claim";
  const verdictBias =
    biasScore <= 3
      ? "The framing is largely neutral, so the reported facts can mostly be taken at face value."
      : biasScore <= 6
        ? "The framing leans toward a particular interpretation, so separate the sourced facts from the author's spin before acting."
        : "The framing is heavily narrative-driven, so treat the conclusion with real skepticism until verified against primary sources.";
  const verdictSourcing = allSentences.some((sentence) => /anonymous|sources said|insider|person familiar/i.test(sentence))
    ? " Several claims rely on anonymous or unnamed sourcing, which limits how much weight to put on them."
    : "";

  return {
    tldr: topClaim,
    summary: allSentences.slice(0, 5),
    keyFacts: {
      verifiableClaims: allSentences.slice(0, 5),
      namedEntities: entities.length ? entities : [source.siteName || new URL(source.url).hostname]
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
    bsDetector: capBsDetector({
      missingContext: ["Check whether the piece compares this event against historical baselines or peer examples."],
      cherryPickedData: [],
      unsupportedClaims: allSentences.filter((sentence) => /may|might|could|critics|experts|some say/i.test(sentence)).slice(0, 4),
      anonymousSourcing: allSentences.filter((sentence) => /anonymous|sources said|insider|person familiar/i.test(sentence)).slice(0, 4),
      conflictsOfInterest: ["Look for ownership, sponsor, affiliate, or author incentives that could shape framing."],
      sponsoredIndicators: allSentences.filter((sentence) => /sponsored|partner|affiliate|presented by|brand studio/i.test(sentence)).slice(0, 4)
    }),
    alternateLens: [
      "Market perspective: if this claim is true, which specific companies or sectors gain or lose, and has the market already priced that in?",
      "Consumer perspective: does this actually change a real decision someone makes this week, or is it background noise dressed as news?",
      "Power perspective: who benefits from this story being told this way right now, and who would tell it differently?",
      "Skeptical perspective: what single piece of missing evidence would most change the conclusion, and why wasn't it included?"
    ],
    finalVerdict: `This piece centers on: "${topClaim}" ${verdictBias}${verdictSourcing}`
  };
}

function reportPrompt(content: string, source: SourceInfo) {
  return [
    {
      role: "system" as const,
      content:
        "You are Filtr: Reuters discipline, Breaking Points skepticism, hedge fund analyst practicality. Remove narrative padding and produce concise intelligence. Return only valid JSON matching the requested schema. Be specific, cautious, and useful. Never write generic, templated, or filler sentences — every field must reference specific facts, names, numbers, or claims that actually appear in THIS article's content. If a field would otherwise be generic boilerplate, instead state precisely what is and isn't in the source text."
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
    "namedEntities": ["AT MOST 5-6 items. Only specific, genuinely important people, organizations, places, or products that are central to the story — not every capitalized word or passing reference. Skip generic references like 'the company' or publication/outlet names unless the outlet itself is the subject."]
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
    "missingContext": ["AT MOST 2-3 items, each one short sentence, specific to this article only — omit the key entirely (empty array) if nothing applies"],
    "cherryPickedData": ["AT MOST 2-3 items, same rule"],
    "unsupportedClaims": ["AT MOST 2-3 items, same rule"],
    "anonymousSourcing": ["AT MOST 2-3 items, same rule"],
    "conflictsOfInterest": ["AT MOST 2-3 items, same rule"],
    "sponsoredIndicators": ["AT MOST 2-3 items, same rule"]
  },
  "alternateLens": ["EXACTLY 4 items, each a sharp, specific, probing question or angle that makes the reader think harder about THIS article — not a generic restatement of viewpoints. Each should be labeled by perspective (e.g. 'Market perspective:', 'Power perspective:', 'Skeptical perspective:') followed by a pointed question referencing the article's actual claim, asking what evidence would change the conclusion, who benefits from the framing, or what a careful reader should still be unsure about. Avoid vague phrasing like 'ask whether' — be concrete and specific to the content."],
  "finalVerdict": "One paragraph that names the SPECIFIC central claim of THIS article (quote or closely paraphrase it), states how much confidence a careful reader should place in it based on the sourcing and framing actually present in the text, and names the one thing that would most change that confidence (e.g. a missing data point, an unnamed source, or absent context). Do not write a generic statement that could apply to any article."
}

IMPORTANT: Every bsDetector array must contain at most 3 items. If you have nothing genuine to flag for a category, return an empty array for it rather than inventing filler. namedEntities must contain at most 6 items, prioritizing the most central names to the story.

If the extracted content below is dominated by site navigation, audio-player prompts, cookie banners, or other non-article boilerplate rather than the actual article body, note this explicitly in "tldr" (e.g. "This page's extracted text is mostly site navigation, not article content — analysis may be unreliable.") rather than treating boilerplate text as the article's content.

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
    // Defensive caps in code too, in case the model ignores the prompt instructions.
    parsed.bsDetector = capBsDetector(parsed.bsDetector, 3);
    parsed.keyFacts.namedEntities = (parsed.keyFacts.namedEntities || []).slice(0, 6);
    return parsed;
  } catch {
    return localAnalyze(content, source);
  }
}
