import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";

export async function requireAdmin() {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return {
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as const;
  }
  if (session.user.role !== "admin") {
    return {
      session,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    } as const;
  }
  return { session, response: null } as const;
}
