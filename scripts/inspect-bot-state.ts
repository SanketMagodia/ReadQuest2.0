/** Read-only: show bot schedules, tick lock, and newest bot posts. */
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

async function main() {
  const { default: connectDB } = await import("../src/lib/db");
  const { default: Bot } = await import("../src/models/Bot");
  const { default: Post } = await import("../src/models/Post");
  const { default: BotTickLock } = await import("../src/models/BotTickLock");
  await import("../src/models/User");

  await connectDB();
  const now = new Date();

  const lock = await BotTickLock.findById("global").lean();
  console.log("=== tick lock ===");
  console.log(
    lock
      ? `lockedUntil=${lock.lockedUntil?.toISOString()} (held=${!!(lock.lockedUntil && lock.lockedUntil > now)}) lastStartedAt=${lock.lastStartedAt?.toISOString() ?? "-"} lastFinishedAt=${lock.lastFinishedAt?.toISOString() ?? "-"}`
      : "no lock document"
  );

  const bots = await Bot.find().populate("user", "username").lean();
  console.log(`\n=== ${bots.length} bot(s) ===`);
  for (const b of bots) {
    const u = (b.user as { username?: string })?.username ?? "?";
    console.log(
      `@${u} enabled=${b.enabled} interval=${b.intervalMinMinutes}-${b.intervalMaxMinutes}min ` +
        `posts=${b.postsCount} lastPostAt=${b.lastPostAt?.toISOString() ?? "never"} ` +
        `nextPostAt=${b.nextPostAt?.toISOString() ?? "none"}` +
        (b.enabled && (!b.nextPostAt || b.nextPostAt <= now) ? "  <-- DUE" : "") +
        (b.lastError ? `  lastError=${b.lastError.slice(0, 80)}` : "")
    );
  }

  const botUserIds = bots.map((b) => b.user && (b.user as { _id?: unknown })._id).filter(Boolean);
  const recent = await Post.find({ author: { $in: botUserIds } })
    .sort({ createdAt: -1 })
    .limit(15)
    .populate("author", "username")
    .lean();
  console.log("\n=== 15 newest bot posts ===");
  for (const p of recent) {
    const a = p.author as { username?: string };
    console.log(
      `${new Date(p.createdAt as Date).toISOString()}  @${a?.username ?? "?"}  ` +
        String(p.content).slice(0, 60).replace(/\n/g, " ")
    );
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
