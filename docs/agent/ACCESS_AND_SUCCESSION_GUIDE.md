# Contas, acessos e assunção do Gril

Este documento organiza os serviços usados pelo Gril e o procedimento para transferir a responsabilidade técnica a outro desenvolvedor. Ele complementa `DEVELOPER_HANDOFF.md` e não substitui `AGENTS.md`, `CURRENT_STATE.md` ou os runbooks operacionais.

## Escopo e validade

- Retrato verificado em **24 de agosto de 2026**.
- GitHub, Supabase e Vercel foram reconsultados em modo leitura.
- Identidades não observáveis sem abrir um segredo ou dado pessoal são marcadas como **não identificadas**.
- O sucessor deve revalidar todas as informações mutáveis antes de agir.
- Este arquivo não é um cofre de senhas nem uma lista de dados pessoais.

## Regra de segurança da transferência

Nunca registre aqui, em Issue, PR, commit ou chat:

- senha;
- token de GitHub, Supabase, Vercel, OpenAI, UAZAPI ou Meta;
- conteúdo de `.env.local`;
- chave `service_role`;
- segredo de webhook ou worker;
- chave privada de Web Push;
- cookie ou código de recuperação;
- telefone pessoal ou número operacional completo;
- transcrição de conversa real;
- QR Code do WhatsApp.

O sucessor deve receber **convites individuais** e configurar a própria autenticação multifator. Compartilhar a conta pessoal do desenvolvedor anterior não é uma transferência aceitável.

## Matriz canônica de contas e serviços

| Serviço | Identidade ou recurso confirmado | Estado no retrato | Como o sucessor deve assumir |
| --- | --- | --- | --- |
| GitHub | conta CLI ativa `Uugaren`; conta `supinovahub` também autenticada localmente, mas inativa | acesso ao repositório confirmado | receber convite individual para `supinovahub/Gril`; usar a própria conta e confirmar permissões |
| Repositório GitHub | `supinovahub/Gril` | branch padrão `phase/01-foundation` no commit `1ee46166965a`; PR #79 aberta | clonar o repositório, fazer fetch e trabalhar em branch/worktree próprios |
| Vercel | usuário obrigatório `suporteinovahub-7501`; time `brio5`; projeto `gril` | produção `Ready` no alias `https://gril-lac.vercel.app` | receber acesso individual ao time e usar perfil CLI isolado |
| Supabase | organização do projeto canônico: `Br.io` (`lkjqacdkpvpwqxshksix`) | projeto `Gril` ativo e saudável | receber convite para a organização/projeto e selecionar sempre pelo project ref |
| Supabase canônico | `frslhzwhaooqtivkzdez`, região `sa-east-1` | único banco remoto autorizado pelo `AGENTS.md`; sem staging | confirmar link e migrations antes de qualquer SQL ou migration |
| Codex/ChatGPT | identidade da conta não identificada nem necessária para reconstruir o projeto | chats e memória local não são fonte de verdade | usar uma conta própria e executar o onboarding versionado no repositório |
| OpenAI API | provedor OpenAI; perfil padrão observado com modelo `gpt-5.6-terra` | credencial resolvida no servidor; identidade de billing não identificada | receber convite ao projeto/organização OpenAI ou capacidade formal de rotação e billing |
| UAZAPI | conexão de WhatsApp operacional existente | identidade da conta, instância e número não documentados por segurança | receber acesso individual ao painel e identificar a instância atual sem gerar novo QR |
| WhatsApp operacional | número conectado à conexão atual | número omitido; troca de conexão é operação de risco | obter números de homologação controlados por canal seguro e não substituir o número durante onboarding |
| Meta | código suporta Meta Cloud e entrada por Meta Ads | Business Manager, WABA, app e token não foram identificados neste levantamento | confirmar com o dono se a operação usa conta Meta viva e solicitar convite separado, se aplicável |
| Aplicação Gril | perfis Dono e Corretor | credenciais e identidades pessoais omitidas | criar usuários individuais de teste/gestão e validar cada papel separadamente |
| Web Push | par de chave pública/privada configurável por ambiente | não é uma conta; valores não foram lidos | garantir acesso às variáveis Vercel para rotação e contingência |
| DNS/domínio | alias canônico `gril-lac.vercel.app` | nenhum domínio externo adicional foi confirmado | confirmar no projeto Vercel se um domínio próprio for adicionado futuramente |

## GitHub

### Estado confirmado

