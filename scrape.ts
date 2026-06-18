import { Readability } from "@mozilla/readability";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import dns from "dns/promises";
import type { SourceInfo } from "./types";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 15 * 1024 * 1024; // 15 MB (PDFs are heavier than HTML)

const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/
];

const CLUTTER_SELECTOR = [
  "script",
  "style",
  "noscript",
  "iframe",
  "svg",
  "canvas",
  "form",
  "button",
  "input",
  "select",
  "textarea",
  "nav",
  "footer",
  "aside",
  "header",
  "[role='navigation']",
  "[role='banner']",
  "[role='complementary']",
  "[aria-label*='advert' i]",
  "[class*='advert' i]",
  "[id*='advert' i]",
  "[class*='ad-' i]",
  "[class*='ads' i]",
  "[id*='ads' i]",
  "[class*='cookie' i]",
  "[id*='cookie' i]",
  "[class*='newsletter' i]",
  "[class*='subscribe' i]",
  "[class*='related' i]",
  "[class*='share' i]",
  "[class*='social' i]",
  "[class*='comment' i]",
  "[id*='comment' i]",
  "[class*='promo' i]",
  "[class*='paywall' i]"
].join(",");

function normalizeText(text: string) {
  return text
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function estimateMinutes(wordCount: number) {
  return Math.max(1, Math.ceil(wordCount / 225));
}

async function assertPublicUrl(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs can be analyzed.");
  }

  let addresses: string[] = [];
  try {
    const result = await dns.lookup(url.hostname, { all: true });
    addresses = result.map((entry) => entry.address);
  } catch {
    throw new Error("Could not resolve that domain. Check the URL and try again.");
  }

  for (const address of addresses) {
    if (PRIVATE_RANGES.some((range) => range.test(address))) {
      throw new Error("That URL points to a private or internal network, which is not allowed.");
    }
  }
}

async function fetchWithLimits(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; Filtr/0.1; +https://filtr.news) AppleWebKit/537.36",
        accept: "text/html,application/xhtml+xml,application/pdf,application/xml;q=0.9,*/*;q=0.8"
      },
      next: { revalidate: 0 }
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("That page took too long to respond. Try again or try a different URL.");
    }
    throw new Error("Could not reach that URL. Check that it's publicly accessible and try again.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const statusMessages: Record<number, string> = {
      403: "Access denied — that page requires a login or subscription.",
      404: "Page not found — double-check the URL.",
      429: "That site is rate-limiting requests. Try again in a few minutes.",
      500: "The target site returned a server error. Try again later.",
      503: "The target site is unavailable. Try again later."
    };
    throw new Error(statusMessages[response.status] || `Could not fetch that page. The server returned ${response.status}.`);
  }

  return response;
}

async function readBodyWithCap(response: Response): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("That URL returned an empty response.");
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        reader.cancel();
        break;
      }
      chunks.push(value);
    }
  }

  return Buffer.concat(chunks);
}

function fallbackExtract(html: string, url: string) {
  const $ = cheerio.load(html);
  $(CLUTTER_SELECTOR).remove();

  const title =
    $("meta[property='og:title']").attr("content") ||
    $("title").first().text() ||
    $("h1").first().text() ||
    new URL(url).hostname;

  const siteName =
    $("meta[property='og:site_name']").attr("content") ||
    new URL(url).hostname.replace(/^www\./, "");

  const candidates = $("article, main, [role='main'], .article, .post, .entry-content, .content")
    .toArray()
    .map((element) => normalizeText($(element).text()))
    .filter((text) => text.split(/\s+/).length > 80)
    .sort((a, b) => b.length - a.length);

  const body = candidates[0] || normalizeText($("body").text());

  return {
    title: normalizeText(title),
    siteName,
    byline: $("meta[name='author']").attr("content"),
    excerpt: $("meta[name='description']").attr("content") || undefined,
    textContent: body,
    method: "cheerio" as const
  };
}

