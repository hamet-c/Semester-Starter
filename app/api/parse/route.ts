import { NextRequest, NextResponse } from "next/server";
import { extractTextFromFile } from "@/lib/extract-text";
import { ruleParse } from "@/lib/rule-parser";
import { aiParse, aiParserAvailable } from "@/lib/ai-parser";
import type { ParseResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120; // AI pass on a long syllabus can take a while

/** Lets the UI show whether AI parsing is configured. */
export async function GET() {
  return NextResponse.json({ ai: aiParserAvailable() });
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart form upload." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "File is too large (max 15 MB)." }, { status: 400 });
  }

  let text: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    text = await extractTextFromFile(buffer, file.name);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read the file.";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  if (!text || text.trim().length < 20) {
    return NextResponse.json(
      { error: "No readable text found in this file. If it's a scanned PDF, parsing isn't supported yet." },
      { status: 422 }
    );
  }

  const referenceDate = new Date();
  const ruleEvents = ruleParse(text, referenceDate);

  if (aiParserAvailable()) {
    try {
      const aiEvents = await aiParse(text, referenceDate);
      const body: ParseResponse = { events: aiEvents, parserUsed: "ai" };
      return NextResponse.json(body);
    } catch (err) {
      console.error("AI parse failed, falling back to rules:", err);
      const body: ParseResponse = {
        events: ruleEvents,
        parserUsed: "rules",
        warning: "AI parsing failed, so basic date detection was used instead. Review the results carefully.",
      };
      return NextResponse.json(body);
    }
  }

  const body: ParseResponse = {
    events: ruleEvents,
    parserUsed: "rules",
    warning:
      "Basic date detection was used (no ANTHROPIC_API_KEY configured). Add a key to .env.local for much more accurate AI parsing.",
  };
  return NextResponse.json(body);
}
