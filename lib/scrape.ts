import { Readability } from "@mozilla/readability";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import type { SourceInfo } from "./types";

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

export async function scrapeUrl(url: string): Promise<{ source: SourceInfo; content: string }> {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs can be analyzed.");
  }

  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; Filtr/0.1; +https://local.app) AppleWebKit/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    },
    next: { revalidate: 0 }
  });

  if (!response.ok) {
    throw new Error(`Could not fetch that page. The server returned ${response.status}.`);
  }

  const html = await response.text();
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

  const wordCount = extracted.textContent.split(/\s+/).filter(Boolean).length;
  const originalReadingMinutes = estimateMinutes(wordCount);
  const briefReadingMinutes = 2;

  return {
    content: extracted.textContent.slice(0, 28000),
    source: {
      url,
      title: extracted.title || parsed.hostname,
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