function buildSource(extracted: {
  title: string;
  siteName?: string;
  byline?: string;
  excerpt?: string;
  textContent: string;
  method: "readability" | "cheerio" | "pdf";
}, url: string, hostnameFallback: string): { source: SourceInfo; content: string } {
  const wordCount = extracted.textContent.split(/\s+/).filter(Boolean).length;
  const originalReadingMinutes = estimateMinutes(wordCount);
  const briefReadingMinutes = 2;

  return {
    content: extracted.textContent.slice(0, 28000),
    source: {
      url,
      title: extracted.title || hostnameFallback,
      siteName: extracted.siteName,
      byline: extracted.byline,
      excerpt: extracted.excerpt,
      wordCount,
      originalReadingMinutes,
      briefReadingMinutes,
      minutesSaved: Math.max(0, originalReadingMinutes - briefReadingMinutes),
      extractionMethod: extracted.method
    }
  };
}

/**
 * Scrape a regular web article (HTML).
 */
export async function scrapeUrl(url: string): Promise<{ source: SourceInfo; content: string }> {
  const parsed = new URL(url);
  await assertPublicUrl(parsed);

  const response = await fetchWithLimits(url);
  const contentType = (response.headers.get("content-type") || "").toLowerCase();

  // If the URL actually points to a PDF, route it through the PDF pipeline instead.
  if (contentType.includes("application/pdf")) {
    const buffer = await readBodyWithCap(response);
    return extractFromPdfBuffer(buffer, url);
  }

  if (
    contentType.includes("audio/") ||
    contentType.includes("video/") ||
    contentType.includes("image/") ||
    contentType.includes("application/zip") ||
    contentType.includes("application/octet-stream")
  ) {
    throw new Error("That file type isn't supported yet. Try pasting an article URL or a PDF URL instead.");
  }

  const buffer = await readBodyWithCap(response);
  const html = buffer.toString("utf-8");

  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  const extracted =
    article?.textContent && article.textContent.split(/\s+/).length > 120
      ? {
          title: normalizeText(article.title || parsed.hostname),
          siteName: article.siteName || parsed.hostname.replace(/^www\./, ""),
          byline: article.byline || undefined,
          excerpt: article.excerpt || undefined,
          textContent: normalizeText(article.textContent),
          method: "readability" as const
        }
      : fallbackExtract(html, url);

  return buildSource(extracted, url, parsed.hostname);
}

/**
 * Scrape a PDF given its URL.
 */
export async function scrapePdfUrl(url: string): Promise<{ source: SourceInfo; content: string }> {
  const parsed = new URL(url);
  await assertPublicUrl(parsed);

  const response = await fetchWithLimits(url);
  const buffer = await readBodyWithCap(response);
  return extractFromPdfBuffer(buffer, url);
}

/**
 * Extract text from a PDF that was uploaded directly (no URL).
 * fileName is used only for display purposes (acts as the "title" fallback).
 */
export async function scrapePdfUpload(
  buffer: Buffer,
  fileName: string
): Promise<{ source: SourceInfo; content: string }> {
  return extractFromPdfBuffer(buffer, fileName, true);
}

async function extractFromPdfBuffer(
  buffer: Buffer,
  urlOrFileName: string,
  isUpload = false
): Promise<{ source: SourceInfo; content: string }> {
  // Lazy import: pdf-parse pulls in some heavy deps, only load when needed.
  const pdfParse = (await import("pdf-parse")).default;

  let parsed: { text: string; info?: { Title?: string; Author?: string } };
  try {
    parsed = await pdfParse(buffer);
  } catch {
    throw new Error("Could not read that PDF. It may be scanned, encrypted, or corrupted.");
  }

  const textContent = normalizeText(parsed.text || "");
  if (textContent.split(/\s+/).filter(Boolean).length < 30) {
    throw new Error("This PDF doesn't contain extractable text (it may be a scanned image). Try a text-based PDF instead.");
  }

  const fallbackTitle = isUpload
    ? urlOrFileName.replace(/\.pdf$/i, "")
    : (() => {
        try {
          return new URL(urlOrFileName).hostname;
        } catch {
          return "PDF Document";
        }
      })();

  const extracted = {
    title: parsed.info?.Title?.trim() || fallbackTitle,
    siteName: isUpload ? "Uploaded PDF" : (() => {
      try {
        return new URL(urlOrFileName).hostname.replace(/^www\./, "");
      } catch {
        return "PDF";
      }
    })(),
    byline: parsed.info?.Author || undefined,
    excerpt: undefined,
    textContent,
    method: "pdf" as const
  };

  return buildSource(extracted, isUpload ? "uploaded-pdf" : urlOrFileName, "PDF Document");
}
