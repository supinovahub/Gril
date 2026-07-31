# Fase 5 — persona, contexto e motor Pedro

## Escopo entregue

- pacote inicial publicado de persona e regras do Pedro;
- versões `draft | published | archived` com checksum e publicação transacional;
- snapshot congelado de persona, regras e perfil institucional por conversa;
- perfis BYOK de modelo sem armazenar a chave na Data API;
- modos `off | shadow | assisted | production`;
- contrato idempotente de execução, sugestões, escaladas, uso e alertas de orçamento;
- tela Pedro para editar/publicar persona, referenciar secret, ativar modelo e mudar o modo global.

## Contrato do modelo

1. O endpoint previsto é Responses API, adequado a raciocínio, ferramentas e estado de conversa.
2. O catálogo inicial contém os papéis `quality`, `balanced` e `extraction`; nenhum preço ou limite foi inventado no banco.
3. `reasoning_effort` e `text_verbosity` são explícitos por perfil para evitar mudança silenciosa de comportamento.
4. O prompt é orientado ao resultado e preserva as invariantes do Grill: fatos aprovados, limites comerciais, opt-out, privacidade, fraude, discriminação e escalada.
5. Conversas em andamento não trocam persona ou regras quando uma nova versão é publicada.

## Gate da fase

- modelo não pode virar ativo por `UPDATE` direto;
- ativação exige owner e referência de secret;
- existe uma única versão publicada por persona;
- publicar v2 arquiva a v1 sem alterar snapshots anteriores;
- simulador cria execução `queued` e outbox com chave única;
- execução de atendimento sem conversa é rejeitada;
- produção exige modelo, WhatsApp, capacidade, modo e ownership compatíveis.

## Dependência externa aberta

Não existe uma chave BYOK concreta disponível nesta execução. Por isso o worker que chama a OpenAI não foi ativado e nenhuma chamada paga foi realizada. O restante do contrato está pronto para receber o secret no Supabase.

