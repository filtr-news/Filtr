import type { AnalysisResponse } from "./types";

function list(items: string[]) {
  return items.filter(Boolean).map((item) => `- ${item}`).join("\n") || "- None detected.";
}

export function toMarkdown({ source, report }: AnalysisResponse) {
  return `# Filtr Brief: ${source.title}

Source: ${source.url}
Extraction: ${source.extractionMethod}
Reading time saved: ${source.minutesSaved} min
Bias score: ${report.narrativeDetection.biasScore}/10

## TL;DR
${report.tldr}

## Summary
${list(report.summary)}

## Key Facts
### Verifiable Claims
${list(report.keyFacts.verifiableClaims)}

### Important Numbers
${list(report.keyFacts.importantNumbers)}

### Named Entities
${list(report.keyFacts.namedEntities)}

### Dates and Timelines
${list(report.keyFacts.datesAndTimelines)}

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
- Missing context: ${report.bsDetector.missingContext.join("; ") || "None detected."}
- Cherry-picked data: ${report.bsDetector.cherryPickedData.join("; ") || "None detected."}
- Unsupported claims: ${report.bsDetector.unsupportedClaims.join("; ") || "None detected."}
- Anonymous sourcing: ${report.bsDetector.anonymousSourcing.join("; ") || "None detected."}
- Conflicts of interest: ${report.bsDetector.conflictsOfInterest.join("; ") || "None detected."}
- Sponsored indicators: ${report.bsDetector.sponsoredIndicators.join("; ") || "None detected."}

## Alternate Lens
${list(report.alternateLens)}

## Final Verdict
${report.finalVerdict}
`;
}
