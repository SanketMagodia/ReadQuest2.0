import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { isAdminUsername } from "@/lib/admin";
import { purgeUser } from "@/lib/admin-purge-user";
import connectDB from "@/lib/db";
import User from "@/models/User";

type Ctx = { params: Promise<{ id: string }> };

/**
 * DELETE /api/admin/users/:id
 *
 * Removes the account and every row that points at it. Admins (including the
 * signed-in manager) cannot be deleted this way.
 */
export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;

  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  if (id === gate.session.user.id) {
    return NextResponse.json(
      { error: "You cannot remove your own account from here." },
      { status: 400 }
    );
  }

  await connectDB();
  const user = await User.findById(id).select("username role").lean();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (user.role === "admin" || isAdminUsername(user.username)) {
    return NextResponse.json(
      { error: "Admin accounts cannot be removed this way." },
      { status: 403 }
    );
  }

  const deleted = await purgeUser(id);
  return NextResponse.json({
    ok: true,
    username: user.username,
    deleted,
  });
}
