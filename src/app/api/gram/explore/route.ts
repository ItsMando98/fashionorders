import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/server/auth";
import { exploreGrid } from "@/lib/server/gram";
import { errorResponse } from "@/lib/server/http";

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  try {
    return NextResponse.json({ items: await exploreGrid(user.id) });
  } catch (err) {
    return errorResponse("gram-explore", err);
  }
}
