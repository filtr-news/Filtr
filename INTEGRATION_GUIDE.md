# Filtr — Production Readiness Changes
## Integration Guide

This package contains all the files from the production readiness review.
Apply them to your repo as described below.

---

## Files Delivered

```
filtr-changes/
├── middleware.ts                  → repo root  (NEW)
├── next.config.mjs                → repo root  (REPLACE)
├── package.json                   → repo root  (REPLACE)
├── app/
│   ├── layout.tsx                 → app/layout.tsx  (REPLACE)
│   ├── not-found.tsx              → app/not-found.tsx  (NEW)
│   └── sitemap.ts                 → app/sitemap.ts  (NEW)
├── lib/
│   ├── validate-url.ts            → lib/validate-url.ts  (NEW)
│   └── fetch-article.ts           → lib/fetch-article.ts  (NEW)
└── public/
    ├── favicon.ico                → public/favicon.ico  (REPLACE)
    ├── icon.png                   → public/icon.png  (NEW)
    ├── apple-icon.png             → public/apple-icon.png  (NEW)
    ├── logo.png                   → public/logo.png  (NEW)
    ├── logo-sm.png                → public/logo-sm.png  (NEW)
    └── robots.txt                 → public/robots.txt  (NEW)
```

---

## 1. Rate Limiting — `middleware.ts`

**Drop into repo root.** No additional dependencies needed.

This runs at the Vercel Edge layer (before any serverless function starts).
It allows 10 requests per IP per 12 hours on the `/api/analyze` route.

If you later want **persistent** rate limits across multiple Vercel instances
(matters at scale), replace the in-memory Map with Upstash Redis:

```bash
pnpm add @upstash/ratelimit @upstash/redis
```

And add to `.env.local`:
```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

The middleware returns a clean JSON error on 429:
```json
{
  "error": "rate_limited",
  "message": "You've reached the limit of 10 analyses per 12 hours. Try again later.",
  "retryAfter": 43200
}
```

---

## 2. URL Validation + SSRF Protection — `lib/validate-url.ts`

**Drop into `lib/`.**

Blocks:
- Non-http/https schemes (file://, ftp://, etc.)
- Private/loopback IP ranges (127.x, 10.x, 192.168.x, 172.16–31.x)
- AWS/GCP metadata endpoint (169.254.x.x)
- Unresolvable domains

**Wire it into your existing `/api/analyze/route.ts`:**

```typescript
import { fetchArticleHtml, FetchError } from "@/lib/fetch-article";

// Inside your POST handler, replace your current fetch call with:
let html: string;
try {
  html = await fetchArticleHtml(url);
} catch (err) {
  if (err instanceof FetchError) {
    return Response.json({ error: err.userMessage }, { status: 400 });
  }
  throw err;
}
```

---

## 3. Safe Fetch + Content-Type Guard — `lib/fetch-article.ts`

**Drop into `lib/`.**

Wraps the external URL fetch with:
- 12-second AbortController timeout
- 2 MB body cap (truncates gracefully — article text is almost always < 500 KB)
- Content-type detection with friendly user messages:
  - PDF → "📄 PDF detected. Filtr doesn't support PDF files yet..."
  - Audio → "🎧 Audio files aren't supported..."
  - Video → "🎬 Video files aren't supported..."
  - Binary → "⚠️ Binary file detected..."
- HTTP error code mapping (403, 404, 429, 500 → clear messages)

---

## 4. Security Headers — `next.config.mjs`

**Replace existing `next.config.mjs`.**

Adds these headers to every response:
| Header | Value | Purpose |
|--------|-------|---------|
| X-Content-Type-Options | nosniff | Prevents MIME sniffing |
| X-Frame-Options | SAMEORIGIN | Prevents clickjacking |
| X-XSS-Protection | 1; mode=block | Legacy XSS protection |
| Referrer-Policy | strict-origin-when-cross-origin | Limits referrer leakage |
| Content-Security-Policy | (see file) | Restricts resource loading |
| Strict-Transport-Security | max-age=31536000 | Forces HTTPS |
| Permissions-Policy | camera=(), microphone=() | Disables sensitive APIs |

---

## 5. Updated Layout with Logo + Metadata — `app/layout.tsx`

**Replace existing `app/layout.tsx`.**

Changes:
- Full OpenGraph metadata (title, description, image)
- Twitter card (summary_large_image)
- Favicon + Apple touch icon declarations
- `robots: { index: false }` — **remove this when you're ready for public launch**
- `metadataBase` set to `https://filtr-sand.vercel.app`

⚠️ If your domain changes from `filtr-sand.vercel.app`, update `APP_URL` at the top.

Also wire the logo into your UI header (wherever your current page renders "Filtr"):
```tsx
import Image from "next/image";

<Image src="/logo-sm.png" alt="Filtr" width={160} height={107} priority />
```

---

## 6. 404 Page — `app/not-found.tsx`

**Drop into `app/`.** No dependencies. Automatically used by Next.js for unknown routes.

Styled to match the Filtr dark aesthetic with the green accent bar from the logo.

---

## 7. Branding Assets — `public/`

| File | Use |
|------|-----|
| `favicon.ico` | Browser tab icon (16×16, 32×32) |
| `icon.png` | PWA / Next.js app icon (192×192) |
| `apple-icon.png` | iOS home screen icon (180×180) |
| `logo.png` | OG image for social sharing (1536×1024) |
| `logo-sm.png` | In-app logo usage (400×266) |

---

## 8. robots.txt — `public/robots.txt`

**Drop into `public/`.** Disallows `/api/` from all crawlers.

---

## 9. Pinned Dependencies — `package.json`

**Replace existing `package.json`.** Removes all `^` version prefixes.

After replacing, run:
```bash
pnpm install
```

This regenerates `pnpm-lock.yaml` from the pinned versions.
Commit both `package.json` and `pnpm-lock.yaml`.

---

## 10. Sitemap — `app/sitemap.ts`

**Drop into `app/`.** Generates `/sitemap.xml` automatically.
Update the URL if your domain changes.

---

## Post-Deployment Checklist

- [ ] Set `OPENAI_API_KEY` in Vercel project settings (not `NEXT_PUBLIC_OPENAI_API_KEY`)
- [ ] Set a monthly spend limit in OpenAI dashboard → Billing → Usage limits ($20–$50 to start)
- [ ] Confirm `/api/analyze` is not accessible without POST body (test in browser — should 405)
- [ ] Test 404 by visiting `https://filtr-sand.vercel.app/this-does-not-exist`
- [ ] Test rate limit by submitting 11 analyses quickly — should 429 on the 11th
- [ ] Test PDF URL: paste a `.pdf` URL — should get friendly message not 500
- [ ] Test OG preview: paste your URL into https://opengraph.xyz
- [ ] Remove `robots: { index: false }` from `layout.tsx` when ready for public launch

---

## OpenAI Spend Limit — Recommended Settings

For Filtr at early/beta stage:

| Setting | Value | Rationale |
|---------|-------|-----------|
| Monthly soft limit | $20 | You get an email warning |
| Monthly hard limit | $50 | API calls stop; users get an error |
| Model | gpt-4o-mini | ~$0.0015/analysis at avg 1K tokens |
| At hard limit | ~33,000 analyses/month | Plenty for beta |

As usage grows, raise the hard limit and add the Upstash-based rate limiter.
