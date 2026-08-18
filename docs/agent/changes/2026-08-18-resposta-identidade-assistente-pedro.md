# Resposta de identidade como assistente do Pedro

- Data: 18/08/2026
- Responsável: Codex
- Branch/PR: `fix/pedro-assistant-identity` / PR #64
- Commit: o commit que contém este arquivo

## Objetivo

Evitar que o atendimento pare na primeira pergunta sobre IA, respondendo de forma curta e descontraída como assistente do Pedro Sifuentes e preservando a escalação humana quando houver insistência.

## Antes e depois

- Antes: qualquer pergunta direta sobre identidade da IA era listada entre as causas imediatas de escalação, então o turno podia terminar sem resposta ao lead.
- Depois: a primeira pergunta exige `outcome=reply` e uma apresentação curta como assistente; uma pergunta posterior que insista no mesmo ponto exige `outcome=escalate`, categoria `identity_question`, sem resposta automática.

## Escopo executado

- Arquivos: compilador e teste das instruções do Pedro; decisão de produto; rastreabilidade; fluxos e guia de homologação; estado compartilhado e este registro.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: o PR #64 foi mergeado em `phase/01-foundation` no commit `66fb26ef984b7b187a61d4a12ada8b7977cd3f3e`; a integração Vercel publicou o deployment de produção `dpl_Dc8crJygSyq3WiuCsbb9g9FKgcUS`, `READY`, com o alias `https://gril-lac.vercel.app`. Supabase e schema não foram alterados.

## Validação

- Comandos/testes executados: `npm ci`; teste direcionado de `pedro-instructions`; `npm run lint`; `npm test`; `npm run build` com as variáveis locais carregadas somente no processo; `npm audit --omit=dev`; `git diff --check`; checks de CI e preview do PR; inspeção Vercel; smokes HTTP; consulta de logs de erro; consulta somente leitura do modo inbound e da whitelist.
- Evidência observada: lint sem erro; 24 arquivos e 117 testes passaram; o build Next.js 16.2.12 compilou, validou TypeScript e gerou 46 rotas. O teste unitário exige o marcador `GRIL_BEHAVIOR_V5`, a apresentação como assistente, a proibição de afirmar ser o próprio Pedro ou negar ser IA e a escalação somente após insistência. O deployment canônico ficou `READY`; `/login` respondeu HTTP 200, `/app/pedro` respondeu HTTP 307 para o login e nenhum erro apareceu nos logs consultados. O inbound permaneceu em `production`, com exatamente uma entrada ativa na whitelist.
- Validações não executadas e motivo: o cenário de dois turnos com o modelo real e uma conversa de WhatsApp permanece para homologação pós-deploy, pois executá-lo automaticamente enviaria ou registraria uma interação operacional além do smoke técnico autorizado.

## Impacto operacional

- Deploy necessário: executado em produção pelo merge canônico.
- Migração aplicada: não.
- Compatibilidade/rollback: reversível por deploy do commit anterior; schemas, banco e conversas persistidas permanecem compatíveis.

## Pendências e riscos

- A formulação é uma instrução de modelo, não um interceptador lexical. A homologação deve provar o comportamento em conversa de dois turnos com o modelo real.
- `npm audit --omit=dev` encontrou uma vulnerabilidade alta preexistente em `nanoid@3.3.16`, dependência transitiva de `postcss` via Next.js. Esta mudança não altera dependências; a atualização deve ser tratada separadamente para não ampliar o escopo funcional.

## Documentos relacionados

- Decisões atualizadas: `docs/decisions/2026-08-18-identidade-assistente-pedro.md`.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md` e `docs/operations/MVP_VALIDATION_FLOWS.md`.
