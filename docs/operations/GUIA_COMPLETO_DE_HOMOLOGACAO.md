# Guia mestre de cadastro, configuração e homologação do Gril

> Revisão consolidada em 31/07/2026 a partir dos sete documentos iniciais do Grill Me, do código local, das migrations aplicadas no banco remoto e das validações automáticas. As mudanças desta rodada ainda não foram publicadas na Vercel.

## 1. Objetivo deste guia

Este documento descreve, na ordem correta, tudo o que o dono de uma imobiliária deve fazer para configurar e testar o Gril desde o primeiro cadastro até a conclusão de uma venda.

Ele também registra o resultado da revisão de aderência entre os sete documentos originais e o produto atual. Por isso, cada teste recebe um dos seguintes estados:

- `PRONTO PARA HOMOLOGAÇÃO`: implementação concluída; falta a execução humana deste roteiro.
- `TESTÁVEL`: o fluxo básico existe e pode ser homologado agora.
- `CREDENCIAL REAL`: o fluxo existe, mas só pode ser comprovado com uma conta real do fornecedor.
- `PARCIAL`: parte do fluxo existe, mas o requisito original ainda não está completo.
- `BLOQUEADO`: falta implementação necessária; não é possível aprovar o requisito apenas testando a interface atual.
- `DEPENDÊNCIA EXTERNA`: depende de painel, credencial, decisão jurídica ou infraestrutura fora do código.
- `PÓS-PILOTO`: não impede um piloto controlado, mas continua fazendo parte do produto planejado.

Responsáveis usados neste guia:

- `VOCÊ`: configuração, decisão comercial ou validação humana.
- `CODEX`: correção ou implementação no sistema.
- `SISTEMA`: comportamento automático esperado.
- `FORNECEDOR`: ação nos painéis da Uazapi, Meta, OpenAI, Supabase ou Vercel.

## 2. Conclusão executiva da revisão

O núcleo vertical do MVP está implementado e pronto para homologação: primeiro cadastro com organização/operação/dono, configurações institucionais e operacionais, equipe, credenciais por organização, Pedro nos modos sombra/assistido/produção, qualificação, recomendações, calls, follow-ups, campanhas 20/50/restante, capacidade, integração Uazapi/Meta, privacidade operacional, auditoria e isolamento por organização.

A revisão desta rodada fechou no código e no banco os P0 que tinham contrato suficiente nos sete documentos: portão de produção, pausa emergencial, janelas e ritmo, agrupamento, atrasos, fallback, caixa assistida, cadências curta/longa/no-show, campanhas, preferenciais, comandos de corretor pelo WhatsApp, reagendamento, anexos sensíveis, dead-letter e revogação de sessões.

Isso ainda não equivale a uma homologação aprovada. Permanecem dependências que não podem ser comprovadas sem ação humana ou fornecedor real:

1. cadastrar identidade, regras, chave OpenAI, modelos, conhecimento e credenciais de canal da imobiliária;
2. executar os 100 casos com o modelo real e alcançar 90% geral e 100% nos críticos;
3. provar envio, recebimento, recibos, retries, mídias e comandos operacionais em Uazapi e/ou Meta;
4. definir e executar materialmente correção, anonimização, exclusão e retenção conforme decisão do responsável LGPD;
5. ativar a proteção de senhas vazadas no painel Supabase;
6. realizar restore em destino seguro e medir RPO/RTO;
7. concluir revisão jurídica e homologação humana de UI/acessibilidade.

Portanto, este guia não deve ser interpretado como uma declaração de que tudo já está pronto. Ele é simultaneamente:

- um roteiro de homologação;
- uma lista de pré-requisitos;
- uma matriz de lacunas;
- o critério de aceite para declarar o MVP pronto.

## 3. Ambientes e fontes oficiais

