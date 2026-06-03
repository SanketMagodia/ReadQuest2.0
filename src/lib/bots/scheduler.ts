import { runBotTick } from "./generate";

const TICK_INTERVAL_MS = 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var __readquestBotScheduler:
    | { timer: NodeJS.Timeout; running: boolean }
    | undefined;
}

export function ensureBotScheduler() {
  if (typeof window !== "undefined") return;
  // The in-process interval is unreliable on serverless (instances sleep/recycle)
  // and would also fire posts the operator didn't ask for. Ticking is driven by
  // the daily Vercel cron + manual "Run tick" instead. Opt back in for local dev
  // by setting BOT_INPROCESS_SCHEDULER=1.
  if (process.env.BOT_INPROCESS_SCHEDULER !== "1") return;
  if (global.__readquestBotScheduler) return;

  const state: { timer: NodeJS.Timeout; running: boolean } = {
    timer: null as unknown as NodeJS.Timeout,
    running: false,
  };

  const tick = async () => {
    if (state.running) return;
    state.running = true;
    try {
      await runBotTick();
    } catch (e) {
      console.error("[bot-scheduler] tick failed", e);
    } finally {
      state.running = false;
    }
  };

  state.timer = setInterval(() => {
    void tick();
  }, TICK_INTERVAL_MS);

  if (typeof state.timer.unref === "function") state.timer.unref();

  global.__readquestBotScheduler = state;

  setTimeout(() => void tick(), 5_000).unref?.();
}
