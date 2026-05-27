const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export class GroqError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "GroqError";
  }
}

export function isGroqConfigured() {
  return Boolean(process.env.GROQ_API_KEY);
}

export async function groqChat(
  messages: GroqMessage[],
  opts: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new GroqError("GROQ_API_KEY not set in environment", 500);
  }

  const model = opts.model?.trim() || process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: opts.temperature ?? 0.85,
      max_tokens: opts.maxTokens ?? 320,
      messages,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new GroqError(
      `Groq request failed (${res.status}): ${text.slice(0, 400)}`,
      res.status
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new GroqError("Groq returned empty completion", 502);
  }
  return content;
}
