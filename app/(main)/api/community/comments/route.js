import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { meedCommunityComments, users, meedCommunityPosts } from "@/lib/schema";
import { createNotifications } from "@/lib/notify";
import { and, desc, eq } from "drizzle-orm";

export async function GET(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const url = new URL(req.url);
    const postId = Number(url.searchParams.get("postId"));
    if (!postId) return NextResponse.json({ error: "postId required" }, { status: 400 });
    const rows = await db
      .select({ id: meedCommunityComments.id, postId: meedCommunityComments.postId, userId: meedCommunityComments.userId, content: meedCommunityComments.content, createdAt: meedCommunityComments.createdAt, name: users.name, image: users.image })
      .from(meedCommunityComments)
      .leftJoin(users, eq(users.id, meedCommunityComments.userId))
      .where(eq(meedCommunityComments.postId, postId))
      .orderBy(desc(meedCommunityComments.createdAt));
    return NextResponse.json({ comments: rows }, { status: 200 });
  } catch (e) {
    console.error("comments GET", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { postId, content } = await req.json();
    if (!postId || !content) return NextResponse.json({ error: "postId and content required" }, { status: 400 });
    await db.insert(meedCommunityComments).values({ postId: Number(postId), userId: Number(session.user.id), content: String(content).trim() });
    try {
      const [post] = await db.select({ userId: meedCommunityPosts.userId, title: meedCommunityPosts.title }).from(meedCommunityPosts).where(eq(meedCommunityPosts.id, Number(postId)));
      const authorId = Number(post?.userId);
      if (authorId && authorId !== Number(session.user.id)) {
        await createNotifications({
          recipients: [authorId],
          type: "community_comment",
          title: "New comment on your post",
          body: String(content).slice(0, 140),
          entityKind: "community_post",
          entityId: Number(postId),
        });
      }
    } catch {}
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    console.error("comments POST", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
