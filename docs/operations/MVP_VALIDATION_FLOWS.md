# Fluxos de validação do MVP Gril

Automação concluída antes deste roteiro: 70 testes locais, 127 verificações pgTAP no banco remoto, lint e build aprovados. Consulte `AUTOMATED_VALIDATION_EVIDENCE.md`. Este arquivo começa exatamente onde a automação termina: navegador, operação humana e fornecedores reais.

Este roteiro é a homologação manual final. Ele não substitui os testes automatizados; comprova os comportamentos que dependem de navegador, credenciais, provedores e decisões humanas.

## 1. Preparação

- usar uma organização de homologação dentro do banco atual;
- criar um dono, um gestor e dois corretores com números de teste autorizados;
- publicar uma persona, regras, qualificação, dez FAQs globais e ao menos um empreendimento válido;
- cadastrar uma chave OpenAI e uma conexão Uazapi ou Meta pelo autosserviço;
- depois do deploy, configurar o worker, webhook e push conforme `RUNBOOKS.md`;
- manter IA global desligada até os fluxos 1–8 passarem.

Registre em cada fluxo: data, usuário, conexão, lead, resultado, evidência e falha encontrada.

## 2. Acesso, equipe e isolamento

### Fluxo 1 — dono, gestor e corretores

1. Cadastrar o dono e aprová-lo.
2. Convidar gestor e corretores em **Equipe**.
3. Aceitar cada convite e preencher perfil/WhatsApp operacional.
4. Associar os usuários à operação e ajustar permissões.

Esperado: cada papel vê apenas as telas e ações autorizadas; corretor não vê custos, colegas ou leads sem vínculo; toda alteração sensível aparece na auditoria.

### Fluxo 2 — isolamento entre imobiliárias

1. Entrar com usuário da organização A e guardar IDs de leads, calls e campanhas.
2. Entrar com usuário da organização B e tentar localizar esses registros pela interface e por URL direta.

Esperado: nenhum registro, contagem ou detalhe da organização A é exposto à B.

## 3. Credenciais e WhatsApp

### Fluxo 3 — chave OpenAI do dono

1. Em **Pedro**, cadastrar a chave OpenAI.
2. Executar o teste de conexão.
3. Reabrir a tela, rotacionar e depois testar novamente.

Esperado: a chave funciona, nunca é reexibida, somente o final mascarado aparece e cada operação fica auditada.

### Fluxo 4 — Uazapi existente ou criada pelo Gril

1. Conectar instância existente com URL e token, ou criar com URL e `admintoken`.
2. Gerar QR/código de pareamento e concluir a conexão.
3. Após o deploy, configurar o webhook pela própria tela.
4. Enviar e receber uma mensagem de teste.

Esperado: health check saudável, webhook idempotente, entrada única na Inbox e recibos de envio/entrega atualizados.

### Fluxo 5 — Meta oficial

1. Cadastrar WABA, número, token e App Secret.
2. Configurar callback e verify token exibidos pelo Gril.
3. Sincronizar templates e habilitar os aprovados para campanha, follow-up e call.
4. Enviar dentro e fora da janela de 24 horas.

Esperado: texto livre somente dentro da janela; fora dela o template correto é usado; ausência de template suprime o envio e cria alerta persistente.

## 4. Configuração do Pedro

### Fluxo 6 — persona, regras e conhecimento

1. Revisar o pacote inicial do Pedro e criar um rascunho.
2. Publicar como dono.
3. Cadastrar FAQ, fatos institucionais e empreendimento com fonte/validade.
4. Criar um conflito proposital entre duas informações.

Esperado: publicação é versionada; conversas em andamento mantêm o snapshot comportamental; informação vencida ou conflitante não é afirmada como fato.

### Fluxo 7 — simulador e regressão

1. Rodar cenários no **Simulador** sem enviar WhatsApp.
2. Executar a suíte de regressão.
3. Confirmar os 100 casos ativos e revisar os 52 críticos.
4. Criar uma correção e verificar que ela vira sugestão/rascunho, nunca regra publicada automaticamente.

