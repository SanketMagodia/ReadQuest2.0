import { BRAND_NAME } from "@/lib/brand";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";

/** How hard we want the model to think before it starts answering. */
export type ReasoningEffort = "none" | "low" | "medium" | "high";

/**
 * Nemotron thinks before it answers, and those tokens come out of the same
 * `max_tokens` allowance as the answer itself — the recommendation prompt was
 * measured burning 3613 of them and getting truncated mid-thought. So callers
 * ask for the budget their *answer* needs and we add thinking room on top.
 *
 * Every prompt in this app is short-form and creative (a post, a quote, five
 * book picks), which is why `none` is the default: on the recommendation prompt
 * it returned the same five valid picks in half the time with zero thinking
 * tokens. Opt into an effort level only for something genuinely analytical.
 */
const REASONING_HEADROOM: Record<ReasoningEffort, number> = {
  none: 0,
  low: 6000,
  medium: 12000,
  high: 20000,
};

/**
 * The free Nemotron tier shares capacity, and a busy upstream answers with
 * "Service temporarily overloaded" within a few hundred milliseconds — often
 * enough that a single attempt is a coin flip. These retries are cheap because
 * a rejected request never reaches the model.
 */
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 900;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Congestion wording OpenRouter passes through from the upstream provider. */
const TRANSIENT = /overload|temporarily|timed? ?out|capacity|try again|rate limit/i;

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export class LlmError extends Error {
  status: number;
  /**
   * Whether trying the exact same request again could plausibly work. Set at
   * the throw site rather than inferred from `status`, because our own 502s
   * ("truncated", "empty completion") describe a call that needs a bigger
   * budget — retrying those just burns three times the quota to fail again.
   */
  retryable: boolean;
  constructor(message: string, status: number, retryable = false) {
    super(message);
    this.status = status;
    this.retryable = retryable;
    this.name = "LlmError";
  }
}

export function isLlmConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/** The model these completions actually came from, for provenance records. */
export function llmModel() {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
}

type Choice = {
  message?: { content?: string };
  finish_reason?: string;
  native_finish_reason?: string;
};

type Completion = {
  choices?: Choice[];
  usage?: {
    completion_tokens?: number;
    completion_tokens_details?: { reasoning_tokens?: number };
  };
  error?: { message?: string; code?: number | string };
};

/**
 * Chat completion via OpenRouter's OpenAI-compatible endpoint.
 *
 * Plain `fetch` rather than `@openrouter/sdk`: the request is a single POST and
 * we only ever want the finished string, so the SDK would add a dependency to
 * save nothing. Streaming is only needed to watch reasoning tokens arrive.
 */
export async function llmChat(
  messages: LlmMessage[],
  opts: {
    model?: string;
    temperature?: number;
    /** Budget for the answer. Reasoning headroom is added on top. */
    maxTokens?: number;
    /** Ask the model for a strict JSON object response. */
    json?: boolean;
    /** Defaults to `none`. Raise it only for genuinely analytical prompts. */
    reasoningEffort?: ReasoningEffort;
  } = {}
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new LlmError("OPENROUTER_API_KEY not set in environment", 500);
  }

  const model = opts.model?.trim() || llmModel();
  const answerBudget = opts.maxTokens ?? 320;

  let lastError: LlmError | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await requestOnce(apiKey, model, messages, answerBudget, opts);
    } catch (err) {
      if (!(err instanceof LlmError)) throw err;
      lastError = err;
      if (attempt === MAX_ATTEMPTS || !err.retryable) throw err;
      await sleep(RETRY_BACKOFF_MS * attempt);
    }
  }
  throw lastError ?? new LlmError("OpenRouter request failed", 502);
}

async function requestOnce(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  answerBudget: number,
  opts: {
    temperature?: number;
    json?: boolean;
    reasoningEffort?: ReasoningEffort;
  }
): Promise<string> {
  const effort = opts.reasoningEffort ?? "none";
  const maxTokens = answerBudget + REASONING_HEADROOM[effort];

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      // Optional attribution — how the app is credited on OpenRouter.
      "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
      "X-Title": BRAND_NAME,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.85,
      // OpenRouter's field is `max_tokens`; it ignores the
      // `max_completion_tokens` alias silently, which reads as a runaway model.
      max_tokens: maxTokens,
      reasoning_effort: effort,
      // Keep the chain of thought out of the response entirely.
      include_reasoning: false,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new LlmError(
      `OpenRouter request failed (${res.status}): ${body.slice(0, 400)}`,
      res.status,
      res.status === 429 || res.status >= 500
    );
  }

  // OpenRouter pads non-streamed responses with whitespace keep-alives while
  // the upstream model works. JSON.parse skips it, but a mid-flight failure
  // can leave us with a body that isn't JSON at all.
  const text = await res.text();
  let data: Completion;
  try {
    data = JSON.parse(text) as Completion;
  } catch {
    throw new LlmError(
      `OpenRouter returned a non-JSON body: ${text.trim().slice(0, 200)}`,
      502,
      true
    );
  }

  // Errors can also arrive inside a 200 — a busy upstream provider shows up
  // here as "Service temporarily overloaded", not as a failed HTTP status.
  if (data.error?.message) {
    const message = data.error.message;
    throw new LlmError(
      `OpenRouter error: ${message}`,
      502,
      TRANSIENT.test(message)
    );
  }

  const choice = data.choices?.[0];
  const finish = choice?.finish_reason ?? choice?.native_finish_reason;
  const content = choice?.message?.content?.trim();

  /**
   * A truncated response is worse than an empty one here: when the budget runs
   * out mid-thought the provider flushes the partial reasoning as `content`, so
   * we'd hand callers the model's musings as if they were the answer.
   */
  if (finish === "length") {
    const thought = data.usage?.completion_tokens_details?.reasoning_tokens ?? 0;
    throw new LlmError(
      `OpenRouter response truncated (model ${model}, ${thought} reasoning tokens ` +
        `of a ${maxTokens} budget at effort "${effort}") — raise maxTokens for this call`,
      502
    );
  }

  if (!content) {
    throw new LlmError(
      `OpenRouter returned empty completion (model ${model}, finish_reason ${finish ?? "unknown"})`,
      502
    );
  }

  return content;
}
