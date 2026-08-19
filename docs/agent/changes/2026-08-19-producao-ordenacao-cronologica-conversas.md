# Publicação da ordenação cronológica das conversas

- Data: 19/08/2026
- Responsável: Codex
- Branch/PR: `fix/chat-chronological-order`, PR #68; registro em `docs/record-chat-chronological-production`
- Commit: o commit que contém este arquivo; código integrado por `a27a46662aa93869795a5a1f7bfb79f00c29710b`

## Objetivo

Publicar a regra aprovada que organiza a Inbox pela atividade mais recente,
como no WhatsApp, sem colocar conversas com pendências no topo.

## Antes e depois

- Antes: mensagens inbound não lidas e sugestões pendentes formavam um grupo de
  atenção acima das demais conversas, mesmo quando eram mais antigas.
- Depois: todas as conversas usam `updated_at DESC`, com ID como desempate
  determinístico. Não lidos e sugestões pendentes permanecem como badges e
  contadores, sem influenciar a posição.

## Escopo executado

- Arquivos: ordenação da Inbox, teste unitário, decisão de produto, guia de
  homologação, teste pgTAP e documentação operacional.
- Migrations: `20260819123017_inbox_chronological_order.sql` substitui
  `inbox_conversation_page` e `inbox_workspace_bootstrap` sem alterar linhas de
  conversas, mensagens ou sugestões.
- Mudanças externas em Supabase, Vercel e GitHub: PR #68 mergeado na branch
  canônica; migration aplicada no projeto `frslhzwhaooqtivkzdez`; deployment
  `dpl_DSS1hbi8AHMABCLYXkrRwxZtgQMP` publicado pelo vínculo Git da Vercel.

## Validação

- `npm run lint`: aprovado.
- `npm test`: 24 arquivos e 117 testes aprovados.
- `npm run build`: aprovado com 46 rotas.
- CI do PR e do merge canônico: aprovado.
- `npx supabase db push --linked --dry-run --skip-vault`: selecionou somente
  `20260819123017_inbox_chronological_order.sql`.
- `npx supabase migration list --linked`: local e remoto alinhados até
  `20260819123017` após a aplicação.
- Consulta direta das funções vivas: ambas contêm a ordem cronológica e usam
  `security definer`, `search_path=""` e `jit=off`; a função de paginação é
  executável somente por `service_role`, e o bootstrap também por
  `authenticated`, como previsto pelo contrato atual.
- `npx supabase db lint --linked --fail-on error`: concluído sem erros; apenas
  avisos históricos não relacionados.
- Advisors: o aviso de `SECURITY DEFINER` autenticado para
  `inbox_workspace_bootstrap` é esperado, pois o contrato expõe o bootstrap ao
  usuário autenticado e valida `auth.uid()` e a organização dentro da função.
  Nenhum achado novo exige mudança nesta publicação.
- Vercel: identidade `suporteinovahub-7501` confirmada pelo perfil isolado;
  deployment `dpl_DSS1hbi8AHMABCLYXkrRwxZtgQMP` inspecionado como `Ready`, alvo
  `production` e alias `https://gril-lac.vercel.app`.
- Smoke público: `/login` retornou 200 e `/app/inbox` retornou 307 para
  `/login?next=%2Fapp%2Finbox`; nenhum log de nível `error` foi encontrado no
  deployment.
- Validações não executadas: o pgTAP criado não rodou porque este host não
  possui Docker/Podman. A inspeção visual autenticada exige uma sessão humana e
  permanece pendente.

## Impacto operacional

- Deploy necessário: concluído em `https://gril-lac.vercel.app`.
- Migração aplicada: sim, `20260819123017` no projeto
  `frslhzwhaooqtivkzdez`.
- Compatibilidade/rollback: a mudança não altera dados nem o formato retornado.
  Um rollback completo exige promover o bundle anterior e criar uma nova
  migration adiante que restaure explicitamente a ordenação antiga; não se deve
  reescrever o histórico de migrations.

## Pendências e riscos

- Homologar em sessão autenticada uma conversa recente sem pendência e duas
  conversas antigas com badges, confirmando que a mais recente fica no topo e
  que resolver um badge não muda artificialmente a ordem.

## Documentos relacionados

- Decisões atualizadas:
  `docs/decisions/2026-08-19-inbox-chronological-order.md` substitui
  `docs/decisions/inbox-attention-order.md`.
- Guia de homologação atualizado:
  `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