Esperado: simulador não cria lead, call, mensagem real ou reserva de capacidade; publicação continua sendo decisão humana.

## 5. Inbound e autonomia

### Fluxo 8 — atendimento inbound completo

1. Habilitar IA em modo sombra, depois assistido e por último produção.
2. Enviar mensagem de um número novo.
3. Informar gradualmente região, orçamento, entrada, prazo e preferências.
4. Perguntar sobre um fato cadastrado e outro inexistente.

Esperado: contato/oportunidade/conversa são criados uma vez; Pedro pergunta sem inventar, salva somente dados declarados, explica o score e escala quando falta conhecimento aprovado.

### Fluxo 9 — curadoria de imóveis

1. Ter pelo menos três empreendimentos ativos, com preços e entradas diferentes.
2. Informar orçamento e entrada compatíveis com dois deles.
3. Autorizar a curadoria e depois alterar um critério.

Esperado: no máximo dois imóveis compatíveis são recomendados, com snapshots das fontes; nova seleção só ocorre após novo critério/autorização.

### Fluxo 10 — áudio, imagem, documento e mutações

1. Enviar áudio com informação de qualificação.
2. Enviar imagem comum e depois documento potencialmente sensível.
3. Editar/apagar uma mensagem e reagir a uma pergunta binária textual.

Esperado: áudio é transcrito, imagem descrita, documento sensível não vai ao modelo e entra em retenção; edição reprocessa contexto, exclusão invalida a mensagem e reação só vale como “sim” no caso binário permitido.

### Fluxo 11 — controles determinísticos

Testar separadamente: opt-out, número errado, origem contestada, privacidade, pagamento e pergunta direta sobre IA.

Esperado: opt-out confirma uma vez e bloqueia novos envios; número errado confirma e suprime o telefone; privacidade, pagamento e pergunta sobre IA pausam/escalam sem resposta inventada; documentos e dados de pagamento não chegam ao modelo.

### Fluxo 12 — tomada e devolução humana

1. Assumir uma conversa ativa na Inbox.
2. Enviar mensagem humana e aguardar.
3. Devolver ao Pedro com instrução e escopo.

Esperado: enquanto humana, nenhuma resposta automática é enviada; devolução cria novo estado auditado e Pedro respeita a instrução sem alterar fatos protegidos.

## 6. Reativação

### Fluxo 13 — importar e revisar campanha

1. Importar CSV com válidos, duplicados, inválidos e um opt-out.
2. Mapear colunas e registrar declaração de consentimento/origem.
3. Selecionar número, IA, template e revisar cinco exemplos.
4. Confirmar e iniciar.

Esperado: deduplicação e supressão funcionam; primeira onda tem até 20, segunda até 50 e o restante só avança após o gate de revisão.

### Fluxo 14 — ondas e qualidade

1. Concluir a primeira onda e revisar 100%.
2. Marcar uma falha crítica e tentar liberar a próxima.
3. Resolver/reprovar a falha e repetir sem falha crítica.

Esperado: falha crítica pausa a campanha; sem falha, a segunda onda exige revisão mínima de 30%; ondas posteriores exigem 10%, além dos casos obrigatórios de risco.

### Fluxo 15 — resposta e follow-ups

1. Responder a uma reativação e concluir a qualificação.
2. Deixar outra conversa sem resposta.
3. Responder antes de um follow-up agendado.

Esperado: resposta cancela automações conflitantes; short/long follow-up respeitam capacidade, ownership, opt-out, janela Meta e idempotência.

## 7. Agenda, distribuição e pós-call

### Fluxo 16 — disponibilidade e concorrência

1. Cadastrar agenda recorrente e uma exceção.
2. Marcar corretor preferencial e habilitar alertas urgentes.
3. Criar call confirmada pelo lead.
4. Fazer dois corretores aceitarem simultaneamente.

