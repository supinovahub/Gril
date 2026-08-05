# Ações explícitas do Pedro como fonte de verdade

- Data: 05/08/2026
- Responsável: Codex na sessão principal do Gril
- Branch/PR: `fix/pedro-explicit-actions-source-of-truth` / PR pendente
- Commit: o commit que contém este arquivo

## Objetivo

Impedir que worker ou banco substituam a decisão contextual do Pedro, incluindo o incidente em que um pedido de um book enviou três PDFs.

## Antes e depois

- Antes: o worker reinterpretava a mensagem por regex, escolhia até três imóveis e o executor de mídia percorria `recommended_project_ids`; outras rotas podiam reescrever texto ou reutilizar ações após edição humana.
- Depois: Pedro declara projetos e mídias exatos; gates técnicos aceitam ou bloqueiam o plano, e qualquer mutação semântica causa rollback.

## Escopo executado

- Arquivos: schema/instruções do Pedro, worker, runtime OpenAI, testes, decisão, rastreabilidade e guia de homologação.
- Migration: `20260805160806_pedro_explicit_actions_source_of_truth.sql`.
- Mudanças externas: migration aplicada no Supabase `frslhzwhaooqtivkzdez`; publicação Vercel pendente neste registro inicial.

## Validação

- Comandos/testes executados: testes Vitest direcionados, lint, build, dry-run e push da migration, consultas às definições remotas e pgTAP por `supabase db query --linked`.
- Evidência observada: schema estrito e 26 testes direcionados aprovados; build aprovado; migration alinhada; consultas remotas confirmaram mídia exata, ausência de expansão por recomendações, guarda de mutação e invalidação após edição humana.
- Validações não executadas e motivo: `supabase test db --linked` depende do Docker local desligado; os mesmos arquivos pgTAP foram executados pela Management API. Homologação real no WhatsApp permanece humana.

## Impacto operacional

- Deploy necessário: sim.
- Migração aplicada: sim, aditiva e com wrappers transacionais.
- Compatibilidade/rollback: sugestões antigas com `project_media_request` singular continuam executando somente o pedido singular; rollback de código exige restaurar as funções anteriores antes de remover as colunas aditivas.

## Pendências e riscos

- Publicar o worker e homologar um novo pedido de book específico.
- Três asserções históricas do arquivo `phase_25_pedro_behavior_v3.sql` já estavam desatualizadas (pacote publicado v4 e texto de cadência); não pertencem a esta correção. O novo arquivo `phase_31` passou integralmente.

## Documentos relacionados

- Decisão atualizada: `docs/decisions/pedro-explicit-actions-source-of-truth.md`.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
