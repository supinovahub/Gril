"use client";

import { BellRing } from "lucide-react";
import { useState } from "react";

import { registerPlatformPushSubscriptionAction } from "./actions";

function decodeKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function PlatformPushSubscription({ publicKey }: { publicKey: string }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function activate() {
    if (!publicKey) { setMessage("Chave push não configurada."); return; }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) { setMessage("Este navegador não suporta push."); return; }
    setPending(true);
    try {
      if (await Notification.requestPermission() !== "granted") { setMessage("Permissão de notificação não concedida."); return; }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(publicKey) });
      const raw = subscription.toJSON();
      if (!raw.endpoint || !raw.keys?.p256dh || !raw.keys.auth) throw new Error("subscription_incomplete");
      const result = await registerPlatformPushSubscriptionAction({ endpoint: raw.endpoint, keys: raw.keys, userAgent: navigator.userAgent });
      setMessage(result.message);
    } catch { setMessage("Não foi possível ativar o push neste navegador."); }
    finally { setPending(false); }
  }
  return <div><button disabled={pending} onClick={activate} type="button"><BellRing size={14} /> {pending ? "Ativando…" : "Ativar push administrativo"}</button>{message ? <small>{message}</small> : null}</div>;
}
