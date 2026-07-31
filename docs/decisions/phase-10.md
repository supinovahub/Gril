# Fase 10 — Hardening e piloto local

## Entregue

- Meta Lead Ads versionado, idempotente e sem criar lead antes do inbound do WhatsApp;
- solicitações de privacidade, políticas de retenção e fila privada de purge;
- ativação de conector exclusiva do dono, auditada e condicionada a health check recente;
- rotas server-only para payloads normalizados de WhatsApp e Meta;
- cinquenta casos iniciais de regressão, incluindo todos os grupos críticos;
- políticas executáveis para capacidade, ondas, revisão, segurança de campanha e agenda;
- CI para lint, testes e build.

Tabelas de comando de ingestão podem aparecer no advisor como “RLS sem policy”. Isso é deliberado: `webhook_ingest_requests` e `meta_form_ingest_requests` são service-role-only e não devem ganhar policy para usuários autenticados.

## Limites deliberados

O banco remoto é o ambiente de desenvolvimento do MVP. A aplicação continua em localhost e não será publicada na Vercel antes da aprovação final. Os adapters específicos de Uazapi/Meta, o worker da OpenAI, envio real de mensagens e purge físico de Storage exigem credenciais e payloads reais; os contratos internos estão prontos, mas esses efeitos externos permanecem desativados.

## Gate

O piloto só começa depois que os bloqueios de `docs/operations/READINESS.md` forem resolvidos. Uma conexão não pode ser ativada sem configuração completa e health check saudável nos últimos quinze minutos.

## Evidências finais

- 28 testes unitários aprovados, lint limpo e build das 27 rotas concluído;
- zero tabela pública sem RLS;
- formulário Meta criou versão com checksum e ingestão repetida resultou em `unmatched` + `duplicate`, sem criar contato;
- conexão incompleta foi recusada, conexão saudável foi ativada e update direto de status foi bloqueado;
- cada organização de desenvolvimento recebeu 50 casos iniciais, sendo 26 críticos;
- `npm audit --omit=dev` encontrou zero vulnerabilidades de runtime.

O audit completo ainda aponta o advisory de `brace-expansion` na cadeia de desenvolvimento do ESLint. A correção automática oferecida pelo npm substituiria `eslint-config-next@16.2.12` por `0.2.4`, portanto o upgrade forçado foi recusado para não quebrar a verificação do projeto. Essa dependência não faz parte do bundle de produção.
