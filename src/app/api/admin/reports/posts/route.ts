import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import connectDB from "@/lib/db";
import Post from "@/models/Post";
import PostReport from "@/models/PostReport";

type ReportBucket = {
  _id: Types.ObjectId;
  reportCount: number;
  lastReportedAt: Date;
};

export async function GET() {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;

  await connectDB();

  const buckets = (await PostReport.aggregate([
    { $group: { _id: "$post", reportCount: { $sum: 1 }, lastReportedAt: { $max: "$createdAt" } } },
    { $sort: { reportCount: -1, lastReportedAt: -1 } },
    { $limit: 200 },
  ])) as ReportBucket[];

  if (!buckets.length) return NextResponse.json({ items: [] });

  const postIds = buckets.map((b) => b._id);
  const posts = await Post.find({ _id: { $in: postIds } })
    .populate("author", "username name")
    .populate("book", "title slug")
    .select("content image createdAt author book")
    .lean();

  const byId = new Map(posts.map((p) => [(p._id as Types.ObjectId).toString(), p]));
  const items = buckets
    .map((b) => {
      const post = byId.get(b._id.toString());
      if (!post) return null;
      const author = post.author as unknown as { username: string; name?: string };
      const book = post.book as unknown as { title: string; slug?: string };
      return {
        postId: b._id.toString(),
        reportCount: b.reportCount,
        lastReportedAt: b.lastReportedAt,
        post: {
          id: b._id.toString(),
          content: (post.content || "").slice(0, 220),
          image: (post as { image?: string }).image,
          createdAt: (post as { createdAt?: Date }).createdAt?.toISOString() ?? "",
          author: {
            username: author.username,
            name: author.name || author.username,
          },
          book: {
            title: book.title,
            slug: book.slug || "",
          },
        },
      };
    })
    .filter((v): v is NonNullable<typeof v> => Boolean(v));

  return NextResponse.json({ items });
}
