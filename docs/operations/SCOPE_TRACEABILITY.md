# Rastreabilidade do escopo Grill Me

> **Atualização de homologação — 03/08/2026:** esta matriz registra principalmente a presença estrutural de módulos, migrations e rotas; ela não comprova, isoladamente, que todas as jornadas estejam completas ou homologadas com fornecedores reais. Para o estado funcional, as lacunas atuais e o roteiro de aceite, use [GUIA_COMPLETO_DE_HOMOLOGACAO.md](./GUIA_COMPLETO_DE_HOMOLOGACAO.md).

Fonte de verdade: os sete documentos em `docs/product`. Esta matriz aponta a implementação principal e evita confundir “código pronto” com “integração real homologada”. A evidência executada está detalhada em `AUTOMATED_VALIDATION_EVIDENCE.md`.

| Escopo do MVP | Implementação principal | Estado antes do deploy |
|---|---|---|
| Organização, usuários, papéis e acesso | Auth, memberships, operações, convites, WhatsApp obrigatório, permissões e RLS | Implementado; fases 1 e 18, 28/28 |
| WhatsApp não oficial | Autosserviço Uazapi, criação/conexão, pareamento, webhook e adapter | Implementado; credencial/tráfego real pendentes |
| WhatsApp oficial | Meta Cloud direta, assinatura, janela de 24 h, templates sincronizados | Implementado; WABA/número real pendentes |
| Meta Leads | Webhook de formulários, pré-lead e enriquecimento tardio sem sobrescrever dados | Implementado; payload real pendente |
| CRM e Inbox | Contatos, telefones, participantes, oportunidades, busca, ownership e histórico | Implementado; fases 2–3, 24/24 |
| Persona, regras e conhecimento | Versões, publicação humana, snapshots, FAQ, fatos e catálogo de mídias | Implementado no núcleo; editor guiado e conflito/expiração avançados são P1 |
| Qualificação e score | Extração estruturada, evidência/confiança, regras obrigatórias e score explicável | Implementado; fase 6, 10/10 |
| Curadoria | Filtro determinístico por orçamento/entrada e até dois projetos com snapshot | Implementado |
| IA autônoma | Responses API, ferramenta estrita, resumo versionado, qualificação, curadoria, call e follow-up | Implementado; chave/modelo real pendentes |
| Mídia | Áudio, visão, Storage privado, documento sensível e retenção | Parcial; catálogo e restrição existem, upload/envio binário real pendente |
| Campanhas | CSV, consentimento, revalidação, ondas 20/50/restante, revisão e pausas | Implementado; fase 7, 12/12; envio real pendente |
| Follow-ups | Esteiras curta/longa, no-show, compra futura, cancelamentos e capacidade | Curta/longa/no-show implementadas; compra futura vaga aguarda data-base |
| Agenda e distribuição | Agenda, exceções, 20+10, preferenciais, rodízio, aceite atômico e escaladas | Implementado; fase 8, 12/12 |
| Videochamada | Link HTTPS auditado, dashboard, template/link no envio e alerta T-15 | Implementado; envio real pendente |
| Kanban e pós-call | Etapas protegidas, próxima ação, checklist, pagamento humano e venda | Implementado |
| Central e alertas | Persistência, resolução, app, push e WhatsApp operacional de calls | Implementado; VAPID/navegador real pendentes |
| Modos e testes | Off, sombra, assistido, produção, simulador e 100 regressões | Implementado; suíte com modelo real pendente |
| Aprendizado | Sugestão, conflito, revisão, rascunho e publicação humana | Implementado |
| Relatórios e auditoria | Funil, campanha, calls, autonomia, capacidade, uso e eventos auditáveis | Auditoria implementada; relatórios avançados são P1 |
| Privacidade e retenção | Opt-out, supressão, revisão, hold, evidência e restrição de anexo | Workflow implementado; mutação material depende da política LGPD |
| PWA | Manifesto, ícone, service worker e web push | Implementado; instalação/push reais pendentes |

## Cobertura dos sete documentos-fonte

