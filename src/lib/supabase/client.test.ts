import { beforeEach, describe, expect, it, vi } from "vitest";

const { createBrowserClient } = vi.hoisted(() => ({
  createBrowserClient: vi.fn(() => ({ kind: "browser-client" })),
}));

vi.mock("@supabase/ssr", () => ({ createBrowserClient }));
vi.mock("@/lib/supabase/env", () => ({
  supabaseEnv: {
    publishableKey: "publishable-key",
    url: "https://example.supabase.co",
  },
}));

import { createClient } from "./client";

describe("browser Supabase client", () => {
  beforeEach(() => {
    createBrowserClient.mockClear();
  });

  it("keeps Realtime heartbeats in a worker for background tabs", () => {
    expect(createClient()).toEqual({ kind: "browser-client" });
    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "publishable-key",
      {
        realtime: {
          worker: true,
        },
      },
    );
  });
});
