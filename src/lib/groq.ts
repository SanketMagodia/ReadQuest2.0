const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "qwen/qwen3.6-27b";

export type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** How hard we want the model to think before it starts answering. */
export type ReasoningEffort = "low" | "medium" | "high";

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

/**
 * Reasoning models think before they answer, and those thinking tokens come
 * out of the same completion budget as the answer. Left unchecked, a long
 * prompt can spend the entire budget reasoning and return an empty message —
 * which in JSON mode surfaces as a 400 `json_validate_failed` with an empty
 * `failed_generation`, because Groq ends up validating "" as JSON.
 *
 * Every family exposes the dial under the same name but the accepted values
 * don't overlap: GPT-OSS takes low/medium/high, Qwen takes none/default, and
 * each rejects the other's vocabulary. Translate per family, and send nothing
 * for models that take neither.
 */
function reasoningParams(model: string, effort: ReasoningEffort) {
  if (model.startsWith("openai/gpt-oss")) {
    return { reasoning_effort: effort, include_reasoning: false };
  }
  if (model.startsWith("qwen/")) {
    // Qwen has no dial, only a switch — "none" is what keeps the whole budget
    // available for the answer.
    return {
      reasoning_effort: effort === "low" ? "none" : "default",
      include_reasoning: false,
    };
  }
  return null;
}

function post(apiKey: string, body: Record<string, unknown>) {
  return fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
}

export async function groqChat(
  messages: GroqMessage[],
  opts: {
    model?: string;
    temperature?: number;
    /** Budget for reasoning + answer combined, not just the answer. */
    maxTokens?: number;
    /** Ask the model for a strict JSON object response. */
    json?: boolean;
    /** Raise it for genuinely hard prompts; ignored by non-reasoning models. */
    reasoningEffort?: ReasoningEffort;
  } = {}
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new GroqError("GROQ_API_KEY not set in environment", 500);
  }

  const model = opts.model?.trim() || process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;

  const base = {
    model,
    temperature: opts.temperature ?? 0.85,
    // `max_tokens` is the deprecated alias; reasoning models document
    // `max_completion_tokens`.
    max_completion_tokens: opts.maxTokens ?? 320,
    messages,
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
  };

  const reasoning = reasoningParams(model, opts.reasoningEffort ?? "low");
  let res = await post(apiKey, { ...base, ...reasoning });
  let errorBody = "";

  if (!res.ok) {
    errorBody = await res.text().catch(() => "");
    // Swapping to a model from another family shouldn't take the feature down:
    // if it rejected our reasoning vocabulary, drop it and let the model
    // default instead of failing the request.
    if (res.status === 400 && reasoning && errorBody.includes("reasoning")) {
      res = await post(apiKey, base);
      errorBody = res.ok ? "" : await res.text().catch(() => "");
    }
  }

  if (!res.ok) {
    throw new GroqError(
      `Groq request failed (${res.status}): ${errorBody.slice(0, 400)}`,
      res.status
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new GroqError(
      `Groq returned empty completion (model ${model}, finish_reason ${
        data.choices?.[0]?.finish_reason ?? "unknown"
      }) — the token budget was likely spent before the answer started`,
      502
    );
  }
  return content;
}
