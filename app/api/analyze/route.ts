import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeContent } from "@/lib/analyze";
import { scrapeUrl } from "@/lib/scrape";

export const runtime = "nodejs";
export const maxDuration = 60;

const RequestSchema = z.object({
  url: z.string().url()
});

export async function POST(request: Request) {
  try {
    const body = RequestSchema.parse(await request.json());
    const { source, content } = await scrapeUrl(body.url);
    const report = await analyzeContent(content, source);

    return NextResponse.json({ source, report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to analyze this URL.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
