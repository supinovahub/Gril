# Gril

MVP do sistema operacional imobiliário com o Pedro, construído a partir do pacote técnico Grill Me versionado em `docs/product`.

## Estado atual

Fase 1 concluída para validação local: autenticação, perfis, organizações, operações, papéis, convites, aprovação, RLS multi-tenant e auditoria mínima. Não há deploy na Vercel nesta fase.

## Requisitos

- Node.js 22 ou superior
- npm 11 ou superior
- acesso ao projeto Supabase configurado no `.env.local`

## Executar

```bash
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Verificações

```bash
npm run lint
npm test
npm run build
```

As migrações ficam em `supabase/migrations`. O projeto remoto usado durante o MVP é `frslhzwhaooqtivkzdez`; trate todos os dados nele como dados de desenvolvimento até a aprovação final.
