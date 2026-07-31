"use client";

import { useActionState } from "react";

import { createUazapiInstanceAction, type UazapiInstanceState } from "./actions";

const initialState: UazapiInstanceState = { status: "idle" };

export function UazapiInstanceForm({ className }: { className: string }) {
  const [state, action, pending] = useActionState(createUazapiInstanceAction, initialState);
  return <form action={action} className={className}><div><p>Criar pelo servidor</p><h2>Nova instância Uazapi</h2></div><label><span>URL raiz da Uazapi</span><input name="baseUrl" placeholder="https://seu-servidor.uazapi.com" type="url" required/></label><label><span>admintoken</span><input autoComplete="new-password" name="adminToken" type="password" required/></label><label><span>Nome da instância</span><input name="name" placeholder="Atendimento imobiliária" required/></label><label><span>Nome exibido no WhatsApp</span><input name="systemName" defaultValue="Pedro" required/></label><button disabled={pending}>{pending?"Criando…":"Criar instância"}</button>{state.message?<p>{state.message}</p>:null}{state.token?<output><small>Token da nova instância</small><strong>{state.token}</strong><small>URL: {state.baseUrl}</small></output>:null}</form>;
}
