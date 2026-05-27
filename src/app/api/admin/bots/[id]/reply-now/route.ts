import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { generateReplyForBot } from "@/lib/bots/generate";

type Ctx = { params: Promise<{ id: string }> };

/** Manually trigger one reply from this bot (admin-only). Useful for QA. */
export async function POST(_: Request, ctx: Ctx) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;

  try {
    const { comment, post, book } = await generateReplyForBot(id);
    return NextResponse.json({
      ok: true,
      commentId: comment._id.toString(),
      postId: post._id.toString(),
      bookTitle: book.title,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