Esperado: bloco 20+10 é reservado; indisponíveis não recebem oferta; primeiro aceite válido vence atomicamente; o outro recebe conflito sem duplicar atribuição.

### Fluxo 17 — videochamada e lembretes

1. Criar call em vídeo e adicionar link HTTPS como gestor ou corretor atribuído.
2. Abrir o link pela Agenda.
3. Validar confirmação e lembretes do lead.
4. Repetir sem link até T-15.

Esperado: link aparece no dashboard e na mensagem/template compatível; sem link próximo da call, alerta crítico persistente é criado; push complementa, mas não substitui o alerta.

### Fluxo 18 — sem corretor, no-show e resultado

1. Deixar uma call sem aceite até a escalada.
2. Registrar no-show em uma call e negociação em outra.
3. Na negociação, informar contexto, próxima ação, prazo e previsão de compra.

Esperado: gestor é alertado sem expor falha ao lead; no-show cria retomada; negociação só é aceita com os campos obrigatórios; ausência de resultado escala em +1 h, +4 h e +24 h.

## 8. CRM, Kanban e venda

### Fluxo 19 — identidade e oportunidade

1. Adicionar segundo telefone e co-comprador.
2. Marcar um telefone incorreto.
3. Mesclar dois contatos sem conversa ativa e tentar repetir com conversa ativa.

Esperado: telefone primário único, participantes preservados, opt-out prevalece na mesclagem e mescla com conversa ativa é bloqueada; histórico permite restauração assistida pela plataforma.

### Fluxo 20 — etapas, checklist e venda

1. Mover oportunidade pelas etapas humanas.
2. Tentar avançar com checklist obrigatório incompleto.
3. Dispensar item como gestor com motivo.
4. Registrar proposta, pagamento orientado por humano e venda com unidade/quantidade.

Esperado: Pedro não move etapas humanas; avanço inválido é recusado; dispensas são auditadas; venda exige dono/gestor, unidade, quantidade e checklist final.

## 9. Operação e resiliência

### Fluxo 21 — Central, capacidade e push

1. Ativar push no navegador.
2. Gerar alerta de ação, crítico e oferta de call.
3. Criar carga até 25 e depois 30 conversas ativas.
4. Reduzir abaixo de 10 e aguardar o ciclo de retomada.

Esperado: alertas persistem na Central; push chega quando permitido; proativas pausam em 25, limite duro é 30, inbound continua em fila e retomada respeita as janelas de segurança.

### Fluxo 22 — falha, retry e idempotência

1. Repetir o mesmo webhook.
2. Simular timeout/429 e interromper o worker após lease.
3. Reexecutar o worker.

Esperado: uma mensagem/efeito por chave; retry usa backoff; lease expirado é recuperado; timeout ambíguo não provoca reenvio cego.

### Fluxo 23 — retenção e privacidade

1. Criar solicitação de privacidade.
2. Anexar mídia comum e documento sensível.
3. Executar purge elegível e conferir banco + Storage.

Esperado: objeto e metadado são removidos de forma auditável; documento sensível respeita o prazo; hold legal impede exclusão quando aplicável.

### Fluxo 24 — relatórios e auditoria

1. Concluir uma campanha, call, negociação e venda de teste.
2. Comparar relatórios com os registros de origem.
3. Revisar auditoria de credencial, IA, call, checklist e venda.

Esperado: contagens não misturam call agendada com realizada; gestor não vê custo sem permissão; corretor vê apenas seus resultados; ações sensíveis guardam ator, instante e entidade.

## 10. Critério para deploy e piloto

O código pode ser publicado quando lint, 70 testes locais, 127 verificações pgTAP, build, migrações, RLS e auditoria técnica estiverem verdes. A operação só pode ser declarada ponta a ponta após os fluxos com Uazapi/Meta/OpenAI reais, push, worker, purge e backup/restauração passarem no ambiente publicado.
