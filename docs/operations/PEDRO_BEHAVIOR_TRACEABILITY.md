# Rastreabilidade comportamental do Pedro v3

Fonte de verdade: `docs/product/Especificacao-do-Produto-v1.md`. O pacote v3 separa comportamento conversacional, controles determinísticos e dados que cada imobiliária precisa cadastrar.

| Decisão do Grill Me | Garantia principal | Evidência |
|---|---|---|
| Pedro Sifuentes, pt-BR, natural e sem biografia inventada | Persona versionada + instruções do runtime | `pedro-instructions.ts`; persona publicada com `GRIL_BEHAVIOR_V3` |
| Humor, emoji e abreviação somente após rapport; irritação sem humor | Persona v3 | campos `style` e prompt publicado |
| Uma pergunta principal, sem interrogatório, repetição ou pressão após recusa | Persona v3 + estado de qualificação | prompt e instruções; `refused` é persistido |
| Fatos aprovados e válidos; nenhuma promessa inventada | Contexto filtrado + instrução + escalada | worker filtra validade de fatos, projetos, FAQ e qualificação |
| Opt-out, privacidade, documento, pagamento, jurídico, fraude, discriminação, idioma e abuso | Pedro analisa histórico + resumo + contexto; depois o backend aplica efeitos rígidos e idempotentes | `pedro-instructions.ts`; `pedro-turn.ts`; `complete_ai_execution`; `contextual-controls-after-ai.md` |
| Pergunta direta sobre IA não recebe improviso | Controle determinístico | intent `identity_question` e handoff silencioso |
| Qualificação só com dado explícito | Ferramenta estruturada + validação de tipo + request transacional | `pedro-turn.ts`; `qualification_value_requests` |
| Curadoria e quantidade de imóveis são decididas contextualmente pelo Pedro | Plano explícito; backend apenas valida IDs ativos | `recommended_project_ids`; `validatePedroDecision` |
| Texto e projetos recomendados não são recompostos depois do modelo | Guarda contra mutação semântica | `complete_pedro_turn`; `decision_hash` |
| Pedido de material oferece fotos restantes ou book | Ações exatas por projeto; executor não amplia a lista | `project_media_requests`; `enqueue_pedro_project_media` |
| Pedro não envia áudio | Instrução obrigatória | pacote v3 |
| Call exige data e hora explícitas; só confirma após aceite do corretor | Pedro decide; backend valida o slot exato e distribui | `validatePedroDecision`; requests de call e ofertas |
| Pedido nominal por humano | Escalada | categoria `human_requested` |
| Follow-up curto, longo, compra futura e cancelamento | Jobs duráveis | triggers de cadência; runtime assistido ou produção |
| Inbound normal em production é controlado por whitelist | Execução não é criada fora da lista; revalidação antes do worker e trigger final antes de qualquer outbound AI | `ai_test_allowlist`; `is_conversation_ai_eligible`; `start_ai_execution`; `messages_pedro_inbound_allowlist` |
| Aprovação sem edição aplica qualificação, match, call, follow-up e mídia | Transação única antes do envio | `apply_approved_assisted_actions` |
| Edição humana substitui a mensagem, mas nunca reutiliza ações antigas | Plano anterior invalidado; envio somente do texto editado | `process_ai_suggestion_review_request`; `validated_action_plan` |
| Conversa antiga mantém sua persona; conversa nova recebe v3 | Snapshot imutável | `conversation_context_versions` aponta para a versão publicada na criação |

## Dados que continuam sendo responsabilidade da imobiliária

O sistema não inventa informação operacional. Antes da homologação real, o dono ou gestor deve publicar perfil institucional, empreendimentos, fontes, validade, FAQs, fatos, capa, até quatro fotos adicionais e book. Sem esses dados, a resposta correta do Pedro é perguntar, não recomendar ou escalar — não preencher a lacuna por conta própria.

## Escopo de production

Production automática existe em dois escopos independentes. No inbound normal,
a opção só aparece quando há número ativo em `ai_test_allowlist`, precisa ser
selecionada explicitamente pelo dono e responde apenas aos números listados.
Na reativação, campanha, onda, conversa, worker e outbound exigem campanha
`reactivation`; `test_controlled` usa a whitelist e `released` usa a base
elegível da campanha.

## Modos

- **Shadow:** registra a decisão sem enviar ou alterar CRM.
- **Assistido:** cria sugestão; somente a aprovação humana aplica todas as ações e envia texto/mídia.
- **Produção:** aplica ações e envia automaticamente, sujeito aos mesmos controles determinísticos.
- **Whitelist de produção:** no inbound normal, somente números ativos cadastrados pelo dono/gestor podem gerar respostas automáticas; sem cadastro, nenhuma resposta é enviada.
- **Simulador:** valida conversa e estado sem criar efeitos operacionais reais.
