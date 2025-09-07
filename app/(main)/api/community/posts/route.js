import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { meedCommunityPosts, meedCommunityAttachments, meedCommunityReactions, meedCommunityComments } from "@/lib/schema";
import { desc, eq, inArray } from "drizzle-orm";

export async function GET(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const mine = url.searchParams.get("mine");

    let where = undefined;
    if (userId) where = eq(meedCommunityPosts.userId, Number(userId));
    else if (mine === "1") where = eq(meedCommunityPosts.userId, Number(session.user.id));

    const posts = await db
      .select()
      .from(meedCommunityPosts)
      .where(where)
      .orderBy(desc(meedCommunityPosts.createdAt));
    const ids = posts.map((p) => p.id);
    const atts = ids.length
      ? await db.select().from(meedCommunityAttachments).where(inArray(meedCommunityAttachments.postId, ids))
      : [];
    const reacts = ids.length
      ? await db.select().from(meedCommunityReactions).where(inArray(meedCommunityReactions.postId, ids))
      : [];
    const cmts = ids.length
      ? await db.select().from(meedCommunityComments).where(inArray(meedCommunityComments.postId, ids))
      : [];
    const uid = Number(session.user.id);
    const grouped = posts.map((p) => {
      const a = atts.filter((x) => x.postId === p.id);
      const r = reacts.filter((x) => x.postId === p.id);
      const c = cmts.filter((x) => x.postId === p.id);
      const typeCounts = {};
      const yourTypes = new Set();
      for (const rx of r) {
        const t = String(rx.type || "like");
        typeCounts[t] = (typeCounts[t] || 0) + 1;
        if (Number(rx.userId) === uid) yourTypes.add(t);
      }
      const likeCount = r.length;
      const youLiked = yourTypes.has("like");
      return { ...p, attachments: a, likeCount, youLiked, commentsCount: c.length, reactions: { counts: typeCounts, yours: Array.from(yourTypes) } };
    });
    return NextResponse.json({ posts: grouped }, { status: 200 });
  } catch (e) {
    console.error("community GET error", e);
    return NextResponse.json({ error: "Failed to load posts" }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const { title, content, attachments = [] } = body || {};
    const [post] = await db
      .insert(meedCommunityPosts)
      .values({ userId: Number(session.user.id), title: title || null, content: content || null })
      .returning();
    if (Array.isArray(attachments) && attachments.length) {
      const rows = attachments
        .filter((a) => a && a.url)
        .map((a) => ({ postId: post.id, title: a.title || null, url: a.url, mimeType: a.mimeType || null }));
      if (rows.length) await db.insert(meedCommunityAttachments).values(rows);
    }
    return NextResponse.json({ postId: post.id }, { status: 201 });
  } catch (e) {
    console.error("community POST error", e);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}
