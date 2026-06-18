import type { AnalysisResponse } from "./types";

function list(items: string[]) {
  return items.filter(Boolean).map((item) => `- ${item}`).join("\n") || "- None detected.";
}

export function toMarkdown({ source, report }: AnalysisResponse) {
  return `# Filtr Brief: ${source.title}
Source: ${source.url}
Extraction: ${source.extractionMethod}
Reading time saved: ${source.minutesSaved} min
Narrative Load: ${report.narrativeDetection.biasScore}/10

## TL;DR
${report.tldr}

## Summary
${list(report.summary)}

## Key Facts
### Verifiable Claims
${list(report.keyFacts.verifiableClaims)}

### Named Entities
${list(report.keyFacts.namedEntities)}

## What Actually Matters
${report.whatActuallyMatters.whyItMatters}

### Second-Order Implications
${list(report.whatActuallyMatters.secondOrderImplications)}

### Impact
${list(report.whatActuallyMatters.impact)}

## Narrative Detection
${list(report.narrativeDetection.flags.map((flag) => `${flag.label} (${flag.severity}): ${flag.evidence}`))}

### Highlighted Sentences
${list(report.narrativeDetection.highlightedSentences.map((item) => `${item.sentence} — ${item.reason}`))}

## BS Detector
${report.bsDetector.missingContext.length ? `- Missing context: ${report.bsDetector.missingContext.join("; ")}\n` : ""}${report.bsDetector.cherryPickedData.length ? `- Cherry-picked data: ${report.bsDetector.cherryPickedData.join("; ")}\n` : ""}${report.bsDetector.unsupportedClaims.length ? `- Unsupported claims: ${report.bsDetector.unsupportedClaims.join("; ")}\n` : ""}${report.bsDetector.anonymousSourcing.length ? `- Anonymous sourcing: ${report.bsDetector.anonymousSourcing.join("; ")}\n` : ""}${report.bsDetector.conflictsOfInterest.length ? `- Conflicts of interest: ${report.bsDetector.conflictsOfInterest.join("; ")}\n` : ""}${report.bsDetector.sponsoredIndicators.length ? `- Sponsored indicators: ${report.bsDetector.sponsoredIndicators.join("; ")}\n` : ""}${!report.bsDetector.missingContext.length && !report.bsDetector.cherryPickedData.length && !report.bsDetector.unsupportedClaims.length && !report.bsDetector.anonymousSourcing.length && !report.bsDetector.conflictsOfInterest.length && !report.bsDetector.sponsoredIndicators.length ? "- No significant red flags detected.\n" : ""}
## Alternate Lens
${list(report.alternateLens)}

## Final Verdict
${report.finalVerdict}
`;
}
