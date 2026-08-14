# Campanhas e Central orientadas à ação

- Data: 14/08/2026
- Branch: `agent/workspace-redesign-real`
- PR: `#47`
- Status: em homologação

## Objetivo

Completar a repaginação real de Campanhas e Central, substituindo a exposição de estruturas técnicas por uma hierarquia operacional clara, sem alterar regras de negócio, dados ou integrações.

## Comportamento anterior

- Campanhas concentrava inventário, criação e ações em cartões densos, com várias decisões concorrentes e detalhes técnicos na primeira camada.
- A criação exibia todos os campos de uma vez e misturava definição da campanha, automação, mensagens e consentimento.
- A Central abria como um registro cronológico amplo; ações necessárias não ficavam evidentes e o mesmo incidente podia aparecer por mais de uma origem técnica.
- Estados de processamento eram apresentados com rótulos próximos da implementação.

## Novo comportamento

- Campanhas passa a usar uma lista operacional contínua de uma coluna, com métricas de contexto e uma ação principal por registro.
- Importação, edição, exemplos e ações destrutivas permanecem disponíveis por divulgação progressiva.
- A criação de campanha foi dividida em quatro etapas: Campanha, Automação, Mensagens e Consentimento. Os mesmos campos e a mesma action de servidor foram preservados.
- A Central abre em `Precisa agir`, mantém o fluxo completo em `Histórico` e oferece recortes por Pedro e Lionel, Agenda, Campanhas e Integrações.
- Eventos repetidos do mesmo incidente são consolidados na apresentação, mantendo o registro mais acionável, e estados técnicos recebem rótulos compreensíveis para o usuário.
- A paginação permanece limitada a dez registros por página.

## Arquivos alterados

- `src/app/app/campanhas/page.tsx`
- `src/app/app/campanhas/campaign-create-form.tsx`
- `src/app/app/campanhas/campaigns.module.css`
- `src/app/app/central/page.tsx`
- `src/app/app/central/push-subscription.tsx`
- `src/app/app/central/central.module.css`
- `docs/agent/CURRENT_STATE.md`
- `docs/decisions/2026-08-14-workspace-operacional-unificado.md`
- `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`
- `design-qa.md`

## Banco, integrações e efeitos externos

- Nenhuma migration foi criada ou aplicada.
- Supabase e produção não foram alterados.
- Actions, permissões, gates de campanha e contratos de dados existentes foram preservados.
- A branch já existente e o PR `#47` foram mantidos porque esta rodada é continuação direta da repaginação em homologação, registrada no próprio PR; não foi criada uma branch concorrente.

## Validação

- `npm run lint`: aprovado.
- `npm test`: 22 arquivos e 110 testes aprovados.
- `npx next build --webpack`: aprovado, incluindo TypeScript e geração das 46 rotas.
- `git diff --check`: aprovado antes da publicação.
- `npx tsc --noEmit`: a alteração introduzida foi corrigida; o comando isolado ainda reporta três erros preexistentes em testes de `pedro-turn` e `openai-runtime`, enquanto a checagem de tipos do build passa.
- QA visual autenticado da preview: aprovado em Chrome, com comparação lado a lado registrada em `design-qa.md`; a criação progressiva e os filtros `Precisa agir` e `Histórico` foram exercitados sem ações de escrita.
- Console do Chrome em Campanhas e Central: zero avisos e zero erros.
- Checks do PR `#47`: CI e Vercel aprovados após a publicação final.

## Riscos e pendências

- Homologação de produto pelo responsável permanece como próxima etapa; a inspeção técnica autenticada com dados reais foi concluída sem executar ações de escrita.
