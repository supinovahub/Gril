# Publicação das melhorias de clareza e das features integradas

- Data: 11/08/2026
- Responsável: Codex
- Branch/PR: `agent/ux-flow-clarity`, PR #42
- Commit publicado: `ec800483e220d1645edfec802183cd2b197c4b66`

## Objetivo

Publicar as melhorias de clareza dos fluxos operacionais e garantir que as
features funcionais feitas por outros agentes e ainda ausentes da base fossem
preservadas no mesmo release.

## Escopo

- Dashboard com orientação inicial e links para os cinco fluxos principais.
- Inbox, Pedro, Leads e Agenda com rótulos, explicações e ações mais claros.
- Regra de produção do Pedro restrita a campanhas de reativação liberadas.
- Runtime de IA de campanhas separado do inbound normal, com revalidação e
  retry seguro para decisões estruturadas inválidas.
- Alinhamento do arquivo local da migration de arquivamento com a versão
  aplicada no Supabase (`20260806170711`).

## Estado externo

- Migrations locais e remotas conferidas até `20260810140144`; nenhuma migration
  foi aplicada durante este deploy porque o Supabase já estava alinhado.
- Deployment Vercel `dpl_CsxDCbaVsw6hxLGpP1bpaCkj4WLW` publicado com a conta
  `suporteinovahub-7501`, target `production`, status `READY`.
- Alias público atualizado: `https://gril-lac.vercel.app`.

## Validação

- `npm run lint -- --no-warn-ignored`: passou.
- `npm test`: 22 arquivos e 110 testes passaram.
- `npm run build`: compilação, TypeScript e 46 rotas passaram.
- Build remoto da Vercel: concluído com 46 rotas e status `READY`.
- `/login`: HTTP 200.
- `/app/chat-pedro`: HTTP 307 para login, conforme proteção esperada.
- Logs de erro do deployment na última hora: nenhum.

## Pendências e riscos

- A homologação visual e operacional autenticada continua pendente conforme o
  guia canônico; nenhuma mensagem real foi enviada como parte desta publicação.
- O `vercel build --prod` local não conseguiu criar symlinks no Windows após
  compilar com sucesso; por isso o bundle final foi construído remotamente pela
  Vercel, a partir do commit canônico já mergeado.
