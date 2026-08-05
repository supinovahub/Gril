# Publicação dos controles contextuais do Pedro

- Data: 05/08/2026
- Responsável: Codex na sessão principal do Gril
- Branch/PR: `phase/01-foundation` / PR `#30`
- Commit de código: `50985192eeada0f165e6f0799a2a835e2472fd34`

## Objetivo

Registrar a aplicação externa e a verificação operacional da correção que remove controles por palavra antes da análise contextual do Pedro.

## Estado publicado

- PR `#30` aprovado pelos checks e mesclado na branch padrão.
- Produção `Ready` em `gril-ba388isp4-brio5.vercel.app`, com alias `https://gril-lac.vercel.app`.
- Supabase `frslhzwhaooqtivkzdez` alinhado até `20260805152133_disable_legacy_pre_ai_controls.sql`.
- As funções `apply_inbound_control_intent` e `apply_inbound_control_intent_before_behavior_v3` permanecem no catálogo apenas por histórico e não são executáveis por `service_role`.

## Arthur Rocha

- A conversa corrente já havia avançado quando a publicação terminou, portanto nenhuma mensagem antiga foi reprocessada.
- A conversa foi confirmada como `active`, ownership `ai`, modo `assisted` e sem `pause_reason`.
- Três escaladas falsas de `payment` geradas pela regex antiga foram marcadas como resolvidas.

## Validação

- Checks do PR: GitHub quality, Vercel e Vercel Preview Comments aprovados.
- Local: 18 arquivos e 104 testes, lint e build com 46 rotas aprovados.
- Banco: migrations alinhadas; lint sem erros; privilégios legados consultados como `false`.
- Produção: deployment `Ready`, `/login` respondeu `200` e a consulta de logs recentes não encontrou erros.

## Risco residual

A interpretação semântica continua probabilística. A garantia técnica é que nenhuma palavra isolada aplica efeitos antes da IA; depois da análise, o Pedro ainda deve ser homologado nos cenários contextuais do guia.
