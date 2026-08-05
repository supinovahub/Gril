# Publicação da correção de entrega de material

- Data: 05/08/2026
- Responsável: Codex na sessão principal do Gril
- Branch/PR: `fix/project-book-delivery`
- Commit: o commit que contém este arquivo

## Objetivo

Publicar em produção a correção que faz o envio do book depender da ação estruturada da IA, e não das palavras usadas pelo lead.

## Antes e depois

- Antes: o comportamento corrigido estava somente na branch `fix/project-book-delivery`, sem estar disponível na aplicação pública.
- Depois: o código do commit `fcc2060` foi publicado no deployment de produção `gril-bhqebkit6-brio5.vercel.app` e associado ao alias canônico `https://gril-lac.vercel.app`.

## Escopo executado

- Arquivos: `docs/agent/CURRENT_STATE.md` e este registro.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: deployment Vercel de produção `dpl_A1SjNHC5vfDqLxC75nyJAPXG9aAg`, alvo `production`, status `Ready`.

## Validação

- Comandos/testes executados: confirmação de identidade Vercel com perfil isolado; `vercel deploy --prod --yes`; `vercel inspect https://gril-bhqebkit6-brio5.vercel.app`; `curl.exe -I -L --max-time 30 https://gril-lac.vercel.app`.
- Evidência observada: build remoto Next.js passou com 46 rotas; inspeção confirmou `Ready` e alvo `production`; a URL pública respondeu `307` para `/login` e `200` na rota final.
- Validações não executadas e motivo: homologação funcional do envio do PDF no WhatsApp não foi executada; depende de telefone autorizado e confirmação humana no Inbox.

## Impacto operacional

- Deploy necessário: concluído.
- Migração aplicada: não se aplica.
- Compatibilidade/rollback: o deployment anterior `gril-rmlqyfs21-brio5.vercel.app` permanece como referência para rollback via promoção, se necessário.

## Pendências e riscos

- Executar o cenário real controlado: confirmar que a resposta que promete o book cria o envio do PDF correto, sem depender do verbo usado pelo lead.

## Documentos relacionados

- Decisões atualizadas: nenhuma.
- Guia de homologação atualizado: já atualizado em `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
