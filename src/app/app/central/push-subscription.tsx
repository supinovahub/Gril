"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";

import { registerPushSubscriptionAction } from "./actions";
import styles from "./central.module.css";

function decodeKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

export function PushSubscription({ publicKey }: { publicKey: string }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function activate() {
    if (!publicKey) {
      setMessage("As notificações serão habilitadas quando a chave push estiver configurada.");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setMessage("Este navegador não oferece notificações push.");
      return;
    }

    setPending(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("A permissão de notificações não foi concedida.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeKey(publicKey),
      });
      const raw = subscription.toJSON();
      if (!raw.endpoint || !raw.keys?.p256dh || !raw.keys.auth) throw new Error("subscription_incomplete");
      const result = await registerPushSubscriptionAction({
        endpoint: raw.endpoint,
        keys: raw.keys,
        userAgent: navigator.userAgent,
      });
      setMessage(result.message);
    } catch {
      setMessage("Não foi possível ativar as notificações neste navegador.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.pushControl}>
      <button className={styles.pushButton} disabled={pending} onClick={activate} type="button">
        <BellRing aria-hidden="true" size={15} />
        {pending ? "Ativando..." : "Notificações"}
      </button>
      {message ? <small aria-live="polite">{message}</small> : null}
    </div>
  );
}
