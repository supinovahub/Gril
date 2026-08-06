# Correção de caracteres especiais na importação de campanhas

- Data: 06/08/2026
- Responsável: Codex
- Branch/PR: `fix/campaign-csv-encoding`
- Commit: o commit que contém este arquivo

## Objetivo

Impedir que nomes com acentos de bases CSV sejam gravados como U+FFFD (`�`) e corrigir as cópias históricas afetadas no contexto das campanhas.

## Antes e depois

- Antes: o navegador/servidor usava `File.text()`, tratando todo arquivo como UTF-8. CSVs Windows-1252/ANSI convertiam bytes de acentos em `�` antes de chegar ao banco.
- Depois: o importador tenta UTF-8 estrito, aceita Windows-1252/ANSI como fallback e UTF-16 com BOM; entradas que ainda contêm U+FFFD são recusadas com orientação clara.

## Escopo executado

- Arquivos: `src/lib/campaigns/csv.ts`, `src/lib/campaigns/csv.test.ts`, `src/app/app/campanhas/actions.ts`, `src/app/app/campanhas/page.tsx`, este registro, `CURRENT_STATE.md` e o guia de homologação.
- Migrations: nenhuma nova migration foi criada ou aplicada.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: os registros históricos encontrados com U+FFFD foram corrigidos no projeto Supabase canônico, incluindo nomes de contatos e cópias derivadas de importação/campanha. Nenhum outro contato foi alterado.

## Validação

- Comandos/testes executados: `npx supabase migration list --linked`, consulta de diagnóstico no Supabase, `npm test -- --run src/lib/campaigns/csv.test.ts`, `npm run lint -- --ignore-pattern .vercel/output`.
- Evidência observada: os testes do parser passaram (5/5), o lint passou e a consulta final não encontrou U+FFFD em `contacts.name`, `campaign_import_rows`, `campaign_import_requests`, `campaign_contacts.campaign_first_name` ou `campaigns.opening_examples`.
- Validações não executadas e motivo: suíte/build completos e deploy ainda dependem da conclusão da documentação e do commit; homologação visual com arquivo real UTF-8 e Windows-1252 continua pendente.

## Impacto operacional

- Deploy necessário: sim, para que novos imports usem a decodificação corrigida.
- Migração aplicada: não.
- Compatibilidade/rollback: CSVs UTF-8 continuam funcionando; CSVs Windows-1252/ANSI passam a ser aceitos. O rollback de código restauraria o risco de corromper novos imports; os dados históricos corrigidos não devem ser revertidos.

## Pendências e riscos

- O remoto registra a migration `20260806171000` (`campaign_first_name`), mas não há arquivo correspondente nesta branch; a divergência precisa ser reconciliada separadamente antes de novas migrations.
- Homologar manualmente a importação em produção com os dois formatos de arquivo e verificar a mensagem bloqueando U+FFFD.

## Documentos relacionados

- Decisões atualizadas: nenhuma; trata-se de correção técnica compatível com a regra existente de importação.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
