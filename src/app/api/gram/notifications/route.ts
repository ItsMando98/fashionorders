import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { markNotificationsRead, notificationsFor, unreadNotifications } from "@/lib/server/gram";
import { errorResponse } from "@/lib/server/http";

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  try {
    return NextResponse.json({
      notifications: await notificationsFor(user.id),
      unread: await unreadNotifications(user.id),
    });
  } catch (err) {
    return errorResponse("gram-notifications", err);
  }
}

export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  try {
    await markNotificationsRead(user.id);
    return NextResponse.json({ ok: true, unread: 0 });
  } catch (err) {
    return errorResponse("gram-notifications", err);
  }
}
