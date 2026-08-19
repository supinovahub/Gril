"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";

import {
  isMessageSoundEnabled,
  MESSAGE_SOUND_SETTING_EVENT,
  MESSAGE_SOUND_STORAGE_KEY,
  setMessageSoundEnabled,
} from "./browser-message-notification-policy";
import { armIncomingMessageSound } from "./incoming-message-sound";
import styles from "./app-shell.module.css";

export function MessageSoundToggle() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const syncSetting = () => setEnabled(isMessageSoundEnabled(window.localStorage));
    const syncSettingFromOtherTab = (event: StorageEvent) => {
      if (event.key === MESSAGE_SOUND_STORAGE_KEY) syncSetting();
    };

    syncSetting();
    window.addEventListener(MESSAGE_SOUND_SETTING_EVENT, syncSetting);
    window.addEventListener("storage", syncSettingFromOtherTab);
    return () => {
      window.removeEventListener(MESSAGE_SOUND_SETTING_EVENT, syncSetting);
      window.removeEventListener("storage", syncSettingFromOtherTab);
    };
  }, []);

  const toggleSound = () => {
    const nextEnabled = !enabled;
    setMessageSoundEnabled(window.localStorage, nextEnabled);
    setEnabled(nextEnabled);
    window.dispatchEvent(new Event(MESSAGE_SOUND_SETTING_EVENT));
    if (nextEnabled) void armIncomingMessageSound();
  };

  const label = enabled ? "Silenciar som de novas mensagens" : "Ativar som de novas mensagens";

  return (
    <button
      aria-pressed={enabled}
      className={`${styles.iconButton} ${styles.soundButton}`}
      onClick={toggleSound}
      title={label}
      type="button"
    >
      {enabled ? <Volume2 aria-hidden="true" size={16} /> : <VolumeX aria-hidden="true" size={16} />}
      <span className="srOnly">{label}</span>
    </button>
  );
}
