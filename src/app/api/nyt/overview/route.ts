import { NextResponse } from "next/server";
import { getNytOverview } from "@/lib/nyt";

// Top 5 books for every NYT bestseller list. The upstream lib caches the NYT
// call (~6h); we also let the CDN cache this proxy response for an hour.
export async function GET() {
  const lists = await getNytOverview();
  return NextResponse.json(
    { lists },
    {
      headers: {
        "Cache-Control":
          "public, s-maxage=21600, stale-while-revalidate=86400",
      },
    }
  );
}
