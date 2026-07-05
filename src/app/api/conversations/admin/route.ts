import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import { getAdminContact } from "@/lib/dm";

/** Site admin contact for the chat inbox (messageable without friending). */
export async function GET() {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await getAdminContact();
  if (!admin) {
    return NextResponse.json({ error: "Admin account not configured" }, { status: 404 });
  }

  return NextResponse.json({ admin });
}
