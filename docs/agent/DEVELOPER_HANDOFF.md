# Transição do desenvolvimento principal

Este documento é o ponto de entrada para quem assumir o desenvolvimento do Gril. Ele explica o produto, separa fatos comprovados de pendências e registra o retrato técnico e operacional existente na saída do desenvolvedor principal anterior.

## Como usar este documento

- Data do retrato: **24 de agosto de 2026, 12h10 BRT**.
- Base Git inspecionada: `origin/phase/01-foundation` no commit `1ee4616`.
- Este é um retrato de transição, não um lock nem uma fonte viva. Antes de agir, refaça as verificações da seção [Primeiro acesso](#primeiro-acesso).
- `docs/agent/CURRENT_STATE.md` continua sendo o retrato curto que deve evoluir com o projeto.
- Não copie segredos, dados pessoais ou conversas reais para este ou qualquer outro documento.

Use estes rótulos ao ler o handoff:

- **Confirmado em produção:** código integrado, deployment `Ready` e evidência operacional compatível.
- **Implementado, não homologado:** existe código, mas falta comprovação humana ponta a ponta.
- **Pendente de integração:** existe trabalho em branch ou PR, mas ele não faz parte da base atual.
- **Dívida operacional:** não é necessariamente um defeito do produto, mas aumenta o risco de manutenção.
- **Decisão necessária:** há uma escolha de produto ou operação que não pode ser feita silenciosamente por um desenvolvedor.

## Ordem das fontes de verdade

O Gril foi desenvolvido por pessoas e agentes em ambientes diferentes. Histórico de chat e memória local não valem como especificação. Para reconstruir uma regra:

1. leia os sete documentos iniciais ligados por `docs/product/README-Pacote-Tecnico-v1.md`;
2. aplique decisões posteriores explícitas em `docs/decisions/` e registros materiais em `docs/agent/changes/`;
3. compare a regra resultante com o código e as migrations da branch padrão atual;
4. confira o estado mutável no GitHub, Supabase e Vercel;
5. diferencie comportamento apenas implementado de comportamento realmente homologado.

Uma decisão posterior explícita pode substituir a especificação inicial. Em conflito não resolvido, pare e peça decisão ao responsável de produto.

Existe ainda um acervo histórico externo chamado Studiosp. Ele ajuda a explicar a origem de algumas regras, mas cita branches, projetos Supabase e ambientes antigos que não são mais canônicos. Não use esse acervo para operar o Gril e não mantenha regras duplicadas nele. O repositório atual prevalece.

## O que o Gril é

O Gril é um CRM imobiliário operacional com um SDR conversacional chamado Pedro. O objetivo da primeira entrega é substituir o trabalho pré-call de um SDR humano:

1. receber ou reativar um lead pelo WhatsApp;
2. conversar de forma natural e entender o contexto completo antes de agir;
3. coletar e normalizar os fatos mínimos de qualificação;
4. responder somente com conhecimento e condições autorizados;
5. apresentar materiais ou oportunidades compatíveis dentro das regras;
6. oferecer um horário real e criar a reserva de forma transacional;
7. preparar o resumo e distribuir a call para a operação humana.

Depois da call, proposta, negociação, contrato, venda e perda são fatos humanos registrados no CRM. O Pedro não vende, não negocia, não inventa condição comercial, não recomenda uma unidade específica e não declara um fato humano como concluído.

O primeiro caso de uso real foi a reativação de base, mas o mesmo núcleo atende inbound normal. A ambição de produto é pelo menos 95% de autonomia nos casos elegíveis, ao menos 90% de extração correta dos fatos mínimos e tratamento humano de 100% dos casos críticos. Autonomia nunca elimina auditoria, idempotência, opt-out, controle do dono ou contingência humana.

## A identidade e o comportamento canônico do Pedro

As decisões posteriores ao pacote inicial definem estes invariantes:

- o Pedro lê a mensagem dentro do contexto completo da conversa; palavra-chave isolada não executa efeito durável;
- a saída estruturada do modelo é a fonte exata do plano de ação; o backend valida e executa o que foi solicitado, sem completar, trocar ou adivinhar ações;
- se uma sugestão assistida for editada por humano, o plano de ação antigo é invalidado;
- ao ser perguntado pela primeira vez se é IA ou quem está falando, responde de forma breve e natural como assistente do Pedro Sifuentes; não afirma ser o próprio Pedro, não afirma ser humano e não faz uma negação artificial de IA;
- insistência sobre a identidade pode gerar escalonamento silencioso `identity_question`, desde que os controles contextuais sejam satisfeitos;
- escalonamento sem pedido explícito exige evidência e confiança mínima de `0.8`;
- projetos, mídias e calls só podem ser executados quando seus identificadores e horários pertencem ao conjunto autorizado para aquele turno;
- uma call existente no futuro não pode ser tratada como concluída nem receber nova reserva por inferência;
- no modo assistido, Inbox e Chat com Pedro revisam a mesma sugestão e a mesma transação; o chat interno não envia livremente ao WhatsApp.

As fontes principais são:

- `docs/decisions/contextual-controls-after-ai.md`;
- `docs/decisions/pedro-explicit-actions-source-of-truth.md`;
- `docs/decisions/chat-pedro-assisted-queue.md`;
- `docs/decisions/2026-08-18-identidade-assistente-pedro.md`;
- `docs/operations/PEDRO_BEHAVIOR_TRACEABILITY.md`;
- `docs/operations/AI_CONVERSATION_RUNBOOK.md`.

## Estado encontrado na transição

### GitHub

**Confirmado em produção:**

- repositório: `supinovahub/Gril`;
- branch padrão: `phase/01-foundation`;
- commit atual da branch padrão no retrato: `1ee46166965a`;
- o check de qualidade do commit estava verde;
- as entregas mais recentes incluem reconciliação do Inbox, relógio e ordem cronológica, identidade do WhatsApp, envio feito pelo celular conectado, notificações de navegador, respostas citadas e Realtime em aba de navegador em segundo plano.

**Dívidas operacionais:**

- a proteção da branch padrão estava desativada;
- não havia Issues abertas para representar propriedade ou prioridade do trabalho;
- havia várias PRs antigas, drafts e branches divergentes. Não use a lista de branches como backlog e não mescle branches antigas em bloco;
- `docs/agent/CURRENT_STATE.md` acumula trechos históricos e duplicações. Leia-o, mas confirme afirmações mutáveis ao vivo.

PRs que exigem uma decisão consciente:

| PR | Estado no retrato | Orientação |
| --- | --- | --- |
| [#66 — tom do Pedro e horário da call](https://github.com/supinovahub/Gril/pull/66) | draft, conflitante, 13 commits atrás e 3 à frente | usar como referência da correção; não mesclar como está |
| [#65 — identidade em produção](https://github.com/supinovahub/Gril/pull/65) | limpa, mas 13 commits atrás | reescrever ou encerrar; o registro de allowlist não representa o estado vivo atual |
| #67, #63, #62, #52 e #24 | documentação antiga e conflitante | revisar e encerrar ou reimplementar somente o que ainda for válido |
| #45 | redesign baseado em uma base antiga | tratar como iniciativa separada; nunca misturar com a correção conversacional |
| #53 | documentação de colaboração | revisar propriedade e utilidade antes de integrar |

### Supabase

**Confirmado ao vivo em modo leitura:**

- projeto canônico único: `frslhzwhaooqtivkzdez`;
- estado: `ACTIVE_HEALTHY`, região `sa-east-1`, PostgreSQL 17.6;
- na branch padrão atual, 178 migrations locais e remotas estavam alinhadas;
- última migration remota: `20260819165442_fix_whatsapp_identity_and_device_outbound`;
- perfil de modelo padrão ativo: OpenAI `gpt-5.6-terra`, raciocínio `low`, verbosidade `low`;
- a organização operacional estava em modo global e inbound **assistido**;
- a reativação estava liberada, mas a configuração observada também estava em **assistido**;
- havia **zero** números com allowlist inbound ativa.

Consequência prática: conversas antigas podem guardar `ai_mode = production`, mas isso não prova que o envio autônomo esteja ativo agora. A configuração corrente, a elegibilidade e o modo da execução devem ser vistos em conjunto.

Retrato agregado dos últimos 14 dias, sem conteúdo pessoal:

- assistido: 60 execuções concluídas, 3 falhas e 1 execução ainda marcada como `running` desde 18/08;
- produção: 14 execuções concluídas e 1 bloqueada; a última conclusão observada foi em 19/08;
- simulador: 17 concluídas e 1 falha;
- 17 sugestões de IA pendentes, entre 19/08 e 24/08;
- 38 threads do Chat com Pedro pendentes: 6 de sugestão assistida, 30 ligadas a envio externo pelo celular e 2 manuais;
- 3 falhas recentes com `openai_tool_arguments_invalid`;
- nenhuma pausa sistêmica ativa e nenhuma orientação humana ativa foram encontradas.

Esses números são uma fotografia, não uma meta. A execução antiga em `running`, as sugestões pendentes e as threads externas devem ser triadas sem apagar histórico nem alterar o banco diretamente.

### Vercel

**Confirmado em produção:**

- identidade esperada e verificada: `suporteinovahub-7501`;
- projeto/alias público: `https://gril-lac.vercel.app`;
- deployment de produção observado: `dpl_DBMfqKASbXNHQzAQZdn79eWsgXqo`;
- estado: `Ready`, criado em 20/08/2026;
- `/login` respondeu `200`;
- `/app/pedro` redirecionou corretamente para login quando acessado sem sessão;
- não foram encontrados logs de nível `error` na janela de 24 horas consultada. Ausência nessa consulta não prova ausência total de erros.

## Onde parou o conserto da conversa da IA

O defeito prioritário observado é uma divergência entre o horário escrito pelo Pedro e o horário estruturado que o sistema executa. Exemplo conceitual: o texto confirma 10h, mas `call_request.starts_at` representa 13h no fuso da operação. Se 13h também for um slot válido, o validador atual aceita a ação, porque valida o campo estruturado contra a agenda, não a equivalência semântica entre o texto visível e esse campo.

### Causa técnica encontrada

O fluxo atual:

- pede uma saída estruturada ao modelo em `src/lib/ai/pedro-turn.ts`;
- carrega fuso, agenda e calls em `src/lib/runtime/worker.ts`;
- normaliza somente detalhes de formato da call;
- impede contradições óbvias com uma call futura;
- verifica se IDs, mídias, projetos e `starts_at` pertencem ao conjunto autorizado;
- não comprova que o dia e a hora escritos em `reply` representam o mesmo instante de `call_request.starts_at`.

A PR #66 adiciona uma proposta de correção com rótulos locais de operação, instrução mais explícita, cópia literal de `starts_at`, validação semântica e retry. Ela também altera o tom da identidade depois de já existir rapport. A direção técnica é válida, mas a branch nasceu antes de mudanças importantes de Inbox, respostas citadas, WhatsApp e Realtime e hoje conflita com a base.

### O que o sucessor deve fazer

1. Abra uma Issue ou registre de outra forma o responsável e o escopo.
2. Crie uma branch nova a partir do `origin/phase/01-foundation` atualizado.
3. Use a PR #66 como material de estudo, não como branch a ser mesclada.
4. Reaplique somente a correção necessária sobre o código atual.
5. Preserve as mudanças integradas pelas PRs #68 a #78, especialmente respostas citadas, identidade do número conectado, notificações e reconciliação/Realtime do Inbox.
6. Adicione testes que provem correspondência entre texto, fuso da operação e `starts_at`, inclusive quando outro slot também seria válido.
7. Se o modelo continuar inconsistente após o retry controlado, não execute a reserva nem envie uma confirmação enganosa; encaminhe para a contingência já prevista.
8. Valide em modo assistido com número controlado antes de qualquer envio autônomo.
9. Registre a mudança, a homologação e qualquer efeito externo no mesmo PR.

A proposta atual não exige migration. Se a reimplementação mudar contrato de banco, interrompa e siga o protocolo serializado de migrations.

## Decisões que não podem ser tomadas silenciosamente

### 1. Duração comunicada versus duração reservada

O acervo legado aprovou comunicar uma conversa de 10 a 15 minutos. Documentos iniciais atuais e o banco também possuem referências a uma reserva maior, incluindo duração e intervalo de segurança. O prompt atual fala em “cerca de 15 minutos”. É preciso decidir e documentar se:

- 15 minutos é apenas a expectativa comunicada ao lead, enquanto a agenda bloqueia uma janela operacional maior; ou
- comunicação e reserva devem usar a mesma duração.

Não mude textos, migrations ou slots até essa diferença ser resolvida pelo responsável de produto.

### 2. “Assistente e corretor” na resposta de identidade

A branch da PR #66 propõe que, depois de rapport e em tom leve, a resposta diga que é assistente do Pedro e também corretor. A decisão integrada em produção confirma apenas a identidade de assistente do Pedro Sifuentes. Definir o papel de corretor é regra de produto e compliance, não um ajuste editorial automático.

### 3. Retorno ao modo production

No retrato, a operação está em assisted e sem allowlist ativa. Ativar production, cadastrar números em allowlist ou liberar reativação autônoma é mudança externa com risco de enviar mensagens reais. Exige autorização explícita do dono, número controlado, confirmação da conexão atual e registro da mudança.

### 4. Destino das PRs antigas

Branches antigas contêm partes já integradas por cherry-pick e partes superadas. Não use contagem “ahead” como prova de trabalho faltante. Compare patch, decisões, base atual e estado vivo; depois encerre, substitua ou reimplemente cada PR conscientemente.

## Primeiro acesso

### Nas primeiras duas horas

1. Siga `AGENTS.md` e `docs/agent/ONBOARDING_PROMPTS.md`.
2. Leia integralmente este handoff, `CURRENT_STATE.md` e `docs/operations/AI_CONVERSATION_RUNBOOK.md`.
3. Execute `git fetch origin` e confirme a branch padrão ao vivo.
4. Confira PRs, Issues, checks e proteção da branch no GitHub.
5. Rode `npx supabase migration list --linked` e confirme o projeto `frslhzwhaooqtivkzdez` sem aplicar nada.
6. Confirme a identidade Vercel com o perfil isolado indicado em `AGENTS.md`; não execute login ou logout.
7. Verifique presença das variáveis locais necessárias sem imprimir valores.
8. Instale dependências e rode lint, testes e build antes de assumir que a máquina reproduz o projeto.

### No primeiro dia

1. Assuma formalmente a Issue da correção conversacional.
2. Reproduza o caso de divergência de horário em teste automatizado.
3. Compare a PR #66 com o código atual e extraia somente a intenção válida.
4. Leve ao responsável de produto as duas decisões de conversa listadas acima.
5. Reimplemente a validação semântica numa branch nova.
6. Faça triagem da execução antiga em `running`, das falhas `openai_tool_arguments_invalid` e da fila de sugestões/threads; não faça limpeza destrutiva.

### Na primeira semana

1. Homologue o fluxo de conversa completo em assisted, incluindo Inbox e Chat com Pedro.
2. Promova a correção com checks verdes e deploy `Ready` confirmado na rota pública.
3. Só então faça um piloto de production se houver autorização explícita.
4. Feche ou substitua PRs obsoletas e crie Issues para dívidas que permanecerem.
5. Proponha proteção mínima da branch padrão e CODEOWNERS/revisão obrigatória.
6. Atualize `CURRENT_STATE.md` para remover duplicações e manter apenas o retrato corrente, preservando os arquivos históricos em `changes/`.

## Transferência de acessos e responsabilidade

O inventário detalhado de serviços, identidades confirmadas, projetos legados e roteiro de retirada está em `docs/agent/ACCESS_AND_SUCCESSION_GUIDE.md`.

O sucessor não está operacionalmente pronto até conseguir, em modo leitura, confirmar:

- acesso ao repositório e às configurações necessárias do GitHub;
- acesso ao projeto Supabase correto e à sequência de migrations;
- acesso ao time/projeto Vercel pelo perfil isolado correto;
- acesso administrativo ao Gril com um usuário do dono e acesso controlado como corretor;
- acesso ao provedor OpenAI e à forma aprovada de substituir/rotacionar a credencial sem conhecê-la em texto;
- acesso à UAZAPI, identificação da instância atual e números de teste controlados;
- acesso a billing, alertas, recuperação de conta e autenticação multifator dos fornecedores;
- contato do responsável de produto que autoriza production, allowlist, campanha, migration e mudança de regra.

Segredos devem ser transferidos pelos mecanismos dos fornecedores, `.env.local`, Supabase Vault ou Vercel. Nunca por commit, Markdown, Issue ou comentário de PR.

## Quando a transição estará concluída

A passagem pode ser considerada concluída quando o novo responsável:

- consegue explicar o objetivo e os limites do Pedro sem depender do desenvolvedor anterior;
- reproduz localmente a base atual com lint, testes e build;
- confirma os três ambientes canônicos em modo leitura;
- assume publicamente o escopo conversacional numa Issue/PR;
- resolve as decisões de produto pendentes com o dono;
- integra e homologa a correção do horário sobre a branch padrão atual;
- deixa `CURRENT_STATE.md`, o registro da mudança e o guia de homologação coerentes com o resultado;
- possui plano explícito para as filas pendentes e PRs obsoletas.

## Por que não foi criada uma skill nova

Este handoff não foi duplicado em uma skill. `AGENTS.md` é carregado automaticamente, o onboarding e os runbooks são versionados com o código, e o próprio acervo histórico orienta a não duplicar regras de produto em skills. Uma skill instalada localmente também não viajaria necessariamente com o repositório ou com outra conta.

Se surgir a necessidade de distribuir automações reutilizáveis entre vários repositórios, crie uma skill separada que consulte estes documentos em vez de copiar seu conteúdo. Para a sucessão atual, documentação versionada é a fonte mais segura e portátil.
