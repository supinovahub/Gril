# Tom da identidade e coerência do horário da call

- Data: 18/08/2026
- Responsável: Codex
- Branch/PR: `fix/pedro-tone-call-slot-consistency` / PR a abrir
- Commit: o commit que contém este arquivo

## Objetivo

Tornar descontraída a apresentação do assistente quando já existe rapport e impedir que o texto enviado ao lead e a ação estruturada da call representem horários locais diferentes.

## Antes e depois

- Antes: a primeira pergunta casual sobre IA podia receber a formulação seca `Sou o assistente do Pedro Sifuentes, corretor imobiliário.`; em um agendamento observado, o texto disse 10h, mas `call_request.starts_at` representou 13h em `America/Sao_Paulo`, e o backend aceitou porque 13h também era um slot disponível.
- Depois: o pacote `GRIL_BEHAVIOR_V6` prefere risada curta e apresentação leve depois de rapport; cada slot chega ao modelo com o instante canônico e seu rótulo local, e o worker bloqueia e pede uma nova decisão quando uma separação é anunciada sem `call_request` ou quando texto e ação divergem no horário da operação.

## Escopo executado

- Arquivos: instruções e schema estruturado do Pedro, validação temporal do worker, testes unitários, decisão de produto, rastreabilidade, fluxos e guia de homologação, estado compartilhado e este registro.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: Supabase consultado somente para diagnóstico do turno observado; nenhum dado, schema ou estado remoto foi alterado nesta implementação. Branch e PR serão registrados na publicação.

## Validação

- Comandos/testes executados: `npm ci`; teste direcionado de `pedro-turn` e `pedro-instructions`; ESLint direcionado; `npm run lint`; `npm test`; `npm run build` com as variáveis locais carregadas somente no processo; `git diff --check` antes da publicação.
- Evidência observada: 14 testes direcionados passaram, incluindo a reprodução de texto `10h` com ação equivalente a 13h local, a promessa de slot sem ação e o rótulo 10h para `2026-08-19T13:00:00Z` em `America/Sao_Paulo`; lint completo passou; 24 arquivos e 120 testes passaram; o build Next.js 16.2.12 compilou, validou TypeScript e gerou 46 rotas.
- Validações não executadas e motivo: o cenário real de WhatsApp ficará para homologação manual após publicação; não será criado outro agendamento real durante a implementação.

## Impacto operacional

- Deploy necessário: sim, porque o compilador de instruções e o worker mudam no runtime da aplicação.
- Migração aplicada: não.
- Compatibilidade/rollback: schema e registros existentes permanecem compatíveis; rollback é o deploy do commit anterior. A call incorreta já criada no caso observado não é alterada retroativamente.

## Pendências e riscos

- Homologar em conversa nova a pergunta casual sobre IA depois de rapport e confirmar uma variação leve.
- Escolher um horário, definir telefone ou vídeo no turno seguinte e provar que texto, call, oferta interna e confirmação usam a mesma hora da operação.
- `npm ci` reportou duas vulnerabilidades altas em dependências já travadas; esta mudança não altera `package.json` nem `package-lock.json`, e a atualização deve permanecer fora deste escopo funcional.

## Documentos relacionados

- Decisões atualizadas: `docs/decisions/2026-08-18-tom-leve-identidade-assistente-pedro.md`.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md` e `docs/operations/MVP_VALIDATION_FLOWS.md`.
