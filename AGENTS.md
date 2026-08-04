<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Gril — protocolo obrigatório para agentes

Este repositório é trabalhado por pessoas e agentes em contas e computadores diferentes. O Git é a memória compartilhada; histórico de chat, memória local e suposições do modelo não são fonte de verdade.

## Antes de qualquer alteração

1. Leia `docs/agent/CURRENT_STATE.md` por inteiro.
2. Leia `docs/agent/README.md` e os registros recentes ou diretamente relacionados em `docs/agent/changes/`.
3. Leia os documentos de produto e decisões aplicáveis. Comece por `docs/product/README-Pacote-Tecnico-v1.md`; decisões posteriores registradas em `docs/decisions/` e `docs/operations/` substituem regras antigas quando isso estiver explícito.
4. Execute `git status --short --branch`, confira a branch e preserve qualquer mudança existente que não seja sua.
5. Execute `git fetch origin` antes de iniciar uma mudança material. Não faça merge, rebase, checkout destrutivo ou sobrescrita automática de trabalho alheio.
6. Verifique fontes vivas quando a tarefa depender de estado mutável: GitHub para branches/PRs, Supabase para schema/migrations/dados e Vercel para deployment/variáveis. Documentação histórica não prova estado atual.

## Coordenação entre desenvolvedores e agentes

- Uma tarefa por branch. Dois agentes não devem implementar a mesma feature ou migration simultaneamente.
- A branch padrão é a informada em `CURRENT_STATE.md`; crie uma branch curta a partir do `origin` atualizado, salvo correção emergencial explicitamente autorizada pelo usuário.
- Use GitHub Issues ou PRs para indicar responsável, escopo e conflitos. O arquivo de estado não é um sistema de lock.
- O banco Supabase remoto é único e não há staging. Antes de aplicar migration, confira `npx supabase migration list --linked`; migrations são serializadas e nunca devem ser aplicadas em paralelo por dois agentes.
- Mudança externa feita somente no banco, Supabase, GitHub ou Vercel também precisa de registro, mesmo sem diff de código.

## Contrato de documentação

Toda mudança material deve criar um arquivo novo em `docs/agent/changes/` usando `docs/agent/CHANGE_TEMPLATE.md`. Não concentre o histórico em um único changelog, pois arquivos independentes reduzem conflitos entre branches.

Antes de concluir uma tarefa:

1. Registre objetivo, comportamento anterior e novo, arquivos, migrations, validações, efeitos externos, riscos e pendências.
2. Atualize `docs/agent/CURRENT_STATE.md` se a mudança alterar produção, branch padrão, banco, integrações, funcionalidades comprovadas, pendências ou protocolo operacional.
3. Atualize `docs/decisions/` quando houver nova regra de produto ou quando uma decisão substituir outra.
4. Atualize `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md` quando o fluxo que um humano precisa testar mudar.
5. Inclua código e documentação no mesmo commit ou PR. O registro pode identificar o commit como “o commit que contém este arquivo”; não invente hash antes do commit existir.

Correções exclusivamente tipográficas dentro de documentação podem ser agrupadas em um único registro. Não copie transcrições completas de chat, prompts privados, tokens, segredos ou dados pessoais para o repositório.

## Verificação mínima

- Código TypeScript/React: `npm run lint`, `npm test` e `npm run build`, na proporção do risco e respeitando pedido explícito por correção rápida.
- Banco: migration local criada pelo Supabase CLI, lint do banco e confirmação de que local/remoto estão alinhados.
- Deploy: confirme conta, projeto, status `Ready` e rota pública. Nunca conclua apenas porque a CLI retornou uma URL.
- Se alguma verificação não foi executada, registre claramente o motivo e o risco residual.

## Identidades e ambientes canônicos

- GitHub: `supinovahub/Gril`.
- Supabase: projeto `frslhzwhaooqtivkzdez`.
- Produção: `https://gril-lac.vercel.app`.
- Neste host Windows, antes de qualquer alteração Vercel, execute `npx --yes vercel@latest --global-config "C:\Users\Windows 11\.vercel-profiles\supinovahub-7501" whoami` e prossiga somente se o resultado for `suporteinovahub-7501`. Em outro computador, use um perfil local isolado equivalente, confirme a mesma identidade e nunca reutilize silenciosamente a conta padrão da máquina.
- Não execute `vercel login`, `vercel logout` nem altere outros perfis Vercel deste computador.
- Segredos ficam em `.env.local`, Supabase Vault ou Vercel; nunca entram em Markdown, logs versionados ou código cliente.

Em caso de divergência entre este arquivo e uma instrução explícita e atual do usuário, siga o usuário e registre a exceção no documento da mudança.
