# Gril

MVP do sistema operacional imobiliário com o Pedro, implementado a partir dos sete documentos Grill Me versionados em `docs/product`.

## Estado atual

As dez fases locais e o autosserviço de integrações estão implementados: identidade e tenancy, CRM, inbox, filas, Pedro, conhecimento, campanhas, calls, operações, hardening do piloto e credenciais por organização. O banco remoto de desenvolvimento é `frslhzwhaooqtivkzdez`. Não há deploy na Vercel.

O dono pode validar, armazenar, retestar, rotacionar e revogar sua Uazapi, Meta Cloud API e chave OpenAI. Os segredos ficam criptografados no Supabase Vault e nunca são reexibidos. Os efeitos externos ainda dependem de homologar os adapters de WhatsApp, o worker OpenAI e o purge físico do Storage. Consulte `docs/operations/READINESS.md`.

## Requisitos

- Node.js 22 ou superior;
- npm 11 ou superior;
- acesso ao projeto Supabase;
- arquivo `.env.local` baseado em `.env.example`.

As chaves `SUPABASE_SERVICE_ROLE_KEY` e `GRIL_WEBHOOK_INGEST_SECRET` são exclusivamente server-side e nunca podem usar o prefixo `NEXT_PUBLIC_`. `META_GRAPH_API_VERSION` seleciona a versão da Graph API e `UAZAPI_ALLOWED_HOSTS` permite, de forma explícita, hosts Uazapi privados fora de `*.uazapi.com`.

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
