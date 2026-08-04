# Estado atual compartilhado do Gril

> Atualizado em 04/08/2026. Este arquivo descreve o estado corrente conhecido; valide fatos mutáveis antes de alterá-los.

## Repositório

- GitHub: `https://github.com/supinovahub/Gril`.
- Branch padrão confirmada: `phase/01-foundation`.
- Último commit de código confirmado neste retrato: `24804c8` (`fix(ai): republish recovered executions`).
- Working tree estava limpa antes da criação desta camada de memória.

## Produção e infraestrutura

- Aplicação: `https://gril-lac.vercel.app`.
- Vercel CLI deve autenticar como `suporteinovahub-7501` pelo perfil isolado `C:\Users\arthu\.vercel-profiles\supinovahub-7501`, conforme registrado no `AGENTS.md` para este host.
- Deployment de produção confirmado como `Ready` em 04/08/2026: `dpl_FNnTMDPjaWgoX5S91ybK6bfSTwPN`.
- Supabase remoto único: projeto `frslhzwhaooqtivkzdez`; não existe staging separado.
- Migrations locais e remotas estavam alinhadas até `20260804180044_republish_requeued_ai_execution.sql`.

## Estado funcional

- O MVP cobre onboarding multi-tenant, CRM, inbox WhatsApp, Pedro, qualificação, imóveis, campanhas, agenda/distribuição, follow-ups, simulador, colaboração interna, curadoria e administração da plataforma.
- Uazapi, OpenAI e worker foram conectados ao fluxo real; a homologação operacional pelo dono continua em andamento.
- Pedro deve permanecer em `shadow` ou `assisted` nos atendimentos normais enquanto o comportamento não for integralmente homologado. O modo `production` tem liberação controlada conforme as decisões do produto.
- O roteiro humano canônico é `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
- Regras comportamentais do Pedro estão resumidas em `docs/operations/PEDRO_BEHAVIOR_TRACEABILITY.md` e detalhadas nos documentos de produto/decisão.

## Últimas correções comprovadas

- O inbox recebe e exibe conversas reais da Uazapi.
- Execuções recuperadas do Pedro republicam o evento necessário para o worker.
- O nudge após envio de material não reenvia PDFs.
- Pedido de disponibilidade usa horários aprovados e não cria handoff indevido quando existem slots válidos.
- O lead de teste Arthur Rocha foi removido do banco em 04/08/2026 para reiniciar a homologação; não permaneceu fingerprint de supressão para o telefone utilizado.

## Verificações deste retrato

- `npm test`: 19 arquivos e 108 testes aprovados em 04/08/2026.
- Migrações Supabase: local e remoto alinhados até a versão indicada acima.
- Vercel: alias de produção respondendo por deployment `Ready`.

## Pendências operacionais

- Continuar a homologação manual dos fluxos descritos no guia, especialmente comportamento do Pedro, agendamento, distribuição, reativação e integrações reais.
- Registrar cada novo defeito com esperado, observado, lead/canal, horário e IDs técnicos quando disponíveis.
- Atualizar este arquivo após qualquer alteração de deployment, migration, conta/projeto ou conclusão material de homologação.

## Protocolo compartilhado

- Todo novo Codex deve iniciar na raiz do repositório e seguir `docs/agent/ONBOARDING_PROMPTS.md`.
- Correções funcionais devem comparar os sete documentos originais, decisões posteriores, implementação atual e comportamento observado.
- Bug técnico inequívoco pode ser corrigido diretamente quando autorizado; lacuna ou mudança de produto exige discussão e aprovação antes da implementação.

## Limites desta fonte

Este documento não substitui:

- o banco para estado transacional;
- Git/GitHub para código e autoria;
- Vercel para estado de deployment;
- os sete documentos de produto para regras consolidadas;
- os registros em `changes/` para histórico detalhado.
