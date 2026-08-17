# Guia de homologação do Gril

> Roteiro operacional do MVP, atualizado em 04/08/2026. Consolida os sete documentos iniciais, as decisões do Grill Me posterior e o produto implementado.

## 1. Onde testar

| Item | Referência |
|---|---|
| Aplicação | [gril-lac.vercel.app](https://gril-lac.vercel.app) |
| Supabase | projeto `frslhzwhaooqtivkzdez` |
| GitHub | [supinovahub/Gril](https://github.com/supinovahub/Gril) |
| Pull request | [PR #7](https://github.com/supinovahub/Gril/pull/7) |
| Ambiente | banco remoto único; não existe staging separado |

O código e o banco estão prontos para homologação. OpenAI, WhatsApp, corretores, campanha, revisão visual, decisão jurídica e restore real só podem ser aprovados com fornecedores e pessoas reais.

## 2. Antes de começar

1. use prefixo `HML-` em nomes e registros de teste;
2. use apenas telefones próprios ou autorizados;
3. teste primeiro com um lead e depois com até 20 contatos;
4. não envie documentos financeiros ou dados pessoais reais;
5. mantenha Pedro em `Shadow` ou `Assistido` até aprovar a regressão;
6. registre IDs, horário e evidências dos resultados.

Interrompa o piloto se houver destinatário errado, duplicidade, opt-out ignorado, vazamento entre imobiliárias, segredo exposto ou fato comercial inventado.

## 3. Acesso do administrador geral

O administrador da plataforma usa o mesmo `/login`, mas possui uma conta separada das contas de imobiliárias. Depois do login, é direcionado a `/platform`; não cria imobiliária e não entra no onboarding comum.

Primeiro acesso planejado:

1. abra o convite enviado para `mbritobusiness@gmail.com`;
2. defina sua própria senha;
3. entre em [gril-lac.vercel.app/login](https://gril-lac.vercel.app/login);
4. confirme o redirecionamento para `/platform`;
5. ative notificações push administrativas, se desejar.

No painel da plataforma, valide:

- fila de solicitações de novas imobiliárias;
- aprovação normal sem prazo ou temporária por 30 dias, pedido de correção, recusa e revogação;
- nota interna visível apenas à equipe da plataforma;
- pré-autorização por e-mail por 30 dias;
- convite de outro administrador ou suporte, válido por sete dias;
- suspensão, reativação, arquivamento e restauração de imobiliária;
- suspensão e bloqueio de novas solicitações de usuário;
- concessão contratual de suporte `leitura` ou `completo`;
- entrada explícita no contexto de suporte de uma imobiliária.

Toda ação destrutiva exige digitar exatamente `CONFIRMAR AÇÃO`. Suporte pode consultar e anotar, mas somente administrador decide criação de imobiliária e controles globais.

## 4. Cadastro público e onboarding

Crie contas diferentes para provar os três caminhos. Confirme o e-mail antes de continuar.

### 4.1 Nova imobiliária

1. acesse `/cadastro`;
2. escolha `Criar nova imobiliária`;
3. informe nome, WhatsApp, cidade e UF;
4. CNPJ, CRECI, descrição e número aproximado de corretores são opcionais;
5. envie a solicitação;
6. no `/platform`, aprove, peça correção e reenvie; depois faça a aprovação final;
7. valide separadamente a aprovação normal e a aprovação por 30 dias; confirme que a decisão não falha ao criar a notificação interna; volte à conta solicitante e conclua a criação dentro do prazo escolhido.

Resultado esperado: a conta não cria uma imobiliária diretamente. Após aprovação, cria organização, operação padrão e vínculo de dono em uma única transação. Pré-autorização aprova a solicitação automaticamente, mas o usuário ainda conclui o onboarding.

### 4.2 Gestor de imobiliária existente

1. copie nas configurações da imobiliária o código de oito caracteres;
2. em outra conta, escolha `Entrar como gestor`;
3. informe o código;
4. confira o nome da imobiliária exibido e confirme;
5. envie a solicitação;
6. o dono pede correção, aprova ou recusa;
7. confirme que o solicitante recebe `Acesso aprovado` na Central e que um gestor não consegue aprovar outro gestor.

### 4.3 Corretor de imobiliária existente

Repita o caminho anterior como corretor. Dono ou gestor com `team.manage` pode aprovar e deve escolher ao menos uma operação.

### 4.4 Regras obrigatórias

- código usa oito letras/números, sem `0`, `O`, `1` ou `I`;
- código mostra apenas nome e cidade/UF da imobiliária;
- dono ou gestor autorizado pode copiar, desativar ou rotacionar o código;
- rotação invalida imediatamente o código antigo;
- só pode existir uma solicitação aberta por usuário;
- WhatsApp não pode pertencer a outra conta ou solicitação aberta;
- após recusa, existe espera de sete dias para nova solicitação equivalente;
- convite individual é de uso único, preso ao e-mail e expira em sete dias;
- abrir o convite preserva o retorno durante cadastro, confirmação de e-mail, login e troca de conta;
- o convite aberto mais recentemente fica pendente por no máximo sete dias;
- gestor ou corretor ativo sem WhatsApp fica bloqueado até cadastrar um número válido e único;
- links gerais de convite não são aceitos;
- cancelar solicitação mantém a conta livre para escolher outro caminho.

## 5. Organização, equipe e suporte

### 5.1 Convite individual e WhatsApp obrigatório

1. como dono, crie um convite de gestor; como gestor autorizado, crie um convite de corretor;
2. copie o link e abra-o em janela anônima, sem conta criada;
3. confirme que aparecem somente imobiliária, papel e validade, sem e-mail completo ou operação interna;
4. crie a conta pelo próprio convite, confirme o e-mail e entre sem reabrir manualmente o link; o link deve encerrar apenas a sessão local anterior, autenticar o e-mail convidado e retornar diretamente ao convite, sem abrir a conta que estava logada;
5. na tela final, informe o WhatsApp e clique em `Salvar WhatsApp e aceitar convite`;
6. confirme ativação imediata, sem segunda aprovação, e a notificação `Convite aceito` na Central do dono/criador;
7. repita com uma conta logada no e-mail errado: o aceite deve ser bloqueado, o e-mail convidado deve aparecer mascarado e `Trocar de conta` deve preservar o convite;
8. tente número já utilizado, convite expirado/revogado, segundo vínculo e clique repetido; nenhum deles pode duplicar vínculo ou consumir parcialmente o convite;
9. se o WhatsApp for salvo e o aceite falhar, corrija a causa e tente novamente sem perder o número.

Depois, valide o gate operacional:

- gestor/corretor existente sem WhatsApp vai para `/whatsapp-obrigatorio` e só consegue cadastrar o número ou sair;
- enquanto bloqueado, não vê dados por navegação nem por API direta e não recebe oferta de call;
- dono ou gestor autorizado altera o WhatsApp de um corretor;
- somente dono ou o próprio gestor altera o WhatsApp de um gestor;
- gestor/corretor pode trocar o próprio número, mas não deixá-lo vazio;
- número inválido ou usado por outra conta é recusado sem revelar quem o utiliza;
- toda alteração administrativa registra ator, número anterior, número novo e horário na auditoria.

O link é entregue manualmente pelo dono/gestor; o MVP não envia convite automaticamente por e-mail ou WhatsApp.

### 5.2 Configuração da equipe e suporte

Cadastre identidade, CNPJ/CRECI, endereço, site, Instagram, contato de privacidade, fonte dos dados, fuso, janelas de atendimento e número operacional.

Cadastre um gestor e ao menos dois corretores. Para corretores, configure WhatsApp único, disponibilidade semanal, exceções, férias e `Quero receber calls`.

Valide:

- dono controla propriedade, integrações e configurações;
- gestor só possui as permissões concedidas;
- corretor vê apenas seu pipeline, conversas e calls;
- gestor autorizado pode pausar a operação;
- somente o dono retoma uma pausa global;
- suspensão ou remoção invalida acesso e efeitos operacionais;
- transferência de propriedade exige aceite e deixa auditoria;
- dados de uma segunda imobiliária nunca aparecem, inclusive por API direta.

O suporte externo é concedido pelo administrador da plataforma com base no contrato, não pelo dono na interface. Quando houver concessão ativa, o dono vê apenas a opção de revogá-la imediatamente. O suporte precisa entrar explicitamente no contexto da imobiliária; esse acesso é auditado e não transforma suporte em dono.

## 6. Pedro, OpenAI e conhecimento

Em `/app/pedro`:

1. cadastre a chave OpenAI da própria imobiliária;
2. selecione modelo principal e fallback;
3. configure orçamento e limites;
4. publique persona, regras e critérios de qualificação;
5. confirme que a chave completa nunca reaparece;
6. use `Shadow`, depois `Assistido` e só então `Autônomo`.

Cadastre inicialmente cinco empreendimentos. Para cada um, preencha informações comerciais com fonte e validade, restrições e FAQs. Publique no máximo cinco fotos JPEG/PNG de 5 MB, exatamente uma principal, e um PDF/book de até 20 MB.

Valide:

- uma conversa nova usa a persona **Pedro v3**; conversas antigas mantêm a versão já fixada;
- Pedro responde primeiro a perguntas paralelas, não repete dado conhecido e aceita recusa sem pressionar;
- humor, emoji e abreviações só aparecem depois de rapport e desaparecem diante de irritação;
- fato vencido sai do contexto e gera alerta;
- conflito de fatos exige decisão humana;
- empreendimento arquivado não é recomendado;
- sexta foto ou segundo PDF exige exclusão prévia;
- Pedro recomenda somente imóvel compatível e publicado;
- primeira recomendação envia a foto principal;
- se o lead pedir mais material, Pedro oferece as fotos restantes ou o book;
- somente mídia publicada e aprovada é enviada;
- quando Pedro disser que enviará o book de um empreendimento, somente esse book é enviado; a regra de até três opções nunca completa a lista automaticamente;
- se o projeto, arquivo ou horário escolhido ficar indisponível, nada é substituído: o turno é bloqueado e precisa ser gerado novamente;
- Pedro recebe/transcreve áudio quando suportado, mas não envia áudio no MVP;
- preço, entrada, disponibilidade, rentabilidade e crédito nunca são inventados.

No modo **Assistido**, aprove sem editar uma sugestão que contenha qualificação e depois outra com agendamento ou follow-up. Confirme que a aprovação envia a mensagem e aplica, na mesma ação, os valores do lead, o match, a call, a cadência e a mídia escolhida pelo Pedro. Depois edite outra sugestão antes de enviar: somente o texto editado deve ser enviado, e nenhuma qualificação, call, follow-up ou mídia do plano antigo pode ser aplicada. Se o estado da conversa mudou, o sistema deve rejeitar tudo por conflito, sem envio parcial.

Para reproduzir o incidente de material, peça o book de um empreendimento específico. Confirme no Inbox e no WhatsApp que somente o PDF desse empreendimento foi enviado, mesmo que existam dois ou mais imóveis compatíveis no contexto.

### Contexto antes dos controles

Com o Pedro em `assisted`, valide que palavras isoladas nunca pausam a conversa antes da análise:

1. durante a qualificação, envie `Tenho até 2 milhões pra pagar`; deve surgir uma sugestão que registre orçamento ou continue a qualificação, sem `pending_handoff`;
2. pergunte `como funciona o processo de financiamento?`; Pedro deve responder ou esclarecer, sem escalada jurídica;
3. peça ou envie um book/planta; o arquivo não pode ser tratado como documento sensível apenas pelo tipo;
4. depois, peça explicitamente uma chave Pix para pagar o sinal de uma reserva; Pedro deve analisar a conversa e então escalar como `payment`, registrando evidência e confiança;
5. devolva a mesma conversa ao Pedro mais de uma vez; a mesma execução não pode criar escaladas duplicadas;
6. teste opt-out explícito e confirme supressão, cancelamento de jobs e ausência de novo envio automático.

Na interface do Inbox, uma sugestão pendente aparece como **Enviar resposta**, **Gerar outra resposta** ou **Descartar**. A primeira envia a sugestão aprovada; a segunda pede uma nova sugestão sem falar com o lead; a terceira não envia nada. Para uma resposta escrita pela equipe, use **Enviar resposta humana** e confirme a fila de envio.

## 7. Simulador e regressão

No simulador, abra uma conversa e envie vários turnos no mesmo cenário. Confirme que o Pedro lembra as mensagens anteriores, acumula a qualificação e mantém o resumo sem criar lead, Inbox, WhatsApp, call, follow-up real ou consumo de capacidade. Cubra saudação vaga, preço, disponibilidade, compra à vista/financiada/futura, falta de imóvel compatível, pergunta sem resposta, pedido humano, reclamação, opt-out, número errado, prompt injection, agendamento, cancelamento, reagendamento e recebimento de mídia.

### 6.1 Modos, aprendizado e curadoria

1. em `Pedro`, confirme que o atendimento normal oferece **Desligado**, **Só observa**, **Sugere para revisão** e **Responde automaticamente** (valores técnicos `off`, `shadow`, `assisted` e `production`); `production` só pode ser salvo quando os portões técnicos de produção estiverem aprovados;
2. na seção **Números autorizados para teste**, cadastre o telefone E.164 do lead de teste, coloque o inbound em `production` e confirme que esse número pode receber a resposta automática;
3. coloque o inbound em `assisted` e envie uma mensagem de um contato fora da whitelist; prove no banco/log que ele criou execução/sugestão, mas não enviou mensagem outbound automaticamente;
4. coloque o inbound em `production` e envie uma mensagem de um contato fora da whitelist; prove que ele foi registrado no Inbox, mas não criou execução nem mensagem outbound automática;
5. remova um número da whitelist com uma execução `production` pendente e confirme que o worker bloqueia a execução antes do envio;
6. configure reativação como `production + teste controlado`, cadastre seu telefone E.164 na allowlist e prove que um contato fora dela é bloqueado no servidor;
7. em uma sugestão assisted, edite e aprove: a mensagem deve ser enviada e a correção deve criar um candidato para Lionel;
8. use **Gerar outra resposta**: nada deve ser enviado ao lead e uma nova sugestão deve aparecer usando a orientação;
9. use **Descartar**: nada deve ser enviado nem exibido como sucesso de envio;
10. abra `/app/lionel`, responda ao grill uma pergunta por vez e registre o consenso como candidato; confirme que ele aparece em `Aprendizados`, ainda sem ativação silenciosa;
11. confirme que corretor não vê Lionel nem controles de aprendizado.
12. com uma sugestão `assisted` pendente, abra `/app/chat-pedro`: o tópico do lead deve mostrar a mesma resposta proposta no Inbox, o contexto resumido da análise, a mensagem inbound exata e o link para a conversa;
13. edite a resposta no tópico e aprove: somente o texto editado deve ser enviado, o Inbox deve refletir o resultado e o tópico deve deixar de exigir ação;
14. gere duas sugestões para a mesma conversa: elas devem permanecer no mesmo tópico do lead, sem duplicar tópicos, e a fila só pode ser resolvida depois da última pendência.
15. na fila do Chat com Pedro, use busca, status, prioridade e **Só pendências**; confirme que os filtros alteram a lista sem expor tópicos de outra operação.
16. abra um tópico com pendência e confirme que o painel **Próximo passo** explica que a aprovação é humana e que o lead só é afetado depois da ação explícita.

### 6.2 Chat geral, intervenção humana e corretor

1. abra `/app/chat-pedro`, envie mensagens no tópico geral, selecione uma mensagem anterior com `Responder` e confirme que a resposta fica vinculada;
2. envie uma mensagem diretamente pelo celular conectado enquanto Pedro controla a conversa: o Inbox deve rotular `enviada pelo celular`, Pedro deve parar e criar tópico de alta prioridade;
3. no tópico, teste separadamente `Continuar como humano`, `Devolver ao Pedro` e `Não reconheço o envio`; a última opção deve pausar todo outbound da conexão sem impedir novos inbound;
4. conclua uma call com `iniciar negociação`, `perdido` ou `sem resultado`: o acesso operacional do corretor deve ser revogado, a conversa deve voltar ao dono/gestor em `assisted` e autonomia baixa, e Pedro deve abrir o tópico de próximo passo;
5. durante uma janela ativa do corretor, use `Pedir ajuda ao Pedro`: `/app/assistente-corretor` deve mostrar somente aquele lead e responder de forma consultiva, sem enviar ao WhatsApp;
6. depois do fim/revogação da janela, o corretor não deve mais acessar o tópico nem a conversa;
7. confirme atualização automática, sem F5, e badges separados para Inbox, Chat com Pedro, Lionel e Assistente do corretor.
8. no Lionel, confirme que a fila se identifica como **Fila de curadoria**, o painel **Próximo passo** orienta a responder uma pergunta por vez e o botão de candidato deixa claro que o resultado vai para revisão.
9. com um gestor, confirme que Lionel e a action de registro de candidato seguem a mesma permissão; corretor continua sem acesso.

No Inbox, valide a ordem da lista com uma conversa mais antiga que tenha uma
mensagem inbound não lida, outra com sugestão `assisted` pendente e uma
conversa mais recente sem pendência. As duas conversas com atenção devem ficar
acima da conversa regular; dentro de cada grupo, a atividade mais recente deve
vir primeiro. Abra a conversa antiga e marque-a como lida, depois resolva a
sugestão, e confirme que cada item deixa o grupo de atenção somente quando a
pendência correspondente for resolvida.

Também valide:

- uma nova mensagem só é liberada depois que o turno atual termina;
- uma conversa arquivada sai da lista ativa, permanece legível em **Arquivadas** e não aceita novas mensagens;
- ao restaurar, todo o histórico reaparece e a conversa pode continuar do mesmo estado;
- atualizar a página ou sair e voltar não perde o histórico;
- cenários antigos continuam disponíveis como conversas de um turno.

Depois:

1. congele modelo, persona, conhecimento e configuração;
2. execute os 100 casos cadastrados;
3. revise as falhas sem alterar o dataset durante a rodada;
4. exija pelo menos 90% geral;
5. exija 100% nos 52 casos críticos;
6. após qualquer correção, repita o conjunto completo.

## 8. WhatsApp e formulários Meta

Uma conexão real saudável basta para o piloto. Teste ambos os provedores antes de declarar suporte homologado aos dois.

### Uazapi

- cadastre URL, token e instância;
- conecte por QR Code quando aplicável;
- configure o webhook fornecido pelo Gril;
- teste envio, recebimento, entregue, lido e falha;
- envie uma mensagem pelo celular conectado e confirme que o nome do chat/cliente aparece no Inbox, em vez de `Contato do WhatsApp`;
- repita o teste com uma conversa que já exista como placeholder e confirme que o nome recebido atualiza o contato sem substituir um nome cadastrado manualmente;
- como dono/gestor, abra uma conversa ou lead, use o lápis ao lado do nome, salve uma alteração e confirme que o novo nome aparece no Inbox, no lead e após recarregar a página;
- repita o mesmo webhook e confirme idempotência;
- desconecte e reconecte.

### Meta oficial

- configure Business, WABA, número, app e token;
- cadastre webhook e token de verificação;
- teste texto dentro da janela;
- teste template aprovado fora da janela;
- confirme bloqueio de texto livre fora da janela;
- revogue e restaure o token.

### Formulários Meta

- mapeie nome, telefone, e-mail, campanha e empreendimento;
- envie um lead, repita o evento e envie enriquecimento tardio;
- confirme deduplicação por telefone e rejeição de payload inválido.

Critério comum: webhook inválido é rejeitado; organização arquivada retorna bloqueio definitivo; organização suspensa ainda registra inbound, mas não envia mensagens; retry não duplica lead, mensagem ou oportunidade.

### Reativacao em production

1. em `Pedro`, confirme que o atendimento normal oferece somente `off`, `shadow`
   e `assisted`; `production` nao deve estar disponivel no inbound normal;
2. configure reativacao como `production + teste controlado`, cadastre o telefone
   E.164 do lead de teste e confirme que um contato fora da allowlist e bloqueado;
3. libere a reativacao como `released`, execute uma onda e confirme que a
   conversa recebe `journey = reactivation`;
4. envie uma mensagem inbound normal e confirme que ela permanece inelegivel
   para production, mesmo que exista uma configuracao antiga no banco.

## 9. Jornada vertical principal

Execute com telefone autorizado:

`Lead entra → Pedro qualifica → recomenda → envia material → agenda → distribui → acompanha → humano assume → resultado é registrado`

Confirme:

1. mensagens próximas são agrupadas;
2. região, preço, entrada, objetivo e prazo atualizam a qualificação;
3. somente imóveis publicados e compatíveis são recomendados;
4. foto principal, fotos extras e book seguem a decisão do lead;
5. horários respeitam disponibilidade;
6. se o lead escolher vídeo ou telefone depois do horário, a resposta mantém o mesmo horário, a ação estruturada reaproveita o slot e não surge uma segunda call ativa;
7. Pedro não confirma a call antes do aceite de um corretor;
8. aceite atribui e bloqueia agenda atomicamente;
9. follow-up é criado e cancelado na condição correta;
10. pedido humano pausa Pedro imediatamente;
11. opt-out bloqueia campanha, follow-up e retomada;
12. pós-call, proposta, perda e venda encerram as automações adequadas.

## 10. Volume, campanhas e calls

### Fila e resiliência

- 10 conversas inbound ativas; a 11ª aguarda;
- 25 conversas de campanha e limite total de 30;
- inatividade de cinco minutos leva a `sleeping`;
- backlog volta pela ordem de reserva;
- timeout, 429 e 5xx tentam novamente sem duplicar;
- falha definitiva vai para dead-letter com alerta redigido;
- dois workers não executam o mesmo efeito duas vezes.

### Campanha

1. importe CSV sintético e mapeie colunas;
2. revise amostras, telefones, duplicados e opt-outs;
3. confirme bloqueio do mesmo hash;
4. aprove exemplos de abertura;
5. confirme que cada abertura usa somente o primeiro nome do CSV ou o primeiro nome do CRM como fallback, sem alterar o nome completo do contato;
6. libere a onda de 20 sem revisão individual por contato;
7. confirme no CRM a fila, os opt-outs e os status enfileirados;
8. libere a onda de 50 sem revisão individual por contato;
9. libere o restante;
10. teste pausa, retomada, exclusão e arquivamento.

Para a personalização dinâmica, use uma base sintética com pelo menos três
linhas válidas e colunas de objetivo, investimento anterior, entrada e parcela.
Confirme que:

- a tela de criação mostra três aberturas diferentes para o mesmo objetivo;
- a revisão substitui `{{first_name}}`, `{{objetivo}}`, `{{entrada}}`,
  `{{parcela}}`, `{{orcamento}}` e `{{historico}}` com os dados de cada linha;
- nenhum preview contém `undefined`, `null` ou placeholder aberto;
- os contatos elegíveis de uma mesma onda alternam os IDs de variante e uma
  supressão/opt-out não consome uma posição da rotação;
- o corpo persistido pelo worker é igual ao preview da mesma linha e variante;
- campanhas antigas sem `opening_variants` continuam usando
  `opening_template`.

### Agenda e distribuição

- no cadastro de disponibilidade, selecione vários dias, aplique um período de uma vez e salve a semana padrão;
- edite um período existente, remova-o, crie dois períodos no mesmo dia e confirme que períodos sobrepostos são bloqueados;
- aplique um modelo rápido, confira o resumo de alterações não salvas e confirme que as exceções continuam separadas da semana padrão;
- preferenciais recebem oferta simultânea;
- fluxo comum segue 5/5/5 minutos e depois broadcast;
- slots oferecidos devem ter no mínimo uma hora de antecedência em relação ao momento atual;
- pedido explícito abaixo de uma hora sobe silenciosamente para o gestor, gera o alerta crítico correspondente e não inicia ofertas aos corretores;
- dois aceites simultâneos produzem um vencedor;
- aceite, recusa e devolução funcionam no app e WhatsApp;
- cancelamento/reagendamento anulam holds, ofertas e jobs anteriores;
- somente humano registra no-show;
- terceiro reagendamento alerta o gestor.

Inbox, CRM e agenda devem exibir datas e horários no fuso configurado da operação, nunca no UTC do servidor.

## 11. CRM, privacidade e encerramento

### Workspace operacional unificado

Com dono ou gestor autenticado, valide a arquitetura de navegação antes dos fluxos detalhados:

1. a primeira camada da navegação mostra `Visão geral`, `Conversas`, `Agenda`, `Central` e `Campanhas`, conforme as permissões, sem entradas independentes para Leads ou Kanban;
2. `Gestão`, `Inteligência` e `Administração` ficam recolhidas por padrão, abrem por interação e permanecem abertas quando uma rota interna está ativa;
3. em `Conversas`, alterne entre as visualizações `Conversas` e `Leads` e confirme que filtros, links profundos e ações continuam preservados;
4. na Visão geral, use `Abrir Kanban completo` e confirme que esta é a entrada geral para a visão completa;
5. em `Central`, confirme que a entrada `Precisa agir` mostra apenas registros acionáveis; alterne para `Histórico`, valide a ordem cronológica e verifique que cada página mostra no máximo dez registros reais, sem duplicações técnicas do mesmo evento;
6. confirme que ações de alertas, notificações e escaladas continuam disponíveis no registro correspondente;
7. em Auditoria, avance e volte entre páginas, sempre com no máximo trinta eventos;
8. no Kanban completo, confirme métricas reais, filtros e todas as etapas em uma mesa horizontal; os cards devem abrir o registro completo e a navegação deve voltar somente à Visão geral;
9. em Agenda, Campanhas, Equipe, Base e Simulador, confirme que o resumo inicial corresponde aos registros reais e que formulários e ações existentes continuam disponíveis;
10. em Campanhas, confirme que cada registro apresenta uma ação principal coerente com seu estado e que a criação avança pelas etapas Campanha, Automação, Mensagens e Consentimento; criação e edição não devem mostrar personalidade ou persona do Pedro, mas devem preservar modo, consentimento, importação, ondas, pausa, retomada e arquivamento;
11. em Pedro, use as âncoras de comportamento, persona, modelos e testes; confirme que editores avançados ficam recolhidos e abrem sem perder rascunhos ou ações;
12. em Organização, alterne pelas seções de identidade, operação e segurança e confira se o resumo reflete os valores salvos;
13. em WhatsApp, confira contagens de conexões, credenciais e templates; abra separadamente cada forma de adicionar canal e confirme que nenhuma credencial é exibida para papel sem permissão;
14. em celular, confirme as entradas `Início`, `Conversas`, `Agenda`, `Central` e `Mais`; dentro de `Mais`, confirme os grupos Trabalho, Gestão, Inteligência, Administração e Conta, sem overflow lateral da página.

### Visão geral

Com uma conta de imobiliária autenticada, abra `/app` e valide:

1. o título, o favicon e a paleta continuam iguais aos de produção; a tela não
   mostra “Bom dia, Pedro” nem “Hoje na operação”;
2. a abertura sem parâmetro seleciona 7 dias; os seletores Hoje, 7 dias e 30 dias
   atualizam Leads, Taxa de resposta, Agendamentos e Vendas usando somente dados
   do período, e a conversão aparece como contexto de Vendas;
3. uma taxa sem denominador ou uma consulta indisponível aparece como `N/D`, e
   não como zero inventado;
4. o Kanban se identifica como estoque atual independente do período, segue a
   ordem das etapas ativas, informa a contagem de todas elas e exibe no máximo
   um card por etapa; o link abre o Kanban completo;
5. todas as etapas do resumo se reorganizam sem rolagem horizontal cega e, em
   celular, a página permanece sem overflow lateral;
6. “Precisa de atenção” e “Agenda” mostram no máximo três itens reais e seus
   links abrem a conversa ou o lead correto;
7. modo do Pedro e quantidade de pessoas ativas não aparecem na Visão geral.

### CRM, privacidade e encerramento

Teste criação, deduplicação e merge de leads; co-comprador; origem; Kanban; checklists; proposta; perda; venda; ações em massa com prévia; exportação CSV; arquivamento e restauração manual, com Pedro ou com Pedro e follow-up.

O dono/gestor pode arquivar e restaurar um lead, devolvê-lo ao Pedro e reativar follow-up conforme permissões.

### Limpeza do contexto de homologação

No dashboard, dono ou gestor com `team.manage` pode expandir **Área administrativa** e usar **Limpar contexto de homologação** para remover o contexto de teste da própria imobiliária. O preview considera somente contatos cujo nome começa por `HML-` e limita a operação a 20 contatos.

1. Crie os registros de teste com o prefixo `HML-` e use somente contatos autorizados.
2. Confira no preview contatos, oportunidades, conversas, mensagens, chamadas e jobs pendentes.
3. Não prossiga se houver bloqueio por merge ou referência cruzada com uma oportunidade fora de HML-.
4. Clique na ação, digite exatamente `CONFIRMAR AÇÃO` e confirme.
5. Valide que leads, conversas, mensagens, chamadas, IA, qualificações, jobs, outbox e mídias do contexto foram removidos; configurações, equipe e auditoria permanecem.
6. Consulte `/app/configuracoes/auditoria` e registre o horário, o ator, os IDs e os contadores do recibo.

O suporte externo não executa esta ação. A limpeza é transacional no banco; remoção de arquivos usa a rotina de storage e qualquer pendência deve ser registrada antes de repetir o piloto.

Em privacidade, teste acesso, exportação, correção e anonimização; legal hold; documento sensível com e sem liberação; e trilha de auditoria. A decisão jurídica e o atendimento de LGPD pertencem à imobiliária; o sistema oferece os controles, mas não substitui sua decisão.

Valide ainda Central, push, pausa emergencial, relatórios, custos, carga por corretor, alertas de orçamento em 50/80/100% e auditoria. Em um notebook com altura reduzida e zoom de 100%, confirme que a sidebar rola verticalmente, mantém o rodapé acessível e permite alcançar todos os botões. A revisão visual em desktop/celular e o teste de restore seguro são etapas humanas finais.

## 12. Critério de aprovação

### Produto

- [ ] os três caminhos de cadastro e todas as aprovações funcionam;
- [ ] convite sobrevive ao cadastro/login e ativa somente o e-mail correto com WhatsApp único;
- [ ] gestor/corretor sem WhatsApp fica bloqueado no app, na API e nas ofertas;
- [ ] administrador, suporte, dono, gestor e corretor respeitam seus limites;
- [ ] Pedro qualifica, recomenda, agenda e acompanha sem inventar;
- [ ] humano pausa, assume, corrige e audita;
- [ ] campanha respeita 20/50/restante, janela, ritmo e opt-out;
- [ ] calls percorrem preferenciais, 5/5/5, broadcast, aceite e resultado;
- [ ] CRM, privacidade, relatórios e auditoria refletem dados reais.
- [ ] a Visão geral mostra métricas reais, Kanban na ordem correta e no máximo três itens em atenção e agenda;

### Qualidade e operação

- [ ] 100 casos executados: 90% geral e 100% dos 52 críticos;
- [ ] zero efeito duplicado e zero vazamento entre organizações;
- [ ] zero segredo exposto;
- [ ] ao menos uma conexão real saudável;
- [ ] envio, recebimento, status, worker, retry e dead-letter comprovados;
- [ ] corretores testaram calls reais;
- [ ] campanha de 20 contatos aprovada;
- [ ] kill switch testado;
- [ ] UI, jurídico e restore seguro aprovados.
- [ ] sidebar é utilizável a 100% de zoom em notebook com pouca altura;
- [ ] navegação entre abas e ações mostra resposta visual imediata, sem refresh periódico interrompendo o clique;

## 13. Regras numéricas de referência

| Tema | Regra |
|---|---|
| Janelas | inbound 05:00–23:59; campanha 08:30–20:30 |
| Abertura proativa | máximo 1/min por conexão |
| Agrupamento | 10 s; máximo total 30 s |
| Capacidade | inbound 10; campanha 25; total 30; sleeping 5 min |
| Call | 20 min + intervalo de 10 min |
| Lead time de call | mínimo 1 h; abaixo disso sobe silenciosamente para o gestor |
| Preferenciais | simultâneo por até 30 min |
| Fluxo comum | 5 min + 5 min + 5 min + broadcast |
| Fotos | até 5; exatamente 1 principal; 5 MB; JPEG/PNG |
| Book | 1 PDF de até 20 MB |
| Contatos | retenção padrão 24 meses, configurável |
| Anexo sensível | purge padrão 30 dias; legal hold bloqueia |

Cadência curta: 1 h, 4 h, 8 h, 14 h e 22 h; depois esteira longa até 180 dias. No-show: 10 min, 2 h, 8 h, 24 h e 48 h. Qualquer nova mensagem cancela a sequência incompatível.

## 14. Como registrar um erro

Envie ao Codex: ID do cenário, data/hora, conta, imobiliária, lead/canal, passos exatos, esperado, observado, IDs técnicos e captura quando útil.

- **P0:** segurança, destinatário errado, duplicidade, opt-out ignorado ou invenção crítica; interrompa o piloto;
- **P1:** fluxo principal incorreto; não amplie;
- **P2:** acabamento ou exceção não crítica; registre para correção.

## 15. Fora do MVP

- sincronização com Google Calendar;
- sincronização com Outlook;
- envio de áudio pelo Pedro.

Recebimento e transcrição de áudio permanecem no MVP quando o fornecedor suportar.
