import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { memberProfile } from "@/lib/server/gram";
import { errorResponse } from "@/lib/server/http";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ detail: "Sign in to view this page." }, { status: 401 });

  try {
    const { handle } = await params;
    const profile = await memberProfile(handle, user.id);
    if (!profile) return NextResponse.json({ detail: "No user with that page." }, { status: 404 });
    return NextResponse.json({ ...profile, viewer_id: user.id });
  } catch (err) {
    return errorResponse("gram-profile", err);
  }
}
