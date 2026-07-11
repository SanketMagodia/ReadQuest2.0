import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { profileUpdateSchema } from "@/lib/validators";

export async function PATCH(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await req.json();
  const parsed = profileUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(parsed.error.flatten().fieldErrors, { status: 400 });
  }

  await connectDB();
  const u = await User.findById(session.user.id);
  if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.name !== undefined) u.name = parsed.data.name;
  if (parsed.data.bio !== undefined) u.bio = parsed.data.bio;
  if (parsed.data.image !== undefined) u.image = parsed.data.image || undefined;
  if (parsed.data.mood !== undefined) u.set("mood", parsed.data.mood);

  const { currentPassword, newPassword } = raw as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (newPassword || currentPassword) {
    if (
      typeof newPassword !== "string" ||
      newPassword.length < 8 ||
      typeof currentPassword !== "string"
    ) {
      return NextResponse.json(
        { error: "Provide currentPassword and newPassword (min 8 chars)" },
        { status: 400 }
      );
    }
    const fresh = await User.findById(session.user.id).select("+passwordHash");
    if (!fresh?.passwordHash) {
      return NextResponse.json({ error: "Google-only account" }, { status: 400 });
    }
    const ok = await bcrypt.compare(currentPassword, fresh.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Wrong current password" }, { status: 400 });
    }
    if (parsed.data.name !== undefined) fresh.name = parsed.data.name;
    if (parsed.data.bio !== undefined) fresh.bio = parsed.data.bio;
    if (parsed.data.image !== undefined) fresh.image = parsed.data.image || undefined;
    if (parsed.data.mood !== undefined) fresh.set("mood", parsed.data.mood);
    fresh.passwordHash = await bcrypt.hash(newPassword, 12);
    await fresh.save();
  } else {
    await u.save();
  }

  const out =
    await User.findById(session.user.id).lean();

  return NextResponse.json({
    user: {
      id: out?._id.toString() ?? u._id.toString(),
      username: out?.username ?? u.username,
      name: out?.name ?? u.name,
      bio: out?.bio ?? u.bio,
      image: out?.image ?? u.image,
      mood: (out as { mood?: string })?.mood ?? "",
    },
    message:
      newPassword ?
        "Profile and password updated."
      : "Saved",
  });
}

export async function GET() {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const out = await User.findById(session.user.id).lean();
  if (!out) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    user: {
      id: out._id.toString(),
      username: out.username,
      name: out.name,
      bio: out.bio,
      image: out.image,
      mood: (out as { mood?: string }).mood ?? "",
    },
  });
}
