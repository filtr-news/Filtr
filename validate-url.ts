// lib/validate-url.ts
// Validates user-supplied URLs before server-side fetch.
// Blocks SSRF vectors (private/loopback IPs, cloud metadata endpoints).

import { URL } from "url";
import dns from "dns/promises";

// Private IPv4 ranges
const PRIVATE_RANGES = [
  /^127\./,           // loopback
  /^10\./,            // RFC1918
  /^192\.168\./,      // RFC1918
  /^172\.(1[6-9]|2\d|3[01])\./,  // RFC1918
  /^169\.254\./,      // link-local (AWS/GCP metadata)
  /^0\./,             // "this" network
  /^::1$/,            // IPv6 loopback
  /^fc00:/,           // IPv6 private
  /^fe80:/,           // IPv6 link-local
];

export class UrlValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "UrlValidationError";
  }
}

export async function validateUrl(rawUrl: string): Promise<URL> {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new UrlValidationError(
      "That doesn't look like a valid URL. Please include https://",
      "INVALID_URL"
    );
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new UrlValidationError(
      "Only http:// and https:// URLs are supported.",
      "INVALID_SCHEME"
    );
  }

  // Resolve hostname to IP to block SSRF via DNS rebinding
  let addresses: string[] = [];
  try {
    const result = await dns.lookup(url.hostname, { all: true });
    addresses = result.map((r) => r.address);
  } catch {
    throw new UrlValidationError(
      "Could not resolve that domain. Please check the URL and try again.",
      "DNS_FAILURE"
    );
  }

  for (const addr of addresses) {
    for (const range of PRIVATE_RANGES) {
      if (range.test(addr)) {
        throw new UrlValidationError(
          "That URL points to a private or internal network, which is not allowed.",
          "PRIVATE_IP"
        );
      }
    }
  }

  return url;
}
