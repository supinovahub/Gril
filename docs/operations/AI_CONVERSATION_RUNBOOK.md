# Runbook da conversa do Pedro

Este runbook orienta manutenção, diagnóstico, correção e homologação do núcleo conversacional do Gril. Leia também `AGENTS.md`, `docs/agent/DEVELOPER_HANDOFF.md`, `docs/operations/PEDRO_BEHAVIOR_TRACEABILITY.md` e as decisões citadas no handoff.

## Escopo

O fluxo coberto começa no recebimento de uma mensagem e termina em um destes resultados:

- resposta autônoma entregue em production;
- sugestão criada para revisão humana em assisted;
- execução de simulador sem efeito externo;
- decisão segura de não responder ou escalar;
- falha persistida com retry ou atenção humana.

Este runbook não autoriza alterar modo, allowlist, banco ou produção. Esses atos dependem do escopo da tarefa e do protocolo do `AGENTS.md`.

## Contrato comportamental mínimo

Qualquer correção precisa preservar:

1. **Contexto antes de controle:** a conversa recente, mensagem citada, resumo, fatos e estado operacional vêm antes de opt-out, escalonamento ou outra ação durável.
2. **Ações explícitas:** o modelo devolve `reply` e ações estruturadas; o backend valida exatamente esse plano e não inventa ações ausentes.
3. **Mesma verdade no texto e na ação:** projeto, mídia, formato, dia e horário visíveis ao lead devem corresponder ao objeto estruturado executado.
4. **Fonte determinística para fatos críticos:** a existência de uma reserva, e não a eloquência do texto, confirma uma call.
5. **Uma pergunta principal por vez:** o Pedro pode responder um desvio e retomar a qualificação, mas não transforma a conversa em formulário.
6. **Identidade atual:** primeira pergunta sobre identidade recebe a resposta natural de assistente do Pedro Sifuentes; insistência segue a decisão de escalonamento.
7. **Sem promessa não autorizada:** preço, condição, disponibilidade, material e empreendimento dependem dos dados autorizados para o turno.
8. **Controle humano explícito:** assisted não envia automaticamente; edição humana invalida o plano anterior; Chat e Inbox compartilham a mesma revisão.
9. **Idempotência:** retry, webhook duplicado e clique repetido não podem duplicar resposta, reserva ou ação.
10. **Auditoria sem exposição:** decisões e IDs técnicos ficam rastreáveis; segredo e conteúdo pessoal não entram em documentação ou log versionado.

## Modos

| Modo | Efeito esperado |
| --- | --- |
| `off` | mensagem é preservada, mas o Pedro não gera resposta automática |
| `simulator` | usa o runtime e registra resultado sem conversa ou envio real |
| `assisted` | gera sugestão; humano aprova, edita, regenera ou descarta |
| `production` | pode executar o plano e enviar, desde que todas as precondições determinísticas estejam válidas |

Inbound production possui uma trava adicional: só números numa allowlist ativa podem executar e enviar. A ausência de allowlist ativa significa que nenhum contato está autorizado por esse mecanismo. Reativação possui liberação e modo próprios; não derive um do outro.

## Fluxo técnico atual

```text
Webhook WhatsApp
  -> normalização do payload e deduplicação por identidade externa
  -> persistência da mensagem/RPC de ingestão
  -> agregação do turno e job durável
  -> start_ai_execution
  -> compilação do contexto e das instruções
  -> chamada estruturada ao modelo
  -> normalização e validação determinística
  -> complete_pedro_turn
  -> production: ação/outbox/envio, se elegível
     assisted: ai_suggestions + revisão no Inbox/Chat
     simulator: resultado isolado
  -> resumo, mídias, sinais de qualidade, auditoria e eventuais retries
```

### 1. Entrada e identidade da mensagem

Arquivo principal: `src/app/api/webhooks/whatsapp/[connectionId]/route.ts`.

Responsabilidades:

- validar o contrato do webhook;
- distinguir inbound, status, mutação e outbound feito externamente pelo celular conectado;
- preservar `provider_message_id` e referência de mensagem citada;
- deduplicar eventos;
- persistir mídia e criar job separado quando necessário;
- encaminhar a mensagem inbound à agregação do turno.

Não adicione regra conversacional baseada em texto ao webhook. Ele deve persistir e enfileirar; o contexto e a decisão pertencem ao runtime.

### 2. Worker e contexto

Arquivo principal: `src/lib/runtime/worker.ts`, especialmente `runAiExecution` e `drainRuntimeWorker`.