| Documento e seções | Código/contrato principal | Migração/teste | Situação comprovada |
|---|---|---|---|
| Especificação §§ 4–6: escopo, papéis e entrada | `src/app/(auth)`, `src/app/app/equipe`, guards server-side | fases 1 e 10; `phase_01_rls.sql` | automatizada |
| Especificação §§ 7–9: persona, limites e ritmo | `src/app/app/pedro`, `src/lib/ai/pedro-turn.ts`, worker | fases 5, 13 e 19; testes Pedro/runtime | contrato automatizado; comportamento real pendente |
| Especificação §§ 10–12: capacidade, estados e identidade | comandos SQL e `src/lib/runtime/worker.ts` | fases 2, 4 e 18; testes 2 e 4 | automatizada |
| Especificação §§ 13–20: inbound, qualificação, conhecimento, mídia e privacidade | webhooks, adapters, `src/app/app/conhecimento` | fases 3, 6, 10, 15, 19 e 22; testes 3, 6 e 10 | contrato automatizado; payload real pendente |
| Especificação §§ 21–22: campanhas e follow-ups | `src/app/app/campanhas`, worker e jobs | fases 7, 13, 14 e 16; `phase_07_campaigns.sql` | automatizada; envio real pendente |
| Especificação §§ 23–27: calls, distribuição, Kanban e pós-call | `src/app/app/agenda`, `src/app/app/kanban` | fases 8, 14, 18, 20 e 23; `phase_08_calls.sql` | concorrência automatizada; operação humana pendente |
| Especificação §§ 28–35: Inbox, Central, modos, erros, métricas, auditoria e perfil | `src/app/app/inbox`, `central`, `relatorios`, `simulador`, `perfil` | fases 5, 9, 10, 17–21; testes 5, 9 e 10 | automatizada; UX/push real pendentes |
| Especificação §§ 36–41: arquitetura, fluxos, aceite e ordem | Next.js + Supabase + worker + Vault | 62 migrações; 272 verificações aprovadas | implementada e rastreada |
| Arquitetura §§ 1–3: fronteiras e componentes | App Router, domínio em `src/lib`, conectores separados e Supabase | fases 1–12 | build e contratos aprovados |
| Arquitetura §§ 4–6: fluxos críticos, estados e concorrência | rotas de webhook, worker, RPCs atômicas | fases 2–8 e 12–23; testes 2–8 | automatizada |
| Arquitetura §§ 7–10: segredos, ambientes, observabilidade e spikes | Vault, health checks, Vercel/Supabase Cron e runbooks | fases 9–12; teste 11 | automatizada onde simulável; fornecedores pendentes |
| Eventos §§ 1–7: envelope, filas, webhook, lease e agenda durável | `src/lib/runtime/worker.ts`, PGMQ, inbox/outbox | fases 3, 4 e 12 | idempotência e backlog automatizados |
| Eventos §§ 8–13: políticas, retry, dead letter, reconciliação e retenção | worker, RPCs de retry/finalização e purge | fases 7, 10, 12–16 e 23 | contratos automatizados; purge real pendente |
| Eventos § 14: testes obrigatórios | pgTAP + Vitest | `supabase/tests` e `src/**/*.test.ts` | 190 pgTAP + 82 Vitest aprovados |
| Mapa de Telas §§ 1–14: rotas, navegação e superfícies | 48 entradas no manifesto de páginas/rotas | build Next.js | existência/tipagem comprovadas; revisão visual pendente |
| Mapa de Telas §§ 15–18: visual, acessibilidade, responsividade e estados | módulos CSS, componentes e estados server-side | lint/build | implementação presente; homologação humana pendente |
| Modelo de Dados §§ 1–11: schemas e entidades | 159 tabelas públicas, schemas `private` e `audit` | fases 1–23 + fechamento | migrações remotas aplicadas |
| Modelo de Dados §§ 12–17: acesso, RLS, constraints, privacidade e validação | policies, funções com invocação restrita e Vault | hardening final; testes 1–12 | 159/159 RLS; grants mínimos comprovados |
| Backlog §§ 1–4: DoD, épicos e dependências | decisões de fase 1–23 | 62 migrações | núcleo de código concluído; P1/P2 explícitos no guia |
| Backlog § 5: estratégia de testes | Vitest, pgTAP e mocks de provedores | 82 + 190 aprovados | automatizada sem UI |
| Backlog §§ 6–8: avaliação, piloto e portões | 100 casos/52 críticos, modos e checklist | fase 17 e `PILOT_CHECKLIST.md` | estrutura pronta; avaliação real é humana |
| Backlog §§ 9–11: playbooks, métricas e fora do ciclo | `RUNBOOKS.md`, relatórios e exclusões explícitas | fases 9, 10, 18 e 20 | implementada para o MVP |
| README: decisões estruturantes e portões | este documento, readiness e evidências | lint, build, 272 testes, fechamento estrutural e advisors | gate técnico automatizado concluído |

## Critérios da seção 39

- **Reativação:** contratos e UI cobrem importação, deduplicação, declaração, número, prévia, ondas, resposta, qualificação, call, Kanban e proteção.
- **Meta/inbound:** formulário tardio e inbound direto convergem para o mesmo CRM sem sobrescrever valores já obtidos.
- **Segurança:** 159 tabelas públicas estão com RLS, zero grants de tabela para `anon`; segredos ficam no Vault; controles determinísticos precedem a IA; pausa global e auditoria existem.
- **Calls:** agenda/exceções, 20+10, preferência/rodízio, aceite atômico, escaladas T-60/T-30/T-15, link, lembretes e pós-call existem.
- **Operação:** Central, Inbox, ownership, capacidade 10/25/30, push, métricas, modos e simulador existem.

## Fora do MVP mantido fora

Google/Outlook Calendar, gravação de calls, voz gerada por IA, gestão documental completa, processamento de pagamentos, comissão, cobrança/nota, white-label, Kanban livre, visitas presenciais autônomas, negociação autônoma de preço e idiomas além de português não foram adicionados.

## Limites de homologação

Não existe conexão WhatsApp ou modelo ativo para a nova imobiliária no momento desta auditoria. Por isso, adapters, OpenAI, push, worker público e restauração de backup não estão comprovados ponta a ponta. A ação material de privacidade também depende de política LGPD. Esses itens são gates de homologação ou decisões externas; não devem ser apresentados como já aprovados.
