# Prompts para preparar um novo Codex

Use esta sequência quando outro desenvolvedor abrir o Gril em uma conta ou computador diferente. O chat deve ser novo e iniciado na raiz do repositório, depois de atualizar a branch padrão.

Envie um prompt por vez e só avance quando a resposta anterior estiver satisfatória.

## 1. Carregar o contexto

```text
Antes de executar qualquer alteração, faça a orientação completa deste projeto.

Leia integralmente:

- AGENTS.md
- docs/agent/README.md
- docs/agent/CURRENT_STATE.md
- os registros mais recentes e relevantes em docs/agent/changes/
- docs/product/README-Pacote-Tecnico-v1.md
- docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md
- docs/operations/PEDRO_BEHAVIOR_TRACEABILITY.md

Depois, inspecione sem modificar nada: branch atual, working tree, remote Git, branch padrão, últimos commits e estrutura principal.

Resuma: produto, arquitetura, integrações, estado atual, comportamento esperado do Pedro, ambientes, pendências, protocolo obrigatório e divergências encontradas.

Não altere arquivos, banco, GitHub ou Vercel.
```

## 2. Validar acessos

```text
Valide somente em modo leitura se este computador está preparado para trabalhar no Gril.

Verifique:

1. GitHub CLI e acesso a supinovahub/Gril;
2. branch padrão phase/01-foundation;
3. Supabase conectado ao projeto frslhzwhaooqtivkzdez;
4. migrations locais e remotas;
5. identidade e acesso Vercel;
6. presença das variáveis locais necessárias, sem mostrar valores;
7. versões de Node.js e npm.

Na Vercel, a identidade esperada é suporteinovahub-7501. Não execute login, logout, troca de conta, alteração de variável, deploy ou qualquer mutação. Não revele tokens, chaves ou arquivos de ambiente.

Classifique cada item como pronto, precisa de configuração ou bloqueado. Continue as demais verificações mesmo se um item falhar.
```

## 3. Preparar o ambiente local

```text
Prepare o ambiente local do Gril sem alterar produção, banco remoto ou credenciais.

Preserve qualquer mudança existente. Instale dependências e execute npm run lint, npm test e npm run build. Confirme que o projeto pode iniciar em localhost, sem realizar testes visuais demorados.

Informe resultados, branch, commit, problemas e se o ambiente está pronto para correções.
```

## 4. Firmar o modo de trabalho

```text
A partir de agora, adote este modo de trabalho para o Gril:

1. Em um prompt de correção, entenda o problema, identifique a causa e trabalhe com rapidez, sem análise ou testes desproporcionais.
2. Não faça testes visuais de UI/UX, salvo quando o defeito depender deles ou quando eu pedir.
3. Antes de editar, atualize referências Git, releia CURRENT_STATE.md e consulte os registros e decisões relacionados.
4. Trabalhe em branch própria por tarefa e não implemente algo já assumido por outro desenvolvedor.
5. Nunca aplique migrations simultaneamente com outro agente; confira local e remoto antes.
6. Toda mudança material gera um arquivo novo em docs/agent/changes/. Atualize estado, decisões e homologação quando aplicável.
7. Quando eu disser Execute, Corrija ou equivalente, você está autorizado a implementar, validar, commitar, fazer push, abrir PR, aguardar checks e integrar. Faça deploy quando a mudança funcional exigir e a identidade Vercel estiver correta.
8. Se eu disser só responda, explique primeiro ou não execute, não faça mutações.
9. Se faltar credencial impossível de contornar, continue o trabalho seguro e depois informe o bloqueio exato.
10. Na resposta final, informe causa, correção, testes, migration, commit, PR, merge e deployment.

Antes de analisar ou implementar qualquer correção funcional:

a. consulte as partes relevantes dos sete documentos iniciais em docs/product/;
b. consulte também docs/decisions/, CURRENT_STATE.md, registros relacionados em docs/agent/changes/, PEDRO_BEHAVIOR_TRACEABILITY.md e o guia de homologação;
c. compare o fluxo originalmente planejado, as decisões posteriores, o código/estado atual e o comportamento observado;
d. considere que decisões posteriores explícitas podem substituir os sete documentos iniciais;
e. não invente uma regra nova apenas para corrigir o sintoma;
f. se for um defeito técnico evidente e a documentação não deixar dúvidas, implemente diretamente quando autorizado;
g. se houver contradição, lacuna ou necessidade de mudar o produto, apresente primeiro o fluxo canônico, a causa, a correção proposta, os impactos e as dúvidas. Não implemente até discutirmos e eu aprovar.

Confirme que entendeu cada regra e diga se está pronto. Não altere nada neste prompt.
```

## 5. Confirmar prontidão

```text
Faça uma última verificação de prontidão, sem modificar nada.

Responda com sim ou não para: contexto carregado, AGENTS.md carregado, GitHub pronto, Supabase correto, Vercel correta, ambiente local validado, protocolo de documentação entendido, risco de conflito conhecido e pronto para receber correções.

Para qualquer não, explique o bloqueio em uma frase.
```

## Modelo de solicitação depois do onboarding

```text
Prompt de correção:

Problema observado:
[...]

Comportamento esperado:
[...]

Consulte o fluxo canônico conforme o protocolo do AGENTS.md. Se houver lacuna ou conflito de produto, explique e discuta comigo antes de implementar. Se for um defeito técnico inequívoco e eu tiver autorizado a execução, corrija de ponta a ponta.
```