O worker:

- reivindica a execução com `start_ai_execution`;
- resolve perfil de modelo e segredo no servidor;
- carrega versão de persona, regras e perfil institucional;
- carrega até 120 mensagens recentes e completa referências citadas ausentes;
- inclui resumo e orientação humana ativa;
- inclui perguntas e valores de qualificação;
- inclui projetos, fatos, FAQs e mídias publicados;
- carrega fuso da operação, slots reais para sete dias e call ativa;
- chama o modelo com saída estruturada;
- normaliza o formato da call e valida o plano;
- registra saída original, hash do plano, resultado, tokens, latência e custo;
- conclui o turno por `complete_pedro_turn`;
- agenda mídia, salva resumo e registra sinais de baixa confiança;
- aplica fallback, retry limitado ou `fail_ai_execution` conforme o erro.

### 3. Instruções e contrato estruturado

Arquivos principais:

- `src/lib/ai/pedro-instructions.ts`;
- `src/lib/ai/pedro-turn.ts`;
- `src/lib/ai/conversation-context.ts`;
- `src/lib/integrations/openai-runtime.ts`.

`pedro-instructions.ts` compila os invariantes, política publicada, contexto institucional e objetivos do turno. O nome da constante `PEDRO_BEHAVIOR_V3_MARKER` é legado; o valor atual usa `GRIL_BEHAVIOR_V5`. Renomear é dívida de clareza, não mudança funcional.

`pedro-turn.ts` define o schema Zod da resposta e as validações de qualificações, escalonamento, projetos, mídias e call. O ponto frágil conhecido na transição é a falta de comparação semântica completa entre o horário escrito em `reply` e `call_request.starts_at`.

`conversation-context.ts` deixa explícito quem escreveu e qual era o conteúdo da mensagem citada. Preserve isso ao alterar montagem de histórico.

### 4. Conclusão e revisão assistida

Migrations centrais:

- `20260805150835_contextual_controls_after_pedro_analysis.sql`;
- `20260805160806_pedro_explicit_actions_source_of_truth.sql`;
- `20260806165000_chat_pedro_assisted_queue.sql`;
- `20260807130110_chat_pedro_suggestion_context.sql`.

Interfaces e ações:

- `src/app/app/inbox/actions.ts` contém a revisão da sugestão no Inbox;
- `src/app/app/chat-interno/actions.ts` contém a mesma revisão a partir do Chat com Pedro;
- `src/app/app/chat-pedro/page.tsx` carrega o workspace interno;
- `src/app/app/pedro/page.tsx` mostra o painel operacional do Pedro.

A revisão é transacional por `ai_suggestion_review_requests`. Não implemente um segundo caminho de envio no Chat. O chat organiza contexto e confirmação; o contrato do Inbox continua valendo.

## Mapa de arquivos e testes

| Assunto | Código | Testes/evidências principais |
| --- | --- | --- |
| identidade, tom e limites | `src/lib/ai/pedro-instructions.ts` | `src/lib/ai/pedro-instructions.test.ts` |
| schema e ações exatas | `src/lib/ai/pedro-turn.ts` | `src/lib/ai/pedro-turn.test.ts` |
| mensagens citadas | `src/lib/ai/conversation-context.ts` | `src/lib/ai/conversation-context.test.ts` |
| chamada ao provedor | `src/lib/integrations/openai-runtime.ts` | `src/lib/integrations/openai-runtime.test.ts` |
| orquestração e retries | `src/lib/runtime/worker.ts` | testes de runtime e SQL de fases 5, 12, 33 e 37 |
| assisted no Inbox | `src/app/app/inbox/actions.ts` | `supabase/tests/phase_33_chat_pedro_assisted_queue.sql` |
| assisted no Chat | `src/app/app/chat-interno/actions.ts` | `supabase/tests/phase_37_chat_pedro_suggestion_context.sql` |
| production/allowlist | migrations de 06 e 18/08 | testes de inbound production e guia de homologação |
| simulator | `src/app/app/simulador/` | testes do simulador e regressão de comportamento |

Confirme nomes reais com `rg --files` antes de executar um teste isolado; a suíte evolui.

## Diagnóstico por sintoma

### O Pedro não respondeu

Verifique nesta ordem:

1. a mensagem foi reconhecida e persistida pelo webhook;
2. a conversa pertence à conexão atual, e não a uma conexão arquivada;
3. direção, `reply_to_message_id`, mídia e corpo estão coerentes;
4. modo global, modo do fluxo, modo da conversa e controle humano;
5. em production inbound, allowlist e conexão ativa;
6. criação e estado da `ai_execution`;
7. job agregado, lease, retry e erro redigido;
8. modelo ativo e credencial acessível ao servidor;
9. em assisted, existência de `ai_suggestion` pendente e thread correspondente;
10. em production, plano validado, outbox e resultado do provedor.

Não conclua “falha da IA” apenas porque não houve bolha de saída. O bloqueio pode ser intencional em qualquer uma dessas camadas.

### O texto está errado, mas a ação parece correta

Registre somente IDs técnicos, horário aproximado e comportamento observado. Compare:

- mensagem inbound e mensagem citada;
- `model_output_structured.reply`;
- `call_request`, `project_actions`, `media_actions` e escalonamento;
- `validated_action_plan` e `decision_validation_status`;
- fuso da operação e conjunto de slots/projetos/mídias fornecido ao turno;
- versão de persona, regra e marcador de comportamento;
- texto efetivamente enviado ou sugerido.

Se texto e ação divergem, não “corrija” apenas a mensagem depois da execução. A execução precisa ser recusada ou regenerada antes do efeito durável.

### O horário visível diverge da reserva

Colete:

- fuso da operação;
- `reply` original;
- `call_request.starts_at` original;
- rótulo local do slot autorizado;
- eventual call já ativa;
- registro final em `calls` e mensagem final.

O teste de regressão deve incluir pelo menos dois slots válidos. Assim ele prova que o sistema rejeita a incoerência sem depender de um `starts_at` inválido.

### Há duplicidade

Compare:

- `external_event_id` e `provider_message_id`;
- versão de contexto da conversa;
- chave de agregação do turno;
- execução anterior superseded/completed;
- hash do plano de ação;
- outbox e IDs retornados pelo provedor;
- pedido de revisão assistida.

Nunca reenvie manualmente antes de determinar se o provedor pode ter aceitado a tentativa anterior.

### A sugestão assistida ficou parada

Verifique sugestão, thread ativa, pedido de revisão e controle atual da conversa. Aprovação, edição, regeneração e descarte precisam passar pela transação canônica. Uma edição humana não pode reaproveitar ações estruturadas geradas para outro texto.

### A mensagem foi enviada pelo celular

Outbound externo é preservado como mensagem e gera uma thread `external_device` no Chat com Pedro para decisão humana. Não trate a mensagem como envio do runtime nem tente duplicá-la. Resolva pela ação explícita disponível na thread.

## Consultas seguras de operação

Prefira UI administrativa, CLI oficial e agregados. Não cole conteúdo de mensagens no terminal compartilhado, Issue ou PR.

### GitHub

```powershell
git fetch origin
git status --short --branch
gh pr list --repo supinovahub/Gril --state open
gh pr checks 66 --repo supinovahub/Gril
```

### Supabase

```powershell
npx supabase migration list --linked
npx supabase db lint --linked
```

Confirme antes que o link aponta para `frslhzwhaooqtivkzdez`. `db lint` é leitura/análise; não use `db push`, SQL de atualização ou limpeza durante diagnóstico.

Ao consultar tabelas, prefira contagens por `status`, `mode`, `error_code` e faixa de tempo. Não extraia `body`, telefone, nome, e-mail, prompt completo ou segredo.

### Vercel

Neste host, use sempre o perfil isolado determinado em `AGENTS.md`:

```powershell
npx --yes vercel@latest --global-config "C:\Users\Windows 11\.vercel-profiles\supinovahub-7501" whoami
npx --yes vercel@latest --global-config "C:\Users\Windows 11\.vercel-profiles\supinovahub-7501" inspect gril-lac.vercel.app
```

Prossiga somente se a identidade for `suporteinovahub-7501`. Nunca use `vercel login`, `vercel logout` ou o perfil padrão da máquina.

## Procedimento recomendado para a correção do horário

1. Reproduza primeiro num teste de `pedro-turn` e, se necessário, num teste do worker.
2. Use o fuso da operação para produzir rótulos inequívocos dos slots.
3. Instrua o modelo a copiar o instante autorizado para o campo estruturado e a usar no texto o mesmo dia/hora local.
4. Valide deterministicamente a correspondência antes de `complete_pedro_turn`.
5. Faça no máximo o retry controlado já adotado pelo runtime para contradições corrigíveis.
6. Se a segunda resposta continuar divergente, falhe de forma segura; não reserve nem envie confirmação.
7. Preserve `model_output_structured` original e auditoria suficiente para diagnosticar a rejeição.
8. Teste virada de dia, horário de verão histórico quando aplicável ao parsing, acento/abreviação, 12h/24h, resposta sem horário textual e call futura existente.
9. Não interprete qualquer número solto do texto como hora. A validação deve ser específica ao contexto de agendamento para evitar falso positivo com preço, metragem e parcela.

