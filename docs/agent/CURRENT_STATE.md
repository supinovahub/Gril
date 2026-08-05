# Estado atual compartilhado do Gril

> Atualizado em 05/08/2026. Este arquivo descreve o estado corrente conhecido; valide fatos mutáveis antes de alterá-los.

## Repositório

- GitHub: `https://github.com/supinovahub/Gril`.
- Branch padrão confirmada: `phase/01-foundation`.
- Último commit de código publicado em produção neste retrato: `fcc2060` (`fix(pedro): drive material delivery from structured action`), na branch `fix/project-book-delivery`.
- Working tree estava limpa antes da criação desta camada de memória.

## Produção e infraestrutura

- Aplicação: `https://gril-lac.vercel.app`.
- Vercel CLI deve autenticar como `suporteinovahub-7501` pelo perfil explícito registrado no `AGENTS.md`.
- Deployment de produção confirmado como `Ready` em 05/08/2026: `gril-bhqebkit6-brio5.vercel.app` (`dpl_A1SjNHC5vfDqLxC75nyJAPXG9aAg`), com alias `https://gril-lac.vercel.app`, contendo o commit `fcc2060`.
- Supabase remoto único: projeto `frslhzwhaooqtivkzdez`; não existe staging separado.
- Migrations locais e remotas estão alinhadas até `20260805124457_edit_contact_name.sql`.

## Estado funcional

- O MVP cobre onboarding multi-tenant, CRM, inbox WhatsApp, Pedro, qualificação, imóveis, campanhas, agenda/distribuição, follow-ups, simulador, colaboração interna, curadoria e administração da plataforma.
- Uazapi, OpenAI e worker foram conectados ao fluxo real; a homologação operacional pelo dono continua em andamento.
- Pedro deve permanecer em `shadow` ou `assisted` nos atendimentos normais enquanto o comportamento não for integralmente homologado. O modo `production` tem liberação controlada conforme as decisões do produto.
- O roteiro humano canônico é `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
- Regras comportamentais do Pedro estão resumidas em `docs/operations/PEDRO_BEHAVIOR_TRACEABILITY.md` e detalhadas nos documentos de produto/decisão.

## Últimas correções comprovadas

- O inbox recebe e exibe conversas reais da Uazapi.
- Dono ou gestor com permissão de CRM pode editar manualmente o nome do contato no detalhe do Inbox ou do lead; a alteração é auditada e preserva o telefone canônico.
- A edição de nome no Inbox envia o UUID canônico do contato e não retorna mais `invalid uuid`.
- Execuções recuperadas do Pedro republicam o evento necessário para o worker.
- O nudge após envio de material não reenvia PDFs.
- A entrega de material usa `project_media_request.kind` da ação estruturada da IA e não depende do vocabulário usado pelo lead.
- Pedido de disponibilidade usa horários aprovados e não cria handoff indevido quando existem slots válidos.
- O lead de teste Arthur Rocha foi removido do banco em 04/08/2026 para reiniciar a homologação; não permaneceu fingerprint de supressão para o telefone utilizado.

## Verificações deste retrato

- `npm run lint`, `npm test` (19 arquivos e 108 testes) e `npm run build` aprovados em 05/08/2026.
- Migrações Supabase: local e remoto alinhados até a versão indicada acima; tabela, função, trigger e privilégios da edição de nome confirmados no remoto.
- `npx supabase db lint --linked --fail-on error`: concluído sem erros; permanecem apenas avisos preexistentes.
- Vercel: deployment de produção `Ready` associado ao commit indicado acima; inspeção confirmou o alvo `production` e o alias canônico respondeu `307` para `/login` seguido de `200`.

## Pendências operacionais

- Continuar a homologação manual dos fluxos descritos no guia, especialmente comportamento do Pedro, agendamento, distribuição, reativação e integrações reais.
- Homologar manualmente a edição de nome com dono/gestor e confirmar que corretor não recebe a ação nem consegue forjar a operação.
- Registrar cada novo defeito com esperado, observado, lead/canal, horário e IDs técnicos quando disponíveis.
- Atualizar este arquivo após qualquer alteração de deployment, migration, conta/projeto ou conclusão material de homologação.

## Protocolo compartilhado

- Todo novo Codex deve iniciar na raiz do repositório e seguir `docs/agent/ONBOARDING_PROMPTS.md`.
- Correções funcionais devem comparar os sete documentos originais, decisões posteriores, implementação atual e comportamento observado.
- Bug técnico inequívoco pode ser corrigido diretamente quando autorizado; lacuna ou mudança de produto exige discussão e aprovação antes da implementação.

## Limites desta fonte

## Registro operacional recente

- Uma limpeza repetida do contexto historico do lead de homologacao foi executada em 05/08/2026; cadastro e oportunidade foram preservados, e a conversa ficou pausada com a IA desligada para nova homologacao.

Este documento não substitui:

- o banco para estado transacional;
- Git/GitHub para código e autoria;
- Vercel para estado de deployment;
- os sete documentos de produto para regras consolidadas;
- os registros em `changes/` para histórico detalhado.
