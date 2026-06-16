import { NextRequest, NextResponse } from "next/server";

// In-memory rate limit store (resets on cold start — acceptable for serverless)
// For persistent limits across instances, swap this for Upstash Redis:
// https://github.com/upstash/ratelimit
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const LIMIT = 10;
const WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/api/analyze")) {
    return NextResponse.next();
  }

  const ip = getClientIp(req);
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return NextResponse.next();
  }

  if (record.count >= LIMIT) {
    const retryAfterSecs = Math.ceil((record.resetAt - now) / 1000);
    return NextResponse.json(
      {
        error: "rate_limited",
        message: `You've reached the limit of ${LIMIT} analyses per 12 hours. Try again later.`,
        retryAfter: retryAfterSecs,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSecs),
          "X-RateLimit-Limit": String(LIMIT),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(record.resetAt / 1000)),
        },
      }
    );
  }

  record.count += 1;
  return NextResponse.next();
}

export const config = {
  matcher: "/api/analyze",
};
