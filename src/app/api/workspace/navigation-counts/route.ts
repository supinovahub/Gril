import { NextResponse } from "next/server";

import { requireActiveViewer } from "@/lib/auth/session";
import { getWorkspaceNavigationCounts } from "@/lib/navigation/counts";

export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await requireActiveViewer();
  const counts = await getWorkspaceNavigationCounts(viewer.organization!.id);

  return NextResponse.json(counts, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
