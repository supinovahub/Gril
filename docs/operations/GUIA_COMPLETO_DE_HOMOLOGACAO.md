# Guia de homologação do Gril

> Roteiro operacional do MVP, atualizado em 01/08/2026. Consolida os sete documentos iniciais, as decisões do Grill Me posterior e o produto implementado.

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
7. valide separadamente a aprovação normal e a aprovação por 30 dias; volte à conta solicitante e conclua a criação dentro do prazo escolhido.

Resultado esperado: a conta não cria uma imobiliária diretamente. Após aprovação, cria organização, operação padrão e vínculo de dono em uma única transação. Pré-autorização aprova a solicitação automaticamente, mas o usuário ainda conclui o onboarding.

### 4.2 Gestor de imobiliária existente

1. copie nas configurações da imobiliária o código de oito caracteres;
2. em outra conta, escolha `Entrar como gestor`;
3. informe o código;
4. confira o nome da imobiliária exibido e confirme;
5. envie a solicitação;
6. o dono pede correção, aprova ou recusa;
7. confirme que um gestor não consegue aprovar outro gestor.

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
- links gerais de convite não são aceitos;
- cancelar solicitação mantém a conta livre para escolher outro caminho.

## 5. Organização, equipe e suporte

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

- fato vencido sai do contexto e gera alerta;
- conflito de fatos exige decisão humana;
- empreendimento arquivado não é recomendado;
- sexta foto ou segundo PDF exige exclusão prévia;
- Pedro recomenda somente imóvel compatível e publicado;
- primeira recomendação envia a foto principal;
- se o lead pedir mais material, Pedro oferece as fotos restantes ou o book;
- somente mídia publicada e aprovada é enviada;
- Pedro recebe/transcreve áudio quando suportado, mas não envia áudio no MVP;
- preço, entrada, disponibilidade, rentabilidade e crédito nunca são inventados.

## 7. Simulador e regressão

No simulador, cubra saudação vaga, preço, disponibilidade, compra à vista/financiada/futura, falta de imóvel compatível, pergunta sem resposta, pedido humano, reclamação, opt-out, número errado, prompt injection, agendamento, cancelamento, reagendamento e recebimento de mídia.

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

## 9. Jornada vertical principal

Execute com telefone autorizado:

`Lead entra → Pedro qualifica → recomenda → envia material → agenda → distribui → acompanha → humano assume → resultado é registrado`

Confirme:

1. mensagens próximas são agrupadas;
2. região, preço, entrada, objetivo e prazo atualizam a qualificação;
3. somente imóveis publicados e compatíveis são recomendados;
4. foto principal, fotos extras e book seguem a decisão do lead;
5. horários respeitam disponibilidade;
6. Pedro não confirma a call antes do aceite de um corretor;
7. aceite atribui e bloqueia agenda atomicamente;
8. follow-up é criado e cancelado na condição correta;
9. pedido humano pausa Pedro imediatamente;
10. opt-out bloqueia campanha, follow-up e retomada;
11. pós-call, proposta, perda e venda encerram as automações adequadas.

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
5. libere 20 e revise todas as conversas;
6. libere 50 e revise novamente;
7. libere o restante;
8. teste pausa, retomada, exclusão e arquivamento.

### Agenda e distribuição

- preferenciais recebem oferta simultânea;
- fluxo comum segue 5/5/5 minutos e depois broadcast;
- dois aceites simultâneos produzem um vencedor;
- aceite, recusa e devolução funcionam no app e WhatsApp;
- cancelamento/reagendamento anulam holds, ofertas e jobs anteriores;
- somente humano registra no-show;
- terceiro reagendamento alerta o gestor.

## 11. CRM, privacidade e encerramento

Teste criação, deduplicação e merge de leads; co-comprador; origem; Kanban; checklists; proposta; perda; venda; ações em massa com prévia; exportação CSV; arquivamento e restauração manual, com Pedro ou com Pedro e follow-up.

O dono/gestor pode arquivar e restaurar um lead, devolvê-lo ao Pedro e reativar follow-up conforme permissões.

Em privacidade, teste acesso, exportação, correção e anonimização; legal hold; documento sensível com e sem liberação; e trilha de auditoria. A decisão jurídica e o atendimento de LGPD pertencem à imobiliária; o sistema oferece os controles, mas não substitui sua decisão.

Valide ainda Central, push, pausa emergencial, relatórios, custos, carga por corretor, alertas de orçamento em 50/80/100% e auditoria. A revisão visual em desktop/celular e o teste de restore seguro são etapas humanas finais.

## 12. Critério de aprovação

### Produto

- [ ] os três caminhos de cadastro e todas as aprovações funcionam;
- [ ] administrador, suporte, dono, gestor e corretor respeitam seus limites;
- [ ] Pedro qualifica, recomenda, agenda e acompanha sem inventar;
- [ ] humano pausa, assume, corrige e audita;
- [ ] campanha respeita 20/50/restante, janela, ritmo e opt-out;
- [ ] calls percorrem preferenciais, 5/5/5, broadcast, aceite e resultado;
- [ ] CRM, privacidade, relatórios e auditoria refletem dados reais.

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

## 13. Regras numéricas de referência

| Tema | Regra |
|---|---|
| Janelas | inbound 05:00–23:59; campanha 08:30–20:30 |
| Abertura proativa | máximo 1/min por conexão |
| Agrupamento | 10 s; máximo total 30 s |
| Capacidade | inbound 10; campanha 25; total 30; sleeping 5 min |
| Call | 20 min + intervalo de 10 min |
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
