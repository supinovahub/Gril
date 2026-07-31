# Evidências automatizadas do MVP

Data da execução: 31/07/2026. Banco validado: projeto Supabase `frslhzwhaooqtivkzdez`.

Este documento registra somente o que foi comprovado sem credenciais reais de OpenAI, Uazapi ou Meta e sem testes visuais. Todas as fixtures de banco foram criadas dentro de transações finalizadas com `rollback`; nenhum contato, organização ou segredo de teste permaneceu no banco.

## Resultado consolidado

| Gate | Resultado | Evidência |
|---|---:|---|
| Testes unitários e de contrato | 70/70 | `npm test`, 10 arquivos Vitest |
| Banco, RLS e concorrência | 127/127 | 11 arquivos pgTAP em `supabase/tests` |
| Lint | aprovado | `npm run lint` |
| TypeScript e build | aprovado | `npm run build`, 31 rotas/páginas |
| Migrações remotas | 41 aplicadas | fases 1–23 mais hardening de privilégios |
| Tabelas públicas com RLS | 139/139 | consulta ao catálogo remoto |
| Grants de tabela para `anon` | 0 | consulta a `information_schema.table_privileges` |
| Privilégios excessivos de `authenticated` | 0 | sem `TRUNCATE`, `REFERENCES` ou `TRIGGER` |
| Casos de regressão ativos | 100 | 52 classificados como críticos |
| Worker durável | ativo | um cron remoto `gril-runtime-worker` ativo |
| Integrações reais ativas | 0 | preserva o limite entre simulação e homologação externa |

Total desta rodada: **197 verificações automatizadas aprovadas**, além de lint e build.

## Banco e RLS

| Arquivo | Verificações | Contratos comprovados |
|---|---:|---|
| `phase_01_rls.sql` | 12 | papéis, operação, convite pendente, isolamento e bloqueio anônimo |
| `phase_02_crm.sql` | 12 | telefone E.164, deduplicação, ownership, transição, versão, histórico e outbox |
| `phase_03_inbox.sql` | 12 | webhook idempotente, uma mensagem/contato/oportunidade/conversa e acesso à Inbox |
| `phase_04_queues.sql` | 13 | dedupe de job, limites 25/30, backlog, liberação e comandos service-only |
| `phase_05_pedro.sql` | 10 | publicação, BYOK obrigatório, execução bloqueada, idempotência e ausência de efeito externo |
| `phase_06_qualification_knowledge.sql` | 10 | oito critérios, evidência humana, conflito de IA, histórico, FAQ atômica e RLS |
| `phase_07_campaigns.sql` | 12 | CSV válido/duplicado/inválido, opt-out, aprovação, onda 20 e isolamento |
| `phase_08_calls.sql` | 12 | 20+10, oferta, aceite atômico, atribuição única, lembretes e conflito concorrente |
| `phase_09_operations.sql` | 10 | aprendizado, regressão, simulador, imutabilidade, publicação e pausa crítica |
| `phase_10_hardening.sql` | 12 | baseline 100/52, RLS global, grants mínimos, retenção, idempotência e schemas privados |
| `phase_11_integrations.sql` | 12 | Vault, mascaramento, owner-only, ativação, revogação e remoção física do segredo |

O hardening adicional em `20260731213347_harden_public_table_privileges.sql` corrigiu os grants padrão amplos do projeto: `anon` perdeu acesso direto às 139 tabelas e `authenticated` ficou somente com o CRUD derivado das políticas RLS.

## Provedores e runtime

Os testes em `src/lib/integrations` usam respostas simuladas, sem chamadas pagas e sem persistir segredos. Eles comprovam:

- Uazapi: allowlist HTTPS, status da instância, pareamento, autenticação do webhook, entrada, edição, recibo, falha e envio;
- Meta: vínculo Phone Number/WABA, HMAC do webhook, mensagem, reação, mídia, recibo, texto livre e template;
- OpenAI: validação não paga da chave, Responses API, ferramenta estrita e rejeição de decisão fora do schema;
- falhas: `429` repetível, `4xx` permanente, timeout/`5xx` de envio como resultado incerto sem reenvio cego;
- mídia: leitura autenticada pode repetir falha transitória e rejeita origem Uazapi não autorizada;
- segredos: payload e mensagens de erro não devolvem token, App Secret ou chave OpenAI.

## Advisor do Supabase

Não há erro de segurança sobre RLS ausente. Quatro tabelas service-only aparecem como informação “RLS sem policy”; isso é intencional, pois `anon` e `authenticated` não têm grants e os comandos são exclusivos de `service_role`.

Permanece um warning de proteção contra senhas vazadas desativada. Ele deve ser resolvido no Supabase Auth quando o recurso estiver disponível no plano do projeto.

O advisor de performance lista apenas itens informativos no banco vazio: 365 chaves estrangeiras sem índice dedicado e 81 índices ainda não usados. Não foram criados centenas de índices preventivos sem carga ou plano de consulta; os caminhos quentes do piloto devem ser medidos antes desse hardening.

## Limite desta evidência

Esta rodada não prova qualidade comercial do Pedro, aderência visual, entrega de push no navegador, payload real dos provedores, purge de objeto real nem restauração de backup. Esses gates estão em `MVP_VALIDATION_FLOWS.md` e exigem ação humana ou credencial externa.
