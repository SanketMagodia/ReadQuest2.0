import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { generatePostForBot } from "@/lib/bots/generate";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_: Request, ctx: Ctx) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;

  try {
    const { post, book } = await generatePostForBot(id);
    return NextResponse.json({
      ok: true,
      postId: post._id.toString(),
      bookTitle: book.title,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
