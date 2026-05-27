import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Bot from "@/models/Bot";
import User from "@/models/User";
import { requireAdmin } from "@/lib/admin-guard";
import { botCreateSchema } from "@/lib/validators";
import { isGroqConfigured } from "@/lib/groq";
import { rollNextPostAt } from "@/lib/bots/generate";
import { ensureBotScheduler } from "@/lib/bots/scheduler";
import { serializeBot } from "@/lib/bots/serialize";

export async function GET() {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

  ensureBotScheduler();
  await connectDB();
  const rows = await Bot.find()
    .sort({ createdAt: -1 })
    .populate("user", "username name bio image")
    .lean();

  return NextResponse.json({
    groqConfigured: isGroqConfigured(),
    bots: rows.map((r) =>
      serializeBot({
        ...r,
        _id: r._id,
      } as Parameters<typeof serializeBot>[0])
    ),
  });
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

  ensureBotScheduler();
  const raw = await req.json().catch(() => null);
  const parsed = botCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(parsed.error.flatten().fieldErrors, { status: 400 });
  }
  const data = parsed.data;

  if (data.intervalMaxMinutes < data.intervalMinMinutes) {
    return NextResponse.json(
      { error: "intervalMaxMinutes must be >= intervalMinMinutes" },
      { status: 400 }
    );
  }

  await connectDB();

  const existing = await User.findOne({ username: data.username }).lean();
  if (existing) {
    return NextResponse.json({ error: "Username taken" }, { status: 409 });
  }

  const user = await User.create({
    username: data.username,
    name: data.name,
    bio: data.bio || "",
    image: data.image || undefined,
    isBot: true,
    role: "user",
  });

  const bot = await Bot.create({
    user: user._id,
    enabled: data.enabled ?? false,
    persona: data.persona,
    categories: data.categories,
    intervalMinMinutes: data.intervalMinMinutes,
    intervalMaxMinutes: data.intervalMaxMinutes,
    model: data.model || "",
    nextPostAt: data.enabled
      ? new Date(Date.now() + 30 * 1000)
      : rollNextPostAt({
          intervalMinMinutes: data.intervalMinMinutes,
          intervalMaxMinutes: data.intervalMaxMinutes,
        } as never),
    replyEnabled: data.replyEnabled ?? false,
    replyCategories: data.replyCategories ?? [],
    replyChancePerTick: data.replyChancePerTick ?? 20,
    repliesPerTick: data.repliesPerTick ?? 1,
    replyDailyLimit: data.replyDailyLimit ?? 12,
    autoRespondToComments: data.autoRespondToComments ?? true,
    autoRespondPerTick: data.autoRespondPerTick ?? 3,
  });

  const populated = await Bot.findById(bot._id)
    .populate("user", "username name bio image")
    .lean();

  return NextResponse.json(
    {
      bot: serializeBot({
        ...populated!,
        _id: populated!._id,
      } as Parameters<typeof serializeBot>[0]),
    },
    { status: 201 }
  );
}