A PR #66 contém uma implementação de referência. Reavalie seus helpers e testes contra a base atual em vez de copiar a branch inteira.

## Homologação mínima da conversa

Execute com dados e números controlados:

1. pergunta de identidade na primeira ocorrência;
2. insistência sobre identidade e escalonamento esperado;
3. resposta fora de ordem e digressão sem perda da qualificação;
4. palavra de opt-out usada em contexto não imperativo, seguida de pedido explícito real;
5. pergunta comercial coberta e outra sem conhecimento confiável;
6. projeto e mídia autorizados, mais tentativa de referenciar item não autorizado;
7. consulta de agenda, seleção de slot e correspondência entre texto, ação e reserva;
8. call futura já existente;
9. mensagem citada, confirmando autor e conteúdo correto;
10. revisão da mesma sugestão pelo Inbox e pelo Chat, uma vez cada, provando idempotência;
11. edição humana invalidando o plano antigo;
12. webhook ou clique repetido sem duplicação;
13. production bloqueado para número fora da allowlist;
14. mensagem enviada pelo celular aparecendo como intervenção externa, sem reenvio do Pedro.

Use `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md` para o roteiro integral. Registre resultado observado, horário aproximado, IDs técnicos e evidência visual quando necessária, sem transcrever conversa privada.

## Validação automatizada

Para mudança TypeScript/React de risco conversacional:

```powershell
npm run lint
npm test
npm run build
```

Durante desenvolvimento, execute primeiro os testes focados, mas antes de integrar rode a verificação completa na proporção do risco. Se qualquer comando não for executado, registre motivo e risco residual no arquivo da mudança.

Para migration:

1. confirme novamente a lista local/remota;
2. garanta que ninguém mais está migrando;
3. crie migration local pelo Supabase CLI;
4. execute lint e testes SQL aplicáveis;
5. aplique somente com autorização e registre o efeito externo;
6. confirme alinhamento local/remoto depois.

## Publicação e rollback

Não existe Supabase staging canônico. O banco remoto é único, portanto a segurança vem de branch isolada, testes, modo assisted, allowlist controlada, serialização de migration e rollout consciente.

Antes de publicar:

- base atualizada e sem conflito;
- responsável e escopo visíveis;
- decisões de produto resolvidas;
- testes focados e suíte proporcional verdes;
- migration desnecessária ou serializada e validada;
- modo operacional e número de homologação confirmados;
- identidade Vercel correta;
- registro em `docs/agent/changes/` no mesmo PR.

Depois de publicar:

- confirme o commit na branch padrão;
- confirme deployment `Ready` e alias público;
- teste `/login` e a rota autenticada aplicável;
- valide primeiro em assisted;
- monitore execuções, sugestões, erros e outbox;
- só libere production/allowlist com autorização explícita.

Rollback preferencial:

- desative o envio autônomo ou remova a allowlist controlada pelo caminho administrativo aprovado;
- reverta o commit por nova PR ou promova o deployment anterior;
- preserve mensagens, execuções, planos e auditoria;
- não apague migrations aplicadas nem registros para “limpar” o incidente;
- registre causa, janela afetada, contenção e estado final.

## Dívidas conhecidas no retrato de 24/08/2026

- correção semântica de horário pendente de reimplementação da PR #66;
- decisão pendente sobre duração comunicada e duração reservada;
- decisão pendente sobre o Pedro se apresentar também como corretor;
- uma execução assistida antiga ainda em `running`;
- falhas recentes `openai_tool_arguments_invalid` a classificar;
- sugestões e threads pendentes precisam de triagem operacional;
- marcador de comportamento com nome legado em `pedro-instructions.ts`;
- branch padrão sem proteção;
- documentação de estado com duplicações;
- guia de homologação possui descrição de capacidade que deve ser reconciliada com a regra implementada: pausa proativa a partir de 25 trabalhos, teto total de 30 e retomada abaixo de 10, em vez de tratar 10 como teto rígido de inbound.

Resolver uma dívida não autoriza mudar outra. Mantenha cada correção em branch, registro e PR próprios.
