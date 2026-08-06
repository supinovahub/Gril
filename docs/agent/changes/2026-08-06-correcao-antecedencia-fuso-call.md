# Correção de antecedência mínima e fuso operacional de calls

- Data: 06/08/2026
- Responsável: Codex
- Branch/PR: `agent/fix-call-lead-time-timezone`
- Commit: o commit que contém este arquivo

## Objetivo

Corrigir a oferta de calls com antecedência inferior a uma hora e a exibição de horários em UTC no Inbox/CRM. O fluxo deve respeitar a regra de produto, evitar ofertas prematuras e deixar explícita a escalada silenciosa para o gestor quando um pedido explícito estiver abaixo do limite.

## Antes e depois

- Antes: o worker e a função de disponibilidade começavam a janela em aproximadamente 10 minutos; por isso Pedro podia oferecer 11h30 quando a mensagem era processada às 11h18. A interface também formatava timestamps no fuso do servidor, exibindo UTC.
- Depois: slots oferecidos pelo worker e pela função de banco têm no mínimo uma hora de antecedência, inclusive quando o chamador tenta informar uma janela anterior. Pedido explícito abaixo de uma hora continua seguindo a regra de escalada para o gestor e não inicia ofertas aos corretores. Inbox e CRM exibem datas no fuso da operação, com fallback para `America/Sao_Paulo`.

## Escopo executado

- Arquivos: helper/teste de antecedência; helper de fuso operacional; worker; listas e detalhes de Inbox; detalhe do lead; guia de homologação; estado compartilhado.
- Migrations: `20260806144434_enforce_one_hour_call_lead_time.sql`, substituindo a função de disponibilidade para impor uma hora no banco.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: migration aplicada no projeto Supabase `frslhzwhaooqtivkzdez`; publicação Vercel fica registrada após a confirmação do deployment.

## Validação

- Comandos/testes executados: `npm test`, `npm run lint`, `npm run build`, `git diff --check`, `npx supabase db push --linked --dry-run`, `npx supabase db lint --linked --fail-on error`, `npx supabase db push --linked` e `npx supabase migration list --linked`.
- Evidência observada: 99 testes passaram; lint passou; build passou com 46 rotas; o dry-run mostrou somente a migration nova; o lint do banco não encontrou erros; a função remota contém `interval '1 hour'` e não contém mais `interval '10 minutes'`; uma chamada tentando iniciar em 10 minutos retornou slots cujo primeiro início estava a mais de uma hora.
- Validações não executadas e motivo: homologação visual/manual do Inbox e de uma call real controlada ainda depende de interação humana; os testes pgTAP locais não foram executados porque o Docker não está disponível neste host.

## Impacto operacional

- Deploy necessário: sim, para publicar o worker e os formatadores de horário. A migration já foi aplicada remotamente.
- Migração aplicada: sim, no Supabase remoto único do projeto `frslhzwhaooqtivkzdez`.
- Compatibilidade/rollback: pedidos explícitos abaixo de uma hora continuam compatíveis com a escalada para o gestor. O rollback do código pode usar o deployment anterior; a alteração da função de banco deve ser revertida por uma migration posterior, se necessário.

## Pendências e riscos

- Confirmar manualmente, com lead de teste novo, que a lista oferece apenas horários com pelo menos uma hora e que um pedido abaixo desse limite gera alerta do gestor sem ofertas aos corretores.
- Confirmar visualmente no Inbox e no detalhe do lead que os horários aparecem no fuso configurado da operação.

## Documentos relacionados

- Decisões atualizadas: `docs/decisions/phase-08.md`.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
