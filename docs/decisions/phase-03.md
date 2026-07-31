# Fase 3 — conectores e Inbox

## Escopo entregue

- contrato único para Uazapi e Meta Cloud API;
- conexão por operação sem persistir tokens na Data API;
- webhook inbox privado, hash do payload e idempotência por evento externo;
- criação/reuso de contato, oportunidade e conversa a partir do inbound;
- timeline de mensagens, anexos e resumos versionados;
- opt-out e lista de supressão;
- envio humano e takeover por comandos transacionais versionados;
- Inbox, detalhe da conversa e tela de rascunho dos conectores.

## Segurança e acesso

1. O adapter de webhook usa `service_role` depois de validar a assinatura do provedor. Usuários autenticados não têm grant na tabela de ingestão.
2. Payload bruto fica em `private.webhook_inbox`, fora da Data API.
3. Dono e gestor veem as conversas da operação. Corretor só vê conversa e telefone quando existe grant ativo e ele é o responsável atribuído.
4. Todo envio revalida opt-out, supressão, status e `expected_conversation_version`.
5. Tokens concretos permanecem em secrets do Supabase. `secret_reference` guarda apenas o nome do secret.

## Gate da fase

- webhook repetido produz uma única mensagem;
- inbound cria contato/oportunidade/conversa de forma atômica;
- broker sem grant vê zero conversa e zero telefone; com grant vê ambos;
- resposta humana cria mensagem `queued` e evento na outbox;
- lint, testes e build passam sem teste visual.

## Dependência externa aberta

A ativação real requer URL/token e número concreto de Uazapi ou ativos da Meta. Até isso existir, conexões ficam em `draft`, sem inbound ou campanha habilitados.

