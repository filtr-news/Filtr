export type SourceInfo = {
  url: string;
  title: string;
  siteName?: string;
  byline?: string;
  excerpt?: string;
  wordCount: number;
  originalReadingMinutes: number;
  briefReadingMinutes: number;
  minutesSaved: number;
  extractionMethod: "readability" | "cheerio" | "pdf";
};

export type NarrativeFlag = {
  label: string;
  severity: "low" | "medium" | "high";
  evidence: string;
};

export type Highlight = {
  sentence: string;
  reason: string;
};

export type FiltrReport = {
  tldr: string;
  summary: string[];
  keyFacts: {
    verifiableClaims: string[];
    importantNumbers: string[];
    namedEntities: string[];
  };
  whatActuallyMatters: {
    whyItMatters: string;
    secondOrderImplications: string[];
    impact: string[];
  };
  narrativeDetection: {
    biasScore: number;
    flags: NarrativeFlag[];
    highlightedSentences: Highlight[];
  };
  bsDetector: {
    missingContext: string[];
    cherryPickedData: string[];
    unsupportedClaims: string[];
    anonymousSourcing: string[];
    conflictsOfInterest: string[];
    sponsoredIndicators: string[];
  };
  alternateLens: string[];
  finalVerdict: string;
};

export type AnalysisResponse = {
  source: SourceInfo;
  report: FiltrReport;
};
