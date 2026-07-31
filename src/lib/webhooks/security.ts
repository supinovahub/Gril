import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

export function verifyWebhookSecret(received: string | null) {
  const expected = process.env.GRIL_WEBHOOK_INGEST_SECRET;
  if (!expected || !received) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyWorkerAuthorization(received: string | null) {
  const expected = process.env.GRIL_WORKER_SECRET;
  const token = received?.startsWith("Bearer ") ? received.slice(7) : null;
  if (!expected || !token) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(token);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function readBodyWithinLimit(
  request: Request,
  limit = 1_000_000,
) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > limit) return null;

  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}
