"use client";

import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";
import {
  claimMessageNotification,
  isMessageSoundEnabled,
  NAVIGATION_COUNTS_REFRESH_EVENT,
  parseInboundMessageRecord,
} from "./browser-message-notification-policy";
import { armIncomingMessageSound, playIncomingMessageSound } from "./incoming-message-sound";

function requestNavigationCountsRefresh() {
  window.dispatchEvent(new Event(NAVIGATION_COUNTS_REFRESH_EVENT));
}

export function BrowserMessageNotifications({ orgId }: { orgId: string }) {
  useEffect(() => {
    const supabase = createClient();
    const armSoundAfterInteraction = () => {
      if (isMessageSoundEnabled(window.localStorage)) void armIncomingMessageSound();
    };
    const notifyInboundMessage = async (record: unknown) => {
      requestNavigationCountsRefresh();

      const message = parseInboundMessageRecord(record);
      if (!message || !isMessageSoundEnabled(window.localStorage)) return;

      const playClaimedSound = async () => {
        if (!claimMessageNotification(window.localStorage, message.id)) return;
        await playIncomingMessageSound();
      };

      if (navigator.locks) {
        await navigator.locks.request(`gril:message-sound:${message.id}`, playClaimedSound);
        return;
      }

      await playClaimedSound();
    };
    const channel = supabase
      .channel(`browser-message-notifications:${orgId}`, {
        config: { broadcast: { replication_ready: true } },
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `org_id=eq.${orgId}` },
        (payload) => void notifyInboundMessage(payload.new),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ai_suggestions", filter: `org_id=eq.${orgId}` },
        requestNavigationCountsRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_read_states", filter: `org_id=eq.${orgId}` },
        requestNavigationCountsRefresh,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") requestNavigationCountsRefresh();
      });

    window.addEventListener("pointerdown", armSoundAfterInteraction, { once: true });
    window.addEventListener("keydown", armSoundAfterInteraction, { once: true });

    return () => {
      window.removeEventListener("pointerdown", armSoundAfterInteraction);
      window.removeEventListener("keydown", armSoundAfterInteraction);
      void supabase.removeChannel(channel);
    };
  }, [orgId]);

  return null;
}
