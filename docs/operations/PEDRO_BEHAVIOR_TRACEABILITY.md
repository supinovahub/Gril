# Rastreabilidade comportamental do Pedro v3

Fonte de verdade: `docs/product/Especificacao-do-Produto-v1.md`. O pacote v3 separa comportamento conversacional, controles determinísticos e dados que cada imobiliária precisa cadastrar.

| Decisão do Grill Me | Garantia principal | Evidência |
|---|---|---|
| Pedro Sifuentes, pt-BR, natural e sem biografia inventada | Persona versionada + instruções do runtime | `pedro-instructions.ts`; persona publicada com `GRIL_BEHAVIOR_V3` |
| Humor, emoji e abreviação somente após rapport; irritação sem humor | Persona v3 | campos `style` e prompt publicado |
| Uma pergunta principal, sem interrogatório, repetição ou pressão após recusa | Persona v3 + estado de qualificação | prompt e instruções; `refused` é persistido |
| Fatos aprovados e válidos; nenhuma promessa inventada | Contexto filtrado + instrução + escalada | worker filtra validade de fatos, projetos, FAQ e qualificação |
| Opt-out, privacidade, documento, pagamento, jurídico, fraude, discriminação, idioma e abuso | Classificador e RPC determinísticos antes do modelo | `control-intents.ts`; `apply_inbound_control_intent` |
| Pergunta direta sobre IA não recebe improviso | Controle determinístico | intent `identity_question` e handoff silencioso |
| Qualificação só com dado explícito | Ferramenta estruturada + validação de tipo + request transacional | `pedro-turn.ts`; `qualification_value_requests` |
| Curadoria exige preço e entrada, no máximo dois imóveis | Filtro do servidor | `selectEligibleProjects`; `project_match_requests` |
| Primeira indicação: nome, bairro/região e capa, sem preço/entrada | Composição determinística e mídia publicada | `appendProjectRecommendations`; `enqueue_pedro_project_media` |
| Pedido de material oferece fotos restantes ou book | Persona + ação estruturada | `project_media_request`; catálogo publicado |
| Pedro não envia áudio | Instrução obrigatória | pacote v3 |
| Call exige data e hora explícitas; só confirma após aceite do corretor | Validação determinística + distribuição | `validCallRequest`; requests de call e ofertas |
| Pedido nominal por humano | Escalada | categoria `human_requested` |
| Follow-up curto, longo, compra futura e cancelamento | Jobs duráveis | triggers de cadência; runtime assistido ou produção |
| Aprovação no modo assistido aplica qualificação, match, call, follow-up e mídia | Transação única antes do envio | `apply_approved_assisted_actions` |
| Conversa antiga mantém sua persona; conversa nova recebe v3 | Snapshot imutável | `conversation_context_versions` aponta para a versão publicada na criação |

## Dados que continuam sendo responsabilidade da imobiliária

O sistema não inventa informação operacional. Antes da homologação real, o dono ou gestor deve publicar perfil institucional, empreendimentos, fontes, validade, FAQs, fatos, capa, até quatro fotos adicionais e book. Sem esses dados, a resposta correta do Pedro é perguntar, não recomendar ou escalar — não preencher a lacuna por conta própria.

## Modos

- **Shadow:** registra a decisão sem enviar ou alterar CRM.
- **Assistido:** cria sugestão; somente a aprovação humana aplica todas as ações e envia texto/mídia.
- **Produção:** aplica ações e envia automaticamente, sujeito aos mesmos controles determinísticos.
- **Simulador:** valida conversa e estado sem criar efeitos operacionais reais.
