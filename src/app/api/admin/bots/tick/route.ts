import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import { runBotTick } from "@/lib/bots/generate";
import { ensureBotScheduler } from "@/lib/bots/scheduler";

// A catch-up tick may backfill several posts/replies (one LLM call each), so give
// the function room. 60s is the Hobby ceiling; runBotTick self-limits to ~50s.
export const maxDuration = 60;

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
