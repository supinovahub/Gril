import "server-only";

const SLOW_SERVER_TASK_MS = 250;

export async function measureServerTask<T>(
  name: string,
  task: () => PromiseLike<T>,
  options: { alwaysLog?: boolean } = {},
): Promise<T> {
  const startedAt = performance.now();
  let outcome: "ok" | "error" = "ok";

  try {
    return await task();
  } catch (error) {
    outcome = "error";
    throw error;
  } finally {
    const durationMs = Math.round(performance.now() - startedAt);
    if (options.alwaysLog || durationMs >= SLOW_SERVER_TASK_MS || outcome === "error") {
      console.info("server_task_timing", {
        durationMs,
        name,
        outcome,
      });
    }
  }
}
