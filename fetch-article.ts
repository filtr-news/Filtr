// lib/fetch-article.ts
// Fetches a URL safely: enforces timeout, caps response size,
// detects content type, and provides clean error messages for unsupported formats.

import { validateUrl, UrlValidationError } from "./validate-url";

const FETCH_TIMEOUT_MS = 12_000;   // 12 seconds
const MAX_BODY_BYTES   = 2 * 1024 * 1024; // 2 MB

// Human-friendly messages for unsupported content
const UNSUPPORTED_TYPE_MESSAGES: Record<string, string> = {
  "application/pdf":
    "📄 PDF detected. Filtr doesn't support PDF files yet — paste the article URL directly instead.",
  "audio/":
    "🎧 Audio files aren't supported. Try linking to the article or transcript instead.",
  "video/":
    "🎬 Video files aren't supported. Try linking to the article or transcript instead.",
  "image/":
    "🖼️ Image files aren't supported. Try linking to the article page instead.",
  "application/zip":
    "📦 Archive files aren't supported. Try linking to the article directly.",
  "application/octet-stream":
    "⚠️ Binary file detected — this content type isn't supported. Try an article URL instead.",
};

export class FetchError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly userMessage: string
  ) {
    super(message);
    this.name = "FetchError";
  }
}

function getUnsupportedMessage(contentType: string): string | null {
  for (const [prefix, message] of Object.entries(UNSUPPORTED_TYPE_MESSAGES)) {
    if (contentType.includes(prefix)) return message;
  }
  return null;
}

export async function fetchArticleHtml(rawUrl: string): Promise<string> {
  // 1. Validate URL (throws UrlValidationError on failure)
  let url: URL;
  try {
    url = await validateUrl(rawUrl);
  } catch (err) {
    if (err instanceof UrlValidationError) {
      throw new FetchError(err.message, err.code, err.message);
    }
    throw err;
  }

  // 2. Fetch with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        // Identify as a browser to avoid bot blocks
        "User-Agent":
          "Mozilla/5.0 (compatible; Filtr/1.0; +https://filtr-sand.vercel.app)",
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new FetchError(
        "Fetch timed out",
        "TIMEOUT",
        "⏱️ That page took too long to respond. Try again or try a different URL."
      );
    }
    throw new FetchError(
      String(err),
      "NETWORK_ERROR",
      "🌐 Could not reach that URL. Check that it's publicly accessible and try again."
    );
  } finally {
    clearTimeout(timeout);
  }

  // 3. Check HTTP status
  if (!response.ok) {
    const statusMessages: Record<number, string> = {
      403: "🔒 Access denied — that page requires a login or subscription.",
      404: "🔍 Page not found — double-check the URL.",
      429: "🚦 That site is rate-limiting requests. Try again in a few minutes.",
      500: "🔧 The target site returned a server error. Try again later.",
      503: "🔧 The target site is unavailable. Try again later.",
    };
    const msg =
      statusMessages[response.status] ??
      `⚠️ Received HTTP ${response.status} from that URL.`;
    throw new FetchError(`HTTP ${response.status}`, "HTTP_ERROR", msg);
  }

  // 4. Detect content type
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  const unsupportedMsg = getUnsupportedMessage(contentType);
  if (unsupportedMsg) {
    throw new FetchError(
      `Unsupported content type: ${contentType}`,
      "UNSUPPORTED_TYPE",
      unsupportedMsg
    );
  }

  // 5. Read body with size cap
  const reader = response.body?.getReader();
  if (!reader) {
    throw new FetchError("No body", "NO_BODY", "⚠️ That URL returned an empty response.");
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
        // Still try to parse what we have — truncation is often fine for articles
        break;
      }
      chunks.push(value);
    }
  }

  const buffer = Buffer.concat(chunks);
  return buffer.toString("utf-8");
}
