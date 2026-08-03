import { redirect } from "next/navigation";

import { getViewer } from "@/lib/auth/session";

export default async function HomePage() {
  const viewer = await getViewer();
  redirect(viewer ? (viewer.platformRole ? "/platform" : "/app") : "/login");
}
