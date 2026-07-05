import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import { clearUnread, loadConversationForViewer } from "@/lib/dm";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const conv = await loadConversationForViewer(id, session.user.id);
  if (!conv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await clearUnread(id, session.user.id);
  return NextResponse.json({ ok: true });
}
