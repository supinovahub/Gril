# Gril

MVP do sistema operacional imobiliário com o Pedro, implementado a partir dos sete documentos Grill Me versionados em `docs/product`.

## Estado atual

As doze fases estão implementadas: identidade e tenancy, CRM, inbox, filas, Pedro, conhecimento, campanhas, calls, operações, hardening do piloto, credenciais por organização e execução real dos adapters/workers. O banco remoto de desenvolvimento é `frslhzwhaooqtivkzdez`. Ainda não há deploy na Vercel.

O dono pode validar, armazenar, retestar, rotacionar e revogar sua Uazapi, Meta Cloud API e chave OpenAI. Os segredos ficam criptografados no Supabase Vault e nunca são reexibidos. Webhooks nativos, recibos, envio real, Responses API, filas, jobs e purge físico do Storage estão implementados; o que falta para declarar operação real é publicar a URL HTTPS e homologar uma credencial/número reais. Consulte `docs/operations/READINESS.md`.

## Requisitos

- Node.js 22 ou superior;
- npm 11 ou superior;
- acesso ao projeto Supabase;
- arquivo `.env.local` baseado em `.env.example`.

As chaves `SUPABASE_SERVICE_ROLE_KEY`, `GRIL_WEBHOOK_INGEST_SECRET` e `GRIL_WORKER_SECRET` são exclusivamente server-side e nunca podem usar o prefixo `NEXT_PUBLIC_`. `META_GRAPH_API_VERSION` seleciona a versão da Graph API e `UAZAPI_ALLOWED_HOSTS` permite, de forma explícita, hosts Uazapi privados fora de `*.uazapi.com`.

## Executar em localhost

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`. Se a porta já estiver ocupada, o Next.js escolherá outra e mostrará o endereço no terminal.

## Verificações não visuais

```bash
npm run lint
npm test
npm run build
```

## Estrutura

- `src/app`: rotas e telas do App Router;
- `src/lib`: autenticação, Supabase e políticas de domínio;
- `supabase/migrations`: schema, RLS, comandos atômicos e eventos;
- `supabase/tests`: gates SQL documentados por fase;
- `docs/decisions`: decisões e evidências de cada fase;
- `docs/operations`: checklist, runbooks e bloqueios do piloto.

Toda alteração de banco deve nascer como migração local, ser aplicada ao projeto remoto de desenvolvimento e terminar com tipos TypeScript regenerados.
