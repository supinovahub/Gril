# Publicacao do Chat com Pedro assisted em producao

- Data: 06/08/2026
- Responsavel: Codex
- Branch: `fix/chat-pedro-assisted-suggestions`
- Commits publicados: `9d566bc` e `e565f68`

## Escopo

A fila de sugestoes da IA em modo `assisted` foi publicada no Chat com Pedro.
O operador pode revisar a resposta exata, edita-la, aprova-la e envia-la,
ensinar o Pedro e gerar outra sugestao, ou descarta-la. O Inbox continua sendo
o canal da conversa externa, e os dois caminhos usam a mesma revisao
transacional.

## Supabase

- Projeto remoto: `frslhzwhaooqtivkzdez`.
- A migration `20260806165000_chat_pedro_assisted_queue.sql` foi aplicada
  com `npx supabase db push --linked --yes`.
- A lista de migrations confirmou local/remoto alinhados ate essa versao.
- Consulta remota confirmou as duas triggers, as funcoes de sincronizacao e a
  constraint de origem do topico.
- O cache local do catalogo nao foi gerado porque Docker Desktop nao esta
  instalado; isso nao impediu a aplicacao remota da migration.

## Vercel

- Conta confirmada: `suporteinovahub-7501`.
- Projeto: `brio5/gril`.
- O deployment preview `gril-bxbhr5y24-brio5.vercel.app`, construido a partir
  do commit `e565f68`, foi promovido para producao.
- Deployment de producao resultante:
  `gril-1dv2hcpa3-brio5.vercel.app`, status `READY`.
- Alias publico: `https://gril-lac.vercel.app`.
- Verificacao publica: `/login` respondeu HTTP 200.
- Logs de erro do deployment na ultima hora: nenhum.
- Uma tentativa anterior de `deploy --prod` ficou `BLOCKED`; ela nao foi
  promovida nem ficou como deployment ativo.

## Validacao e pendencias

- `npm run lint`, `npm test` e `npm run build` haviam passado antes da
  publicacao; o build gerou 46 rotas.
- A homologacao visual e operacional do fluxo com um lead real de teste ainda
  precisa ser feita pelo usuario conforme o guia de homologacao.
- Nenhum envio externo foi realizado durante a publicacao.
