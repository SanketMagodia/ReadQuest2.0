import { Types } from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Bot from "@/models/Bot";
import User from "@/models/User";
import Post from "@/models/Post";
import { requireAdmin } from "@/lib/admin-guard";
import { botUpdateSchema } from "@/lib/validators";
import { rollNextPostAt } from "@/lib/bots/generate";
import { serializeBot } from "@/lib/bots/serialize";

type Ctx = { params: Promise<{ id: string }> };

async function loadBot(id: string) {
  if (!Types.ObjectId.isValid(id)) return null;
  return Bot.findById(id);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const raw = await req.json().catch(() => null);
  const parsed = botUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(parsed.error.flatten().fieldErrors, { status: 400 });
  }
  const data = parsed.data;

  await connectDB();
  const bot = await loadBot(id);
  if (!bot) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (data.persona !== undefined) bot.persona = data.persona;
  if (data.categories !== undefined) bot.categories = data.categories;
  if (data.model !== undefined) bot.model = data.model;
  if (data.intervalMinMinutes !== undefined) bot.intervalMinMinutes = data.intervalMinMinutes;
  if (data.intervalMaxMinutes !== undefined) bot.intervalMaxMinutes = data.intervalMaxMinutes;

  if (data.replyEnabled !== undefined) bot.replyEnabled = data.replyEnabled;
  if (data.replyCategories !== undefined) bot.replyCategories = data.replyCategories;
  if (data.replyChancePerTick !== undefined) bot.replyChancePerTick = data.replyChancePerTick;
  if (data.repliesPerTick !== undefined) bot.repliesPerTick = data.repliesPerTick;
  if (data.replyDailyLimit !== undefined) bot.replyDailyLimit = data.replyDailyLimit;
  if (data.autoRespondToComments !== undefined)
    bot.autoRespondToComments = data.autoRespondToComments;
  if (data.autoRespondPerTick !== undefined)
    bot.autoRespondPerTick = data.autoRespondPerTick;

  if (bot.intervalMaxMinutes < bot.intervalMinMinutes) {
    return NextResponse.json(
      { error: "intervalMaxMinutes must be >= intervalMinMinutes" },
      { status: 400 }
    );
  }

  if (data.enabled !== undefined && data.enabled !== bot.enabled) {
    bot.enabled = data.enabled;
    if (data.enabled) {
      bot.nextPostAt = new Date(Date.now() + 30 * 1000);
      bot.lastError = "";
    }
  }

  await bot.save();

  if (data.name !== undefined || data.bio !== undefined || data.image !== undefined) {
    const user = await User.findById(bot.user);
    if (user) {
      if (data.name !== undefined) user.name = data.name;
      if (data.bio !== undefined) user.bio = data.bio;
      if (data.image !== undefined) user.image = data.image || undefined;
      await user.save();
    }
  }

  const populated = await Bot.findById(bot._id)
    .populate("user", "username name bio image")
    .lean();

  return NextResponse.json({
    bot: serializeBot({
      ...populated!,
      _id: populated!._id,
    } as Parameters<typeof serializeBot>[0]),
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  await connectDB();
  const bot = await loadBot(id);
  if (!bot) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const wipe = url.searchParams.get("wipe") === "1";

  const userId = bot.user;
  await bot.deleteOne();

  if (wipe && userId) {
    await Post.deleteMany({ author: userId });
    await User.findByIdAndDelete(userId);
  }

  return NextResponse.json({ ok: true });
}
