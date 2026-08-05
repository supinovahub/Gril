# Fases 13–23 — fechamento funcional do MVP

## Entregue

- autonomia real do Pedro para qualificar, recomendar até dois imóveis, criar call e programar follow-up;
- ferramenta OpenAI estrita com validação determinística e resumo versionado;
- revisão obrigatória de ondas, templates Meta e proteção da janela de 24 horas;
- mensagens operacionais para calls, aceite atômico, escaladas e resultados +1/+4/+24 horas;
- áudio, imagem, documento sensível, Storage privado e mutações de mensagens;
- CRM de participantes/telefones/mescla, score explicável, checklists e integridade da venda;
- efeitos determinísticos de opt-out, privacidade, pagamento, número errado, origem e pergunta sobre IA; a detecção lexical anterior ao modelo foi posteriormente substituída por análise contextual conforme `contextual-controls-after-ai.md`;
- PWA, busca global, push, Uazapi criada/conectada, pareamento e configuração de webhook;
- link de videochamada auditado, propagado a lembretes/templates e alerta crítico por ausência;
- suíte de 100 regressões, sendo 52 críticas.

## Reconciliação importante

A fase de push havia substituído o consumidor de eventos e removido, por regressão, o WhatsApp operacional da oferta e a confirmação de call ao lead. A fase 23 recompôs as três saídas — app, push e WhatsApp — e restaurou a confirmação/agendamento pós-aceite em uma única função versionada.

## Evidência final não visual

- TypeScript: aprovado;
- ESLint: aprovado;
- Vitest: 70/70 testes aprovados;
- pgTAP remoto: 127/127 verificações aprovadas, com rollback das fixtures;
- build Next.js: 31 páginas/rotas geradas;
- banco remoto: 41 migrações aplicadas, incluindo fase 23 e hardening de privilégios;
- RLS: zero das 139 tabelas públicas sem RLS;
- Storage: dois buckets privados;
- produção anterior disponível; esta rodada de hardening ainda precisa ser publicada pelo fluxo Git/Vercel.
