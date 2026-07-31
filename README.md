# Gril

MVP do sistema operacional imobiliário com o Pedro, implementado a partir dos sete documentos Grill Me versionados em `docs/product`.

## Estado atual

As dez fases locais estão implementadas: identidade e tenancy, CRM, inbox, filas, Pedro, conhecimento, campanhas, calls, operações e hardening do piloto. O banco remoto de desenvolvimento é `frslhzwhaooqtivkzdez`. Não há deploy na Vercel.

Os efeitos que dependem de fornecedores permanecem desativados até existirem credenciais reais: adapter Uazapi/Meta, envio de WhatsApp, worker OpenAI e purge físico do Storage. Consulte `docs/operations/READINESS.md`.

## Requisitos

- Node.js 22 ou superior;
- npm 11 ou superior;
- acesso ao projeto Supabase;
- arquivo `.env.local` baseado em `.env.example`.

As chaves `SUPABASE_SERVICE_ROLE_KEY` e `GRIL_WEBHOOK_INGEST_SECRET` são exclusivamente server-side e nunca podem usar o prefixo `NEXT_PUBLIC_`.

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