- Host: `github.com`.
- Repositório: `supinovahub/Gril`.
- Conta ativa neste host: `Uugaren`.
- Outra conta autenticada, mas inativa: `supinovahub`.
- Branch padrão: `phase/01-foundation`.
- PR do handoff: [#79](https://github.com/supinovahub/Gril/pull/79).
- A proteção da branch padrão estava desativada no retrato inicial.

### Transferência correta

1. Convide o sucessor pelo usuário GitHub dele.
2. Dê somente as permissões necessárias para branches, PRs, Actions e configurações.
3. Exija autenticação multifator na organização quando possível.
4. Confirme que ele consegue consultar PRs, checks e configurações sem usar um token alheio.
5. Depois da transição, revogue tokens e acessos do desenvolvedor anterior conforme a política da organização.
6. Não peça ao sucessor para ativar localmente a conta `supinovahub` já armazenada nesta máquina.

### Verificação do sucessor

```powershell
gh auth status
gh repo view supinovahub/Gril
git remote -v
git fetch origin
git symbolic-ref --short refs/remotes/origin/HEAD
gh pr list --repo supinovahub/Gril --state open
```

O protocolo Git completo está em `AGENTS.md`. Uma tarefa deve ter branch própria, responsável visível e worktree sem alterações de terceiros.

## Supabase

### Projeto canônico

- Organização informada pelo projeto: `Br.io`.
- Organization ID: `lkjqacdkpvpwqxshksix`.
- Projeto: `Gril`.
- Project ref: `frslhzwhaooqtivkzdez`.
- Região: `sa-east-1`.
- Estado observado: `ACTIVE_HEALTHY`.
- PostgreSQL: linha 17.

O Gril possui um único banco remoto e **não possui Supabase staging canônico**. Toda migration é uma operação serializada contra esse projeto.

### Armadilha: projetos legados visíveis

O acesso atual também enxerga projetos históricos em outra organização, `InovaHub`. Eles não são o banco do Gril atual:

| Projeto histórico | Project ref | Orientação |
| --- | --- | --- |
| `Studiosp` | `ixttqwjfaeybaisglxee` | legado; não usar para o Gril |
| `Studiosp Staging` | `ffeyrxsdlgcfwgnsnwlj` | staging legado; não usar para o Gril |
| `GrillStudio` | `vummfrwixxmshsepqqlz` | projeto antigo; não usar como canônico |
| `Dash-Studio` | `vcpswwvqooyrsnsqkzbg` | inativo e legado |
| `Studiosp Greenfield` | `mjburncdvqcqdywjjtup` | inativo e legado |

Nome parecido não prova identidade. Sempre compare o project ref com `frslhzwhaooqtivkzdez`.

### Transferência correta

1. Convide a conta Supabase do sucessor para a organização/projeto correto.
2. Defina quem mantém billing, backups, recuperação e autenticação multifator.
3. Dê acesso ao banco e aos logs apenas na medida necessária.
4. Garanta que existe pelo menos um segundo administrador confiável antes de remover o anterior.
5. Não envie a senha do banco nem a `service_role`; prefira convite e rotação.
6. Documente qualquer rotação sem registrar o valor novo.

### Verificação do sucessor

```powershell
npx supabase --version
npx supabase projects list
npx supabase migration list --linked
```

Antes de migration, o sucessor deve confirmar que ninguém mais está aplicando banco, comparar local/remoto e seguir `AGENTS.md`. `db push`, migration ou SQL de escrita não fazem parte do onboarding.

## Vercel

### Estado confirmado

- Identidade exigida pelo projeto: `suporteinovahub-7501`.
- Time: `brio5`.
- Projeto: `gril`.
- Alias público: `https://gril-lac.vercel.app`.
- Deployment de produção observado: `dpl_DBMfqKASbXNHQzAQZdn79eWsgXqo`.
- Estado observado: `Ready`.
- Região das Functions: `gru1`.

Neste host Windows, o perfil isolado está em:

```text
C:\Users\Windows 11\.vercel-profiles\supinovahub-7501
```

Esse caminho é local desta máquina. Em outro computador, crie um perfil isolado equivalente e confirme a mesma identidade. Não copie tokens do perfil antigo.

### Transferência correta

1. Convide o sucessor para o time/projeto Vercel com a própria conta.
2. Confirme acesso a deployments, logs, variáveis e billing conforme a função.
3. Garanta um segundo administrador antes de remover o anterior.
4. Não reutilize a conta padrão de uma máquina compartilhada.
5. Nunca execute `vercel login` ou `vercel logout` neste host, conforme `AGENTS.md`.
6. Não promova preview como produção sem confirmar que o commit já pertence à branch padrão atual.

### Verificação do sucessor neste host

```powershell
npx --yes vercel@latest --global-config "C:\Users\Windows 11\.vercel-profiles\supinovahub-7501" whoami
npx --yes vercel@latest --global-config "C:\Users\Windows 11\.vercel-profiles\supinovahub-7501" inspect gril-lac.vercel.app
```

O primeiro comando precisa retornar exatamente `suporteinovahub-7501`.

## Codex e ChatGPT

A conta usada para conversar com o Codex não é a memória compartilhada do projeto. O sucessor pode usar outra conta, outro computador e outro chat, desde que o repositório esteja atualizado.

### O que é transferível

- `AGENTS.md`;
- `docs/agent/`;
- `docs/product/`;
- `docs/decisions/`;
- `docs/operations/`;
- histórico Git, Issues e PRs.

### O que não é transferível nem confiável

- histórico privado deste chat;
- memória da conta anterior;
- resumo local não versionado;
- skill instalada apenas no perfil local;
- suposição lembrada pelo modelo;
- credencial guardada pela máquina anterior.

### Como iniciar uma nova conta do Codex

1. Abra um chat novo na raiz do clone atualizado.
2. Confirme que `AGENTS.md` foi carregado.
3. Execute, um por vez, os cinco prompts de `ONBOARDING_PROMPTS.md`.
4. Execute depois o prompt **Assumir o desenvolvimento principal**.
5. Compare a resposta do agente com o estado vivo dos fornecedores.
6. Não permita alteração até a orientação e a validação de acessos terminarem.

Não foi criada uma skill de handoff porque ela duplicaria regras mutáveis e poderia ficar presa a uma conta local. Se uma automação futura for necessária, ela deve consultar estes documentos versionados.

## OpenAI API

### Estado confirmado

- O runtime usa o provedor OpenAI.
- O perfil padrão observado aponta para `gpt-5.6-terra` com raciocínio e verbosidade baixos.
- A credencial é resolvida no servidor por uma integração protegida.
- Organização, projeto de billing, e-mail do titular e método de pagamento não foram identificados neste levantamento.

Uma conta ChatGPT/Codex e uma organização da OpenAI API são acessos diferentes. Não presuma que entrar no Codex concede acesso ao billing ou à credencial do runtime.

### Transferência correta

1. Identifique fora do repositório quem é o proprietário da organização/projeto OpenAI.
2. Convide o sucessor ou outro administrador de contingência.
3. Confirme acesso a uso, limites, billing e rotação da chave.
4. Planeje a rotação da credencial quando o desenvolvedor anterior perder acesso.
5. Atualize a integração server-side pelo caminho administrativo aprovado.
6. Valide no simulador/assisted antes de liberar qualquer envio real.
7. Nunca grave a chave em Markdown, código cliente ou variável `NEXT_PUBLIC_*`.

## UAZAPI, WhatsApp e Meta

### UAZAPI e WhatsApp

A operação possui uma conexão ativa, mas este documento omite intencionalmente número, token, hostname específico e identificador da instância.

Para assumir:

1. receber convite ou conta individual no painel do fornecedor;
2. identificar a instância e o número atuais sem alterar configuração;
3. confirmar URL do webhook, status, inbound e identidade da conexão;
4. receber números controlados de homologação por canal seguro;
5. validar entrada, saída, mídia e resposta citada em `assisted`;
6. não gerar QR Code nem substituir a instância durante a inspeção inicial;
7. não reprocessar mensagens ou limpar histórico para “testar”.

Trocar o número conectado pode arquivar uma conexão, cancelar pendências e afetar a projeção do Inbox. Essa operação exige autorização explícita e runbook próprio.

### Meta

O código possui integração com Meta Cloud e webhooks de formulários, mas o levantamento não comprovou qual Business Manager, app, WABA ou conta de anúncios está em uso. O dono deve informar se essa integração está operacional e convidar o sucessor nos ativos corretos.

O sucessor não deve criar novo app, trocar token, alterar webhook ou vincular WABA durante onboarding.

## Aplicação Gril e papéis humanos

O sucessor precisa de acessos separados para validar autorização:

- **Dono:** configuração, integrações, IA, allowlist, campanhas, equipe, auditoria e visão completa;
- **Corretor:** somente operação e dados permitidos para seus leads/atribuições.

Nunca teste permissões apenas com o Dono. Uma funcionalidade pode funcionar para o administrador e continuar quebrada ou insegura para o Corretor.

Contas de homologação devem ser individuais, identificáveis e removíveis. Não registre usuário, e-mail ou senha delas neste arquivo.

## Variáveis e segredos que precisam de custódia

O `.env.example` confirma estas famílias de configuração, sem valores:

- URL e chave publicável do Supabase;
- `SUPABASE_SERVICE_ROLE_KEY`;
- segredo de ingestão de webhook;
- segredo do worker;
- versão da Meta Graph API;
- allowlist de hosts UAZAPI;
- chaves pública e privada de Web Push;
- URL e identificação do ambiente da aplicação.

Além delas, credenciais de fornecedores podem estar nas integrações server-side, no Supabase Vault ou nas variáveis Vercel.

O sucessor deve saber **quem pode rotacionar cada segredo**, mas não precisa receber todos os valores diretamente. Confirme também quem responde por billing, recuperação e incidentes em cada fornecedor.

## Registro privado que o responsável atual deve preencher

As informações abaixo são necessárias, mas devem ficar num gerenciador de senhas ou sistema privado da empresa, nunca no Git:

| Serviço | Titular atual | Administrador reserva | Sucessor convidado | MFA confirmado | Billing confirmado | Recuperação testada |
| --- | --- | --- | --- | --- | --- | --- |
| GitHub | preencher fora do Git | preencher | sim/não | sim/não | n/a ou confirmar | sim/não |
| Supabase `Br.io` | preencher fora do Git | preencher | sim/não | sim/não | sim/não | sim/não |
| Vercel `brio5` | preencher fora do Git | preencher | sim/não | sim/não | sim/não | sim/não |
| OpenAI API | preencher fora do Git | preencher | sim/não | sim/não | sim/não | sim/não |
| UAZAPI | preencher fora do Git | preencher | sim/não | sim/não | sim/não | sim/não |
| Meta, se ativa | preencher fora do Git | preencher | sim/não | sim/não | sim/não | sim/não |
| E-mail/conta Dono do Gril | preencher fora do Git | preencher | sim/não | sim/não | n/a | sim/não |

## Procedimento do sucessor

### Etapa 1 — somente leitura

1. Clone ou atualize o repositório.
2. Leia `AGENTS.md`, `DEVELOPER_HANDOFF.md`, este guia e `CURRENT_STATE.md`.
3. Execute o onboarding do Codex.
4. Confirme GitHub, Supabase e Vercel com os comandos deste documento.
5. Confirme os acessos administrativos fora do Git: OpenAI, UAZAPI, Meta e aplicação.
6. Compare PRs, migrations e deployment com o retrato documentado.
7. Registre diferenças antes de alterar qualquer coisa.

### Etapa 2 — ambiente local

1. Preserve qualquer worktree suja existente.
2. Crie branch/worktree a partir da branch padrão remota atualizada.
3. Instale dependências com a versão compatível de Node.js.
4. Confirme presença das variáveis sem imprimir valores.
5. Execute `npm run lint`, `npm test` e `npm run build`.
6. Não use esse passo para enviar WhatsApp, aplicar migration ou fazer deploy.

### Etapa 3 — assumir o trabalho prioritário

1. Crie ou assuma uma Issue para a correção conversacional.
2. Abra branch nova a partir de `origin/phase/01-foundation`.
3. Use a PR #66 somente como referência.
4. Resolva com o dono as decisões de duração da call e identidade do assistente.
5. Reimplemente a validação de horário na base atual.
6. Valide primeiro em testes e em `assisted` com número controlado.
7. Registre código, documentos, efeitos externos, checks e homologação no mesmo PR.

### Etapa 4 — retirada do desenvolvedor anterior

Somente depois de o sucessor comprovar acesso e recuperação:

1. rotacione credenciais que pertenciam ao desenvolvedor anterior;
2. remova sessões e tokens pessoais antigos;
3. ajuste membership de GitHub, Supabase, Vercel, OpenAI, UAZAPI e Meta;
4. preserve uma segunda conta administrativa da empresa;
5. confirme que CI, deploy, worker, webhooks e WhatsApp continuam funcionando;
6. registre a mudança externa em `docs/agent/changes/`, sem registrar segredos.

## Critério de assunção concluída

O sucessor está pronto quando:

- usa contas próprias com MFA;
- conhece o administrador e o canal de recuperação de cada fornecedor;
- acessa GitHub, Supabase, Vercel, OpenAI, UAZAPI e Gril conforme sua função;
- distingue o Supabase canônico dos projetos legados;
- reproduz lint, testes e build localmente;
- entende que não existe Supabase staging;
- sabe que production e allowlist exigem autorização do dono;
- consegue explicar o fluxo do Pedro e o defeito de horário pendente;
- assumiu publicamente a primeira Issue/PR;
- não depende do chat, token ou computador do desenvolvedor anterior.

Se qualquer item falhar, mantenha o acesso anterior como contingência e registre o bloqueio exato. Não improvise compartilhamento de senha para “terminar” a transição.
