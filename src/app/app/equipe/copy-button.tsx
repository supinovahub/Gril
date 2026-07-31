"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import styles from "./team.module.css";

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button className={styles.copyButton} onClick={copy} type="button">
      {copied ? <Check size={15} /> : <Copy size={15} />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}
