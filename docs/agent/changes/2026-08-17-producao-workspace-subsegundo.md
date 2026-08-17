# Publicação do workspace subsegundo em produção

- Data: 2026-08-17
- Responsável: Codex
- Branch/PR: `perf/all-workspace-routes-under-one-second` / PR #50; registro em `docs/production-all-routes-release`
- Commit: o commit que contém este arquivo; aplicação integrada por `9f28608040134b1ba5d675f8408fd3022d1ea5f1`

## Objetivo

Publicar em produção a cadeia validada que reduz o carregamento das 29 telas autenticadas para até um segundo após aquecimento e integra a melhoria contínua governada.

## Antes e depois

- Antes: o alias `https://gril-lac.vercel.app` apontava para `dpl_DrQ4qMxpKGBBxNPNkCMVPf94HLFy`, release de 11/08/2026 com Functions em `iad1`, sem o redesign e as correções atuais.
- Depois: o alias passou a apontar para `dpl_3kQzu51GdmGndaSd1PRo8eMstd6Y`, `Ready`, com Functions em `gru1` e o tree de aplicação já validado no preview.

## Escopo executado

- Arquivos: nenhuma alteração funcional adicional durante o deploy; este registro e `docs/agent/CURRENT_STATE.md` documentam o estado externo.
- Migrations: nenhuma aplicada durante a publicação. As versões até `20260817202000` já estavam aplicadas e alinhadas no Supabase canônico.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: a base da PR #50 foi alterada para `phase/01-foundation`, a PR foi marcada como pronta e mergeada no commit `9f28608040134b1ba5d675f8408fd3022d1ea5f1`; a integração Git/Vercel criou o deployment de produção `dpl_3kQzu51GdmGndaSd1PRo8eMstd6Y`.

## Validação

- Comandos/testes executados: inspeção de ancestralidade Git; confirmação da identidade Vercel `suporteinovahub-7501`; CI do merge; `vercel inspect`; smokes HTTP com `curl`; consulta de logs Vercel com nível `error`.
- Evidência observada: PR #50 mergeada e o commit de aplicação `dbabc10` é ancestral da branch canônica; o tree de `dbabc10` e do merge é `7bd45de6789400d62e0abff632392bbb36da6d90`; deployment `Ready` em `gru1`; `/login` respondeu 200 em 0,446 s; `/app`, `/app/inbox` e `/app/aprendizados` responderam 307 para o login em 0,124–0,272 s; nenhum log de erro foi retornado; o CI `32063514496` passou com lint, 112 testes e build de 46 rotas.
- Validações não executadas e motivo: a matriz autenticada não foi repetida no alias público para não criar sessão operacional adicional; o mesmo tree havia sido validado nas 29 telas no preview. A homologação visual e dos fluxos de escrita permanece humana.

## Impacto operacional

- Deploy necessário: concluído em `https://gril-lac.vercel.app`.
- Migração aplicada: não nesta publicação.
- Compatibilidade/rollback: as migrations são compatíveis com o bundle anterior. Em caso de regressão, o deployment anterior `dpl_DrQ4qMxpKGBBxNPNkCMVPf94HLFy` pode ser promovido novamente sem desfazer migrations nem apagar dados.

## Pendências e riscos

- Homologar visualmente as 29 telas e os fluxos de escrita com dono/gestor.
- Cold start após ociosidade prolongada pode superar um segundo; a meta comprovada é a troca de telas em sessão autenticada após o primeiro aquecimento.
- A publicação ocorreu por solicitação explícita do usuário, que substituiu nesta execução a pendência documental anterior de aguardar homologação humana antes de produção.

## Documentos relacionados

- Decisões atualizadas: nenhuma regra de produto foi alterada.
- Guia de homologação atualizado: o roteiro de desempenho e melhoria contínua já consta em `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
