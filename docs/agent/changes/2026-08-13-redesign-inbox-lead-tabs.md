# Redesign do detalhe do Inbox com contexto do lead em abas

- Data: 13/08/2026
- Responsável: Codex
- Branch/PR: `fix/inbox-lead-context-tabs`
- Commit: o commit que contém este arquivo

## Objetivo

Substituir a composição visual antiga do detalhe do Inbox por uma experiência de triagem centrada na conversa, usando a direção `Ink, Paper, Signal` e os princípios anti-slop da [Taste Skill](https://github.com/leonxlnx/taste-skill).

## Antes e depois

- Antes: a sugestão do Pedro aparecia em um bloco separado no topo; a conversa tinha uma caixa lateral dominante sobre quem estava atendendo; as informações do lead ficavam dispersas entre o resumo lateral e a rota de Leads.
- Depois: a sugestão pendente aparece na timeline como um balão editável com aprovar, gerar outra e declinar; as ações de atendimento ficam em um menu compacto; o detalhe tem abas URL-backed para Mensagens, Visão geral, Qualificação, Resumo, Próximas ações e Histórico.

## Escopo executado

- Arquivos: `src/app/app/inbox/[id]/page.tsx`, `src/app/app/inbox/inbox.module.css`.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: Preview Vercel será publicada após o commit; produção e Supabase permanecem inalterados.

## Validação

- Comandos/testes executados: `npm run lint`, `npm test`, `npm run build` com variáveis públicas do Supabase carregadas apenas no processo; smoke test local com `agent-browser` via `npx` em `/login`.
- Evidência observada: lint aprovado; 22 arquivos e 110 testes aprovados; build compilou TypeScript e gerou 47 rotas; `/login` carregou com conteúdo, sem overlay de erro e sem erros da aplicação no console.
- Validações não executadas e motivo: homologação autenticada do detalhe e interação real com abas/sugestão pendente ainda dependem de uma conta Gril; a sessão atual não possui credenciais de usuário.

## Impacto operacional

- Deploy necessário: Preview Vercel para aprovação visual; não promover para produção.
- Migração aplicada: não.
- Compatibilidade/rollback: rotas, queries, server actions, permissões e contratos de formulário existentes foram preservados; rollback é o revert do commit desta mudança.

## Pendências e riscos

- Homologar autenticado o detalhe com uma conversa que tenha mensagem pendente e uma oportunidade com qualificação, resumo, próxima ação e histórico.
- Confirmar em viewport móvel a rolagem horizontal das abas e a leitura do balão de sugestão.

## Documentos relacionados

- Decisões atualizadas: nenhuma.
- Guia de homologação atualizado: não alterado; o fluxo funcional não mudou, apenas a composição visual e a navegação contextual da tela.

## Publicação da Preview

- A branch `fix/inbox-lead-context-tabs` foi publicada no GitHub no commit `646790a`.
- A Preview Vercel associada ao commit está `READY`: `https://gril-8ki3s7zh9-brio5.vercel.app`.
- Alias da branch: `https://gril-git-fix-inbox-lead-context-tabs-brio5.vercel.app`.
- O endpoint `/login` respondeu HTTP 200 na verificação pública, com proteção SSO da Vercel; a homologação autenticada do Inbox permanece pendente.
- Produção, Supabase e dados não foram alterados.
