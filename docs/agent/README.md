# Memória compartilhada dos agentes

Esta pasta permite que desenvolvedores usando contas diferentes do Codex reconstruam o mesmo contexto operacional a partir do repositório.

## Fontes e responsabilidades

- `AGENTS.md`: protocolo obrigatório carregado automaticamente pelo Codex.
- `DEVELOPER_HANDOFF.md`: ponto de entrada para a transição do desenvolvimento principal, com contexto, estado vivo verificado e prioridades do sucessor.
- `CURRENT_STATE.md`: retrato curto do estado atual; é atualizado, não usado como diário.
- `ONBOARDING_PROMPTS.md`: sequência pronta para preparar um novo Codex em outra conta ou computador.
- `CHANGE_TEMPLATE.md`: contrato mínimo de um registro de mudança.
- `changes/`: um arquivo por mudança material, incluindo alterações externas sem diff local.
- `../product/`: escopo e regras de produto consolidadas.
- `../decisions/`: decisões duráveis por fase.
- `../operations/`: homologação, evidências e runbooks.
- `../operations/AI_CONVERSATION_RUNBOOK.md`: arquitetura, diagnóstico, homologação e publicação segura do núcleo conversacional do Pedro.

## Início de uma tarefa

1. Atualize referências remotas com `git fetch origin`.
2. Confirme branch e working tree com `git status --short --branch`.
3. Em uma entrada nova no projeto, leia `DEVELOPER_HANDOFF.md`; em qualquer tarefa, leia `CURRENT_STATE.md` inteiro.
4. Leia os registros de mudança relacionados à tarefa; para orientação geral, comece pelos mais recentes.
5. Leia a decisão e o documento de produto aplicáveis.
6. Verifique ao vivo qualquer fato que possa ter mudado desde o último registro.
7. Crie uma branch própria e deixe o escopo visível no Issue ou PR correspondente.

## Encerramento de uma tarefa

1. Valide a mudança na proporção do risco.
2. Crie `changes/AAAA-MM-DD-descricao-curta.md` a partir do template.
3. Atualize `CURRENT_STATE.md` somente quando o estado corrente mudar.
4. Atualize decisão e guia de homologação quando o comportamento de produto mudar.
5. Revise `git diff --check` e `git status`.
6. Faça commit e push de código e documentação juntos.
7. Após migration ou deploy, confirme o estado remoto e registre o resultado.

## Concorrência

O histórico usa um arquivo por mudança para reduzir conflitos. Mesmo assim:

- não compartilhe uma working tree suja;
- não aplique migrations simultaneamente;
- não faça deploy a partir de uma branch desatualizada;
- não trate `CURRENT_STATE.md` como lock;
- resolva divergências pelo Git, pelo estado remoto verificado e pelas decisões versionadas — nunca pela lembrança de um chat.

## O que não registrar

- chaves, tokens, cookies ou conteúdo de `.env.local`;
- payloads reais com dados pessoais;
- transcrições completas de conversas privadas;
- raciocínio interno do agente;
- afirmações de “pronto” sem evidência reproduzível.
