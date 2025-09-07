import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { meedCommunityReactions, meedCommunityPosts } from "@/lib/schema";
import { createNotifications } from "@/lib/notify";
import { and, eq } from "drizzle-orm";

export async function POST(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { postId, action = "toggle", type = "like" } = await req.json();
    if (!postId) return NextResponse.json({ error: "postId required" }, { status: 400 });
    const where = and(eq(meedCommunityReactions.postId, Number(postId)), eq(meedCommunityReactions.userId, Number(session.user.id)), eq(meedCommunityReactions.type, String(type)));
    const existing = await db.select({ id: meedCommunityReactions.id }).from(meedCommunityReactions).where(where);
    if (existing.length) {
      if (action !== "like") {
        await db.delete(meedCommunityReactions).where(eq(meedCommunityReactions.id, existing[0].id));
        return NextResponse.json({ reacted: false });
      }
      return NextResponse.json({ reacted: true });
    } else {
      if (action !== "unlike") {
        await db.insert(meedCommunityReactions).values({ postId: Number(postId), userId: Number(session.user.id), type: String(type) });
        // Notify post author on like (not for self)
        try {
          const [post] = await db.select({ userId: meedCommunityPosts.userId }).from(meedCommunityPosts).where(eq(meedCommunityPosts.id, Number(postId)));
          const authorId = Number(post?.userId);
          if (authorId && authorId !== Number(session.user.id)) {
            await createNotifications({
              recipients: [authorId],
              type: "community_like",
              title: "New reaction on your post",
              body: `Someone reacted ${String(type)} to your post`,
              entityKind: "community_post",
              entityId: Number(postId),
            });
          }
        } catch {}
        return NextResponse.json({ reacted: true });
      }
      return NextResponse.json({ reacted: false });
    }
  } catch (e) {
    console.error("react error", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
