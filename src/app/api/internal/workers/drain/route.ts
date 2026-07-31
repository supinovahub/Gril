import { NextResponse } from "next/server";

import { drainRuntimeWorker } from "@/lib/runtime/worker";
import { verifyWorkerAuthorization } from "@/lib/webhooks/security";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!verifyWorkerAuthorization(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await drainRuntimeWorker();
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "worker_failed" }, { status: 500 });
  }
}
