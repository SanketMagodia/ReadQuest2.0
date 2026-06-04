import { NextResponse } from "next/server";
import { getNytList } from "@/lib/nyt";

// The full (~15 book) list for a single category, e.g.
//   /api/nyt/list?name=hardcover-fiction
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name")?.trim() ?? "";
  if (!name) {
    return NextResponse.json({ error: "Missing list name" }, { status: 400 });
  }

  const list = await getNytList(name);
  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  return NextResponse.json(
    { list },
    {
      headers: {
        "Cache-Control":
          "public, s-maxage=21600, stale-while-revalidate=86400",
      },
    }
  );
}
