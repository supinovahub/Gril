# Rastreabilidade do escopo Grill Me

Fonte de verdade: os sete documentos em `docs/product`. Esta matriz aponta a implementação principal e evita confundir “código pronto” com “integração real homologada”.

| Escopo do MVP | Implementação principal | Estado antes do deploy |
|---|---|---|
| Organização, usuários, papéis e acesso | Auth, memberships, operações, convites, permissões e RLS | Implementado; isolamento remoto verificado |
| WhatsApp não oficial | Autosserviço Uazapi, criação/conexão, pareamento, webhook e adapter | Implementado; credencial/tráfego real pendentes |
| WhatsApp oficial | Meta Cloud direta, assinatura, janela de 24 h, templates sincronizados | Implementado; WABA/número real pendentes |
| Meta Leads | Webhook de formulários, pré-lead e enriquecimento tardio sem sobrescrever dados | Implementado; payload real pendente |
| CRM e Inbox | Contatos, telefones, participantes, oportunidades, busca, ownership e histórico | Implementado |
| Persona, regras e conhecimento | Versões, publicação humana, snapshots, FAQ, fatos e conflitos | Implementado |
| Qualificação e score | Extração estruturada, evidência/confiança, regras obrigatórias e score explicável | Implementado |
| Curadoria | Filtro determinístico por orçamento/entrada e até dois projetos com snapshot | Implementado |
| IA autônoma | Responses API, ferramenta estrita, resumo versionado, qualificação, curadoria, call e follow-up | Implementado; chave/modelo real pendentes |
| Mídia | Áudio, visão, Storage privado, documento sensível e retenção | Implementado; payloads reais pendentes |
| Campanhas | CSV, consentimento, revalidação, ondas 20/50/restante, revisão e pausas | Implementado; envio real pendente |
| Follow-ups | Esteiras curta/longa, no-show, compra futura, cancelamentos e capacidade | Implementado |
| Agenda e distribuição | Agenda, exceções, 20+10, preferenciais, rodízio, aceite atômico e escaladas | Implementado |
| Videochamada | Link HTTPS auditado, dashboard, template/link no envio e alerta T-15 | Implementado; envio real pendente |
| Kanban e pós-call | Etapas protegidas, próxima ação, checklist, pagamento humano e venda | Implementado |
| Central e alertas | Persistência, resolução, app, push e WhatsApp operacional de calls | Implementado; VAPID/navegador real pendentes |
| Modos e testes | Off, sombra, assistido, produção, simulador e 100 regressões | Implementado; suíte com modelo real pendente |
| Aprendizado | Sugestão, conflito, revisão, rascunho e publicação humana | Implementado |
| Relatórios e auditoria | Funil, campanha, calls, autonomia, capacidade, uso e eventos auditáveis | Implementado para o piloto |
| Privacidade e retenção | Opt-out, supressão, solicitações, hold e purge físico de Storage | Implementado; purge real pendente |
| PWA | Manifesto, ícone, service worker e web push | Implementado; instalação/push reais pendentes |

## Critérios da seção 39

- **Reativação:** contratos e UI cobrem importação, deduplicação, declaração, número, prévia, ondas, resposta, qualificação, call, Kanban e proteção.
- **Meta/inbound:** formulário tardio e inbound direto convergem para o mesmo CRM sem sobrescrever valores já obtidos.
- **Segurança:** 139 tabelas públicas estão com RLS; segredos ficam no Vault; controles determinísticos precedem a IA; pausa global e auditoria existem.
- **Calls:** agenda/exceções, 20+10, preferência/rodízio, aceite atômico, escaladas T-60/T-30/T-15, link, lembretes e pós-call existem.
- **Operação:** Central, Inbox, ownership, capacidade 10/25/30, push, métricas, modos e simulador existem.

## Fora do MVP mantido fora

Google/Outlook Calendar, gravação de calls, voz gerada por IA, gestão documental completa, processamento de pagamentos, comissão, cobrança/nota, white-label, Kanban livre, visitas presenciais autônomas, negociação autônoma de preço e idiomas além de português não foram adicionados.

## Limites de homologação

Não existe conexão WhatsApp ou modelo ativo no banco no momento desta auditoria. Por isso, adapters, OpenAI, push, worker público, purge físico e restauração de backup estão implementados, mas não comprovados ponta a ponta com fornecedores reais. Eles são os gates do deploy/piloto, não trabalho de código omitido.
