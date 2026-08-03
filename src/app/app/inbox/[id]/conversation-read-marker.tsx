"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { markConversationReadAction } from "../actions";

export function ConversationReadMarker({ conversationId }: { conversationId: string }) {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    void markConversationReadAction(conversationId).then((marked) => {
      if (active && marked) router.refresh();
    });

    return () => {
      active = false;
    };
  }, [conversationId, router]);

  return null;
}
