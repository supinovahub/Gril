"use client";

import { useActionState } from "react";
import Image from "next/image";

import { generateUazapiPairingAction, type UazapiPairingState } from "./actions";

const initialState: UazapiPairingState = { status: "idle" };

export function UazapiPairingForm({ className }: { className: string }) {
  const [state, action, pending] = useActionState(generateUazapiPairingAction, initialState);
  return <form action={action} className={className}>
    <div><p>Conectar pelo WhatsApp</p><h2>Gerar QR ou pair code</h2></div>
    <label><span>URL raiz da Uazapi</span><input name="baseUrl" placeholder="https://sua-instancia.uazapi.com" type="url" required /></label>
    <label><span>Token da instância</span><input autoComplete="new-password" name="token" type="password" required /></label>
    <label><span>Telefone com DDI (opcional)</span><input inputMode="tel" name="phone" placeholder="5511999999999" /><small>Preencha para pair code; deixe vazio para QR Code.</small></label>
    <button disabled={pending}>{pending ? "Gerando…" : "Gerar conexão"}</button>
    {state.message ? <p>{state.message}</p> : null}
    {state.pairCode ? <output><strong>{state.pairCode}</strong></output> : null}
    {state.qrImage ? <Image alt="QR Code temporário da instância Uazapi" height={240} src={state.qrImage} unoptimized width={240} /> : null}
    {state.status === "success" ? <small>Depois de conectar, use o formulário “Conectar Uazapi” para validar e salvar a conta.</small> : null}
  </form>;
}
