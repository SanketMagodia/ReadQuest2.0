import { NextResponse } from "next/server";
import { getNytListNames } from "@/lib/nyt";

// All NYT bestseller list names (weekly + monthly), used to build category tabs.
export async function GET() {
  const names = await getNytListNames();
  return NextResponse.json(
    { names },
    {
      headers: {
        "Cache-Control":
          "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
