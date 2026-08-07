# Publicação da correção de slot de call

- Data: 05/08/2026
- Responsável: Codex
- Branch/PR: `agent/fix-call-slot-preservation-published`
- Commit: o commit que contém este arquivo

## Objetivo

Publicar em produção a correção que preserva o horário da call quando o lead escolhe o formato depois do agendamento.

## Antes e depois

- Antes: a correção estava apenas na branch e a produção apontava para o deployment anterior.
- Depois: a branch foi publicada em produção e o alias canônico aponta para o novo deployment.

## Escopo executado

- Arquivos: nenhum arquivo de aplicação adicional; atualização do estado compartilhado e deste registro.
- Migrations: nenhuma nova; a migration de preservação de slot já estava aplicada no Supabase remoto.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: deployment de produção criado na Vercel e alias canônico atualizado.

## Validação

- Comandos/testes executados: verificação da identidade Vercel, deploy `--prod`, inspeção do deployment e requisição HTTP ao alias público.
- Evidência observada: identidade `suporteinovahub-7501`; deployment `gril-ebgsafekr-brio5.vercel.app` com `readyState=READY`; build Next.js concluído; `https://gril-lac.vercel.app/login` respondeu HTTP 200.
- Validações não executadas e motivo: não foi repetida a suíte local completa nesta etapa porque o código já havia passado lint, testes, build e validações do Supabase antes da publicação.

## Impacto operacional

- Deploy necessário: concluído.
- Migração aplicada: não aplicável nesta etapa.
- Compatibilidade/rollback: o deployment anterior permanece disponível na Vercel para rollback operacional.

## Pendências e riscos

- Homologar manualmente o fluxo completo de escolha de formato após horário confirmado no ambiente publicado.

## Documentos relacionados

- Decisões atualizadas: nenhuma.
- Guia de homologação atualizado: não aplicável.
