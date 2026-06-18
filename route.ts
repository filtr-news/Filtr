import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeContent } from "@/lib/analyze";
import { scrapeUrl, scrapePdfUrl, scrapePdfUpload } from "@/lib/scrape";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

const UrlRequestSchema = z.object({
  url: z.string().url(),
  mode: z.enum(["article", "pdf"]).optional().default("article")
});

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";

    // Case 1: PDF uploaded directly as a file (multipart/form-data)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
      }

      if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        return NextResponse.json(
          { error: "Only PDF files are supported for upload right now." },
          { status: 400 }
        );
      }

      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: "That PDF is too large. Please upload a file under 15 MB." },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const { source, content } = await scrapePdfUpload(buffer, file.name);
      const report = await analyzeContent(content, source);
      return NextResponse.json({ source, report });
    }

    // Case 2: JSON body with a URL (either a regular article or a PDF link)
    const body = UrlRequestSchema.parse(await request.json());

    const { source, content } =
      body.mode === "pdf" ? await scrapePdfUrl(body.url) : await scrapeUrl(body.url);

    const report = await analyzeContent(content, source);
    return NextResponse.json({ source, report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to analyze this URL.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
