import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-guard";
import { groqChat, isGroqConfigured, GroqError } from "@/lib/groq";

const schema = z.object({
  brief: z.string().trim().max(500).optional().default(""),
  name: z.string().trim().max(80).optional().default(""),
  categories: z
    .array(z.string().trim().min(1).max(60))
    .max(10)
    .optional()
    .default([]),
});

function clean(raw: string, max = 900) {
  let text = raw.trim();
  text = text.replace(/^["“'`]+|["”'`]+$/g, "").trim();
  text = text.replace(/^(persona|prompt|bio):\s*/i, "").trim();
  if (text.length > max) text = text.slice(0, max).trim() + "…";
  return text;
}

/** Admin helper: generate a persona prompt for a bot from a short brief. */
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  if (!isGroqConfigured()) {
    return NextResponse.json(
      { error: "AI is not configured on the server." },
      { status: 503 }
    );
  }

  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(parsed.error.flatten().fieldErrors, { status: 400 });
  }
  const { brief, name, categories } = parsed.data;

  const system = [
    "You write CONCISE bot personas for Readquest, a books community.",
    "A persona is a 3–5 sentence description written in second person ('You are…').",
    "It must convey:",
    "- Reading taste (genres, eras, what they gravitate toward)",
    "- Personality and voice (casual / wry / excited / reflective / etc.)",
    "- Two or three small specific quirks (drinks, habits, pet peeves) that ground them as a person",
    "- The vibe of how they POST: short, opinionated, a bit playful, never preachy",
    "Hard rules:",
    "- Output ONLY the persona text. No preamble, no label, no quotation marks, no markdown headings.",
    "- 60 to 110 words total. Plain English.",
  ].join("\n");

  const user = [
    name ? `Persona display name: ${name}` : "",
    categories.length
      ? `Their reading focus / categories: ${categories.join(", ")}`
      : "",
    brief
      ? `User brief: ${brief}`
      : "User brief: (none — invent a fresh, distinctive reader persona)",
    "",
    "Write the persona now.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const completion = await groqChat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { temperature: 0.95, maxTokens: 400 }
    );
    const persona = clean(completion, 900);
    if (!persona) {
      return NextResponse.json(
        { error: "AI returned an empty persona — try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ persona });
  } catch (err) {
    const message =
      err instanceof GroqError
        ? err.message
        : err instanceof Error
          ? err.message
          : "AI request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
