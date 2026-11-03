import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { activeStories, myItems, myLooks, myPosts, myReels, networkFeed, personById, unreadNotifications } from "@/lib/server/gram";
import { errorResponse } from "@/lib/server/http";

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  try {
    const me = await personById(user.id);
    return NextResponse.json({
      me,
      items: await myItems(user.id),
      posts: await myPosts(user.id),
      looks: await myLooks(user.id),
      reels: await myReels(user.id),
      feed: await networkFeed(user.id),
      stories: await activeStories(user.id),
      unread: await unreadNotifications(user.id),
    });
  } catch (err) {
    return errorResponse("gram-studio", err);
  }
}
