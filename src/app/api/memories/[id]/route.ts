import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Memory from "@/models/Memory";
import { memoryUpdateSchema } from "@/lib/validators";
import { serializeMemory } from "@/lib/memories";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = memoryUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid update" },
      { status: 400 }
    );
  }

  await connectDB();

  // Matching on `user` as well as `_id` is what enforces ownership — a miss
  // is reported as 404 so the endpoint never confirms another user's id.
  const updated = await Memory.findOneAndUpdate(
    { _id: id, user: new Types.ObjectId(session.user.id) },
    { $set: parsed.data },
    { new: true }
  )
    .populate("book", "title authors thumbnail slug")
    .lean();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ memory: serializeMemory(updated) });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await connectDB();
  const res = await Memory.deleteOne({
    _id: id,
    user: new Types.ObjectId(session.user.id),
  });
  if (!res.deletedCount) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
