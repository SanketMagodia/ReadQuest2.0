import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import { runBotTick } from "@/lib/bots/generate";
import { ensureBotScheduler } from "@/lib/bots/scheduler";

async function authorize(req: Request) {
  const headerSecret = req.headers.get("x-bot-tick-secret");
  const envSecret = process.env.BOT_TICK_SECRET;
  if (envSecret && headerSecret === envSecret) return true;
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
