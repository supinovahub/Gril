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
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: branch publicada e PR draft #64 aberto contra `phase/01-foundation`; Supabase e schema não exigem alteração. O deploy Vercel será registrado após a integração canônica.

## Validação

- Comandos/testes executados: `npm ci`; teste direcionado de `pedro-instructions`; `npm run lint`; `npm test`; `npm run build` com as variáveis locais carregadas somente no processo; `npm audit --omit=dev`; `git diff --check`.
- Evidência observada: lint sem erro; 24 arquivos e 117 testes passaram; o build Next.js 16.2.12 compilou, validou TypeScript e gerou 46 rotas. O teste unitário exige o marcador `GRIL_BEHAVIOR_V5`, a apresentação como assistente, a proibição de afirmar ser o próprio Pedro ou negar ser IA e a escalação somente após insistência.
- Validações não executadas e motivo: o cenário de dois turnos com o modelo real e uma conversa de WhatsApp será validado depois do deploy para não criar efeito externo antes da publicação aprovada.

## Impacto operacional

- Deploy necessário: sim, porque o worker compila essas instruções no runtime da aplicação.
- Migração aplicada: não.
- Compatibilidade/rollback: reversível por deploy do commit anterior; schemas, banco e conversas persistidas permanecem compatíveis.

## Pendências e riscos

- A formulação é uma instrução de modelo, não um interceptador lexical. A homologação deve provar o comportamento em conversa de dois turnos com o modelo real.
- `npm audit --omit=dev` encontrou uma vulnerabilidade alta preexistente em `nanoid@3.3.16`, dependência transitiva de `postcss` via Next.js. Esta mudança não altera dependências; a atualização deve ser tratada separadamente para não ampliar o escopo funcional.

## Documentos relacionados

- Decisões atualizadas: `docs/decisions/2026-08-18-identidade-assistente-pedro.md`.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md` e `docs/operations/MVP_VALIDATION_FLOWS.md`.
