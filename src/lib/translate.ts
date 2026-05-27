import { groqChat, isGroqConfigured } from "@/lib/groq";

/**
 * Heuristic: does the string look like it's already (mostly) English?
 *
 *  - Any non-Latin script (Cyrillic, Hebrew, Arabic, CJK, Hangul, Devanagari)
 *    → not English.
 *  - Otherwise, check for common English function words. If we see ≥3 of them,
 *    we treat it as English. This is cheap and dodges paying the LLM cost on
 *    the vast majority of books whose descriptions are already English.
 *
 * Returns true if we DO NOT need to translate.
 */
export function looksEnglish(input: string): boolean {
  const s = input.trim();
  if (s.length < 30) return true;

  // Common non-Latin script ranges. If we see any of these characters, the
  // text is clearly not English.
  const nonLatin =
    /[\u0400-\u04FF\u0500-\u052F\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3130-\u318F\uAC00-\uD7AF\u0E00-\u0E7F]/;
  if (nonLatin.test(s)) return false;

  // Latin-script density check.
  const englishMarkers =
    /\b(the|and|of|to|in|a|is|was|were|with|for|that|this|on|at|by|from|but|or|as|are|be|been|has|have|had|it|its|they|their|which|when|while|after|before|because)\b/gi;
  const matches = s.match(englishMarkers);
  return (matches?.length ?? 0) >= 3;
}

/**
 * Translate arbitrary text to natural, fluent English using Groq.
 *
 *  - Returns the original string unchanged if it's empty, already English,
 *    or if Groq isn't configured.
 *  - On any LLM failure we also fall through to the original — translation
 *    is a nice-to-have, never a hard requirement for a book to be saved.
 *  - Preserves paragraph structure and tone.
 */
export async function translateToEnglish(input: string): Promise<string> {
  const text = input?.trim?.() ?? "";
  if (!text) return text;
  if (looksEnglish(text)) return text;
  if (!isGroqConfigured()) return text;

  try {
    const result = await groqChat(
      [
        {
          role: "system",
          content: [
            "You are a precise translator.",
            "Translate the user's text into fluent, natural English while preserving its meaning, tone, structure, and paragraph breaks.",
            "If the input is already English, return it verbatim.",
            "If the input contains a mix of languages, translate the non-English parts and leave English parts intact.",
            "Output ONLY the translation — no preamble, no commentary, no language labels, no quotes around the result.",
          ].join(" "),
        },
        { role: "user", content: text },
      ],
      { temperature: 0.15, maxTokens: 1800 }
    );
    const cleaned = result.replace(/^["'`]+|["'`]+$/g, "").trim();
    return cleaned || text;
  } catch (err) {
    console.warn("[translate] falling back to original", err);
    return text;
  }
}

/**
 * Translate a comma-separated list of short terms (e.g. categories) where
 * we want to keep the comma structure intact. Skips terms that already look
 * English; sends only the rest to the LLM in one batched call.
 */
export async function translateTermsToEnglish(
  input: string
): Promise<string> {
  const text = input?.trim?.() ?? "";
  if (!text) return text;

  const terms = text
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!terms.length) return text;

  const needsTranslating = terms.filter((t) => !looksEnglish(t));
  if (!needsTranslating.length) return text;

  if (!isGroqConfigured()) return text;

  try {
    const list = needsTranslating.map((t, i) => `${i + 1}. ${t}`).join("\n");
    const result = await groqChat(
      [
        {
          role: "system",
          content: [
            "You translate short library subject labels into English.",
            "Input is a numbered list. Output the same numbered list, where each item is the English translation (or the original term verbatim if it's already English).",
            "Keep the numbering. Do not add commentary.",
          ].join(" "),
        },
        { role: "user", content: list },
      ],
      { temperature: 0.1, maxTokens: 400 }
    );

    const map = new Map<string, string>();
    for (const line of result.split(/\r?\n/)) {
      const m = line.match(/^\s*(\d+)\.\s*(.+)$/);
      if (!m) continue;
      const idx = parseInt(m[1], 10) - 1;
      const original = needsTranslating[idx];
      if (original) map.set(original, m[2].trim());
    }
    return terms.map((t) => map.get(t) ?? t).join(", ");
  } catch (err) {
    console.warn("[translate] terms fallback", err);
    return text;
  }
}