| Item | Valor |
|---|---|
| Aplicação publicada anterior | [gril-lac.vercel.app](https://gril-lac.vercel.app) |
| Versão desta rodada | `localhost` até a aprovação final; não publicada na Vercel |
| Supabase | `frslhzwhaooqtivkzdez` |
| API Supabase | `https://frslhzwhaooqtivkzdez.supabase.co` |
| Painel Supabase | [projeto frslhzwhaooqtivkzdez](https://supabase.com/dashboard/project/frslhzwhaooqtivkzdez) |
| Repositório | [supinovahub/Gril](https://github.com/supinovahub/Gril) |
| Banco de desenvolvimento/homologação | o próprio banco remoto acima, por decisão do projeto |
| Banco staging separado | não existe, por decisão do projeto |

### 3.1 Estado observado no banco remoto antes da homologação

- 5 usuários no Auth;
- 2 organizações de teste;
- 2 donos ativos;
- 2 usuários do Auth sem vínculo ativo;
- 0 integrações ativas;
- 0 conexões WhatsApp ativas;
- 0 perfis de modelo ativos para a nova imobiliária;
- 0 empreendimentos ativos;
- 0 FAQs publicadas;
- 0 campanhas;
- 0 formulários Meta ativos;
- 2 personas publicadas de fixture;
- 100 casos de regressão cadastrados, sendo 52 críticos;
- 7 tabelas operacionais publicadas no Supabase Realtime;
- 8 planos de cadência publicados para as duas operações de teste.

As organizações existentes são dados de teste e não devem ser usadas como a imobiliária real do criador do produto.

## 4. Regras de segurança para a homologação

Antes de começar:

- use somente telefones próprios ou de participantes que aceitaram o teste;
- não importe a base real inteira na primeira execução;
- prepare no máximo 20 contatos sintéticos ou autorizados para a primeira campanha;
- marque nomes e e-mails de teste com um prefixo identificável, como `HML-`;
- não envie documentos financeiros reais durante a homologação;
- não ative o modo autônomo para tráfego real antes de concluir os portões deste guia;
- registre horário, usuário, lead, conexão e resultado de cada teste;
- interrompa imediatamente envios se houver mensagem duplicada, destinatário errado, opt-out ignorado ou resposta inventando preço, disponibilidade, crédito ou rentabilidade.

Como o projeto usa um único banco remoto, todo dado de homologação deve ser tratável e removível sem atingir uma operação real.

## 5. Como registrar evidências

Crie uma pasta por rodada e salve uma linha por cenário:

| Campo | Exemplo |
|---|---|
| ID | `HML-07.03` |
| Data e hora | `31/07/2026 15:40 BRT` |
| Usuário | `dono@teste.com` |
| Organização | `HML Imobiliária` |
| Lead | `HML Lead Ana` |
| Canal | `Uazapi teste 1` |
| Resultado esperado | `opt-out cancela follow-ups` |
| Resultado observado | descrição objetiva |
| Evidência | captura, ID da conversa ou log |
| Estado | aprovado, reprovado ou bloqueado |
| Severidade | P0, P1 ou P2 |

Não use apenas “funcionou”. A evidência deve permitir que outra pessoa repita e confirme o comportamento.

## 6. Portão zero — correções antes do piloto real

Os itens abaixo precisam estar fechados antes do piloto real. As correções de sistema são responsabilidade do `CODEX`; credenciais, decisões comerciais, revisão jurídica e validações com contas reais dependem de `VOCÊ` e dos respectivos fornecedores, conforme discriminado na matriz de lacunas. Enquanto permanecerem abertos, execute somente testes controlados e não declare o MVP integral como pronto.

Legenda: `[x]` implementado no sistema; `[~]` implementado parcialmente ou dependente de regra humana; `[ ]` ainda precisa ser executado na homologação ou em painel externo.

### P0 — bloqueadores

- [x] Criar onboarding autônomo do primeiro dono, com organização, operação padrão e vínculo `owner`.
- [x] Criar configuração institucional: razão/nome, CRECI, CNPJ, endereço, site, Instagram e contato de privacidade.
- [x] Criar configuração operacional: fuso, horários, janelas proativas, limites e número operacional.
- [x] Fortalecer o portão de produção do Pedro para exigir identidade, regras, qualificação, modelo, conhecimento, regressão e saúde real do canal.
- [x] Permitir pausa emergencial por gestor e retomada somente pelo dono.
- [x] Aplicar janela inbound de 05:00 a 23:59 e encerramento após inatividade na virada do dia.
- [x] Aplicar janela padrão de campanha de 08:30 a 20:30, configurável por operação.
- [x] Aplicar no servidor no máximo uma nova abertura proativa por minuto por conexão.
- [x] Implementar agrupamento por 10 segundos, com espera total máxima de 30 segundos.
- [x] Implementar atrasos planejados de 4–12 s, 12–35 s, 25–60 s e alta demanda de 0–5 s.
- [x] Tornar o modo assistido operável: visualizar, aprovar, editar, enviar ou descartar.
- [x] Implementar fallback para modelo secundário em erros transitórios.
- [~] Corrigir cadências curta, longa e no-show. A compra futura com mês exato está catalogada; prazo vago mensal depende de uma decisão de produto sobre a data-base.
- [x] Fechar mapeamento/hash de importação, cinco exemplos, ritmo, deduplicação e revisão 20/50/restante de campanhas.
- [x] Corrigir distribuição preferencial com expiração, fallback, recusa, devolução e comandos pelo WhatsApp.
- [x] Fazer mensagens operacionais de corretores não virarem leads nem consumirem capacidade.
- [x] Criar revisão, legal hold, export snapshot, conclusão/rejeição e evidência para solicitações de privacidade.
- [~] Executar materialmente correção/anonimização/exclusão conforme a política LGPD aprovada pela imobiliária.
- [x] Restringir documentos sensíveis a dono/gestor, salvo liberação explícita e auditada.
- [x] Encaminhar falhas definitivas para dead-letter e alerta.
- [x] Revogar sessões e desabilitar efeitos operacionais na suspensão/remoção de membro.
- [x] Reagendamento confirmado cria a nova call e cancela de forma atômica slots, ofertas e jobs anteriores.
- [ ] Executar os 100 casos com modelo real e obter 90% geral e 100% nos críticos.
- [ ] Fazer testes reais de envio/recebimento, recibos, retries e idempotência em Uazapi e/ou Meta.
- [ ] Ativar proteção contra senhas vazadas no painel Supabase Auth.
- [ ] Comprovar backup/restore compatível com RPO de 15 minutos e RTO de 4 horas em destino seguro.

### P1 — antes de ampliar o piloto

- [ ] Editor guiado de persona, clonagem, amostras de conversas e comparação de versões.
- [ ] Experimentos A/B completos, com alocação, encerramento e promoção de vencedor.
- [~] Conhecimento por empreendimento: fatos e URLs de mídias aprovadas estão operáveis; conflito/expiração e upload/envio binário ainda precisam de ampliação.
- [ ] Upload e envio real de imagens, áudio e documentos aprovados.
- [ ] Permissões granulares, transferência de propriedade e suporte temporário auditado.
- [ ] Ações em massa de CRM, exportação e modelos/versionamento de checklist.
- [x] Realtime na inbox, Central, Kanban, agenda e aceite de call.
- [~] Painel de auditoria implementado; relatórios operacionais/financeiros continuam básicos.
- [ ] Visões específicas `Hoje` e `Meu pipeline` para corretor.

### P2 — acabamento e escala

- [~] Textos de ambiente e navegação por papel corrigidos; refinamento visual final permanece para a homologação humana.
- [ ] Homologação completa de teclado, contraste, leitor de tela e dispositivos móveis.
- [ ] Administração técnica agregada da plataforma.
- [ ] Integrações externas de agenda previstas para etapa posterior.

## 7. Roteiro completo de homologação

Execute as fases na ordem. Não avance quando um resultado crítico estiver reprovado.

## Fase 1 — cadastrar o primeiro dono e criar a operação

Estado atual: `PRONTO PARA HOMOLOGAÇÃO` no código local e no banco remoto.

### 1.1 Cadastro

1. Antes do deploy final, abra `http://localhost:3010/cadastro`; após o deploy, use a URL pública aprovada.
2. Cadastre um e-mail nunca usado no projeto.
3. Use uma senha forte e exclusiva.
4. Confirme o e-mail recebido.
5. Entre em `http://localhost:3010/login`.
6. Confirme que o sistema não permite acesso a outra organização.

Resultado esperado:

- o primeiro usuário inicia um onboarding de criação da própria imobiliária;
- o sistema cria organização, operação padrão e vínculo de dono de forma atômica;
- o dono entra no checklist inicial;
- nenhum dado das organizações de fixture aparece.

Implementação atual:

- Auth e perfil são criados normalmente;
- usuário sem vínculo é encaminhado a `/onboarding`;
- a confirmação cria organização, operação padrão, configurações e vínculo `owner` na mesma transação;
- usuário convidado continua seguindo o fluxo de convite/aprovação e não cria outra organização por acidente.

### 1.2 Recuperação e sessão

1. Saia da conta.
2. Use `Esqueci minha senha`.
3. Abra o link, defina nova senha e entre novamente.
4. Em outro navegador, confirme se sessões antigas foram revogadas.
5. Deixe uma sessão sem atividade pelo prazo definido e valide expiração.
6. Tente alterar credencial sensível e valide reautenticação.

Critério:

- recuperação funciona;
- redefinição revoga sessões anteriores;
- existe opção de sair de todos os dispositivos;
- ações sensíveis pedem reautenticação;
- inatividade por 30 dias encerra a sessão.

Estado: `TESTÁVEL`. Saída e redefinição usam revogação global; suspensão/remoção também encerra sessões. Expiração por inatividade e reautenticação de toda ação sensível devem ser conferidas/configuradas no Supabase Auth.

## Fase 2 — configurar identidade e regras da imobiliária

Estado atual: `PRONTO PARA HOMOLOGAÇÃO` em `/app/configuracoes/organizacao`.

1. Abra as configurações da organização.
2. Cadastre nome comercial e razão social.
3. Cadastre CNPJ e CRECI aplicáveis.
4. Cadastre endereço, site e Instagram.
5. Cadastre contato de privacidade/LGPD.
6. Revise os dados que Pedro poderá mencionar ao lead.
7. Registre fonte e validade nos fatos do empreendimento, na Fase 6.
8. Defina fuso `America/Sao_Paulo`, salvo decisão diferente da operação.
9. Defina horário inbound padrão de 05:00 a 23:59.
10. Defina campanha padrão de 08:30 a 20:30.
11. Confirme capacidade de 10 inbound, 25 campanha e 30 conversas totais.
12. Escolha a conexão operacional usada para falar com corretores.
13. Salve e confira evento de auditoria.

Teste de isolamento:

- entre com um usuário de outra organização;
- tente abrir, editar ou consultar a organização recém-criada;
- o sistema deve negar o acesso sem revelar os dados.

Critério: nenhuma ativação de IA autônoma deve ser possível antes de esta fase estar completa.

## Fase 3 — cadastrar equipe, funções e permissões

Estado atual: `TESTÁVEL` no fluxo básico e `PARCIAL` no contrato completo.

### 3.1 Convite individual

1. Como dono, abra `/app/equipe`.
2. Convide um gestor por e-mail.
3. Abra o link em janela anônima.
4. Cadastre ou entre com o e-mail convidado.
5. Como dono, aprove o usuário.
6. Repita para dois corretores.
7. Tente reutilizar o mesmo convite.

Critério:

- token é de uso único;
- vínculo é criado somente na organização correta;
- gestor e corretor recebem permissões distintas;
- nenhum convidado enxerga dados antes da aprovação.

### 3.2 Link geral

1. Gere um link geral.
2. Abra sem sessão.
3. Cadastre um usuário.
4. Confirme que ele fica pendente de aprovação.
5. Rejeite o pedido e valide que não há acesso.
6. Suspenda e reative outro membro.

Critério planejado:

- link geral não expira por padrão;
- possui proteção contra abuso, limite e auditoria;
- dono escolhe papel e permissões na aprovação.

Estado: `TESTÁVEL`. O link geral pode ser criado sem expiração; limites antiabuso do provedor/Auth ainda devem ser observados no teste.

### 3.3 Permissões e desligamento

Para cada papel, valide:

- dono: visão total, configurações, integrações e propriedade;
- gestor: operação, equipe permitida, alertas e pausa emergencial;
- corretor: próprias calls, pipeline e conversas atribuídas;
- corretor não acessa campanhas, chaves, custos globais ou configuração do Pedro;
- suspensão revoga sessões;
- calls futuras e pipeline são tratados antes da remoção;
- propriedade pode ser transferida com reautenticação e auditoria.

Estado: `PARCIAL`. RLS, navegação por papel, revogação de sessão, desativação de disponibilidade/push e alerta de calls futuras estão implementados. Transferência de propriedade, suporte temporário e toda a granularidade prevista permanecem P1.

## Fase 4 — configurar corretores para receber calls

Estado atual: `PARCIAL`.

Para cada corretor:

1. Entre no próprio perfil em `/app/perfil`.
2. Cadastre WhatsApp válido e único na operação.
3. Abra `/app/agenda`.
4. Cadastre ao menos um período semanal.
5. Cadastre uma exceção de data.
6. Ative `Quero receber calls`.
7. Confirme que o aviso de cadastro incompleto desaparece somente quando os três requisitos estiverem prontos.
8. Desative o recebimento e confirme que calls já aceitas permanecem.
9. Crie férias ou indisponibilidade temporária com início e fim.
10. Confirme reativação automática ao final.

Critério:

- sem WhatsApp, disponibilidade e aceite explícito, o corretor não recebe oferta;
- indisponibilidade bloqueia somente novas ofertas;
- o sistema alerta sobre calls já aceitas no período;
- todas as mudanças são auditadas.

Lacunas P1: edição/exclusão completa das regras de disponibilidade e fluxo guiado de férias/indisponibilidade. Recusa, devolução e redistribuição da call já estão no núcleo.

## Fase 5 — cadastrar OpenAI, modelos e Pedro

Estado atual: `CREDENCIAL REAL` no básico e `PARCIAL` no contrato completo.

### 5.1 Credencial da organização

1. Como dono, abra `/app/pedro`.
2. Cadastre uma chave API da OpenAI pertencente à própria organização.
3. Salve e recarregue a página.
4. Confirme que a chave completa não reaparece na tela, logs ou eventos.
5. Troque a chave e confirme rotação sem expor o valor anterior.
6. Desative a chave e valide que o Pedro não faz chamada externa.

### 5.2 Modelo

1. Selecione um modelo principal aprovado.
2. Defina temperatura, limite de tokens e orçamento.
3. Defina um modelo secundário aprovado.
4. Faça uma chamada normal.
5. Simule timeout, 429 ou 5xx no principal.
6. Confirme retry idempotente e fallback controlado.
7. Confirme que erro permanente não dispara mensagens inventadas.

Estado: `CREDENCIAL REAL`. Modelo principal e secundário podem ser definidos; o worker tenta o fallback uma vez em erro transitório. Comparação avançada de modelos permanece P1.

### 5.3 Persona

1. Crie uma persona de rascunho.
2. Defina identidade, estilo, vocabulário, limites e frases proibidas.
3. Adicione de 10 a 30 conversas de referência autorizadas.
4. Revise a análise gerada sem publicar automaticamente.
5. Compare a nova versão com a publicada.
6. Publique somente após aprovação humana.
7. Valide descarte das amostras após 30 dias.

Estado: `PARCIAL`. Hoje é possível editar/publicar um prompt compilado, mas não existe o construtor guiado, análise de amostras, clonagem ou comparação completa.

### 5.4 Modos de IA

Teste na ordem:

1. `Shadow`: Pedro analisa, mas não responde ao lead.
2. `Assistido`: Pedro sugere; humano revisa, edita e envia.
3. `Autônomo`: Pedro responde e executa somente ações permitidas.
4. `Pausado`: nenhuma nova resposta automática é enviada.

Critério:

- troca de modo é auditada;
- gestor pode pausar em emergência;
- somente dono retoma globalmente;
- produção só é habilitada após todos os portões.

Estado: `PRONTO PARA HOMOLOGAÇÃO`. A inbox permite editar/enviar ou descartar a sugestão assistida. O banco bloqueia produção sem perfil institucional, persona/regras/qualificação, empreendimento válido, modelos, canal saudável e regressão real aprovada.

## Fase 6 — cadastrar conhecimento e empreendimentos

Estado atual: `PARCIAL`.

Prepare cinco empreendimentos fictícios variados. Para cada um, o requisito é:

1. nome e resumo;
2. cidade, região e tipo;
3. preço/faixa e entrada, com fonte e validade;
4. disponibilidade, com fonte e validade;
5. capa e materiais aprovados;
6. diferenciais factuais;
7. restrições e ressalvas;
8. perguntas frequentes específicas;
9. variações de pergunta;
10. fatos que Pedro não pode afirmar.

Depois:

1. abra `/app/conhecimento`;
2. crie os cinco empreendimentos;
3. publique pelo menos dez FAQs globais;
4. publique de três a cinco FAQs por empreendimento;
5. altere um preço e confirme uso imediato nas próximas respostas;
6. expire uma fonte e confirme bloqueio ou alerta;
7. crie dois fatos conflitantes e confirme quarentena até revisão;
8. envie capa, imagem, áudio e PDF de teste;
9. confirme que Pedro usa somente materiais aprovados;
10. arquive um empreendimento e confirme que ele não é mais recomendado.

Estado atual:

- criação de empreendimento, FAQ global, fatos por projeto e catálogo de URLs de mídias aprovadas está operável;
- o contexto do worker inclui fatos e mídias aprovadas do empreendimento;
- upload binário, envio real de mídia, resolução guiada de conflitos e expiração automática ainda estão `PARCIAIS`.

Aprove a recomendação textual apenas depois de confirmar fonte, validade e ausência de invenção. Homologue mídia real somente após conectar o fornecedor.

## Fase 7 — executar simulador e regressão

Estado atual: `TESTÁVEL` com chave real, mas ainda não executado como portão final.

### 7.1 Cenários manuais mínimos

No `/app/simulador`, valide:

1. saudação vaga;
2. pergunta de preço;
3. pergunta de disponibilidade;
4. pedido de rentabilidade garantida;
5. pedido de aprovação de crédito;
6. compra à vista;
7. compra financiada;
8. compra futura sem mês exato;
9. interesse em região sem projeto compatível;
10. pedido de falar com humano;
11. opt-out;
12. número errado;
13. mensagem crítica ou reclamação;
14. tentativa de prompt injection;
15. dado inexistente no conhecimento;
16. agendamento com horário explícito;
17. agendamento ambíguo;
18. cancelamento;
19. reagendamento solicitado pelo lead;
20. áudio, imagem e documento.

Critério: Pedro nunca inventa preço, disponibilidade, rentabilidade, crédito, link ou identidade de corretor.

### 7.2 Dataset de 100 casos

1. Execute os 100 casos sem alterar o dataset durante a rodada.
2. Salve modelo, persona, conhecimento e configuração usados.
3. Revise todas as falhas.
4. Exija pelo menos 90% no conjunto geral.
5. Exija 100% nos 52 casos críticos.
6. Corrija causa, crie nova versão e repita o conjunto inteiro.

Os 100 casos existem no banco, mas o resultado ainda não foi comprovado contra uma credencial/modelo real.

## Fase 8 — conectar WhatsApp não oficial pela Uazapi

Estado atual: `CREDENCIAL REAL`.

1. Abra `/app/configuracoes/whatsapp`.
2. Escolha Uazapi.
3. Cadastre URL/base, token e identificação da instância.
4. Se suportado, crie ou associe a instância.
5. Leia o QR Code e aguarde estado conectado.
6. Defina a finalidade: inbound, campanha e/ou operacional.
7. Copie a URL de webhook gerada pelo Gril para a Uazapi.
8. Faça um envio de teste para telefone autorizado.
9. Responda pelo telefone e confirme criação de evento, mensagem, conversa e lead.
10. Confirme status enviado, entregue, lido e falha quando o provedor disponibilizar.
11. Desconecte e confirme alerta de saúde.
12. Reconecte sem duplicar mensagens.
13. Reenvie o mesmo webhook e confirme idempotência.

Critério: segredos nunca aparecem completos; webhooks sem assinatura/segredo válido são rejeitados; uma mensagem do corretor para aceite operacional não pode virar lead.

## Fase 9 — conectar WhatsApp oficial pela Meta

Estado atual: `CREDENCIAL REAL`.

1. Na Meta, prepare Business, WABA, número, app e token válidos.
2. Em `/app/configuracoes/whatsapp`, cadastre a conexão Meta.
3. Configure o webhook público e o token de verificação.
4. Assine os eventos necessários.
5. Cadastre templates aprovados para conversas fora da janela de atendimento.
6. Faça envio e resposta dentro da janela.
7. Faça abertura fora da janela usando template.
8. Tente texto livre fora da janela e confirme bloqueio.
9. Valide status de entrega e leitura.
10. Revogue o token e confirme alerta/falha segura.
11. Restaure a credencial e repita sem duplicação.

Critério: o sistema diferencia template de sessão, registra recibos e não faz fallback silencioso para uma conexão não autorizada.

## Fase 10 — conectar formulários Meta

Estado atual: `CREDENCIAL REAL` no fluxo básico.

1. Abra `/app/configuracoes/meta`.
2. Cadastre o formulário e o token.
3. Mapeie nome, telefone, e-mail, campanha, empreendimento e campos adicionais.
4. Envie um lead de teste pelo formulário.
5. Confirme deduplicação por telefone normalizado.
6. Confirme criação/atualização de contato, oportunidade e origem.
7. Envie enriquecimento tardio do mesmo lead.
8. Confirme atualização sem criar nova oportunidade indevida.
9. Reenvie o mesmo evento e confirme idempotência.
10. Envie payload inválido e confirme alerta sem perda silenciosa.

## Fase 11 — cadastrar e organizar leads no CRM

Estado atual: `TESTÁVEL` no núcleo e `PARCIAL` nas operações avançadas.

Em `/app/leads`:

1. crie um lead manual;
2. adicione telefone secundário;
3. adicione e-mail;
4. registre origem e consentimento aplicável;
5. adicione co-comprador;
6. crie duplicata com o mesmo telefone;
7. faça merge e valide preservação de histórico;
8. registre qualificação;
9. associe empreendimentos;
10. mova a oportunidade no `/app/kanban`;
11. complete checklists obrigatórios;
12. tente marcar venda sem requisitos;
13. complete os requisitos e marque venda;
14. pesquise o lead em `/app/busca`.

Critério:

- telefone é normalizado e não gera duplicidade silenciosa;
- merge mantém auditoria e relações;
- score e etapa são reproduzíveis;
- dados históricos não mudam retroativamente quando projeto é atualizado;
- corretor enxerga apenas seu pipeline.

Lacunas: ações em massa, exportação, edição/versionamento de templates de checklist e controles detalhados de atribuição ainda faltam.

## Fase 12 — validar a jornada inbound autônoma

Estado atual: `CREDENCIAL REAL`. Ritmo, horários, agrupamento, ações estruturadas e portão estão implementados; esta fase exige OpenAI e WhatsApp reais, além do conhecimento cadastrado por você.

Use um telefone de teste e siga uma conversa completa:

1. envie uma saudação às 10:00;
2. envie três mensagens em menos de 10 segundos;
3. confirme um único agrupamento, sem três respostas independentes;
4. informe região, faixa de preço, entrada, objetivo e prazo aos poucos;
5. confirme atualização estruturada da qualificação;
6. peça opções de imóveis;
7. confirme recomendação somente de projetos compatíveis e publicados;
8. peça material de um projeto;
9. confirme envio somente de mídia aprovada;
10. peça horário de atendimento;
11. confirme sugestões baseadas na disponibilidade real;
12. aceite um horário;
13. confirme reserva sem usar a palavra `confirmado` antes de um corretor aceitar;
14. confirme criação da call e início da distribuição;
15. deixe a conversa sem resposta e valide follow-ups;
16. responda e confirme cancelamento dos follow-ups pendentes;
17. peça humano e confirme pausa imediata do Pedro;
18. encerre atendimento humano e confirme retomada controlada;
19. envie `não quero mais mensagens` e confirme opt-out em todos os fluxos;
20. tente reativar o lead via campanha e confirme bloqueio.

### 12.1 Limites temporais

Valide separadamente:

- inbound antes das 05:00: não responde automaticamente até a janela permitida;
- inbound entre 05:00 e 23:59: processa normalmente;
- conversa iniciada antes da meia-noite: encerra somente após 30 minutos de inatividade;
- resposta curta: atraso de 4–12 s;
- resposta média: 12–35 s;
- resposta longa: 25–60 s;
- alta demanda: atraso reduzido para 0–5 s quando aplicável;
- mensagens consecutivas: agrupamento de 10 s e espera máxima de 30 s.

Essas regras estão aplicadas no servidor. Registre timestamps e IDs dos jobs para provar que o fornecedor real não introduziu comportamento diferente.

## Fase 13 — validar fila, capacidade, sleeping e retries

Estado atual: `PRONTO PARA HOMOLOGAÇÃO` na automação, inclusive dead-letter e alerta de falha definitiva.

1. Crie 10 conversas inbound ativas.
2. Confirme que a 11ª aguarda capacidade.
3. Crie 25 conversas de campanha ativas.
4. Confirme limite combinado de 30.
5. Deixe uma conversa inativa por 5 minutos.
6. Confirme estado `sleeping` e liberação de capacidade.
7. Responda novamente e confirme retomada conforme prioridade.
8. Pausa atendimento humano e confirme que automação não assume.
9. Simule timeout, 429 e 5xx.
10. Confirme retry com backoff e sem efeito duplicado.
11. Simule payload não recuperável.
12. Confirme dead-letter, alerta e possibilidade de replay controlado.

Critério adicional: a mensagem de dead-letter deve ser privada para o runtime; o usuário vê somente o alerta redigido, sem payload sensível.

## Fase 14 — validar follow-ups

Estado atual: `PRONTO PARA HOMOLOGAÇÃO` nas cadências curta, longa e no-show. `PARCIAL` apenas para compra futura com prazo vago.

Cadências obrigatórias:

### Conversa iniciada

- 1 h;
- 4 h;
- 8 h;
- 14 h;
- 22 h;
- após 24 h sem resposta, esteira longa.

### Esteira longa

- dias 0, 1, 2, 4, 7, 10, 14, 21, 30, 45, 60, 75, 90, 105, 120, 135, 150, 160, 170 e 180.

### No-show

- 10 min;
- 2 h;
- 8 h;
- 24 h;
- 48 h;
- depois, esteira longa quando aplicável.

### Compra futura

- 90, 30 e 7 dias antes do mês-alvo;
- acompanhamento mensal quando o prazo for vago.

Observação: o catálogo 90/30/7 existe, mas a data-base e a cadência mensal para prazo vago não foram definidas de modo executável nos sete arquivos. Não aprove esta subfase até registrar essa decisão de produto.

Para cada cadência, confirme que para imediatamente quando o lead:

- responde;
- agenda;
- compra;
- pede opt-out;
- informa número errado;
- entra em atendimento humano.

Confirme também que tentativas vencidas durante pausa são consolidadas em uma só e que cancelamento de call só permite retomar follow-up depois de 24 horas, sem oferecer reagendamento espontaneamente.

## Fase 15 — criar e homologar campanha de reativação

Estado atual: `CREDENCIAL REAL`. Mapeamento, hash, amostras, deduplicação, cinco aberturas, ondas 20/50/restante, revisão entre ondas, janela e ritmo estão implementados no servidor. Comece com CSV sintético.

### 15.1 Importação

Prepare um CSV com:

```csv
nome,telefone,email,empreendimento,origem,observacao
HML Ana,5511999990001,ana-hml@example.com,Projeto A,Base antiga,Compra em 2027
HML Bruno,5511999990002,bruno-hml@example.com,Projeto B,Base antiga,Pediu contato por WhatsApp
```

Depois:

1. abra `/app/campanhas`;
2. crie um rascunho;
3. envie o CSV;
4. mapeie cada coluna;
5. revise uma amostra antes de confirmar;
6. resolva telefone inválido e duplicado;
7. confirme que opt-out é excluído;
8. confirme reconfirmação de dado financeiro vencido;
9. registre hash do arquivo e resultado da importação.

Critério adicional: importar novamente o mesmo hash deve falhar sem duplicar contatos.

### 15.2 Preparação e portão

Antes de liberar, o sistema deve mostrar:

- conexão saudável;
- modelo e chave ativos;
- persona e regras publicadas;
- conhecimento/qualificação válidos;
- janela, ritmo e capacidade;
- cinco exemplos variados de abertura;
- total válido, duplicado, inválido e opt-out;
- estado verde, amarelo ou vermelho;
- aprovação humana registrada.

O portão de produção e os bloqueios da campanha impedem liberação sem os contratos essenciais. A leitura humana do estado verde/amarelo/vermelho continua obrigatória.

### 15.3 Ondas

1. Libere exatamente 20 contatos.
2. Abra e revise as 20 conversas individualmente.
3. Classifique resposta, risco, erro e qualidade.
4. Pause a campanha.
5. Corrija template/regra se necessário.
6. Libere exatamente 50 contatos.
7. Repita a revisão.
8. Libere todo o restante em uma única terceira onda.
9. Confirme no servidor, não apenas na interface, os limites 20/50/restante.
10. Pause, retome, pule contato e exclua contato com motivo.
11. Confirme uma única nova abertura por minuto por conexão.
12. Confirme janela de 08:30 a 20:30.

O servidor calcula 20 na primeira onda, 50 na segunda e todo o restante na terceira; exige revisão da onda anterior e agenda no máximo uma abertura por minuto por conexão. Ações avançadas de exclusão/pular em massa permanecem P1.

### 15.4 Arquivamento

Valide:

- rascunho sem envio pode ser excluído;
- campanha iniciada só pode ser arquivada;
- restaurar visualização não reinicia envios;
- duplicar cria novo rascunho e nova revisão.

## Fase 16 — agendar e distribuir calls

Estado atual: `CREDENCIAL REAL`. Núcleo, preferenciais, fluxo comum, aceite atômico, recusa, devolução, fallback e WhatsApp operacional estão prontos para prova com corretores e canal reais.

### 16.1 Disponibilidade e criação

1. Garanta três corretores comuns e dois preferenciais elegíveis.
2. Cadastre horários recorrentes e exceções.
3. Crie uma call de 20 minutos.
4. Confirme bloqueio total de 30 minutos, incluindo intervalo.
5. Teste início a cada 15 minutos e um horário específico, como 16:20.
6. Confirme armazenamento em UTC e exibição no fuso da operação.

Datas locais são convertidas pelo fuso da operação e armazenadas em UTC. Inclua ao menos um teste com fuso diferente de São Paulo.

### 16.2 Preferenciais

1. Crie uma call com mais de uma hora de antecedência.
2. Confirme oferta simultânea aos preferenciais por 30 minutos.
3. Faça um preferencial recusar.
4. Faça todos recusarem e confirme início antecipado do fluxo comum.
5. Deixe todos em silêncio e confirme fallback ao fim de 30 minutos.

Estado: `CREDENCIAL REAL`. Recusa e silêncio expiram a preferência e iniciam o fluxo comum; valide os timestamps no banco e as mensagens no canal.

### 16.3 Fluxo comum

1. Ofereça ao corretor 1.
2. Sem resposta, confirme corretor 2 após 5 minutos.
3. Sem resposta, confirme corretor 3 após mais 5 minutos.
4. Sem resposta, confirme broadcast a todos após mais 5 minutos.
5. Aceite simultaneamente com dois corretores.
6. Confirme que somente o primeiro commit vence.
7. Confirme aviso de oferta já atribuída para o segundo.
8. Deixe uma hora após broadcast e confirme alerta ao gestor.

### 16.4 WhatsApp operacional

1. Receba a oferta no WhatsApp do corretor.
2. Responda `aceito`.
3. Confirme atribuição atômica e bloqueio da agenda.
4. Responda `recuso` em outra oferta.
5. Confirme fluxo para o próximo elegível.
6. Devolva uma call aceita, com motivo.
7. Confirme redistribuição sem o corretor que devolveu.
8. Confirme que essas mensagens não criam leads.

Estado: `CREDENCIAL REAL`. O webhook reconhece respostas operacionais antes do fluxo de lead, e os comandos também existem na agenda. Valide com o número operacional real.

### 16.5 Comunicação e lembretes

Valide:

- antes do aceite: Pedro diz apenas que separou o horário;
- depois do aceite: Pedro confirma o horário;
- vídeo é padrão quando o lead não escolhe formato;
- corretor adiciona link real;
- T-60: lembrete ao corretor;
- T-30: alerta de ação aos gestores se faltar link;
- T-15: alerta urgente aos gestores habilitados;
- T-10: lead recebe lembrete com link;
- lead também recebe lembrete em T-60;
- chat e telefone do lead liberam ao corretor somente 30 minutos antes;
- Pedro nunca inventa link;
- com menos de uma hora, a situação sobe silenciosamente ao gestor.

### 16.6 Cancelamento, reagendamento e no-show

1. Cancele pelo lead.
2. Confirme retorno para `Em atendimento`.
3. Confirme que Pedro não sugere reagendamento espontâneo.
4. Peça reagendamento e valide nova distribuição.
5. Faça três reagendamentos e confirme alerta ao gestor.
6. Espere 10 minutos após a call.
7. Confirme que somente humano registra no-show.
8. Informe que o corretor não apareceu.
9. Confirme pausa do Pedro e alertas a gestor/corretor.

Ao criar um novo horário confirmado para a mesma oportunidade, o servidor cancela call, hold, ofertas, atribuição e jobs anteriores; a nova call segue a distribuição normal. O terceiro reagendamento cria alerta ao gestor.

## Fase 17 — pós-call, Kanban, proposta e venda

Estado atual: `TESTÁVEL` no básico.

1. Como corretor atribuído, abra o briefing.
2. Confirme que outro corretor não consegue acessar.
3. Registre realizada, no-show, negociação, perdido ou sem resultado.
4. Informe participantes reais da call.
5. Atualize qualificação e próximos passos.
6. Mova no Kanban.
7. Complete checklist da etapa.
8. Registre proposta.
9. Tente avançar sem checklist obrigatório.
10. Registre venda, empreendimento, valor e atribuição.
11. Confirme encerramento de follow-ups e campanhas.
12. Confirme atualização dos relatórios.

Critério: snapshots históricos permanecem inalterados mesmo se preço ou projeto mudar depois.

## Fase 18 — Central, alertas, push e atendimento humano

Estado atual: `PRONTO PARA HOMOLOGAÇÃO` no núcleo, dead-letter, pausa emergencial, retomada exclusiva do dono e atualização Realtime. Transferência avançada de atendimento permanece P1.

1. Abra `/app/central`.
2. Autorize notificações push.
3. Gere alerta de conexão caída.
4. Gere alerta de call sem corretor.
5. Gere alerta de link de vídeo ausente.
6. Gere falha permanente de job.
7. Gere conversa crítica e pedido humano.
8. Assuma a conversa em `/app/inbox/[id]`.
9. Confirme pausa automática do Pedro naquela conversa.
10. Transfira ou encerre atendimento.
11. Confirme retomada somente quando permitida.
12. Pause globalmente como gestor.
13. Tente retomar como gestor e confirme bloqueio.
14. Retome como dono.

Critério adicional: o gestor pode pausar, mas não retomar a pausa global; o dono deve informar motivo para a retomada.

## Fase 19 — privacidade, retenção e documentos sensíveis

Estado atual: `PARCIAL`. Workflow de revisão, export snapshot, legal hold, liberação, conclusão/rejeição, evidência e restrição de anexos sensíveis está pronto; a mutação material dos dados depende da política LGPD aprovada.

1. Abra `/app/configuracoes/privacidade`.
2. Registre pedido de acesso.
3. Exporte os dados do titular.
4. Registre correção e confirme histórico.
5. Registre exclusão/anonymização.
6. Aplique legal hold e confirme que purge não executa.
7. Remova legal hold e processe a fila.
8. Confirme retenção de contatos por 24 meses conforme regra aprovada.
9. Envie documento financeiro de teste.
10. Confirme classificação sensível.
11. Tente acessar como corretor sem liberação.
12. Libere explicitamente e confirme acesso auditado.
13. Reclassifique falso positivo.
14. Execute purge de anexos expirados.

Não marque exclusão/anonimização como concluída apenas por fechar o ticket. Anexe evidência da ação material definida pelo responsável LGPD. Sem essa política, esta fase não pode ser aprovada integralmente.

## Fase 20 — relatórios, custos e auditoria

Estado atual: `PARCIAL`.

Em `/app/relatorios`, valide pelo menos:

- leads por origem;
- tempo de primeira resposta: mediana, p90, 1, 2 e 5 minutos;
- espera em fila e duração de alta demanda;
- qualificados, calls, no-shows, propostas e vendas;
- entregues, lidas, respondidas e convertidas por campanha;
- taxa de autonomia elegível, meta de 95%;
- revisão semanal de 20 conversas;
- precisão por pergunta crítica;
- custo por modelo, canal, campanha e conversa;
- moeda, cotação e projeção em BRL;
- alertas de orçamento em 50%, 80% e 100%;
- atribuição e coorte;
- exportação respeitando permissões.

Depois, abra `/app/configuracoes/auditoria` e confirme:

- ator, organização, ação, alvo, horário e metadados;
- troca de modo, publicação, credencial, permissão, campanha, call, privacidade e exportação;
- usuário comum não consegue alterar eventos;
- dono consegue investigar sem visualizar segredo em texto puro.

O feed de auditoria está disponível para dono/gestor com RLS e direitos de invocador. Os relatórios continuam básicos e ainda não cobrem todo o contrato de orçamento, coorte, custo e exportação.

## Fase 21 — segurança, concorrência e recuperação

Estado atual: `PARCIAL`; automação já cobre boa parte do banco, mas faltam provas operacionais.

### 21.1 Isolamento e RLS

1. Crie duas organizações de homologação.
2. Repita leituras e mutações com dono, gestor e corretor.
3. Confirme isolamento em contatos, conversas, campanhas, credenciais, custos, calls e anexos.
4. Teste acesso direto via API, não apenas ocultação de botão.
5. Confirme ausência de grants desnecessários.

Evidência automática atual:

- 144 de 144 tabelas públicas com RLS;
- zero grants de tabela para `anon`;
- zero `TRUNCATE`, `REFERENCES` ou `TRIGGER` excessivos para `authenticated`;
- 127 testes pgTAP aprovados.

### 21.2 Concorrência e idempotência

Teste simultaneamente:

- dois webhooks iguais;
- dois corretores aceitando a mesma call;
- dois workers consumindo o mesmo job;
- duas tentativas de merge;
- duas liberações da mesma onda;
- resposta humana durante geração do Pedro;
- opt-out durante job pendente.

Critério: um único efeito de negócio e trilha auditável.

### 21.3 Backup e desastre

1. Confirme política de backup/PITR do Supabase.
2. Registre um ponto de recuperação.
3. Faça restore em ambiente seguro.
4. Meça perda máxima de dados.
5. Meça tempo até aplicação e worker saudáveis.
6. Exija RPO máximo de 15 minutos e RTO máximo de 4 horas.

Como não existe staging separado, o exercício não pode sobrescrever o projeto remoto em uso.

## Fase 22 — UI, acessibilidade e compatibilidade

Responsável principal: `VOCÊ`, com correções pelo `CODEX`.

Teste em desktop e celular:

1. cadastro, login e recuperação;
2. navegação por papel;
3. formulários com teclado;
4. foco visível;
5. contraste;
6. mensagens de erro;
7. loading, vazio e indisponível;
8. zoom de 200%;
9. leitor de tela nos fluxos críticos;
10. Firefox, Chrome, Edge e Safari quando disponível;
11. inbox com mensagens longas e anexos;
12. Kanban e agenda em viewport pequeno;
13. confirmação antes de ações irreversíveis.

Não aprove uma tela só porque ela abre. Valide estado vazio, carregamento, sucesso, erro, sem permissão e concorrência.

## 8. Matriz consolidada das lacunas encontradas

| ID | Sev. | Estado revisado | Item | Próximo responsável |
|---|---|---|---|---|
| GAP-001 | P0 | FECHADO NO SISTEMA | onboarding cria organização/operação/dono atomicamente | VOCÊ homologa |
| GAP-002 | P0 | FECHADO NO SISTEMA | configuração institucional e operacional | VOCÊ cadastra/homologa |
| GAP-003 | P0 | FECHADO NO SISTEMA | portão de produção completo e imposto pelo banco | VOCÊ satisfaz os gates reais |
| GAP-004 | P0 | FECHADO NO SISTEMA | gestor pausa e somente dono retoma globalmente | VOCÊ homologa |
| GAP-005 | P0 | FECHADO NO SISTEMA | horários, ritmo, agrupamento e atrasos | VOCÊ homologa com timestamps |
| GAP-006 | P0 | FECHADO NO SISTEMA | caixa assistida com editar/enviar/descartar | VOCÊ homologa |
| GAP-007 | P0 | FECHADO NO SISTEMA | fallback de modelo em erro transitório | VOCÊ testa com OpenAI |
| GAP-008 | P1 | ABERTO | persona guiada, amostras e A/B completos | CODEX após o MVP |
| GAP-009 | P1 | PARCIAL | fatos e catálogo de mídia existem; upload/envio binário e conflito/expiração avançados faltam | CODEX + FORNECEDOR |
| GAP-010 | P0 | PARCIAL | curta, longa e no-show fechadas; compra futura vaga sem data-base | VOCÊ decide regra; CODEX implementa |
| GAP-011 | P0 | FECHADO NO SISTEMA | mapeamento/hash/amostras e portões de campanha | VOCÊ homologa |
| GAP-012 | P0 | FECHADO NO SISTEMA | ondas obrigatórias 20/50/restante | VOCÊ homologa |
| GAP-013 | P0 | FECHADO NO SISTEMA | preferenciais, recusa, expiração e fallback | VOCÊ homologa com canal real |
| GAP-014 | P0 | FECHADO NO SISTEMA | aceite/recusa/devolução por app e WhatsApp | VOCÊ homologa com canal real |
| GAP-015 | P0 | FECHADO NO SISTEMA | nova call cancela slot/ofertas/jobs anteriores e reinicia distribuição | VOCÊ homologa |
| GAP-016 | P1 | FECHADO NO SISTEMA | Realtime nas telas operacionais | VOCÊ homologa |
| GAP-017 | P1 | ABERTO | ações em massa/exportação/checklists avançados | CODEX após o MVP |
| GAP-018 | P0 | PARCIAL/LEGAL | workflow e evidência existem; ação material depende da política LGPD | VOCÊ + RESPONSÁVEL LGPD |
| GAP-019 | P0 | FECHADO NO SISTEMA | anexos sensíveis restritos com liberação auditada | VOCÊ homologa |
| GAP-020 | P0 | FECHADO NO SISTEMA | saída global e suspensão revogam sessões/efeitos operacionais | VOCÊ homologa Auth |
| GAP-021 | P0 | FECHADO NO SISTEMA | dead-letter privada e alerta redigido | VOCÊ homologa falha simulada |
| GAP-022 | P1 | ABERTO | relatórios e custos completos | CODEX após o MVP |
| GAP-023 | P1 | FECHADO NO SISTEMA | painel de auditoria com RLS | VOCÊ homologa |
| GAP-024 | P1 | ABERTO | granularidade total de permissões | CODEX após o MVP |
| GAP-025 | P1 | ABERTO | transferência de dono e suporte temporário | CODEX após o MVP |
| GAP-026 | P0 | DEPENDÊNCIA EXTERNA | proteção contra senha vazada desativada | VOCÊ no Supabase Auth |
| GAP-027 | P0 | DEPENDÊNCIA DE HOMOLOGAÇÃO | 100 casos ainda não rodados com modelo real | VOCÊ; CODEX corrige reprovações |
| GAP-028 | P0 | DEPENDÊNCIA EXTERNA | fornecedores reais ainda não homologados | VOCÊ + FORNECEDOR |
| GAP-029 | P0 | DEPENDÊNCIA EXTERNA | restore/RPO/RTO ainda não comprovados | VOCÊ + Supabase |
| GAP-030 | P1 | FECHADO NO SISTEMA | textos de ambiente corrigidos | VOCÊ homologa |
| GAP-031 | P1 | FECHADO NO SISTEMA | navegação condicionada por papel | VOCÊ homologa |
| GAP-032 | P1 | FECHADO NO SISTEMA | agenda/IA usam fuso da operação | VOCÊ homologa outro fuso |
| GAP-033 | P0 | FECHADO NO SISTEMA | mensagem de staff é tratada antes de lead | VOCÊ homologa com número real |
| GAP-034 | P0 | DEPENDÊNCIA EXTERNA | revisão jurídica de mensagens, consentimento e crédito | VOCÊ + JURÍDICO |

## 9. O que já possui boa evidência automática

Na revisão atual, foram registrados:

- 73 testes Vitest aprovados em 11 arquivos;
- 127 testes pgTAP previamente aprovados e um novo arquivo de fechamento com 17 assertivas de contrato;
- transação de validação pgTAP executada no banco remoto e validação estrutural consolidada aprovada;
- lint aprovado sem erro ou aviso;
- build de produção aprovado, com 34 rotas geradas;
- 46 migrations presentes no banco remoto;
- 144 de 144 tabelas públicas com RLS e zero grants de tabela para `anon`;
- 7 tabelas operacionais no Supabase Realtime;
- bootstrap de operação nova validado em transação com 4 planos e 33 passos de cadência, seguido de rollback;
- advisor de desempenho sem `WARN` ou `ERROR`;
- advisor de segurança sem erro de RLS; resta apenas o `WARN` externo de proteção contra senha vazada;
- 100 casos de regressão cadastrados, sendo 52 críticos;
- migrations desta rodada aplicadas diretamente no projeto `frslhzwhaooqtivkzdez`.

Essas evidências reduzem risco técnico, mas não substituem:

- execução com OpenAI real;
- envio/recebimento real em WhatsApp;
- aceite operacional por corretores;
- teste humano de UI;
- revisão jurídica;
- restore real;
- campanha controlada.

## 10. Critérios finais para declarar o MVP pronto

### Produto

- [ ] dono faz cadastro e cria a própria operação sem intervenção técnica;
- [ ] equipe e permissões respeitam cada papel;
- [ ] Pedro qualifica, recomenda, agenda e programa follow-ups sem inventar fatos;
- [ ] humano consegue pausar, assumir, corrigir e auditar;
- [ ] campanhas obedecem CSV revisado, 20/50/restante, ritmo, janela e opt-out;
- [ ] calls percorrem preferencial, comum, broadcast, aceite, lembretes e resultado;
- [ ] privacidade e retenção são executáveis;
- [ ] relatórios essenciais refletem dados reais.

### Qualidade

- [ ] 100 casos executados no modelo real;
- [ ] pelo menos 90% geral;
- [ ] 100% dos casos críticos;
- [ ] zero duplicidade em webhooks, jobs, waves e aceite;
- [ ] zero vazamento entre organizações;
- [ ] zero segredo em logs/telas;
- [ ] acessibilidade e responsividade aprovadas nos fluxos críticos.

### Operação

- [ ] uma conexão real saudável;
- [ ] recebimento, envio, entrega, leitura e falha comprovados;
- [ ] worker e alertas comprovados;
- [ ] backup/restore e runbook comprovados;
- [ ] orçamento e alertas configurados;
- [ ] revisão jurídica registrada;
- [ ] kill switch testado;
- [ ] piloto inicial limitado a contatos autorizados.

## 11. Sequência prática recomendada

Para evitar retrabalho, siga esta ordem operacional:

1. `VOCÊ` ativa proteção contra senha vazada no Supabase Auth e confirma a política de backup disponível.
2. `VOCÊ + CODEX` conferem variáveis e fazem o deploy final quando você autorizar.
3. `VOCÊ` cadastra a imobiliária pelo fluxo normal.
4. `VOCÊ` cadastra identidade, regras e equipe.
5. `VOCÊ` conecta OpenAI e configura Pedro, incluindo modelo de fallback.
6. `VOCÊ` cadastra cinco empreendimentos e conhecimento validado.
7. `VOCÊ` executa simulador e os 100 casos.
8. `VOCÊ` conecta uma conta WhatsApp de teste.
9. `VOCÊ + CODEX` analisam o smoke E2E com um único lead autorizado.
10. `VOCÊ` testa agenda com corretores reais da própria operação.
11. `VOCÊ` executa campanha sintética de 20 contatos e aprova a primeira onda.
12. `VOCÊ + CODEX` corrigem qualquer reprovação objetiva.
13. `VOCÊ` conclui UI, jurídico, privacidade material e restore seguro.
14. Só então começa o piloto real controlado.

## 12. O que o Codex ainda pode executar antes da homologação

Não há outro P0 puramente técnico, bem definido nos sete arquivos e seguro para executar sozinho que impeça o início da homologação. O próximo passo útil é gerar evidência com sua configuração e seus fornecedores reais.

### Entradas que os sete arquivos deixaram deliberadamente em aberto

Não devem ser inventadas pelo sistema nem pelo Codex:

1. nome definitivo, identidade visual, wireframes e design system final;
2. WABA, Business Manager, número oficial, instância Uazapi e números de atendimento/campanha/staff;
3. textos e aprovações dos templates oficiais da Meta;
4. lista real de empreendimentos, valores, fontes, validade e materiais;
5. FAQs, regras, biografia e exemplos reais da persona;
6. CNPJ, CRECI e dados institucionais autorizados para divulgação;
7. dono, gestores, corretores, preferenciais e exceções de permissão reais;
8. checklists concretos de proposta, documentação, pagamento e venda;
9. orçamento da OpenAI e limites de alerta em 50%, 80% e 100%;
10. política jurídica/LGPD para comunicação, consentimento, crédito, retenção e ação material sobre dados;
11. data-base de compra futura e regra mensal quando o prazo for vago;
12. plano de observabilidade e destino seguro para o teste de restauração.

A sugestão original de staging foi substituída pela decisão explícita deste projeto: usar o banco remoto `frslhzwhaooqtivkzdez`, com dados identificados de homologação, e publicar na Vercel somente na versão final autorizada.

O Codex pode agir novamente assim que existir uma destas entradas:

- decisão da data-base e do comportamento mensal da compra futura com prazo vago;
- política aprovada para correção, anonimização, exclusão e retenção LGPD;
- credencial/instância real para fechar upload e envio binário de imagens, áudios e documentos;
- evidência de reprovação dos 100 casos, do WhatsApp, de UI ou de concorrência;
- autorização e destino seguro para o exercício de restore.

## 13. Fontes revisadas

Este guia consolida:

- `README-Pacote-Tecnico-v1.md`;
- `Arquitetura-Tecnica-v1.md`;
- `Eventos-Filas-e-Automacoes-v1.md`;
- `Backlog-Testes-e-Piloto-v1.md`;
- `Mapa-de-Telas-v1.md`;
- `Modelo-de-Dados-e-Seguranca-v1.md`;
- `Especificacao-do-Produto-v1.md`;
- rotas e ações atuais do aplicativo;
- migrations e testes do repositório;
- estado remoto do Supabase;
- configuração atual da Vercel.

Em caso de conflito, uma alteração de produto deve ser decidida e registrada explicitamente. Não se deve considerar um requisito removido apenas porque ainda não existe na interface.
