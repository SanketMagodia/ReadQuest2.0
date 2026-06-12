import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import { runBotTick } from "@/lib/bots/generate";
import { ensureBotScheduler } from "@/lib/bots/scheduler";

// Each LLM call is now followed by a 30 s sleep (BOT_LLM_SLEEP_MS) to stay under
// Groq's TPM limit. Raise maxDuration to 300 (Vercel Pro ceiling) so the function
// isn't killed mid-tick. On Hobby (60 s limit) set BOT_LLM_SLEEP_MS=0 or trigger
// ticks from a cron server without a timeout constraint.
export const maxDuration = 300;

async function authorize(req: Request) {
  const headerSecret = req.headers.get("x-bot-tick-secret");
  const envSecret = process.env.BOT_TICK_SECRET;
  if (envSecret && headerSecret === envSecret) return true;

  const cronSecret = process.env.CRON_SECRET ?? process.env.BOT_TICK_SECRET;
  const auth = req.headers.get("authorization");
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;

  const session = await getAppSession();
  return session?.user?.role === "admin";
}

export async function POST(req: Request) {
  const ok = await authorize(req);
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  ensureBotScheduler();
  const result = await runBotTick();
  return NextResponse.json({ ok: true, ...result });
}

export const GET = POST;
